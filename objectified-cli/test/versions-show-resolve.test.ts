import { describe, expect, it } from "vitest";

import type { ClassSchema, VersionSchema, VersionTagSchema } from "../src/generated/models.js";
import type { ObjectifiedApi } from "../src/lib/client.js";
import { ObjectifiedCliError } from "../src/lib/errors.js";
import { EXIT_CODES } from "../src/lib/exit-codes.js";
import {
  extractPathsDeltaFromChangeModel,
  orderedStarTags,
  summarizeClassDelta,
  tagsOnRevisionFromIndex,
} from "../src/lib/versions/show-format.js";
import { findSemverPredecessor, resolveVersionForShow } from "../src/lib/versions/show-resolve.js";

function V(
  partial: Partial<VersionSchema> & Pick<VersionSchema, "id" | "project_id" | "version_id">,
): VersionSchema {
  return {
    enabled: true,
    published: false,
    ...partial,
  };
}

describe("findSemverPredecessor (#3209)", () => {
  it("returns the immediate older semver neighbor", () => {
    const versions: VersionSchema[] = [
      V({ id: "a1", project_id: "p", version_id: "1.0.0", published: true }),
      V({ id: "a2", project_id: "p", version_id: "2.0.0", published: true }),
      V({ id: "a3", project_id: "p", version_id: "2.1.0", published: true }),
    ];
    const prev = findSemverPredecessor(versions, "2.1.0");
    expect(prev?.id).toBe("a2");
    expect(prev?.version_id).toBe("2.0.0");
  });

  it("returns undefined for the lowest semver", () => {
    const versions: VersionSchema[] = [
      V({ id: "a1", project_id: "p", version_id: "1.0.0" }),
      V({ id: "a2", project_id: "p", version_id: "2.0.0" }),
    ];
    expect(findSemverPredecessor(versions, "1.0.0")).toBeUndefined();
  });

  it("matches the current version id even when only one side has a leading v", () => {
    const versions: VersionSchema[] = [
      V({ id: "a1", project_id: "p", version_id: "1.0.0" }),
      V({ id: "a2", project_id: "p", version_id: "v2.0.0" }),
      V({ id: "a3", project_id: "p", version_id: "2.1.0" }),
    ];
    const prev = findSemverPredecessor(versions, "v2.1.0");
    expect(prev?.id).toBe("a2");
    expect(prev?.version_id).toBe("v2.0.0");
  });
});

function createApiStub(overrides: Partial<ObjectifiedApi>): ObjectifiedApi {
  return {
    lastRequestId: undefined,
    lastRetriesAttempted: 0,
    listProjects: async () => [],
    fetchProjectDomainsAllowlist: async () => [],
    createProject: async () => {
      throw new Error("not implemented");
    },
    getProject: async () => {
      throw new Error("not implemented");
    },
    getProjectBySlug: async () => {
      throw new Error("not implemented");
    },
    listVersions: async () => [],
    getVersion: async () => {
      throw new Error("not implemented");
    },
    getVersionByVersionId: async () => {
      throw new Error("not implemented");
    },
    checkRevisionCompatibility: async () => {
      throw new Error("not implemented");
    },
    tryGetVersionChangeReport: async () => null,
    listVersionTags: async () => [],
    listWorkflowAudit: async () => {
      throw new Error("not implemented");
    },
    listClasses: async () => [],
    listPrimitives: async () => [],
    listMyTenantsPage: async () => {
      throw new Error("not implemented");
    },
    getTenantInfo: async () => {
      throw new Error("not implemented");
    },
    verifyTenantAccess: async () => undefined,
    ...overrides,
  };
}

