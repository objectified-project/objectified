import { describe, expect, it } from "vitest";

import { formatBrowsePublicVersionsHumanLines } from "../src/lib/browse/public-versions-format.js";

describe("formatBrowsePublicVersionsHumanLines", () => {
  it("renders header and rows within 80 columns", () => {
    const lines = formatBrowsePublicVersionsHumanLines({
      versions: [
        {
          version_id: "2.1.0",
          published_at: "2026-05-04T12:00:00.000Z",
          tags: ["stable", "latest"],
          changes_summary: "+2 paths, ~5 classes vs v2.0.0",
        },
      ],
      tenantSlug: "acme-corp",
      projectSlug: "payments-api",
      truncated: false,
      totalAfterQuery: 1,
      sinceActive: false,
      memberView: false,
    });
    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0].length).toBeLessThanOrEqual(80);
    expect(lines[1]).toContain("v2.1.0");
    expect(lines[1]).toContain("2026-05-04");
    expect(lines.some((l) => l.includes("stable"))).toBe(true);
  });
});
