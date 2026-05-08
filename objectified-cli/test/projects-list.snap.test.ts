import { describe, expect, it } from "vitest";

import type { ProjectSchema } from "../src/generated/models.js";
import {
  ellipsizeMiddle,
  formatProjectsListHumanLines,
  formatRelativeAgo,
} from "../src/lib/projects/format.js";

function proj(
  base: Partial<ProjectSchema> & Pick<ProjectSchema, "id" | "tenant_id" | "name" | "slug">,
): ProjectSchema {
  return { enabled: true, ...base };
}

describe("projects list human table snapshots (#3202)", () => {
  const frozenNow = new Date("2026-05-07T15:00:00.000Z");

  it("default columns match issue-style layout (80 cols)", () => {
    const rows = [
      proj({
        id: "p1",
        tenant_id: "t1",
        name: "Payments API",
        slug: "payments-api",
        metadata: {
          domain: "finance",
          versions_count: 8,
          latest_published_version: "2.1.0",
          latest_published_at: "2026-05-05T12:00:00.000Z",
        },
      }),
      proj({
        id: "p2",
        tenant_id: "t1",
        name: "Catalog API",
        slug: "catalog-api",
        metadata: {
          domain: "saas",
          versions_count: 3,
          latest_published_version: "1.0.0",
          latest_published_at: "2026-04-01T08:00:00.000Z",
        },
      }),
      proj({
        id: "p3",
        tenant_id: "t1",
        name: "Webhooks",
        slug: "webhooks",
        metadata: { domain: "saas" },
      }),
    ];
    const lines = formatProjectsListHumanLines({
      projects: rows,
      tenantSlug: "acme-corp",
      columnKeys: ["slug", "name", "domain", "versions", "latest"],
      truncated: false,
      totalAfterQuery: 3,
      now: frozenNow,
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("truncation footer when capped by --limit", () => {
    const rows = [
      proj({ id: "1", tenant_id: "t", name: "A", slug: "a", metadata: { domain: "x" } }),
    ];
    const lines = formatProjectsListHumanLines({
      projects: rows,
      tenantSlug: "acme-corp",
      columnKeys: ["slug", "name", "domain", "versions", "latest"],
      truncated: true,
      totalAfterQuery: 50,
      now: frozenNow,
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });
});

describe("projects list text helpers (#3202)", () => {
  it("ellipsizeMiddle shortens long slugs", () => {
    expect(ellipsizeMiddle("abcdefghijklmnop", 8)).toMatchInlineSnapshot(`"abc...op"`);
  });

  it("formatRelativeAgo is compact", () => {
    const now = Date.parse("2026-05-07T15:00:00.000Z");
    expect(formatRelativeAgo("2026-05-07T14:30:00.000Z", now)).toMatchInlineSnapshot(`"30m ago"`);
  });

  it("formats 100-project table quickly", () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      proj({
        id: `id-${String(i)}`,
        tenant_id: "t",
        name: `Project ${String(i)}`,
        slug: `proj-${String(i)}`,
        metadata: { domain: "saas", versions_count: i % 5 },
      }),
    );
    const t0 = performance.now();
    formatProjectsListHumanLines({
      projects: rows,
      tenantSlug: "tenant",
      columnKeys: ["slug", "name", "domain", "versions", "latest"],
      truncated: false,
      totalAfterQuery: 100,
      now: new Date("2026-05-07T15:00:00.000Z"),
    });
    const ms = performance.now() - t0;
    const budgetMs = process.env.CI ? 1500 : 500;
    expect(ms).toBeLessThan(budgetMs);
  });
});
