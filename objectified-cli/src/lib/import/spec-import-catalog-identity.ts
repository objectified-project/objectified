import { parse as parseYaml } from "yaml";

import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";
import { suggestSlugFromName, validateProjectSlug } from "../projects/project-slug.js";
import { parseValidSemverVersionId } from "../versions/create-helpers.js";

/** Fields commonly present under `info` in OpenAPI, Swagger 2.x, and AsyncAPI 2.x. */
export type DerivedCatalogIdentity = {
  title?: string;
  version?: string;
};

function parseSpecDocument(bytes: Buffer): Record<string, unknown> {
  const text = bytes.toString("utf8");
  const trimmed = text.trimStart();
  try {
    let parsed: unknown;
    if (trimmed.startsWith("{")) {
      parsed = JSON.parse(trimmed) as unknown;
    } else {
      parsed = parseYaml(text) as unknown;
    }
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error("Spec root must be a JSON/YAML object.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ObjectifiedCliError({
      message: `Could not parse specification document: ${msg}`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: "Fix JSON/YAML syntax, or pass --project-name, --project-slug, and --version explicitly.",
    });
  }
}

function readInfoRecord(doc: Record<string, unknown>): Record<string, unknown> | undefined {
  const info = doc.info;
  if (info !== null && typeof info === "object" && !Array.isArray(info)) {
    return info as Record<string, unknown>;
  }
  return undefined;
}

function trimNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/**
 * Reads `info.title` and `info.version` when the kind is OpenAPI or AsyncAPI.
 * Other kinds return an empty derivation (callers must require explicit CLI fields).
 */
export function deriveCatalogIdentityFromSpecBytes(
  bytes: Buffer,
  sourceKind: string,
): DerivedCatalogIdentity {
  if (sourceKind !== "openapi-3" && sourceKind !== "asyncapi-2") {
    return {};
  }
  const doc = parseSpecDocument(bytes);
  const info = readInfoRecord(doc);
  if (info === undefined) {
    return {};
  }
  return {
    title: trimNonEmptyString(info.title),
    version: trimNonEmptyString(info.version),
  };
}

export type ResolvedCatalogIdentityForImport = {
  projectName: string;
  projectSlug: string;
  versionId: string;
};

/**
 * Resolves display name, slug, and semver version for `--create-or-map-project`.
 * CLI flags override spec-derived values when provided.
 */
export function resolveCatalogIdentityForCreateOrMap(opts: {
  derived: DerivedCatalogIdentity;
  sourceKind: string;
  cliProjectName: string;
  cliProjectSlug: string;
  cliVersionRaw: string;
}): ResolvedCatalogIdentityForImport {
  const name =
    opts.cliProjectName !== ""
      ? opts.cliProjectName
      : opts.derived.title !== undefined && opts.derived.title !== ""
        ? opts.derived.title
        : "";

  if (name === "") {
    throw new ObjectifiedCliError({
      message:
        opts.sourceKind === "openapi-3" || opts.sourceKind === "asyncapi-2"
          ? "Could not determine project display name from the spec (missing info.title). Pass --project-name."
          : `--create-or-map-project needs --project-name for specification kind '${opts.sourceKind}' (only OpenAPI and AsyncAPI embed title/version in info).`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint:
        opts.sourceKind === "openapi-3" || opts.sourceKind === "asyncapi-2"
          ? "Ensure info.title is set, or pass --project-name."
          : "Pass --project-name, --project-slug, and --version for this format.",
    });
  }

  const versionRaw =
    opts.cliVersionRaw !== ""
      ? opts.cliVersionRaw
      : opts.derived.version !== undefined && opts.derived.version !== ""
        ? opts.derived.version
        : "";

  if (versionRaw === "") {
    throw new ObjectifiedCliError({
      message:
        opts.sourceKind === "openapi-3" || opts.sourceKind === "asyncapi-2"
          ? "Could not determine catalog version from the spec (missing info.version). Pass --version."
          : `--create-or-map-project needs --version for specification kind '${opts.sourceKind}'.`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint:
        opts.sourceKind === "openapi-3" || opts.sourceKind === "asyncapi-2"
          ? "Ensure info.version is set and is a valid semver, or pass --version explicitly."
          : "Pass an explicit semantic version with --version.",
    });
  }

  const versionId = parseValidSemverVersionId(versionRaw);

  let slugRaw = opts.cliProjectSlug.trim();
  if (slugRaw === "") {
    slugRaw = suggestSlugFromName(name);
  }

  const slugCheck = validateProjectSlug(slugRaw);
  if (!slugCheck.ok) {
    throw new ObjectifiedCliError({
      message: slugCheck.message,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint:
        slugCheck.suggestion !== undefined
          ? `Try --project-slug ${slugCheck.suggestion}`
          : "Pass a valid slug with --project-slug.",
    });
  }

  return {
    projectName: name,
    projectSlug: slugCheck.slug,
    versionId,
  };
}
