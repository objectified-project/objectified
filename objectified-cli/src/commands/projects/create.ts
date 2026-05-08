import fs from "node:fs";
import path from "node:path";

import { Flags } from "@oclif/core";
import YAML from "yaml";

import { BaseCommand } from "../../base-command.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { localePrefersAsciiTable } from "../../lib/output.js";
import { PROJECT_DOMAIN_CATEGORY_NONE } from "../../lib/projects/domain-categories.js";
import type { Visibility } from "../../lib/projects/project-create-body.js";
import { buildProjectCreateRequest } from "../../lib/projects/project-create-body.js";
import { validateProjectCreateFileJson } from "../../lib/projects/project-create-file-schema.js";
import { normalizeSlugInput, validateProjectSlug } from "../../lib/projects/project-slug.js";

function argvHasFlag(argv: string[], name: string): boolean {
  const prefixed = `--${name}`;
  return argv.some((a) => a === prefixed || a.startsWith(`${prefixed}=`));
}

function loadStructuredFile(filePath: string): unknown {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    throw new ObjectifiedCliError({
      message: `Project file not found: ${abs}`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Pass a path to an existing JSON or YAML file.",
    });
  }
  const raw = fs.readFileSync(abs, "utf8");
  const lower = abs.toLowerCase();
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    try {
      return YAML.parse(raw) as unknown;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ObjectifiedCliError({
        message: `Invalid YAML in project file: ${msg}`,
        exitCode: EXIT_CODES.VALIDATION,
        title: "Validation failed",
        hint: "Fix the file syntax or use .json for JSON.",
      });
    }
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ObjectifiedCliError({
      message: `Invalid JSON in project file: ${msg}`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: "Fix the file syntax or use .yaml / .yml for YAML.",
    });
  }
}

function normalizeDomainCategory(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (t === "" || t === PROJECT_DOMAIN_CATEGORY_NONE) return undefined;
  return t;
}

