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
