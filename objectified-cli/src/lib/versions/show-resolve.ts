import type { ObjectifiedApi, VersionSchema, VersionTagSchema } from "../client.js";
import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";
import { projectRefLooksLikeUuid } from "../resolve.js";

import { compareSemverVersionIdsAsc } from "./list-query.js";

export type VersionShowResolution =
  | { kind: "revision_id"; revisionId: string }
  | { kind: "semver"; semverArg: string }
  | { kind: "tag"; tagName: string; resolvedVersionId: string };

/** Ascending semver order; immediate predecessor is one index lower. */
export function findSemverPredecessor(
  allVersions: VersionSchema[],
  currentVersionId: string,
): VersionSchema | undefined {
  const sorted = [...allVersions].sort((a, b) =>
    compareSemverVersionIdsAsc(a.version_id, b.version_id),
  );
  const idx = sorted.findIndex(
    (v) => compareSemverVersionIdsAsc(v.version_id, currentVersionId) === 0,
  );
  if (idx <= 0) return undefined;
  return sorted[idx - 1];
}

function semverLookupCandidates(ref: string): string[] {
  if (!/^v?\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/i.test(ref)) return [ref];
  const stripped = ref.replace(/^v/i, "");
  const prefixed = `v${stripped}`;
  return ref.toLowerCase().startsWith("v") ? [ref, stripped] : [ref, prefixed];
}

export async function resolveVersionForShow(opts: {
  api: ObjectifiedApi;
  tenantSlug: string;
  projectId: string;
  rawRef: string;
  tags: VersionTagSchema[];
}): Promise<{ version: VersionSchema; resolution: VersionShowResolution }> {
  const ref = opts.rawRef.trim();
  if (ref === "") {
    throw new ObjectifiedCliError({
      message: "Version semver, revision UUID, or tag name is required.",
      exitCode: EXIT_CODES.MISUSE,
      title: "Missing argument",
      hint: "Run `objectified versions show <project> <version>`.",
    });
  }

  if (projectRefLooksLikeUuid(ref)) {
    const version = await opts.api.getVersion(opts.tenantSlug, opts.projectId, ref.toLowerCase());
    return { version, resolution: { kind: "revision_id", revisionId: ref.toLowerCase() } };
  }

  for (const candidate of semverLookupCandidates(ref)) {
    try {
      const version = await opts.api.getVersionByVersionId(opts.tenantSlug, opts.projectId, candidate);
      return { version, resolution: { kind: "semver", semverArg: ref } };
    } catch (e) {
      if (!(e instanceof ObjectifiedCliError) || e.exitCode !== EXIT_CODES.NOT_FOUND) {
        throw e;
      }
    }
  }

  const tag = opts.tags.find((t) => t.name === ref);
  if (tag !== undefined) {
    const version = await opts.api.getVersion(opts.tenantSlug, opts.projectId, tag.version_id);
    return {
      version,
      resolution: {
        kind: "tag",
        tagName: tag.name,
        resolvedVersionId: version.version_id,
      },
    };
  }

  throw new ObjectifiedCliError({
    message: `Version not found: ${ref}`,
    exitCode: EXIT_CODES.NOT_FOUND,
    title: "Not found",
    hint: "Pass a semver (`v2.1.0` or `2.1.0`), a revision UUID, or a tag name such as `stable`. Try `objectified versions list <project>`.",
  });
}