describe("resolveVersionForShow (#3209)", () => {
  it("falls back between semver forms with and without leading v", async () => {
    const version = V({ id: "a3", project_id: "p", version_id: "2.1.0" });
    const api = createApiStub({
      getVersionByVersionId: async (_tenant, _project, versionId) => {
        if (versionId === "v2.1.0") {
          throw new ObjectifiedCliError({
            message: "missing",
            exitCode: EXIT_CODES.NOT_FOUND,
          });
        }
        if (versionId === "2.1.0") return version;
        throw new Error(`unexpected versionId ${versionId}`);
      },
    });

    const resolved = await resolveVersionForShow({
      api,
      tenantSlug: "acme",
      projectId: "p",
      rawRef: "v2.1.0",
      tags: [],
    });

    expect(resolved.version).toBe(version);
    expect(resolved.resolution).toEqual({ kind: "semver", semverArg: "v2.1.0" });
  });

  it("resolves tag names to their backing revision", async () => {
    const version = V({ id: "rev-1", project_id: "p", version_id: "2.1.0" });
    const tags: VersionTagSchema[] = [
      { id: "tag-1", project_id: "p", name: "stable", version_id: "rev-1" },
    ];
    const api = createApiStub({
      getVersionByVersionId: async () => {
        throw new ObjectifiedCliError({
          message: "missing",
          exitCode: EXIT_CODES.NOT_FOUND,
        });
      },
      getVersion: async (_tenant, _project, revisionId) => {
        expect(revisionId).toBe("rev-1");
        return version;
      },
    });

    const resolved = await resolveVersionForShow({
      api,
      tenantSlug: "acme",
      projectId: "p",
      rawRef: "stable",
      tags,
    });

    expect(resolved.version).toBe(version);
    expect(resolved.resolution).toEqual({
      kind: "tag",
      tagName: "stable",
      resolvedVersionId: "2.1.0",
    });
  });
});

describe("summarizeClassDelta (#3209)", () => {
  it("counts added, removed, and schema-modified classes by name", () => {
    const base: ClassSchema[] = [
      {
        id: "c1",
        version_id: "v-old",
        name: "Keep",
        schema: { type: "object" },
      },
      {
        id: "c2",
        version_id: "v-old",
        name: "Gone",
        schema: { type: "string" },
      },
    ];
    const head: ClassSchema[] = [
      {
        id: "c3",
        version_id: "v-new",
        name: "Keep",
        schema: { type: "object", extra: true },
      },
      {
        id: "c4",
        version_id: "v-new",
        name: "New",
        schema: {},
      },
    ];
    expect(summarizeClassDelta(base, head)).toEqual({
      totalHead: 2,
      added: 1,
      removed: 1,
      modified: 1,
    });
  });

  it("does not count schema objects with different key order as modified", () => {
    const base: ClassSchema[] = [
      {
        id: "c1",
        version_id: "v-old",
        name: "Keep",
        schema: { properties: { a: { type: "string" }, b: { type: "number" } }, type: "object" },
      },
    ];
    const head: ClassSchema[] = [
      {
        id: "c2",
        version_id: "v-new",
        name: "Keep",
        schema: { type: "object", properties: { b: { type: "number" }, a: { type: "string" } } },
      },
    ];
    expect(summarizeClassDelta(base, head)).toEqual({
      totalHead: 1,
      added: 0,
      removed: 0,
      modified: 0,
    });
  });
});

describe("extractPathsDeltaFromChangeModel (#3209)", () => {
  it("reads paths.added/removed/modified lengths when present", () => {
    expect(
      extractPathsDeltaFromChangeModel({
        paths: {
          added: [{ x: "a" }, { x: "b" }],
          removed: [],
          modified: [{ x: "m" }],
        },
      }),
    ).toEqual({ added: 2, removed: 0, modified: 1 });
  });

  it("returns undefined when paths section is missing", () => {
    expect(
      extractPathsDeltaFromChangeModel({ schemas: { added: [], removed: [], modified: [] } }),
    ).toBeUndefined();
  });
});

describe("orderedStarTags (#3209)", () => {
  it("orders stable, latest, next before other tags", () => {
    expect(orderedStarTags(["zzz", "latest", "stable", "next"])).toEqual([
      "stable",
      "latest",
      "next",
      "zzz",
    ]);
  });
});

describe("tagsOnRevisionFromIndex (#3209)", () => {
  it("trims and de-duplicates tag names on the same revision", () => {
    expect(
      tagsOnRevisionFromIndex(
        [
          { id: "tag-1", project_id: "p", name: " stable ", version_id: "rev-1" },
          { id: "tag-2", project_id: "p", name: "stable", version_id: "rev-1" },
          { id: "tag-3", project_id: "p", name: "next", version_id: "rev-1" },
          { id: "tag-4", project_id: "p", name: "latest", version_id: "rev-2" },
        ],
        "rev-1",
      ),
    ).toEqual(["stable", "next"]);
  });
});