export default class ProjectsCreate extends BaseCommand {
  static description =
    "Create a project for the active tenant (POST /v1/projects/{tenant_slug}); interactive or CI flags.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --name 'Payments API' --slug payments-api --yes",
    "<%= config.bin %> <%= command.id %> --from-file ./project.yaml --yes",
    "<%= config.bin %> <%= command.id %> --dry-run --name 'Payments API' --slug payments-api",
  ];

  static seeAlso = ["projects list", "projects show", "tenants use", "docs errors"];

  static flags = {
    name: Flags.string({ description: "Project display name." }),
    slug: Flags.string({ description: "URL-safe slug (^[a-z][a-z0-9-]{1,62}$)." }),
    description: Flags.string({ description: "Optional description." }),
    domain: Flags.string({
      description:
        "Domain category id (metadata domainCategory). Validated against GET …/domains when available.",
    }),
    visibility: Flags.string({
      description: "Stored in project metadata: private or public.",
      options: ["private", "public"],
    }),
    "from-file": Flags.string({
      description: "Load fields from JSON or YAML (validated JSON Schema).",
    }),
    yes: Flags.boolean({
      description: "Skip confirmation prompts (CI guard).",
      default: false,
    }),
    "dry-run": Flags.boolean({
      description: "Print the POST JSON body and exit without calling the API.",
      default: false,
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
        hint: "Run `objectified tenants use <slug>` to save a default tenant.",
      });
    }

    const argv = this.normalizedArgv;
    const fromFileRaw =
      typeof this.flags["from-file"] === "string" ? this.flags["from-file"].trim() : "";
    const dryRun = this.flags["dry-run"] === true;
    const yes = this.flags["yes"] === true;
    const quiet = this.flags.quiet === true;

    let name: string | undefined;
    let slug: string | undefined;
    let description: string | undefined;
    let domainCategoryStr: string | undefined;

    let baseMetadata: Record<string, unknown> | undefined;
    let fileVisibility: Visibility | undefined;
    let descriptionFromFileDoc = false;
    let domainFromFileDoc = false;

    if (fromFileRaw !== "") {
      const rawFile = loadStructuredFile(fromFileRaw);
      let validated: ReturnType<typeof validateProjectCreateFileJson>;
      try {
        validated = validateProjectCreateFileJson(rawFile);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new ObjectifiedCliError({
          message: msg,
          exitCode: EXIT_CODES.VALIDATION,
          title: "Validation failed",
          hint: "Fix the project file fields and retry.",
        });
      }
      name = validated.name;
      slug = validated.slug;
      description = validated.description ?? "";
      if (
        validated.description !== undefined &&
        validated.description !== null &&
        typeof validated.description === "string" &&
        validated.description.trim() !== ""
      ) {
        descriptionFromFileDoc = true;
      }
      domainCategoryStr = validated.domainCategory?.trim() || validated.domain?.trim() || "";
      if (normalizeDomainCategory(domainCategoryStr) !== undefined) {
        domainFromFileDoc = true;
      }
      if (validated.visibility !== undefined) {
        fileVisibility = validated.visibility;
      }
      baseMetadata =
        validated.metadata !== undefined && typeof validated.metadata === "object"
          ? { ...validated.metadata }
          : undefined;
    }

    if (typeof this.flags.name === "string") name = this.flags.name;
    if (typeof this.flags.slug === "string") slug = this.flags.slug;
    if (typeof this.flags.description === "string") description = this.flags.description;
    if (typeof this.flags.domain === "string") domainCategoryStr = this.flags.domain;

    const visibilityFlag = this.flags.visibility as Visibility | undefined;

    const missingCore =
      name === undefined || name.trim() === "" || slug === undefined || slug.trim() === "";

    let tty = false;
    if (process.stdin.isTTY && process.stdout.isTTY) {
      tty = true;
    }
    const useInteractive = !quiet && tty && fromFileRaw === "" && missingCore && !dryRun;

    const partialNonInteractive =
      !tty &&
      fromFileRaw === "" &&
      ((name !== undefined && name.trim() !== "" && (slug === undefined || slug.trim() === "")) ||
        (slug !== undefined && slug.trim() !== "" && (name === undefined || name.trim() === "")));

    if (partialNonInteractive) {
      throw new ObjectifiedCliError({
        message:
          "Incomplete non-interactive invocation: pass both --name and --slug, or use `objectified projects create` from a TTY.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Example: `objectified projects create --name 'My API' --slug my-api --yes`",
      });
    }

    if (quiet && missingCore && fromFileRaw === "") {
      throw new ObjectifiedCliError({
        message: "Quiet mode requires explicit fields or --from-file.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Provide --name and --slug (and usually --yes), or drop --quiet.",
      });
    }

    this.ensureAuthenticated();

    const allowlistArr = await this.api.fetchProjectDomainsAllowlist(tenant);
    const allowlist = new Set(allowlistArr);

    let finalName = name ?? "";
    let finalSlug = slug ?? "";
    let finalDescription = description ?? "";
    let finalDomainStr = domainCategoryStr ?? "";
    let visibilityResolved: Visibility = visibilityFlag ?? fileVisibility ?? "private";

    if (useInteractive) {
      const { promptProjectCreateInteractive } =
        await import("../../lib/projects/create-interactive.js");
      const interactiveDraft = await promptProjectCreateInteractive({
        draft: {
          name: finalName,
          slug: finalSlug,
          description: finalDescription,
          domainCategory: finalDomainStr,
          visibility: visibilityFlag,
        },
        domainAllowlist: allowlist,
        skipFinalConfirm: yes,
        promptDescription: !argvHasFlag(argv, "description") && !descriptionFromFileDoc,
        promptDomain: !argvHasFlag(argv, "domain") && !domainFromFileDoc,
        promptVisibility: !argvHasFlag(argv, "visibility") && fileVisibility === undefined,
      });
      finalName = interactiveDraft.name;
      finalSlug = interactiveDraft.slug;
      finalDescription = interactiveDraft.description;
      finalDomainStr = interactiveDraft.domainCategory;
      visibilityResolved = interactiveDraft.visibility;
    } else {
      if (missingCore) {
        throw new ObjectifiedCliError({
          message:
            "Project name and slug are required. Pass --from-file, use interactive mode from a TTY, or provide --name and --slug.",
          exitCode: EXIT_CODES.MISUSE,
          title: "Invalid usage",
        });
      }
      finalName = name ?? "";
      finalSlug = slug ?? "";
      finalDescription = description ?? "";

      if (!dryRun && !yes && tty && fromFileRaw === "") {
        const { confirm } = await import("@inquirer/prompts");
        const ok = await confirm({ message: "Create now?", default: true });
        if (!ok) {
          throw new ObjectifiedCliError({
            message: "Project creation aborted.",
            exitCode: EXIT_CODES.MISUSE,
            title: "Aborted",
          });
        }
      }

      if (!dryRun && !yes && tty && fromFileRaw !== "") {
        const { confirm } = await import("@inquirer/prompts");
        const ok = await confirm({ message: "Create project from file?", default: true });
        if (!ok) {
          throw new ObjectifiedCliError({
            message: "Project creation aborted.",
            exitCode: EXIT_CODES.MISUSE,
            title: "Aborted",
          });
        }
      }

      if (!dryRun && !yes && !tty && fromFileRaw !== "") {
        throw new ObjectifiedCliError({
          message: "When stdin is not a TTY, pass --yes to create from a file.",
          exitCode: EXIT_CODES.MISUSE,
          title: "Invalid usage",
          hint: "Example: `objectified projects create --from-file ./p.json --yes`",
        });
      }

      if (!dryRun && !yes && !tty && fromFileRaw === "") {
        throw new ObjectifiedCliError({
          message: "When stdin is not a TTY, pass --yes to create a project.",
          exitCode: EXIT_CODES.MISUSE,
          title: "Invalid usage",
          hint: "Example: `objectified projects create --name 'My API' --slug my-api --yes`",
        });
      }

      visibilityResolved = visibilityFlag ?? fileVisibility ?? "private";
    }

    const slugCheck = validateProjectSlug(finalSlug);
    if (!slugCheck.ok) {
      throw new ObjectifiedCliError({
        message: slugCheck.message,
        exitCode: EXIT_CODES.VALIDATION,
        title: "Validation failed",
        hint:
          slugCheck.suggestion !== undefined
            ? `Try slug \`${slugCheck.suggestion}\`.`
            : "Slug must match ^[a-z][a-z0-9-]{1,62}$.",
      });
    }
    finalSlug = slugCheck.slug;

    const domainNorm = normalizeDomainCategory(finalDomainStr);
    if (domainNorm !== undefined && !allowlist.has(domainNorm)) {
      throw new ObjectifiedCliError({
        message: `Unknown domain category '${domainNorm}'.`,
        exitCode: EXIT_CODES.VALIDATION,
        title: "Validation failed",
        hint: `Choose one of: ${Array.from(allowlist).sort().join(", ")}`,
      });
    }

    const body = buildProjectCreateRequest({
      name: finalName,
      slug: finalSlug,
      description: finalDescription === "" ? null : finalDescription,
      domainCategory: domainNorm ?? null,
      visibility: visibilityResolved,
      baseMetadata,
    });

    if (dryRun) {
      if (this.context.json) {
        this.output.json(body);
      } else {
        this.output.text(JSON.stringify(body, null, 2));
      }
      return;
    }

    const existing = await this.api.listProjects(tenant);
    const taken = existing.some((p) => normalizeSlugInput(p.slug) === finalSlug);
    if (taken) {
      throw new ObjectifiedCliError({
        message: `Project slug '${finalSlug}' is already in use for this tenant.`,
        exitCode: EXIT_CODES.CONFLICT,
        title: "Conflict",
        hint: "Pick another slug or delete the existing project first.",
      });
    }

    const created = await this.api.createProject(tenant, body);

    if (this.context.json) {
      this.output.json(created);
      return;
    }

    const langAscii = localePrefersAsciiTable(process.env);
    const mark = langAscii ? "[ok]" : "✔";
    const id = created.id;
    const idShort = id.length <= 14 ? id : `${id.slice(0, 8)}…`;
    this.output.text(`${mark} Created project '${created.slug}' (${idShort})`);
  }
}
