import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { formatBrowsePublicTenantsHumanLines } from "../../lib/browse/public-tenants-format.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { stableDeepSort } from "../../lib/output.js";

const LIMIT_MAX = 500;

export default class BrowseTenants extends BaseCommand {
  static description =
    "List tenants with published public specs (GET /v1/browse/tenants; no authentication required)";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --json <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --search acme --sort latest",
    "<%= config.bin %> <%= command.id %> --all",
  ];

  static seeAlso = ["tenants list", "auth status", "docs errors"];

  static flags = {
    search: Flags.string({
      description: "Filter tenant names and slugs (substring; applied on the server).",
    }),
    sort: Flags.string({
      description: "Sort order: name (default), latest (most recent activity first), or projects (desc).",
      options: ["latest", "name", "projects"],
      default: "name",
    }),
    limit: Flags.integer({
      description: `Maximum rows to display (1–${String(LIMIT_MAX)}; default 50). Ignored with --all.`,
      min: 1,
      max: LIMIT_MAX,
      default: 50,
    }),
    all: Flags.boolean({
      description: "Print every tenant returned by the API after sort/filter (no --limit cap).",
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

    const searchRaw = this.flags.search as string | undefined;
    const search = searchRaw !== undefined && searchRaw.trim() !== "" ? searchRaw.trim() : undefined;

    const sortFlag = this.flags.sort as string | undefined;
    const sort =
      sortFlag === "latest" || sortFlag === "projects" || sortFlag === "name" ? sortFlag : "name";

    const payload = await this.api.listPublicBrowseTenants({
      search,
      sort,
    });

    if (this.context.json) {
      this.output.json(stableDeepSort(payload));
      return;
    }

    const tenantsFull = payload.tenants;
    const limitRaw = this.flags.limit as number | undefined;
    const limit = Math.min(LIMIT_MAX, Math.max(1, limitRaw ?? 50));
    const useAll = Boolean(this.flags.all);
    const displayed = useAll ? tenantsFull : tenantsFull.slice(0, limit);
    const truncated = !useAll && tenantsFull.length > displayed.length;
    const directoryTotal = payload.directory_stats.tenant_count;

    if (tenantsFull.length === 0) {
      if (search !== undefined) {
        this.output.text(`No public tenants match ${JSON.stringify(search)}.`);
      } else {
        this.output.text("No public tenants in the directory yet.");
      }
      return;
    }

    const lines = formatBrowsePublicTenantsHumanLines({
      tenants: displayed,
      directoryTenantTotal: directoryTotal,
      truncated,
      totalAfterQuery: tenantsFull.length,
      searchActive: search !== undefined,
    });
    for (const line of lines) {
      this.output.text(line);
    }
  }
}
