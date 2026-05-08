import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { formatBrowsePublicVersionsHumanLines } from "../../lib/browse/public-versions-format.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { stableDeepSort } from "../../lib/output.js";

const LIMIT_MAX = 500;

function parseTenantProjectRef(raw: string): { tenantSlug: string; projectSlug: string } {
  const s = raw.trim();
  const slash = s.indexOf("/");
  if (slash <= 0 || slash === s.length - 1) {
    throw new ObjectifiedCliError({
      message: "Expected tenant/project (for example acme-corp/payments-api).",
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid argument",
      hint: "Pass a single argument `tenant_slug/project_slug`.",
    });
  }
  const tenantSlug = s.slice(0, slash).trim();
  const projectSlug = s.slice(slash + 1).trim();
  if (tenantSlug === "" || projectSlug === "") {
    throw new ObjectifiedCliError({
      message: "Tenant slug and project slug must be non-empty.",
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid argument",
      hint: "Use `objectified browse versions tenant/project`.",
    });
  }
  return { tenantSlug, projectSlug };
}

export default class BrowseVersions extends BaseCommand {
  static description =
    "List published versions for a project from GET /v1/browse/tenants/{tenant}/projects/{project}/versions (public directory; optional credentials include non-public published versions)";

  static examples = [
    "<%= config.bin %> <%= command.id %> acme-corp/payments-api",
    "<%= config.bin %> --json <%= command.id %> acme-corp/payments-api",
    "<%= config.bin %> <%= command.id %> acme-corp/payments-api --since 2026-01-01",
    "<%= config.bin %> <%= command.id %> acme-corp/payments-api --all",
  ];

  static seeAlso = ["browse projects", "browse tenants", "versions list", "docs errors"];

  static args = {
    ref: Args.string({
      description: "Tenant and project slugs as tenant/project (for example acme-corp/payments-api).",
      required: true,
    }),
  };

  static flags = {
    since: Flags.string({
      description:
        "Include only versions published on or after this instant (ISO 8601, forwarded to the API as `since`).",
    }),
    limit: Flags.integer({
      description: `Maximum rows to display (1–${String(LIMIT_MAX)}; default 50). Ignored with --all.`,
      min: 1,
      max: LIMIT_MAX,
      default: 50,
    }),
    all: Flags.boolean({
      description: "Print every version returned by the API after filters (no --limit cap).",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const argv = this.normalizedArgv;
    const hasAllFlag = argv.some((a) => a === "--all" || a.startsWith("--all="));
    const hasLimitFlag = argv.some((a) => a === "--limit" || a.startsWith("--limit="));
    if (hasAllFlag && hasLimitFlag) {
      throw new ObjectifiedCliError({
        message: "Cannot use --all together with --limit.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Pass only one of --all or --limit.",
      });
    }

    const refRaw = this.commandArgs.ref;
    const refStr = typeof refRaw === "string" ? refRaw : "";
    const { tenantSlug, projectSlug } = parseTenantProjectRef(refStr);

    const sinceRaw = this.flags.since as string | undefined;
    const since = sinceRaw !== undefined && sinceRaw.trim() !== "" ? sinceRaw.trim() : undefined;

    const payload = await this.api.listPublicBrowseVersions({
      tenantSlug,
      projectSlug,
      since,
    });

    const memberView = Boolean(this.apiAuth.apiKey || this.apiAuth.bearer);
    const versionsFull = payload.versions;

    if (this.context.json) {
      this.output.json(stableDeepSort(versionsFull));
      return;
    }

    const limitRaw = this.flags.limit as number | undefined;
    const limit = Math.min(LIMIT_MAX, Math.max(1, limitRaw ?? 50));
    const useAll = Boolean(this.flags.all);
    const displayed = useAll ? versionsFull : versionsFull.slice(0, limit);
    const truncated = !useAll && versionsFull.length > displayed.length;

    if (versionsFull.length === 0) {
      if (since !== undefined) {
        this.output.text(`No published versions on or after ${JSON.stringify(since)} for ${JSON.stringify(`${tenantSlug}/${projectSlug}`)}.`);
      } else if (!memberView) {
        this.output.text(`No public published versions for ${JSON.stringify(`${tenantSlug}/${projectSlug}`)}.`);
      } else {
        this.output.text(`No published versions for ${JSON.stringify(`${tenantSlug}/${projectSlug}`)}.`);
      }
      return;
    }

    const lines = formatBrowsePublicVersionsHumanLines({
      versions: displayed,
      tenantSlug,
      projectSlug,
      truncated,
      totalAfterQuery: versionsFull.length,
      sinceActive: since !== undefined,
      memberView,
    });
    for (const line of lines) {
      this.output.text(line);
    }
  }
}
