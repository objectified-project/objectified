import { describe, expect, it } from "vitest";

import { formatBrowsePublicProjectsHumanLines } from "../src/lib/browse/public-projects-format.js";

describe("formatBrowsePublicProjectsHumanLines", () => {
  it("renders table and footer for public directory", () => {
    const lines = formatBrowsePublicProjectsHumanLines({
      projects: [
        {
          slug: "payments-api",
          name: "Payments API",
          domain: "finance",
          published_versions: 3,
          latest_version: "2.1.0",
          latest_published_at: "2026-05-06T12:00:00.000Z",
        },
      ],
      tenantSlug: "acme-corp",
      truncated: false,
      totalAfterQuery: 1,
      searchActive: false,
      domainActive: false,
      hasPublishedActive: false,
      memberView: false,
      now: new Date("2026-05-08T12:00:00.000Z"),
    });
    expect(lines[0]).toContain("SLUG");
    expect(lines[0]).toContain("DOMAIN");
    expect(lines.some((l) => l.includes("payments-api"))).toBe(true);
    expect(lines.some((l) => l.includes("public project"))).toBe(true);
  });

  it("notes authenticated footer when memberView", () => {
    const lines = formatBrowsePublicProjectsHumanLines({
      projects: [],
      tenantSlug: "acme-corp",
      truncated: false,
      totalAfterQuery: 0,
      searchActive: false,
      domainActive: false,
      hasPublishedActive: false,
      memberView: true,
    });
    expect(lines.some((l) => l.includes("private projects"))).toBe(true);
  });
});
