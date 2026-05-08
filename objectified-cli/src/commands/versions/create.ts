import fs from "node:fs";
import path from "node:path";

import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import type { VersionCreateRequest } from "../../lib/client.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { localePrefersAsciiTable } from "../../lib/output.js";
import { completionProfileCacheKey, resolveProjectForTenant } from "../../lib/resolve.js";
import {
  notesToCommitFields,
  parseValidSemverVersionId,
  pickLatestPublishedRevision,
  resolveHeadRevisionId,
  versionLineExists,
} from "../../lib/versions/create-helpers.js";
import { resolveVersionForShow } from "../../lib/versions/show-resolve.js";

function argvHasFlag(argv: string[], name: string): boolean {
  const prefixed = `--${name}`;
  return argv.some((a) => a === prefixed || a.startsWith(`${prefixed}=`));
}

function readUtf8File(absPath: string): string {
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ObjectifiedCliError({
      message: `Could not read file: ${msg}`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Check the path for --notes-file or --from-file.",
    });
  }
}

function loadFromFileJson(filePath: string): Record<string, unknown> {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    throw new ObjectifiedCliError({
      message: `Version file not found: ${abs}`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Pass a path to an existing JSON file.",
    });
  }
  const raw = readUtf8File(abs);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ObjectifiedCliError({
      message: `Invalid JSON in version file: ${msg}`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: "Fix the JSON syntax and retry.",
    });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ObjectifiedCliError({
      message: "Version file must contain a JSON object.",
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: "Expected an object shaped like VersionCreateRequest.",
    });
  }
  return parsed as Record<string, unknown>;
}

function pickStr(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string") {
      const t = v.trim();
      if (t !== "") return t;
    }
  }
  return undefined;
}

export default class VersionsCreate extends BaseCommand {
  static description =
    "Create a new draft schema revision (POST /v1/versions/{tenant_slug}/{project_id}); CI-friendly.";

  static examples = [
    "<%= config.bin %> <%= command.id %> payments-api --version 2.2.0-rc.1 --notes 'Adds idempotency keys'",
    "<%= config.bin %> --json <%= command.id %> payments-api --version 1.4.0 --notes-file ./CHANGELOG.md",
    "<%= config.bin %> <%= command.id %> payments-api --version 2.0.0 --base v1.9.0",
    "<%= config.bin %> <%= command.id %> payments-api --from-file ./version-create.json",
  ];

  static seeAlso = ["versions list", "versions show", "versions publish", "projects show", "docs errors"];

  static args = {
    project: Args.string({
      description: "Project slug or UUID (uuid-shaped refs resolve as id first)",
      required: true,
    }),
  };

  static flags = {
    version: Flags.string({
      description: "Semantic version for the new draft (required unless set in --from-file).",
    }),
    notes: Flags.string({
      description: "Release notes (markdown). First line is also used as the short revision note.",
    }),
    "notes-file": Flags.string({
      description: "Read release notes as UTF-8 markdown from a file (mutually exclusive with --notes).",
    }),
    base: Flags.string({
      description:
        "Copy schema from this semver, revision UUID, or tag (default: latest published revision, if any).",
    }),
    branch: Flags.string({
      description: "Named branch to advance when the project has multiple version branches.",
    }),
    draft: Flags.boolean({
      description:
        "Create a draft revision (default). Publishing via --no-draft is not supported here — use `versions publish` when available.",
      default: true,
      allowNo: true,
    }),
    "from-file": Flags.string({
      description:
        "Merge fields from a JSON object (VersionCreateRequest-shaped). CLI flags override file values where both are set.",
    }),
  };

