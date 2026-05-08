import { Args, Flags } from "@oclif/core";
import { once } from "node:events";
import { open as fsOpen, writeFile } from "node:fs/promises";

import openBrowser from "open";
import { stringify as stringifyYaml } from "yaml";

import { BaseCommand } from "../../base-command.js";
import { formatApiError } from "../../lib/client.js";
import { httpStatusToCliError, ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { parseTenantProjectVersionRef } from "../../lib/schema/schema-fetch-helpers.js";
import { resolveSchemaSwaggerModes } from "../../lib/schema/schema-swagger-helpers.js";
import { buildPublishedSpecUrls } from "../../lib/versions/show-format.js";

async function readFailedResponseBody(res: Response): Promise<string> {
  const text = await res.text();
  try {
    return formatApiError(JSON.parse(text) as unknown);
  } catch {
    return text.trim() !== "" ? text.slice(0, 800) : `HTTP ${String(res.status)}`;
  }
}

export default class SchemaSwagger extends BaseCommand {
  static description =
    "Open hosted Swagger UI at GET /v1/swagger/{tenant}/{project}/{version} or download the published OpenAPI bundle (GET /v1/schema/…) as JSON/YAML. On an interactive TTY, defaults to opening the browser unless --output or --format is set; piping, non-TTY stdout, or global --json emits the bundle instead.";

  static examples = [
    "<%= config.bin %> <%= command.id %> acme-corp/payments-api/2.1.0",
    "<%= config.bin %> <%= command.id %> acme-corp/payments-api/2.1.0 --open",
    "<%= config.bin %> <%= command.id %> acme-corp/payments-api/2.1.0 --output ./swagger.json",
    "<%= config.bin %> <%= command.id %> acme-corp/payments-api/2.1.0 --format json > ./openapi.json",
  ];

  static seeAlso = ["schema fetch", "browse versions", "versions show"];

  static args = {
    ref: Args.string({
      description:
        "Published target as tenant/project/version (slashes separate the three slugs; semver or published tag slug).",
      required: true,
    }),
  };

  static flags = {
    open: Flags.boolean({
      description:
        "Open the Swagger UI page in the default browser (also the default when stdout is a TTY and neither --output nor --format is set).",
      default: false,
    }),
    format: Flags.string({
      description:
        "Bundle serialization for download mode (GET /v1/schema/…). When set without --output, writes to stdout. Full-bundle YAML is converted client-side from JSON.",
      options: ["json", "yaml"],
    }),
    output: Flags.string({
      description: "Write the OpenAPI bundle to this path instead of stdout (GET /v1/schema/…).",
      char: "o",
    }),
  };

  async run(): Promise<void> {
    const refRaw = this.commandArgs.ref;
    const refStr = typeof refRaw === "string" ? refRaw : "";
    const { tenantSlug, projectSlug, versionSlug } = parseTenantProjectVersionRef(refStr);

    const outRaw = this.flags.output;
    const outPath = typeof outRaw === "string" ? outRaw.trim() : "";

    const formatRaw = this.flags.format;
    const formatExplicit = typeof formatRaw === "string";
    const format: "json" | "yaml" = formatRaw === "yaml" ? "yaml" : "json";

    const openFlag = this.flags.open === true;

    const { openBrowser: doOpen, writeBundle } = resolveSchemaSwaggerModes({
      stdoutIsTTY: process.stdout.isTTY,
      machineOutput: this.context.json,
      openFlag,
      outputPath: outPath,
      formatProvided: formatExplicit,
    });

    const urls = buildPublishedSpecUrls({
      baseUrl: this.context.baseUrl,
      tenantSlug,
      projectSlug,
      versionSlug,
    });

    if (doOpen) {
      if (!this.flags.quiet) {
        this.output.text(`Opening ${urls.swagger_ui} in your browser…`);
      }
      await openBrowser(urls.swagger_ui);
    }

    if (!writeBundle) {
      return;
    }

    const res = await this.api.fetchOpenApiPublishedSchema({
      tenantSlug,
      projectSlug,
      versionSlug,
      acceptHeader: undefined,
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

    const convertFullBundleToYaml = format === "yaml";
    if (convertFullBundleToYaml) {
      let body = Buffer.from(await res.arrayBuffer());
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.toString("utf8")) as unknown;
      } catch {
        throw new ObjectifiedCliError({
          message: "Schema response was not valid JSON; cannot emit YAML for the full bundle.",
          exitCode: EXIT_CODES.VALIDATION,
          title: "Validation failed",
          hint: "The version-level endpoint returned non-JSON; report this with x-request-id from verbose logs.",
        });
      }
      body = Buffer.from(stringifyYaml(parsed), "utf8");

      if (outPath !== "") {
        await writeFile(outPath, body);
      } else {
        process.stdout.write(body);
      }
      return;
    }

    const writer = outPath !== "" ? await fsOpen(outPath, "w") : undefined;
    try {
      if (res.body === null) {
        const chunk = Buffer.from(await res.arrayBuffer());
        if (writer !== undefined) {
          await writer.write(chunk);
        } else {
          if (!process.stdout.write(chunk)) {
            await once(process.stdout, "drain");
          }
        }
      } else {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value);
          if (writer !== undefined) {
            await writer.write(chunk);
          } else {
            if (!process.stdout.write(chunk)) {
              await once(process.stdout, "drain");
            }
          }
        }
      }
    } finally {
      await writer?.close();
    }
  }
}
