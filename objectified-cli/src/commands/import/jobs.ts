import { BaseCommand } from "../../base-command.js";
import type { SpecImportJobListItem } from "../../lib/client.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { stableDeepSort } from "../../lib/output.js";

function sortJobsForDisplay(jobs: SpecImportJobListItem[]): SpecImportJobListItem[] {
  return [...jobs].sort((a, b) => a.job_id.localeCompare(b.job_id));
}

export default class ImportJobs extends BaseCommand {
  static description =
    "List specification import jobs for the tenant (GET /v1/tenants/{tenant_slug}/imports). Rows are summaries only (no event log); use GET …/imports/{job_id} for full status. The API keeps jobs in this server process—restarts clear the list.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --json <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --tenant acme",
  ];

  static seeAlso = ["import spec", "tenants use", "docs errors"];

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

    this.ensureAuthenticated();

    const { jobs } = await this.api.listSpecImportJobs(tenant);
    const ordered = sortJobsForDisplay(jobs);

    if (this.context.json) {
      this.output.json(stableDeepSort({ tenant_slug: tenant, jobs: ordered }));
      return;
    }

    if (ordered.length === 0) {
      this.output.text(
        "No import jobs in this API process for this tenant yet. Start one with `objectified import spec`.",
      );
      return;
    }

    this.output.table(
      ordered.map((j) => ({
        job_id: j.job_id,
        state: j.state,
        percent: String(j.percent),
        status_path: j.status_path,
      })),
      [
        { key: "job_id", label: "Job" },
        { key: "state", label: "State" },
        { key: "percent", label: "%" },
        { key: "status_path", label: "Status path" },
      ],
    );
  }
}
