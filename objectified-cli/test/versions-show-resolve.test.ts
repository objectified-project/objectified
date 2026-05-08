import { describe, expect, it } from "vitest";

import type { ClassSchema, VersionSchema } from "../src/generated/models.js";
import {
  extractPathsDeltaFromChangeModel,
  orderedStarTags,
  summarizeClassDelta,
} from "../src/lib/versions/show-format.js";
import { findSemverPredecessor } from "../src/lib/versions/show-resolve.js";

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
