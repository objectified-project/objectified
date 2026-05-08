import { describe, expect, it } from "vitest";

import type { VersionSchema } from "../src/lib/client.js";
import {
  parseValidSemverVersionId,
  pickLatestPublishedRevision,
  resolveHeadRevisionId,
  versionLineExists,
} from "../src/lib/versions/create-helpers.js";

function v(partial: Partial<VersionSchema> & Pick<VersionSchema, "id" | "version_id">): VersionSchema {
  return {
    project_id: "p",
    published: false,
    ...partial,
  } as VersionSchema;
}

describe("versions create helpers (#3210)", () => {
  it("normalizes valid semver (including prerelease)", () => {
    expect(parseValidSemverVersionId("v2.2.0-rc.1")).toBe("2.2.0-rc.1");
    expect(parseValidSemverVersionId("  1.0.0  ")).toBe("1.0.0");
  });

  it("throws validation exit on invalid semver strings", () => {
    expect(() => parseValidSemverVersionId("not-a-version")).toThrow(/Invalid semantic version/);
  });

  it("picks highest semver among published rows", () => {
    const rows = [
      v({ id: "a", version_id: "1.0.0", published: true, created_at: "2026-01-01T00:00:00Z" }),
      v({ id: "b", version_id: "2.0.0-beta.1", published: true, created_at: "2026-01-02T00:00:00Z" }),
      v({ id: "c", version_id: "1.5.0", published: true, created_at: "2026-01-03T00:00:00Z" }),
      v({ id: "d", version_id: "3.0.0", published: false, created_at: "2026-02-01T00:00:00Z" }),
    ];
    expect(pickLatestPublishedRevision(rows)?.id).toBe("b");
  });

  it("resolves head by created_at descending", () => {
    const rows = [
      v({ id: "old", version_id: "1.0.0", created_at: "2026-01-01T00:00:00Z" }),
      v({ id: "mid", version_id: "1.1.0", created_at: "2026-02-01T00:00:00Z" }),
      v({ id: "new", version_id: "1.2.0", created_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(resolveHeadRevisionId(rows)).toBe("new");
  });

  it("detects semver collisions with normalization", () => {
    const rows = [v({ id: "x", version_id: "v1.0.0", published: true })];
    expect(versionLineExists(rows, "1.0.0")).toBe(true);
    expect(versionLineExists(rows, "1.0.1")).toBe(false);
  });
});
