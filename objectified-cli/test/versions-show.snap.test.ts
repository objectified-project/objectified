import { describe, expect, it } from "vitest";

import type { CompatibilityCheckResponse, VersionSchema } from "../src/generated/models.js";
import type { VersionShowResolution } from "../src/lib/versions/show-resolve.js";
import {
  buildPublishedSpecUrls,
  formatVersionsShowHumanLines,
} from "../src/lib/versions/show-format.js";

function V(
  partial: Partial<VersionSchema> & Pick<VersionSchema, "id" | "project_id" | "version_id">,
): VersionSchema {
  return {
    enabled: true,
    published: false,
    ...partial,
  };
}

const baseCompat: CompatibilityCheckResponse = {
  overall: "safe",
  baseRevisionId: "22222222-2222-2222-2222-222222222222",
  headRevisionId: "33333333-3333-3333-3333-333333333333",
  findings: [],
  reportFingerprint: "sha256:test-fingerprint",
};

describe("versions show human snapshots (#3209)", () => {
  const version = V({
    id: "33333333-3333-3333-3333-333333333333",
    project_id: "p1",
    version_id: "2.1.0",
    published: true,
    published_at: "2026-05-04T12:42:00.000Z",
    publishedImmutable: false,
    shortMessage: "Adds /refunds endpoint; removes deprecated /v1/charges/legacy.",
    creator_email: "kenji@objectified.dev",
    parent_version_id: "2.0.0",
  });

  const specUrls = buildPublishedSpecUrls({
    baseUrl: "https://api.objectified.dev",
    tenantSlug: "acme",
    projectSlug: "payments-api",
    versionSlug: version.version_id,
  });

  const sep = "─".repeat(62);

  it("semver resolution path", () => {
    const resolution: VersionShowResolution = { kind: "semver", semverArg: "2.1.0" };
    const lines = formatVersionsShowHumanLines({
      projectName: "Payments API",
      version,
      tagsOnRevision: ["stable", "latest"],
      resolution,
      predecessorLabel: "v2.0.0",
      compatibility: baseCompat,
      classDelta: { totalHead: 24, added: 3, removed: 1, modified: 5 },
      pathsDelta: { added: 2, removed: 0, modified: 4 },
      forkedFromDisplay: "v2.0.0",
      specUrls,
      separator: sep,
      titleBold: (s) => s,
      starGlyph: "★",
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("revision UUID resolution path", () => {
    const resolution: VersionShowResolution = {
      kind: "revision_id",
      revisionId: "33333333-3333-3333-3333-333333333333",
    };
    const lines = formatVersionsShowHumanLines({
      projectName: "Payments API",
      version,
      tagsOnRevision: ["stable", "latest"],
      resolution,
      predecessorLabel: "v2.0.0",
      compatibility: baseCompat,
      classDelta: { totalHead: 24, added: 3, removed: 1, modified: 5 },
      pathsDelta: { added: 2, removed: 0, modified: 4 },
      forkedFromDisplay: "v2.0.0",
      specUrls,
      separator: sep,
      titleBold: (s) => s,
      starGlyph: "★",
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("tag-name resolution path (prints underlying semver)", () => {
    const resolution: VersionShowResolution = {
      kind: "tag",
      tagName: "stable",
      resolvedVersionId: "2.1.0",
    };
    const lines = formatVersionsShowHumanLines({
      projectName: "Payments API",
      version,
      tagsOnRevision: ["stable", "latest"],
      resolution,
      predecessorLabel: "v2.0.0",
      compatibility: baseCompat,
      classDelta: { totalHead: 24, added: 3, removed: 1, modified: 5 },
      pathsDelta: { added: 2, removed: 0, modified: 4 },
      forkedFromDisplay: "v2.0.0",
      specUrls,
      separator: sep,
      titleBold: (s) => s,
      starGlyph: "★",
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });
});
