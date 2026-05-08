import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import {
  applyProjectListQuery,
  parseColumnKeys,
  parseFilterFlags,
  parseSortFlag,
  validateProjectColumns,
} from "../../lib/projects/list-query.js";
import { formatProjectsListHumanLines } from "../../lib/projects/format.js";
import { chalkForContext } from "../../lib/output.js";

const LIMIT_MAX = 500;

export default class ProjectsList extends BaseCommand {
  static description =
    "List Objectified projects for the active tenant (GET /v1/projects/{tenant_slug})";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --json <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --sort name --limit 25",
    "<%= config.bin %> <%= command.id %> --filter domain=finance --search payment",
    "<%= config.bin %> --profile staging <%= command.id %> --all",
  ];

  static seeAlso = ["tenants use", "config path", "docs errors"];

  static flags = {
    limit: Flags.integer({
      description: `Maximum rows after sort/filter (1–${String(LIMIT_MAX)}; default 50). Ignored with --all.`,
      min: 1,
      max: LIMIT_MAX,
      default: 50,
    }),
    all: Flags.boolean({
      description: "List every matching row after sort/filter (no --limit cap).",
      default: false,
    }),
    sort: Flags.string({
      description:
        "Sort by field; prefix with '-' for descending. Fields: name, slug, updated_at, published_at (default: slug).",
    }),
    filter: Flags.string({
      description:
        "Keep rows where a field equals a value (case-insensitive). Example: --filter domain=finance",
      multiple: true,
    }),
    search: Flags.string({
      description: "Case-insensitive substring match across slug, name, and description.",
    }),
    columns: Flags.string({
      description:
        "Comma-separated columns: slug, name, domain, versions, latest, latest_published_at, description, id, updated_at, enabled, creator_email, creator_name, published_at.",
    }),
    "include-deleted": Flags.boolean({
      description: "Include soft-deleted projects from the API.",
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

    let columnKeys: string[];
    let filters;
    let sort;
    try {
      columnKeys = parseColumnKeys(this.flags.columns as string | undefined);
      validateProjectColumns(columnKeys);
      filters = parseFilterFlags(this.flags.filter as string[] | undefined);
      sort = parseSortFlag(this.flags.sort as string | undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ObjectifiedCliError({
        message: msg,
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Run `objectified projects list --help` for flag syntax.",
      });
    }

    this.ensureAuthenticated();

    const includeDeleted = this.flags["include-deleted"] === true;
    const rawProjects = await this.api.listProjects(
      tenant,
      includeDeleted ? { include_deleted: true } : undefined,
    );

    const search = (this.flags.search as string | undefined) ?? "";
    const pipeline = applyProjectListQuery(rawProjects, {
      filters,
      search,
      sortField: sort.field,
      sortDir: sort.dir,
    });

    const useAll = Boolean(this.flags.all);
    const limitRaw = this.flags.limit as number | undefined;
    const limit = Math.min(LIMIT_MAX, Math.max(1, limitRaw ?? 50));
    const displayed = useAll ? pipeline : pipeline.slice(0, limit);
    const truncated = !useAll && pipeline.length > displayed.length;

    if (this.context.json) {
      this.output.json(displayed);
      return;
    }

    const c = chalkForContext(this.context.color);

    if (rawProjects.length === 0) {
      this.output.text(
        `${c.bold("No projects yet.")} Run \`objectified projects create\` to add one.`,
      );
      return;
    }

    if (pipeline.length === 0) {
      this.output.text("No projects match your filters or search.");
      return;
    }

    const lines = formatProjectsListHumanLines({
      projects: displayed,
      tenantSlug: tenant,
      columnKeys,
      truncated,
      totalAfterQuery: pipeline.length,
    });
    for (const line of lines) {
      this.output.text(line);
    }
  }
}
