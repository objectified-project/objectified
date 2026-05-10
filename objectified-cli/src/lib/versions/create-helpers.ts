import semver from "semver";

import type { VersionSchema } from "../client.js";
import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

import { compareSemverVersionIdsAsc, versionStateMembership } from "./list-query.js";

export function parseValidSemverVersionId(raw: string): string {
  const t = raw.trim();
  if (t === "") {
    throw new ObjectifiedCliError({
      message: "Version string is empty.",
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: "Pass a semantic version such as 2.2.0-rc.1 (see https://semver.org/).",
    });
  }
  const v = semver.valid(t, { loose: true });
  if (v === null) {
    throw new ObjectifiedCliError({
      message: `Invalid semantic version: ${t}`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: "Use a valid semver (e.g. 1.2.0, 2.0.0-beta.1). A leading 'v' is accepted.",
    });
  }
  return v;
}

export type ResolveImportCatalogVersionIdResult = {
  /** Normalized semver when parseable, or the trimmed raw label when not (non-strict only). */
  versionId: string;
  /** Human-readable warnings for stderr (non-strict mode). */
  semverWarnings: string[];
};

/**
 * Catalog import version policy: default accepts loose semver or arbitrary labels and warns;
 * `--strict` requires SemVer 2.0 forms that satisfy strict parsing (no loose-only coercion).
 */
export function resolveImportCatalogVersionId(
  raw: string,
  strict: boolean,
): ResolveImportCatalogVersionIdResult {
  const t = raw.trim();
  if (t === "") {
    throw new ObjectifiedCliError({
      message: "Version string is empty.",
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: "Pass a semantic version such as 2.2.0-rc.1 (see https://semver.org/).",
    });
  }

  const strictNorm = semver.valid(t, { loose: false });
  const looseNorm = semver.valid(t, { loose: true });

  if (strict) {
    if (strictNorm === null) {
      throw new ObjectifiedCliError({
        message: `Invalid semantic version (strict mode): ${t}`,
        exitCode: EXIT_CODES.VALIDATION,
        title: "Validation failed",
        hint: "Use SemVer 2.0 accepted by strict parsing (e.g. 1.2.0, 2.0.0-beta.1). Run without --strict to allow loose semver or non-semver catalog version ids.",
      });
    }
    return { versionId: strictNorm, semverWarnings: [] };
  }

  const semverWarnings: string[] = [];
  if (strictNorm !== null) {
    return { versionId: strictNorm, semverWarnings };
  }
  if (looseNorm !== null) {
    semverWarnings.push(
      `Import catalog version ${JSON.stringify(t)} is not strict SemVer 2.0; using normalized ${JSON.stringify(looseNorm)} (loose parse). Use --strict to require strict semver.`,
    );
    return { versionId: looseNorm, semverWarnings };
  }

  semverWarnings.push(
    `Import catalog version ${JSON.stringify(t)} is not parseable as semver; forwarding as-is. The API may reject it. Use --strict to require SemVer 2.0.`,
  );
  return { versionId: t, semverWarnings };
}

/** Latest published revision (prefers strict semver ordering when parseable; ignores drafts). */
export function pickLatestPublishedRevision(versions: VersionSchema[]): VersionSchema | undefined {
  const candidates = versions.filter((v) => {
    const m = versionStateMembership(v);
    return m.has("published");
  });
  if (candidates.length === 0) return undefined;
  const sorted = [...candidates].sort((a, b) => {
    const sa = semver.parse(a.version_id.trim(), { loose: true });
    const sb = semver.parse(b.version_id.trim(), { loose: true });
    if (sa !== null && sb !== null) return semver.compare(sa, sb);
    if (sa !== null) return 1;
    if (sb !== null) return -1;
    return compareSemverVersionIdsAsc(a.version_id, b.version_id);
  });
  return sorted[sorted.length - 1];
}

/** Server head for linear projects: revision with greatest created_at (ties fall back to stable sort). */
export function resolveHeadRevisionId(versions: VersionSchema[]): string | undefined {
  if (versions.length === 0) return undefined;
  const sorted = [...versions].sort((a, b) => {
    const ta = a.created_at ?? "";
    const tb = b.created_at ?? "";
    if (ta > tb) return -1;
    if (ta < tb) return 1;
    return a.id.localeCompare(b.id);
  });
  return sorted[0]?.id;
}

export function versionLineExists(versions: VersionSchema[], normalizedNewVersionId: string): boolean {
  for (const v of versions) {
    const existing = semver.valid(v.version_id.trim(), { loose: true });
    if (existing !== null && semver.eq(existing, normalizedNewVersionId)) {
      return true;
    }
  }
  return false;
}

export function notesToCommitFields(notes: string): {
  shortMessage: string | null;
  changelog: string | null;
} {
  const text = notes.replace(/\r\n/g, "\n").trimEnd();
  if (text === "") {
    return { shortMessage: null, changelog: null };
  }
  const firstNl = text.indexOf("\n");
  const head = (firstNl === -1 ? text : text.slice(0, firstNl)).trim();
  const shortMessage = head === "" ? null : head.slice(0, 500);
  return { shortMessage, changelog: text };
}
