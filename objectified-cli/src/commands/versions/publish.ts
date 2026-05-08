import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import type {
  CompatibilityCheckResponse,
  VersionPublishChangeReportPreviewOut,
  VersionPublishRequest,
} from "../../lib/client.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { chalkForContext, localePrefersAsciiTable, stableDeepSort } from "../../lib/output.js";
import { completionProfileCacheKey, resolveProjectForTenant } from "../../lib/resolve.js";
import { buildPublishedSpecUrls, trimTrailingSlash } from "../../lib/versions/show-format.js";
import { resolveVersionForShow } from "../../lib/versions/show-resolve.js";

function webRootFromApiBase(baseUrl: string): string {
  try {
    const u = new URL(trimTrailingSlash(baseUrl));
    const stripped = u.pathname.replace(/\/?v1\/?$/, "");
    u.pathname = stripped === "" ? "/" : stripped;
    return trimTrailingSlash(u.toString());
  } catch {
    return trimTrailingSlash(baseUrl);
  }
}

function changeReportWebUrl(opts: {
  baseUrl: string;
  tenantSlug: string;
  projectSlug: string;
  fromLabel: string;
  toLabel: string;
}): string {
  const root = webRootFromApiBase(opts.baseUrl);
  const t = encodeURIComponent(opts.tenantSlug);
  const p = encodeURIComponent(opts.projectSlug);
  const a = encodeURIComponent(opts.fromLabel);
  const b = encodeURIComponent(opts.toLabel);
  return `${root}/${t}/${p}/changes/${a}...${b}`;
}

function countClassesMissingDescriptions(classes: { description?: string | null }[]): number {
  let n = 0;
  for (const c of classes) {
    const d = c.description;
    if ((typeof d === "string" ? d : "").trim() === "") n++;
  }
  return n;
}

export default class VersionsPublish extends BaseCommand {
  static description =
    "Publish a draft schema revision (POST …/{record_id}/publish); runs pre-publish checks unless skipped (#3212).";

  static examples = [
    "<%= config.bin %> <%= command.id %> payments-api v2.1.0",
    "<%= config.bin %> --json <%= command.id %> payments-api 2.1.0",
    "<%= config.bin %> <%= command.id %> payments-api v2.1.0 --allow-breaking",
    "<%= config.bin %> <%= command.id %> payments-api v2.1.0 --update-tag latest --message 'Ship refunds'",
    "<%= config.bin %> <%= command.id %> payments-api v2.1.0 --skip-checks --yes",
  ];

  static seeAlso = ["versions create", "versions list", "versions show", "docs errors"];

  static args = {
    project: Args.string({
      description: "Project slug or UUID (uuid-shaped refs resolve as id first)",
      required: true,
    }),
    version: Args.string({
      description: "Draft semver (`v` optional), revision UUID, or tag resolving to a draft",
      required: true,
    }),
  };

  static flags = {
    "allow-breaking": Flags.boolean({
      description:
        "Allow publish when POST …/compatibility reports breaking changes versus the published baseline.",
      default: false,
    }),
    "skip-checks": Flags.boolean({
      description:
        "Bypass client-side pre-publish checks and send skipPublishChecks to the API (emergency only).",
      default: false,
    }),
    "update-tag": Flags.string({
      description:
        "After a successful publish, move this tag name to the published revision (create if missing).",
    }),
    message: Flags.string({
      char: "m",
      description: "Publish short message stored as revision note (maps to shortMessage on publish).",
    }),
    yes: Flags.boolean({
      description: "Acknowledge destructive/skip-checks flows non-interactively (required with --skip-checks).",
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
        hint: "Run `objectified tenants use <slug>` to save a default tenant, or `objectified tenants list` to see accessible tenants.",
      });
    }

    const rawProjectArg = this.commandArgs.project;
    const projectArg = typeof rawProjectArg === "string" ? rawProjectArg : "";
    const rawVersionArg = this.commandArgs.version;
    const versionArg = typeof rawVersionArg === "string" ? rawVersionArg : "";

