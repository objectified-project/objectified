import { basename } from "node:path";

import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

const FORMAT_ALIASES: Record<string, string> = {
  "openapi-3": "openapi-3",
  openapi3: "openapi-3",
  openapi: "openapi-3",
  swagger: "openapi-3",
  "asyncapi-2": "asyncapi-2",
  asyncapi2: "asyncapi-2",
  asyncapi: "asyncapi-2",
  protobuf: "protobuf",
  proto: "protobuf",
  graphql: "graphql",
  avro: "avro",
  arazzo: "arazzo",
  raml: "raml",
  thrift: "thrift",
  dbml: "dbml",
  prisma: "prisma",
  postman: "postman",
};

export type ResolvedSpecKind = {
  sourceKind: string;
  contentType?: string | null;
  filenameForRequest?: string | null;
};

export function normalizeExplicitFormat(flag: string): string {
  const t = flag.trim();
  if (t === "") {
    throw new ObjectifiedCliError({
      message: "--format cannot be empty.",
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Pass a product import kind such as openapi-3, asyncapi-2, or protobuf.",
    });
  }
  const lower = t.toLowerCase().replace(/_/g, "-");
  return FORMAT_ALIASES[lower] ?? lower;
}

function extensionHint(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".proto")) return "protobuf";
  if (lower.endsWith(".graphql") || lower.endsWith(".gql")) return "graphql";
  if (lower.endsWith(".avsc")) return "avro";
  return undefined;
}

export function sniffSourceKindFromBytes(bytes: Buffer): string | undefined {
  const head = bytes.subarray(0, Math.min(bytes.length, 65_536)).toString("utf8");
  const trimmed = head.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if ("asyncapi" in parsed) return "asyncapi-2";
      if ("openapi" in parsed || "swagger" in parsed) return "openapi-3";
    } catch {
      return undefined;
    }
    return undefined;
  }
  const lines = trimmed.split(/\r?\n/);
  const firstMeaningful = lines.find((l) => {
    const s = l.trim();
    return s !== "" && !s.startsWith("#");
  });
  if (firstMeaningful === undefined) return undefined;
  const l = firstMeaningful.trimStart();
  if (l.startsWith("asyncapi:")) return "asyncapi-2";
  if (l.startsWith("openapi:") || l.startsWith("swagger:")) return "openapi-3";
  if (/^syntax\s*=\s*["']?proto3["']?/i.test(l) || l.startsWith("syntax =")) return "protobuf";
  return undefined;
}

export function resolveSpecImportKind(opts: {
  explicitFormat?: string;
  stdinFilename?: string;
  resolvedPath: string;
  bytes: Buffer;
}): ResolvedSpecKind {
  const derivedName =
    opts.resolvedPath === "-"
      ? opts.stdinFilename !== undefined && opts.stdinFilename.trim() !== ""
        ? basename(opts.stdinFilename.trim())
        : undefined
      : basename(opts.resolvedPath);

  if (opts.explicitFormat !== undefined && opts.explicitFormat !== "") {
    const sourceKind = normalizeExplicitFormat(opts.explicitFormat);
    const endsJson = derivedName?.toLowerCase().endsWith(".json") ?? false;
    const contentType =
      sourceKind === "openapi-3" || sourceKind === "asyncapi-2"
        ? endsJson
          ? "application/json"
          : derivedName !== undefined
            ? "application/yaml"
            : null
        : sourceKind === "protobuf"
          ? "text/plain"
          : sourceKind === "graphql"
            ? "application/graphql"
            : null;
    return {
      sourceKind,
      contentType,
      filenameForRequest: derivedName ?? null,
    };
  }

  const extKind = derivedName !== undefined ? extensionHint(derivedName) : undefined;
  const sniffed = sniffSourceKindFromBytes(opts.bytes);

  if (extKind === "protobuf") {
    return {
      sourceKind: "protobuf",
      contentType: "text/plain",
      filenameForRequest: derivedName ?? null,
    };
  }

  if (sniffed !== undefined) {
    const endsJson = derivedName?.toLowerCase().endsWith(".json") ?? false;
    return {
      sourceKind: sniffed,
      contentType:
        sniffed === "openapi-3" || sniffed === "asyncapi-2"
          ? endsJson
            ? "application/json"
            : "application/yaml"
          : null,
      filenameForRequest: derivedName ?? null,
    };
  }

  if (extKind !== undefined) {
    return {
      sourceKind: extKind,
      contentType: extKind === "graphql" ? "application/graphql" : null,
      filenameForRequest: derivedName ?? null,
    };
  }

  throw new ObjectifiedCliError({
    message:
      "Could not determine specification format from the file path or contents; pass --format <kind> (for example openapi-3 or asyncapi-2).",
    exitCode: EXIT_CODES.MISUSE,
    title: "Ambiguous format",
    hint:
      opts.resolvedPath === "-"
        ? "When reading from stdin, use --filename ./openapi.yaml for sniffing hints or set --format explicitly."
        : "Use a recognizable extension or pass --format.",
  });
}
