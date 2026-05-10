import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../base-command.js";
import { formatApiError } from "../lib/client.js";
import {
  importSpecOpenApiAuditIsClean,
  importSpecOpenApiAuditSummarize,
} from "../lib/audit/import-spec-openapi-audit.js";
import { httpStatusToCliError, ObjectifiedCliError } from "../lib/errors.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { parseSpecRootDocument } from "../lib/import/spec-import-catalog-identity.js";
import { readSpecInput } from "../lib/import/read-spec-input.js";
import { resolveSpecImportKind } from "../lib/import/spec-format.js";
import { stableDeepSort } from "../lib/output.js";
import {
  buildSchemaFetchAcceptHeader,
  parseTenantProjectVersionRef,
} from "../lib/schema/schema-fetch-helpers.js";

async function readFailedResponseBody(res: Response): Promise<string> {
  const text = await res.text();
  try {
    return formatApiError(JSON.parse(text) as unknown);
  } catch {
    return text.trim() !== "" ? text.slice(0, 800) : `HTTP ${String(res.status)}`;
  }
}

function assertOpenApi3Document(doc: Record<string, unknown>, label: string): void {
  const ver = doc.openapi;
  if (typeof ver !== "string" || !ver.trim().startsWith("3.")) {
    throw new ObjectifiedCliError({
      message: `${label} must be an OpenAPI 3.x document (\`openapi: 3.x\`).`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint:
        "This command compares OpenAPI 3.x JSON shapes. Import AsyncAPI or other kinds with `objectified import spec`; audit only supports OpenAPI 3.x vs GET /v1/schema/…. ",
    });
  }
}

export default class Audit extends BaseCommand {
  static description =
    "Compare a local OpenAPI 3.x file to the published catalog bundle from GET /v1/schema/{tenant}/{project}/{version} using POST /v1/openapi/change-report. Exits with a validation error when anything would be removed from the local spec relative to the catalog, added on the catalog side, or semantically modified.";

  static examples = [
    "<%= config.bin %> <%= command.id %> ./openapi.yaml --ref acme-corp/payments-api/2.1.0",
    "<%= config.bin %> <%= command.id %> ./spec.json --ref acme-corp/payments-api/2.1.0 --latest",
    "<%= config.bin %> --json <%= command.id %> ./openapi.yaml --ref acme/my-api/1.0.0",
  ];

  static seeAlso = ["import spec", "schema fetch", "versions show", "docs errors"];

  static args = {
    path: Args.string({
      description: "Path to the OpenAPI file, or `-` to read from stdin.",
      required: true,
    }),
  };

  static flags = {
    ref: Flags.string({
      description:
        "Published catalog target as tenant/project/version (three slash-separated slugs; same shape as `objectified schema fetch`).",
      required: true,
    }),
    latest: Flags.boolean({
      description: "Use version slug `latest` instead of the third segment of --ref.",
      default: false,
    }),
    accept: Flags.string({
      description:
        "Optional Accept token for tag negotiation on GET /v1/schema (for example tag:stable), same as `objectified schema fetch --accept`.",
    }),
    format: Flags.string({
      description:
        "Importer kind when extension/content sniff is ambiguous (must resolve to openapi-3 for this command).",
    }),
    filename: Flags.string({
      description: "Original filename hint when PATH is `-` (improves format sniffing).",
    }),
  };