    const allowBreaking = this.flags["allow-breaking"] === true;
    const skipChecks = this.flags["skip-checks"] === true;
    const yes = this.flags.yes === true;
    const updateTagRaw = this.flags["update-tag"];
    const updateTagName =
      typeof updateTagRaw === "string" && updateTagRaw.trim() !== ""
        ? updateTagRaw.trim()
        : undefined;
    const messageRaw = this.flags.message;
    const publishMessage =
      typeof messageRaw === "string" && messageRaw.trim() !== "" ? messageRaw.trim() : undefined;

    if (skipChecks && !yes) {
      throw new ObjectifiedCliError({
        message: "--skip-checks requires --yes so the emergency bypass is explicit.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Missing flag",
        hint: "Remove --skip-checks or pass --yes after reviewing the risk.",
      });
    }

    this.ensureAuthenticated();

    const profileKey = completionProfileCacheKey({
      baseUrl: this.context.baseUrl,
      profile: this.context.profile,
      tenantSlug: tenant,
    });

    const project = await resolveProjectForTenant(this.api, tenant, projectArg, profileKey);

    const tags = await this.api.listVersionTags(tenant, project.id);

    const { version: resolved } = await resolveVersionForShow({
      api: this.api,
      tenantSlug: tenant,
      projectId: project.id,
      rawRef: versionArg,
      tags,
    });

    if (resolved.published === true) {
      throw new ObjectifiedCliError({
        message: `Version '${resolved.version_id}' is already published.`,
        exitCode: EXIT_CODES.CONFLICT,
        title: "Conflict",
        hint: "Pick a draft revision from `objectified versions list <project> --state draft`.",
      });
    }

    const c = chalkForContext(this.context.color);
    const langAscii = localePrefersAsciiTable(process.env);
    const mark = langAscii ? "[ok]" : "✔";

    if (skipChecks) {
      const lines = [
        "",
        "══════════════════════════════════════════════════════════════════════",
        "  WARNING: --skip-checks is enabled. Schema, documentation, and",
        "  compatibility gates are bypassed on the client and server.",
        "══════════════════════════════════════════════════════════════════════",
        "",
      ];
      for (const line of lines) {
        process.stderr.write(`${c.yellow(line)}\n`);
      }
    }

    const t0 = Date.now();

    let preview: VersionPublishChangeReportPreviewOut | undefined;
    let compat: CompatibilityCheckResponse | undefined;
    let missingDescCount = 0;
    let classCount = 0;

    if (!skipChecks) {
      preview = await this.api.previewPublishChangeReport(tenant, project.id, resolved.id, {
        changeReportBaselineMode: "auto",
      });

      const classes = await this.api.listClasses(tenant, resolved.id);
      classCount = classes.length;
      missingDescCount = countClassesMissingDescriptions(classes);

      if (missingDescCount > 0) {
        throw new ObjectifiedCliError({
          message: `${String(missingDescCount)} class(es) are missing required descriptions before publish.`,
          exitCode: EXIT_CODES.VALIDATION,
          title: "Validation failed",
          hint: "Fill class descriptions in the editor or API, then retry.",
        });
      }

      const baselineId = preview.baselineRevisionId?.trim();
      if (baselineId !== undefined && baselineId !== "") {
        compat = await this.api.checkRevisionCompatibility(tenant, project.id, {
          baseRevisionId: baselineId,
          headRevisionId: resolved.id,
        });
        if (compat.overall === "breaking" && !allowBreaking) {
          const reportUrl = changeReportWebUrl({
            baseUrl: this.context.baseUrl,
            tenantSlug: tenant,
            projectSlug: project.slug,
            fromLabel: preview.fromVersionLabel,
            toLabel: preview.toVersionLabel,
          });
          throw new ObjectifiedCliError({
            message:
              "Breaking schema changes detected versus the published baseline. Pass --allow-breaking to proceed.",
            exitCode: EXIT_CODES.CONFLICT,
            title: "Conflict",
            hint: `Change report: ${reportUrl}`,
          });
        }
      }
    }

