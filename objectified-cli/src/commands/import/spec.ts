import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import type {
  SpecImportCommitResponse,
  SpecImportJobAccepted,
  SpecImportJobStatus,
  SpecImportRollbackResponse,
} from "../../lib/client.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { resolveSpecImportKind } from "../../lib/import/spec-format.js";
import {
  pollSpecImportUntilGate,
  pollSpecImportUntilTerminal,
} from "../../lib/import/spec-import-flow.js";
import { readSpecInput } from "../../lib/import/read-spec-input.js";
import { validateProjectSlug } from "../../lib/projects/project-slug.js";
import { parseValidSemverVersionId } from "../../lib/versions/create-helpers.js";

type ImportSpecSummaryJson = {
  tenant_slug: string;
  job_id: string;
  status_path?: string;
  final_state: SpecImportJobStatus["state"];
  source_kind: string;
  project_slug?: string | null;
  project_id?: string | null;
  version_id?: string | null;
  version_record_id?: string | null;
  summary?: Record<string, unknown> | null;
  commit?: SpecImportCommitResponse | null;
  rollback?: SpecImportRollbackResponse | null;
  stopped_at?: "pending-approval" | null;
};

function throwForBadTerminalState(st: SpecImportJobStatus): never {
  const tail = st.events?.slice(-3) ?? [];
  const hint =
    tail.length > 0
      ? tail.map((e) => `${e.code}: ${e.message}`).join("; ")
      : "See GET …/imports/{job_id} for full events.";
  throw new ObjectifiedCliError({
    message: `Import job ${st.job_id} ended in state ${st.state}.`,
    exitCode: EXIT_CODES.GENERIC,
    title: "Import failed",
    hint,
  });
}

export default class ImportSpec extends BaseCommand {
  static description =
    "Start a tenant-scoped specification import (POST /v1/tenants/{tenant_slug}/imports with JSON+base64), poll job status with backoff, then commit (default), rollback preview, or stop after preview (`--no-commit`).";

  static examples = [
    "<%= config.bin %> <%= command.id %> ./openapi.yaml --project-name 'Payments API' --project-slug payments-api --version 1.0.0",
    "<%= config.bin %> --json <%= command.id %> ./spec.json --project-slug my-api --project-name 'My API' --version 2.0.0 --no-wait",
    "<%= config.bin %> <%= command.id %> - --filename ./api.yaml --project-slug svc --project-name Service --version 0.1.0 < ./api.yaml",
    "<%= config.bin %> <%= command.id %> ./asyncapi.yml --project-slug events --project-name Events --version 1.0.0 --dry-run",
  ];

  static seeAlso = ["projects create", "versions create", "docs errors", "tenants use"];

  static args = {
    path: Args.string({
      description: "Path to the spec file, or `-` to read raw bytes from stdin.",
      required: true,
    }),
  };

