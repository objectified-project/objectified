import { BaseCommand } from "../../base-command.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { chalkForContext } from "../../lib/output.js";

export default class ProjectsList extends BaseCommand {
  static description = "List Objectified projects";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --json <%= command.id %>",
    "<%= config.bin %> --profile staging <%= command.id %>",
  ];

  static seeAlso = ["tenants use", "config path", "docs errors"];

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

    this.ensureAuthenticated();

    const projects = await this.api.listProjects(tenant);
    const payload = { projects };

    if (this.context.json) {
      this.output.json(payload);
      return;
    }

    if (projects.length === 0) {
      this.output.text(chalkForContext(this.context.color).bold("No projects yet."));
      return;
    }

    this.output.table(
      projects.map((p) => ({
        name: p.name,
        slug: p.slug,
        id: p.id,
        enabled: p.enabled,
      })),
      [
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "id", label: "ID" },
        { key: "enabled", label: "Enabled" },
      ],
    );
  }
}
