import { describe, expect, it } from "vitest";

import type { ProjectSchema } from "../src/generated/models.js";
import {
  applyProjectListQuery,
  parseColumnKeys,
  parseFilterFlags,
  parseSortFlag,
  projectMatchesFilters,
  projectMatchesSearch,
  sortProjects,
  validateProjectColumns,
} from "../src/lib/projects/list-query.js";

function p(
  over: Partial<ProjectSchema> & Pick<ProjectSchema, "id" | "tenant_id" | "name" | "slug">,
): ProjectSchema {
  return {
    enabled: true,
    ...over,
  };
}

describe("projects list query helpers (#3202)", () => {
  it("parses columns with aliases", () => {
    expect(parseColumnKeys(undefined)).toEqual(["slug", "name", "domain", "versions", "latest"]);
    expect(parseColumnKeys("slug,name")).toEqual(["slug", "name"]);
    expect(parseColumnKeys("slug, latest_published_at ")).toEqual(["slug", "latest"]);
  });

  it("validates column keys", () => {
    expect(() => validateProjectColumns(["unknown"])).toThrow(/Unknown column/);
    expect(() => validateProjectColumns(["slug", "domains"])).toThrow(/Unknown column/);
    expect(() => validateProjectColumns(["slug", "description"])).not.toThrow();
  });

  it("parses filters", () => {
    expect(parseFilterFlags(["domain=finance"])).toEqual([{ key: "domain", value: "finance" }]);
    expect(() => parseFilterFlags(["nodomain"])).toThrow(/key=value/);
  });

  it("parses sort", () => {
    expect(parseSortFlag(undefined)).toEqual({ field: "slug", dir: "asc" });
    expect(parseSortFlag("-updated_at")).toEqual({ field: "updated_at", dir: "desc" });
    expect(() => parseSortFlag("nope")).toThrow(/Invalid --sort/);
  });

  it("filters and searches case-insensitively", () => {
    const row = p({
      id: "1",
      tenant_id: "t",
      name: "Payments API",
      slug: "payments-api",
      description: "Money",
      metadata: { domain: "finance" },
    });
    expect(projectMatchesFilters(row, [{ key: "domain", value: "FINANCE" }])).toBe(true);
    expect(projectMatchesFilters(row, [{ key: "domain", value: "saas" }])).toBe(false);
    expect(projectMatchesSearch(row, "payment")).toBe(true);
    expect(projectMatchesSearch(row, "zzz")).toBe(false);
  });

  it("sorts by slug", () => {
    const rows = [
      p({ id: "b", tenant_id: "t", name: "B", slug: "b-slug" }),
      p({ id: "a", tenant_id: "t", name: "A", slug: "a-slug" }),
    ];
    expect(sortProjects(rows, "slug", "asc").map((x) => x.slug)).toEqual(["a-slug", "b-slug"]);
  });

  it("applies combined query pipeline", () => {
    const rows = [
      p({
        id: "1",
        tenant_id: "t",
        name: "Alpha",
        slug: "alpha",
        metadata: { domain: "saas" },
      }),
      p({
        id: "2",
        tenant_id: "t",
        name: "Beta",
        slug: "beta",
        metadata: { domain: "finance" },
      }),
    ];
    const out = applyProjectListQuery(rows, {
      filters: [{ key: "domain", value: "finance" }],
      search: "be",
      sortField: "name",
      sortDir: "asc",
    });
    expect(out.map((x) => x.slug)).toEqual(["beta"]);
  });
});