  static flags = {
    "project-name": Flags.string({
      description: "Display name for the catalog project created or targeted by this import.",
      required: true,
    }),
    "project-slug": Flags.string({
      description: "URL-safe project slug (^[a-z][a-z0-9-]{1,62}$).",
      required: true,
    }),
    version: Flags.string({
      description: "Semantic version id for the imported catalog revision (for example 1.0.0).",
      required: true,
    }),
    "project-description": Flags.string({
      description: "Optional project description forwarded in import metadata.",
    }),
    "version-description": Flags.string({
      description: "Optional version description forwarded in import metadata.",
    }),
    "existing-project-id": Flags.string({
      description: "When set, skip project creation and attach the job to this catalog project id.",
    }),
    format: Flags.string({
      description:
        "Importer kind when extension/content sniff is ambiguous (openapi-3, asyncapi-2, protobuf, graphql, …).",
    }),
    filename: Flags.string({
      description:
        "Original filename hint when PATH is `-` (improves sniffing for stdin payloads); may include directories (basename is used).",
    }),
    "dry-run": Flags.boolean({
      description:
        "Forward dry_run in import options (validate/analyze without persisting; server-defined).",
      default: false,
    }),
    "no-wait": Flags.boolean({
      description:
        "Start the job and print the job id immediately without polling or finalize calls (CI stitching).",
      default: false,
    }),
    commit: Flags.boolean({
      description:
        "After preview (pending-approval), POST …/commit (default). Use --no-commit to leave the preview transaction open.",
      default: true,
      allowNo: true,
    }),
    rollback: Flags.boolean({
      description:
        "After preview (pending-approval), POST …/rollback instead of commit (implies --no-commit).",
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

    this.ensureAuthenticated();

    const pathArg = typeof this.commandArgs.path === "string" ? this.commandArgs.path : "";
    const projectNameRaw = this.flags["project-name"];
    const projectName = typeof projectNameRaw === "string" ? projectNameRaw.trim() : "";
    const projectSlugRaw = this.flags["project-slug"];
    const versionRaw = typeof this.flags.version === "string" ? this.flags.version.trim() : "";

    if (projectName === "") {
      throw new ObjectifiedCliError({
        message: "--project-name is required.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
      });
    }
    const slugCheck = validateProjectSlug(typeof projectSlugRaw === "string" ? projectSlugRaw : "");
    if (!slugCheck.ok) {
      throw new ObjectifiedCliError({
        message: slugCheck.message,
        exitCode: EXIT_CODES.VALIDATION,
        title: "Validation failed",
        hint: slugCheck.suggestion !== undefined ? `Try slug ${slugCheck.suggestion}` : undefined,
      });
    }
    if (versionRaw === "") {
      throw new ObjectifiedCliError({
        message: "--version is required.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
      });
    }
    const versionId = parseValidSemverVersionId(versionRaw);

    const rollback = this.flags.rollback === true;
    const commit = !rollback && this.flags.commit !== false;

    const dryRun = this.flags["dry-run"] === true;
    const noWait = this.flags["no-wait"] === true;

    const formatRaw = typeof this.flags.format === "string" ? this.flags.format.trim() : "";
    const explicitFormat = formatRaw !== "" ? formatRaw : undefined;

    const stdinFilenameRaw =
      typeof this.flags.filename === "string" ? this.flags.filename.trim() : "";
    const stdinFilename = stdinFilenameRaw !== "" ? stdinFilenameRaw : undefined;

    const { bytes, resolvedPath } = await readSpecInput(pathArg);

    const kind = resolveSpecImportKind({
      explicitFormat,
      stdinFilename,
      resolvedPath,
      bytes,
    });

    const projDescRaw = this.flags["project-description"];
    const verDescRaw = this.flags["version-description"];
    const existingRaw = this.flags["existing-project-id"];
    const existingTrim =
      typeof existingRaw === "string" && existingRaw.trim() !== "" ? existingRaw.trim() : undefined;

    const documentBase64 = bytes.toString("base64");

    const accepted: SpecImportJobAccepted = await this.api.startSpecImportJson(tenant, {
      metadata: {
        source_kind: kind.sourceKind,
        project: {
          name: projectName,
          slug: slugCheck.slug,
          description:
            typeof projDescRaw === "string" && projDescRaw.trim() !== ""
              ? projDescRaw.trim()
              : null,
        },
        version: {
          version_id: versionId,
          description:
            typeof verDescRaw === "string" && verDescRaw.trim() !== "" ? verDescRaw.trim() : null,
        },
        existing_project_id: existingTrim ?? null,
        options: dryRun ? { dry_run: true } : undefined,
      },
      document_base64: documentBase64,
      filename: kind.filenameForRequest ?? undefined,
      content_type: kind.contentType ?? undefined,
    });

    if (noWait) {
      const early: ImportSpecSummaryJson = {
        tenant_slug: tenant,
        job_id: accepted.job_id,
        status_path: accepted.status_path,
        final_state: "queued",
        source_kind: kind.sourceKind,
        stopped_at: null,
      };
      if (this.context.json) {
        this.output.json(early);
      } else {
        this.output.table(
          [
            {
              job_id: accepted.job_id,
              status_path: accepted.status_path,
              tenant_slug: tenant,
              source_kind: kind.sourceKind,
            },
          ],
          [
            { key: "job_id", label: "Job" },
            { key: "status_path", label: "Status path" },
            { key: "tenant_slug", label: "Tenant" },
            { key: "source_kind", label: "Kind" },
          ],
        );
      }
      return;
    }

    let commitOut: SpecImportCommitResponse | undefined;
    let rollbackOut: SpecImportRollbackResponse | undefined;

    let st = await pollSpecImportUntilGate({
      api: this.api,
      tenantSlug: tenant,
      jobId: accepted.job_id,
    });

    if (st.state === "failed" || st.state === "canceled") {
      throwForBadTerminalState(st);
    }

    if (st.state === "rolled-back") {
      throwForBadTerminalState(st);
    }

    if (st.state === "completed") {
      const summary = this.buildSummaryJson({
        tenant,
        accepted,
        kindSource: kind.sourceKind,
        final: st,
        commit: undefined,
        rollback: undefined,
        stoppedAt: null,
      });
      this.emitSummary(summary);
      return;
    }

    if (st.state === "pending-approval") {
      if (!commit && !rollback) {
        const summary = this.buildSummaryJson({
          tenant,
          accepted,
          kindSource: kind.sourceKind,
          final: st,
          commit: undefined,
          rollback: undefined,
          stoppedAt: "pending-approval",
        });
        this.emitSummary(summary);
        return;
      }

      if (rollback) {
        rollbackOut = await this.api.rollbackSpecImportJob(tenant, accepted.job_id);
      } else {
        commitOut = await this.api.commitSpecImportJob(tenant, accepted.job_id);
      }

      st = await pollSpecImportUntilTerminal({
        api: this.api,
        tenantSlug: tenant,
        jobId: accepted.job_id,
      });

      if (st.state === "failed" || st.state === "canceled") {
        throwForBadTerminalState(st);
      }
      if (st.state === "rolled-back" && rollbackOut === undefined) {
        throwForBadTerminalState(st);
      }
    }

    const summary = this.buildSummaryJson({
      tenant,
      accepted,
      kindSource: kind.sourceKind,
      final: st,
      commit: commitOut ?? null,
      rollback: rollbackOut ?? null,
      stoppedAt: null,
    });
    this.emitSummary(summary);
  }

  private buildSummaryJson(opts: {
    tenant: string;
    accepted: SpecImportJobAccepted;
    kindSource: string;
    final: SpecImportJobStatus;
    commit?: SpecImportCommitResponse | null;
    rollback?: SpecImportRollbackResponse | null;
    stoppedAt: "pending-approval" | null;
  }): ImportSpecSummaryJson {
    const r = opts.final.result ?? undefined;
    const projSlug = opts.commit?.project_slug ?? r?.project_slug ?? null;
    const projId = opts.commit?.project_id ?? r?.project_id ?? null;
    const verId = opts.commit?.version_id ?? r?.version_id ?? null;
    const verRec = opts.commit?.version_record_id ?? r?.version_record_id ?? null;
    return {
      tenant_slug: opts.tenant,
      job_id: opts.final.job_id,
      status_path: opts.accepted.status_path,
      final_state: opts.final.state,
      source_kind: opts.kindSource,
      project_slug: projSlug,
      project_id: projId,
      version_id: verId,
      version_record_id: verRec,
      summary:
        opts.final.summary !== undefined &&
        opts.final.summary !== null &&
        typeof opts.final.summary === "object"
          ? (opts.final.summary as Record<string, unknown>)
          : opts.final.summary === null
            ? null
            : undefined,
      commit: opts.commit ?? null,
      rollback: opts.rollback ?? null,
      stopped_at: opts.stoppedAt,
    };
  }

  private emitSummary(summary: ImportSpecSummaryJson): void {
    if (this.context.json) {
      this.output.json(summary);
      return;
    }

    const rows: Record<string, unknown>[] = [
      {
        job_id: summary.job_id,
        state: summary.final_state,
        tenant_slug: summary.tenant_slug,
        source_kind: summary.source_kind,
        project_slug: summary.project_slug ?? "",
        project_id: summary.project_id ?? "",
        version_id: summary.version_id ?? "",
        version_record_id: summary.version_record_id ?? "",
      },
    ];

    this.output.table(rows, [
      { key: "job_id", label: "Job" },
      { key: "state", label: "State" },
      { key: "tenant_slug", label: "Tenant" },
      { key: "source_kind", label: "Kind" },
      { key: "project_slug", label: "Project slug" },
      { key: "project_id", label: "Project id" },
      { key: "version_id", label: "Version" },
      { key: "version_record_id", label: "Revision id" },
    ]);

    if (summary.stopped_at === "pending-approval") {
      this.output.warn(
        "Import stopped at pending-approval (--no-commit). Commit or rollback later via the REST API.",
      );
    }

    if (summary.summary !== undefined && summary.summary !== null) {
      this.output.text(`Summary: ${JSON.stringify(summary.summary)}`);
    }
  }
}