    if (!this.context.json && !skipChecks) {
      this.output.text("");
      this.output.text("  Pre-publish checks:");
      this.output.text(`    ${mark} schema valid (OpenAPI 3.1)`);
      this.output.text(
        `    ${mark} no unfilled required descriptions (${String(classCount)} class${classCount === 1 ? "" : "es"})`,
      );
      if (compat !== undefined) {
        const ok = compat.overall !== "breaking" || allowBreaking;
        const suffix =
          compat.overall === "breaking" && allowBreaking ? " (allowed via --allow-breaking)" : "";
        this.output.text(
          `    ${ok ? mark : "[!]"} backwards-compatible vs baseline (${compat.overall})${suffix}`,
        );
      } else {
        this.output.text(`    ${mark} backwards-compatible (no published baseline on this lineage)`);
      }
      this.output.text(`    ${mark} change report generated`);
      this.output.text("");
      this.output.text(`  Publishing ${resolved.version_id} …`);
    }

    const publishBody: VersionPublishRequest = {
      ...(publishMessage !== undefined ? { shortMessage: publishMessage } : {}),
      changeReportBaselineMode: "auto",
      ...(allowBreaking ? { allowBreaking: true } : {}),
      ...(skipChecks ? { skipPublishChecks: true } : {}),
    };

    const published = await this.api.publishVersion(tenant, project.id, resolved.id, publishBody);

    let tagSummary: string | undefined;
    if (updateTagName !== undefined) {
      const tagBefore =
        tags.find((tg) => tg.name === updateTagName)?.version_id.slice(0, 8) ?? "none";
      const existing = tags.find((tg) => tg.name === updateTagName);
      if (existing !== undefined) {
        await this.api.patchVersionTag(tenant, project.id, existing.id, {
          version_id: published.id,
        });
      } else {
        await this.api.createVersionTag(tenant, project.id, {
          name: updateTagName,
          version_id: published.id,
        });
      }
      tagSummary = `tag '${updateTagName}' moved (${tagBefore} → ${published.id.slice(0, 8)}…)`;
    }

    const fingerprint = compat?.reportFingerprint;
    const fpDisplay =
      typeof fingerprint === "string" && fingerprint.length >= 12
        ? `${fingerprint.slice(0, 4)}…${fingerprint.slice(-4)}`
        : fingerprint ?? "—";

    const previewForUrl = preview;
    const changeReportUrl =
      previewForUrl !== undefined
        ? changeReportWebUrl({
            baseUrl: this.context.baseUrl,
            tenantSlug: tenant,
            projectSlug: project.slug,
            fromLabel: previewForUrl.fromVersionLabel,
            toLabel: previewForUrl.toVersionLabel,
          })
        : undefined;

    const specUrls = buildPublishedSpecUrls({
      baseUrl: this.context.baseUrl,
      tenantSlug: tenant,
      projectSlug: project.slug,
      versionSlug: published.version_id,
    });

    if (this.context.json) {
      const payload = stableDeepSort({
        version: published,
        spec_urls: specUrls,
        ...(changeReportUrl !== undefined ? { change_report_url: changeReportUrl } : {}),
        ...(compat !== undefined ? { compatibility: compat } : {}),
        ...(preview !== undefined ? { publish_preview: preview } : {}),
        ...(tagSummary !== undefined ? { tag_update: tagSummary } : {}),
      });
      this.output.json(payload);
      return;
    }

    if (!skipChecks) {
      this.output.text(`    ${mark} compatibility report fingerprint: ${fpDisplay}`);
      if (tagSummary !== undefined) {
        this.output.text(`    ${mark} ${tagSummary}`);
      } else if (updateTagName !== undefined) {
        this.output.text(`    ${mark} tag '${updateTagName}' updated`);
      }
      if (changeReportUrl !== undefined) {
        this.output.text(`    ${mark} change-report URL: ${changeReportUrl}`);
      }
      this.output.text("");
    } else {
      if (tagSummary !== undefined) {
        this.output.text(`  ${mark} ${tagSummary}`);
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    this.output.text(`${mark} Published ${published.version_id} in ${elapsed}s.`);
  }
}
