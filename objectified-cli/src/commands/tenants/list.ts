import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { localePrefersAsciiTable, stableDeepSort } from "../../lib/output.js";
import { formatTenantsListHumanLines } from "../../lib/tenants/format.js";

const MAX_PAGE = 100;

export default class TenantsList extends BaseCommand {
  static description = "List tenants you can access (GET /v1/tenants/me)";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --json <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --limit 100 --offset 0",
  ];

  static seeAlso = ["tenants info", "auth status", "config path"];

  static flags = {
    limit: Flags.integer({
      description: "Page size for /v1/tenants/me (1–100; default 50).",
      min: 1,
      max: MAX_PAGE,
      default: 50,
    }),
    offset: Flags.integer({
      description: "Offset into the full tenant list (pagination).",
      min: 0,
      default: 0,
    }),
  };

  async run(): Promise<void> {
    this.ensureAuthenticated();

    const limitRaw = this.flags.limit as number | undefined;
    const offsetRaw = this.flags.offset as number | undefined;
    const limit = Math.min(MAX_PAGE, Math.max(1, limitRaw ?? 50));
    const offset = Math.max(0, offsetRaw ?? 0);

    const argv = this.normalizedArgv;
    const userSetLimit = argv.some((a) => a === "--limit" || a.startsWith("--limit="));
    const userSetOffset = argv.some((a) => a === "--offset" || a.startsWith("--offset="));
    const singlePage = userSetLimit || userSetOffset;

    const items: Array<{ slug: string; name: string; role: string }> = [];
    let total = 0;

    if (singlePage) {
      const page = await this.api.listMyTenantsPage(limit, offset);
      items.push(...page.items);
      total = page.total;
    } else {
      let off = 0;
      for (;;) {
        const page = await this.api.listMyTenantsPage(MAX_PAGE, off);
        total = page.total;
        items.push(...page.items);
        if (items.length >= total || page.items.length === 0) break;
        off += MAX_PAGE;
        if (off > 50_000) break;
      }
    }

    const profile = this.context.profile;
    const profileTenantSlug = this.context.tenantSlug;

    if (this.context.json) {
      const base: Record<string, unknown> = {
        profile,
        default_tenant_slug:
          profileTenantSlug !== undefined && profileTenantSlug !== "" ? profileTenantSlug : null,
        tenants: items,
        total,
      };
      if (singlePage) {
        base.limit = limit;
        base.offset = offset;
      }
      this.output.json(stableDeepSort(base));
      return;
    }

    if (items.length === 0) {
      this.output.text("No tenants found for this account.");
      return;
    }

    const lines = formatTenantsListHumanLines({
      tenants: items,
      profile,
      profileTenantSlug,
      langAscii: localePrefersAsciiTable(process.env),
    });
    for (const line of lines) {
      this.output.text(line);
    }
  }
}
