import { describe, expect, it } from "vitest";

import { formatBrowsePublicTenantsHumanLines } from "../src/lib/browse/public-tenants-format.js";

describe("formatBrowsePublicTenantsHumanLines", () => {
  const now = new Date("2026-05-08T12:00:00.000Z");

  it("renders table and directory footer without search", () => {
    const lines = formatBrowsePublicTenantsHumanLines({
      tenants: [
        {
          slug: "acme-corp",
          name: "Acme Corporation",
          project_count: 7,
          published_versions: 18,
          latest_version: "2.1.0",
          latest_activity_at: "2026-05-06T12:00:00.000Z",
        },
      ],
      directoryTenantTotal: 42,
      truncated: false,
      totalAfterQuery: 1,
      searchActive: false,
      now,
    });
    expect(lines.some((l) => l.includes("acme-corp"))).toBe(true);
    expect(lines.some((l) => l.includes("42 public tenants"))).toBe(true);
    expect(lines.some((l) => l.includes("--search"))).toBe(true);
  });

  it("notes truncation when capped by --limit", () => {
    const lines = formatBrowsePublicTenantsHumanLines({
      tenants: [{ slug: "a", name: "A", project_count: 1, published_versions: 1 }],
      directoryTenantTotal: 99,
      truncated: true,
      totalAfterQuery: 50,
      searchActive: false,
      now,
    });
    expect(lines.some((l) => l.includes("use --all"))).toBe(true);
  });

  it("uses search footer when filtering", () => {
    const lines = formatBrowsePublicTenantsHumanLines({
      tenants: [{ slug: "demo", name: "Demo", project_count: 1, published_versions: 2 }],
      directoryTenantTotal: 100,
      truncated: false,
      totalAfterQuery: 1,
      searchActive: true,
      now,
    });
    expect(lines.some((l) => l.includes("match your search"))).toBe(true);
  });
});