  async run(): Promise<void> {
    const tenant = this.context.tenantSlug;
    if (tenant === undefined || tenant === "") {
      throw new ObjectifiedCliError({
        message:
          "Tenant slug is required for this command. Pass --tenant, set OBJECTIFIED_TENANT, or configure tenant_slug for your profile.",
        exitCode: EXIT_CODES.CONFIG,
        title: "Configuration error",
        hint: "Run `objectified tenants use <slug>` to save a default tenant, or `objectified tenants list` to see accessible tenants.",
      });
    }

    if (this.flags.draft === false) {
      throw new ObjectifiedCliError({
        message: "Refusing to create a non-draft revision from the CLI.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Draft creation is required here; use `objectified versions publish` when that command is available.",
      });
    }

    const argv = this.normalizedArgv;
    const hasNotes = typeof this.flags.notes === "string" && this.flags.notes !== "";
    const notesFileRaw =
      typeof this.flags["notes-file"] === "string" ? this.flags["notes-file"].trim() : "";
    const hasNotesFile = notesFileRaw !== "";

    if (hasNotes && hasNotesFile) {
      throw new ObjectifiedCliError({
        message: "Cannot use --notes together with --notes-file.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Choose one source for release notes.",
      });
    }
    if (hasNotesFile && argvHasFlag(argv, "notes")) {
      throw new ObjectifiedCliError({
        message: "Cannot use --notes together with --notes-file.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Choose one source for release notes.",
      });
    }

    const fromFileRaw =
      typeof this.flags["from-file"] === "string" ? this.flags["from-file"].trim() : "";
    let fileDoc: Record<string, unknown> | undefined;
    if (fromFileRaw !== "") {
      fileDoc = loadFromFileJson(fromFileRaw);
    }

    const versionFlag = typeof this.flags.version === "string" ? this.flags.version.trim() : "";
    const versionFromFile = fileDoc !== undefined ? pickStr(fileDoc, ["version_id", "versionId"]) : undefined;
    const versionRaw = versionFlag !== "" ? versionFlag : versionFromFile ?? "";
    if (versionRaw === "") {
      throw new ObjectifiedCliError({
        message: "A semantic version is required.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Pass --version <semver> or include version_id in --from-file.",
      });
    }
    const normalizedVersionId = parseValidSemverVersionId(versionRaw);

    let notesText: string | undefined;
    if (hasNotes) {
      notesText = this.flags.notes as string;
    } else if (hasNotesFile) {
      const abs = path.resolve(process.cwd(), notesFileRaw);
      notesText = readUtf8File(abs);
    } else if (fileDoc !== undefined) {
      const cl = pickStr(fileDoc, ["changelog", "change_log", "changeLog"]);
      const sm = pickStr(fileDoc, ["shortMessage", "short_message", "description"]);
      if (cl !== undefined) notesText = cl;
      else if (sm !== undefined) notesText = sm;
    }

    const { shortMessage, changelog } =
      notesText !== undefined ? notesToCommitFields(notesText) : { shortMessage: null, changelog: null };

    const fileShort =
      fileDoc !== undefined
        ? pickStr(fileDoc, ["shortMessage", "short_message", "description"])
        : undefined;
    const fileChangelog =
      fileDoc !== undefined ? pickStr(fileDoc, ["changelog", "change_log", "changeLog"]) : undefined;

    let resolvedShort = shortMessage ?? fileShort ?? null;
    const resolvedChangelog = changelog ?? fileChangelog ?? null;
    if (resolvedShort === null && resolvedChangelog !== null) {
      resolvedShort = notesToCommitFields(resolvedChangelog).shortMessage;
    }

    const baseFlag = typeof this.flags.base === "string" ? this.flags.base.trim() : "";
    const branchFlag = typeof this.flags.branch === "string" ? this.flags.branch.trim() : "";
    const branchFromFile =
      fileDoc !== undefined ? pickStr(fileDoc, ["branchName", "branch_name"]) : undefined;
    const branchNameMerged = branchFlag !== "" ? branchFlag : branchFromFile ?? undefined;

    const authorFromFile = fileDoc !== undefined ? pickStr(fileDoc, ["author", "commit_author"]) : undefined;
    const messageFromFile = fileDoc !== undefined ? pickStr(fileDoc, ["message", "commit_message"]) : undefined;
    const externalRefFromFile =
      fileDoc !== undefined ? pickStr(fileDoc, ["externalRef", "external_ref"]) : undefined;
    const bumpStrategyFromFile =
      fileDoc !== undefined ? pickStr(fileDoc, ["bump_strategy", "bumpStrategy"]) : undefined;

    const rawProjectArg = this.commandArgs.project;
    const projectArg = typeof rawProjectArg === "string" ? rawProjectArg : "";

    this.ensureAuthenticated();

    const profileKey = completionProfileCacheKey({
      baseUrl: this.context.baseUrl,
      profile: this.context.profile,
      tenantSlug: tenant,
    });

    const project = await resolveProjectForTenant(this.api, tenant, projectArg, profileKey);

    const [versions, tags] = await Promise.all([
      this.api.listVersions(tenant, project.id),
      this.api.listVersionTags(tenant, project.id),
    ]);

    if (versionLineExists(versions, normalizedVersionId)) {
      throw new ObjectifiedCliError({
        message: `A schema revision with version '${normalizedVersionId}' already exists in project '${project.slug}'.`,
        exitCode: EXIT_CODES.CONFLICT,
        title: "Conflict",
        hint: "Pick a new semver, or remove/rename the existing revision if your workflow allows it.",
      });
    }

    const headId = resolveHeadRevisionId(versions);
    if (headId === undefined) {
      throw new ObjectifiedCliError({
        message: `Project '${project.slug}' has no existing revisions, so a draft cannot be created yet.`,
        exitCode: EXIT_CODES.NOT_FOUND,
        title: "Not found",
        hint: "Create the initial revision first (for example in the UI), then retry this command.",
      });
    }
    const baseRevisionId = headId;

    let sourceVersionId: string | undefined;
    if (baseFlag !== "") {
      const resolved = await resolveVersionForShow({
        api: this.api,
        tenantSlug: tenant,
        projectId: project.id,
        rawRef: baseFlag,
        tags,
      });
      sourceVersionId = resolved.version.id;
    } else {
      const pub = pickLatestPublishedRevision(versions);
      if (pub !== undefined) {
        sourceVersionId = pub.id;
      }
    }

    const fileSource = fileDoc !== undefined ? pickStr(fileDoc, ["source_version_id", "sourceVersionId"]) : undefined;
    if (fileSource !== undefined && baseFlag === "") {
      sourceVersionId = fileSource;
    }

    let overridePublishedImmutability: boolean | undefined;
    let overrideReason: string | null | undefined;
    if (fileDoc !== undefined) {
      if (typeof fileDoc.overridePublishedImmutability === "boolean") {
        overridePublishedImmutability = fileDoc.overridePublishedImmutability;
      } else if (typeof fileDoc.override_published_immutability === "boolean") {
        overridePublishedImmutability = fileDoc.override_published_immutability;
      }
      overrideReason = pickStr(fileDoc, ["overrideReason", "override_reason"]) ?? null;
    }

    const body: VersionCreateRequest = {
      version_id: normalizedVersionId,
      baseRevisionId,
      branchName: branchNameMerged ?? null,
      source_version_id: sourceVersionId ?? null,
      shortMessage: resolvedShort,
      changelog: resolvedChangelog,
      author: authorFromFile ?? null,
      message: messageFromFile ?? null,
      externalRef: externalRefFromFile ?? null,
      bump_strategy: bumpStrategyFromFile ?? null,
      ...(overridePublishedImmutability !== undefined
        ? { overridePublishedImmutability, overrideReason: overrideReason ?? null }
        : {}),
    };

    let created;
    try {
      created = await this.api.createVersion(tenant, project.id, body);
    } catch (e) {
      if (e instanceof ObjectifiedCliError && e.exitCode === EXIT_CODES.CONFLICT) {
        const msg = e.message.toLowerCase();
        if (msg.includes("already exists") || msg.includes("version with id")) {
          throw new ObjectifiedCliError({
            message: e.message,
            exitCode: EXIT_CODES.CONFLICT,
            title: e.title ?? "Conflict",
            hint:
              "That version label is taken on the server. Choose a different --version or inspect `objectified versions list`.",
            requestId: e.requestId,
            retriesAttempted: e.retriesAttempted,
          });
        }
      }
      throw e;
    }

    if (this.context.json) {
      this.output.json(created);
      return;
    }

    const langAscii = localePrefersAsciiTable(process.env);
    const mark = langAscii ? "[ok]" : "✔";
    const label = created.version_id;
    this.output.text(`${mark} Created draft revision '${label}' (${created.id.slice(0, 8)}…)`);
  }
}