  async run(): Promise<void> {
    const pathArgRaw = this.commandArgs.path;
    const pathArg = typeof pathArgRaw === "string" ? pathArgRaw : "";
    const refRaw = this.flags.ref;
    const refStr = typeof refRaw === "string" ? refRaw.trim() : "";
    if (refStr === "") {
      throw new ObjectifiedCliError({
        message: "--ref is required.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Pass tenant/project/version, for example --ref acme-corp/payments-api/2.1.0.",
      });
    }

    const { tenantSlug, projectSlug, versionSlug: versionFromRef } = parseTenantProjectVersionRef(refStr);
    const versionSlug = this.flags.latest === true ? "latest" : versionFromRef;

    const cfgTenant = this.context.tenantSlug?.trim();
    if (
      cfgTenant !== undefined &&
      cfgTenant !== "" &&
      cfgTenant !== tenantSlug &&
      !this.context.json
    ) {
      this.warn(
        `Profile/config tenant is "${cfgTenant}" but --ref targets tenant "${tenantSlug}" (URLs use --ref).`,
      );
    }

    const { bytes, resolvedPath } = await readSpecInput(pathArg);
    const formatRaw = this.flags.format;
    const filenameRaw = this.flags.filename;
    const kind = resolveSpecImportKind({
      bytes,
      resolvedPath,
      explicitFormat:
        typeof formatRaw === "string" && formatRaw.trim() !== "" ? formatRaw.trim() : undefined,
      stdinFilename:
        typeof filenameRaw === "string" && filenameRaw.trim() !== ""
          ? filenameRaw.trim()
          : undefined,
    });

    if (kind.sourceKind !== "openapi-3") {
      throw new ObjectifiedCliError({
        message: `Audit supports OpenAPI 3.x only; this file resolved as importer kind ${kind.sourceKind}.`,
        exitCode: EXIT_CODES.VALIDATION,
        title: "Validation failed",
        hint: "Pass an OpenAPI 3.x document, or set --format openapi-3 when sniffing is wrong.",
      });
    }

    const localDoc = parseSpecRootDocument(
      bytes,
      "Fix JSON/YAML syntax in the local specification file.",
    );
    assertOpenApi3Document(localDoc, "Local specification");

    const acceptRaw = this.flags.accept;
    const acceptTag = typeof acceptRaw === "string" ? acceptRaw.trim() : "";
    const acceptHeader = buildSchemaFetchAcceptHeader({
      format: "json",
      acceptTag: acceptTag !== "" ? acceptTag : undefined,
    });

    const res = await this.api.fetchOpenApiPublishedSchema({
      tenantSlug,
      projectSlug,
      versionSlug,
      acceptHeader,
    });

    if (!res.ok) {
      const msg = await readFailedResponseBody(res);
      const rid = res.headers.get("x-request-id") ?? res.headers.get("X-Request-Id") ?? undefined;
      throw httpStatusToCliError(res.status, msg, {
        requestId: rid ?? this.api.lastRequestId,
        retriesAttempted: this.api.lastRetriesAttempted,
        credentialsWereSent: Boolean(this.apiAuth.apiKey || this.apiAuth.bearer),
      });
    }

    let remoteDoc: Record<string, unknown>;
    try {
      remoteDoc = JSON.parse(await res.text()) as Record<string, unknown>;
    } catch {
      throw new ObjectifiedCliError({
        message: "GET /v1/schema returned body that is not valid JSON.",
        exitCode: EXIT_CODES.VALIDATION,
        title: "Validation failed",
        hint: "The published bundle endpoint should return OpenAPI JSON; retry with --verbose and check x-request-id.",
      });
    }
    assertOpenApi3Document(remoteDoc, "Published catalog OpenAPI");

    const changeReport = await this.api.postOpenApiChangeReport(tenantSlug, {
      baselineOpenApi: localDoc,
      candidateOpenApi: remoteDoc,
    });

    const summary = importSpecOpenApiAuditSummarize(changeReport);
    const refDisplay = `${tenantSlug}/${projectSlug}/${versionSlug}`;

    if (this.context.json) {
      this.output.json(
        stableDeepSort({
          ok: summary.ok,
          ref: refDisplay,
          resolved_local_path: resolvedPath,
          summary,
          change_report: changeReport,
        }),
      );
      if (!summary.ok) {
        throw new ObjectifiedCliError({
          message: `Import audit failed: local spec does not match published OpenAPI for ${refDisplay}.`,
          exitCode: EXIT_CODES.VALIDATION,
          title: "Audit failed",
          hint: "Inspect change_report in the JSON output (schemas, paths, documentation deltas).",
        });
      }
      return;
    }

    if (importSpecOpenApiAuditIsClean(changeReport)) {
      this.output.success(`Audit OK — local spec matches published OpenAPI for ${refDisplay}.`);
      if (summary.warningCount > 0 || summary.skippedCount > 0) {
        this.output.warn(
          `Note: change report has ${String(summary.warningCount)} warning(s) and ${String(summary.skippedCount)} skipped section(s) (see --json for detail).`,
        );
      }
      return;
    }

    const lines = [
      `Import audit failed for ${refDisplay}.`,
      `  Schemas — added: ${String(summary.schemasAdded)}, removed: ${String(summary.schemasRemoved)}, modified: ${String(summary.schemasModified)}`,
      `  Property changes: ${String(summary.propertyChanges)}`,
      `  Reference changes: ${String(summary.referenceChanges)}`,
      `  Relationship changes: ${String(summary.relationshipChanges)}`,
      `  Documentation changes: ${String(summary.documentationChanges)}`,
      "",
      "Run with --json to emit the full semantic change report.",
    ];
    throw new ObjectifiedCliError({
      message: lines.join("\n"),
      exitCode: EXIT_CODES.VALIDATION,
      title: "Audit failed",
      hint: "Differences are baseline (local file) → candidate (published GET /v1/schema): removed/missing items appear in `schemas.removed`, etc.",
    });
  }
}
