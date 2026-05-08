import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { stableDeepSort } from "../../lib/output.js";
import { formatTenantInfoHumanLines } from "../../lib/tenants/format.js";

export default class TenantsInfo extends BaseCommand {
  static description = "Show tenant details when you have access (GET /v1/tenants/{slug})";

  static examples = [
    "<%= config.bin %> <%= command.id %> acme-corp",
    "<%= config.bin %> --json <%= command.id %> acme-corp",
  ];

  static seeAlso = ["tenants list", "tenants use", "auth status", "config path"];

  static args = {
    slug: Args.string({
      description: "Tenant slug",
      required: true,
    }),
  };

  async run(): Promise<void> {
    this.ensureAuthenticated();

    const raw = this.commandArgs.slug;
    const slug = typeof raw === "string" ? raw.trim() : "";
    if (slug === "") {
      throw new ObjectifiedCliError({
        message: "Tenant slug is required.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Missing argument",
        hint: "Run `objectified tenants info <slug>`.",
      });
    }

    const info = await this.api.getTenantInfo(slug);

    if (this.context.json) {
      this.output.json(stableDeepSort(info));
      return;
    }

    for (const line of formatTenantInfoHumanLines(info)) {
      this.output.text(line);
    }
  }
}