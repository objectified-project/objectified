import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { formatBrowsePublicProjectsHumanLines } from "../../lib/browse/public-projects-format.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { stableDeepSort } from "../../lib/output.js";

const LIMIT_MAX = 500;

export default class BrowseProjects extends BaseCommand {
  static description =
    "List projects for a tenant from GET /v1/browse/tenants/{tenant}/projects (public directory without auth; optional credentials include private projects)";

  static examples = [
    "<%= config.bin %> <%= command.id %> acme-corp",
    "<%= config.bin %> --json <%= command.id %> acme-corp",
    "<%= config.bin %> <%= command.id %> acme-corp --search payment --domain finance",
    "<%= config.bin %> <%= command.id %> acme-corp --has-published --all",
  ];

  static seeAlso = ["browse tenants", "projects list", "auth status", "docs errors"];

  static args = {
    tenant: Args.string({
      description: "Tenant slug (for example acme-corp).",
      required: true,
    }),
  };

  static flags = {
    domain: Flags.string({
      description: "Filter by project metadata domain or domainCategory (case-insensitive; server-side).",
    }),
    "has-published": Flags.boolean({
      description: "Only projects with at least one published version (any visibility for members; public publishes only when unauthenticated).",
      default: false,
    }),
    search: Flags.string({
      description: "Filter project slug and name (substring; applied on the server).",
    }),
    limit: Flags.integer({
      description: `Maximum rows to display (1–${String(LIMIT_MAX)}; default 50). Ignored with --all.`,
      min: 1,
      max: LIMIT_MAX,
      default: 50,
    }),
    all: Flags.boolean({
      description: "Print every project returned by the API after filters (no --limit cap).",
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

    const rawTenant = this.commandArgs.tenant;
    const tenantSlug = typeof rawTenant === "string" ? rawTenant.trim() : "";
    if (tenantSlug === "") {
      throw new ObjectifiedCliError({
        message: "Tenant slug is required.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Missing argument",
        hint: "Run `objectified browse projects <tenant>`.",
      });
    }

    const searchRaw = this.flags.search as string | undefined;
    const search = searchRaw !== undefined && searchRaw.trim() !== "" ? searchRaw.trim() : undefined;

    const domainRaw = this.flags.domain as string | undefined;
    const domain = domainRaw !== undefined && domainRaw.trim() !== "" ? domainRaw.trim() : undefined;

    const hasPublished = Boolean(this.flags["has-published"]);

    const payload = await this.api.listPublicBrowseProjects({
      tenantSlug,
      search,
      domain,
      hasPublished,
    });

    const memberView = Boolean(this.apiAuth.apiKey || this.apiAuth.bearer);

    const projectsFull = payload.projects;

    if (this.context.json) {
      this.output.json(stableDeepSort(projectsFull));
      return;
    }

    const limitRaw = this.flags.limit as number | undefined;
    const limit = Math.min(LIMIT_MAX, Math.max(1, limitRaw ?? 50));
    const useAll = Boolean(this.flags.all);
    const displayed = useAll ? projectsFull : projectsFull.slice(0, limit);
    const truncated = !useAll && projectsFull.length > displayed.length;

    if (projectsFull.length === 0) {
      if (search !== undefined || domain !== undefined || hasPublished) {
        this.output.text("No projects match your filters.");
      } else if (!memberView) {
        this.output.text(`No public projects in tenant ${JSON.stringify(tenantSlug)}.`);
      } else {
        this.output.text(`No projects in tenant ${JSON.stringify(tenantSlug)}.`);
      }
      return;
    }

    const lines = formatBrowsePublicProjectsHumanLines({
      projects: displayed,
      tenantSlug: payload.tenant_slug,
      truncated,
      totalAfterQuery: projectsFull.length,
      searchActive: search !== undefined,
      domainActive: domain !== undefined,
      hasPublishedActive: hasPublished,
      memberView,
    });
    for (const line of lines) {
      this.output.text(line);
    }
  }
}
