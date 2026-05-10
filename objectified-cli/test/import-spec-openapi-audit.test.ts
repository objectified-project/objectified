import { describe, expect, it } from "vitest";

import type { ChangeReportModel } from "../src/generated/models.js";
import {
  importSpecOpenApiAuditIsClean,
  importSpecOpenApiAuditSummarize,
} from "../src/lib/audit/import-spec-openapi-audit.js";

function emptyReport(): ChangeReportModel {
  return {
    schemaVersion: "1.0",
    schemas: { added: [], removed: [], modified: [] },
    properties: [],
    references: [],
    relationships: [],
    documentation: [],
    warnings: [],
    skipped: [],
  };
}

describe("importSpecOpenApiAudit", () => {
  it("is clean only when all diff sections are empty", () => {
    expect(importSpecOpenApiAuditIsClean(emptyReport())).toBe(true);
    const noisy = emptyReport();
    noisy.schemas.added.push({ name: "X" });
    expect(importSpecOpenApiAuditIsClean(noisy)).toBe(false);
  });

  it("summarizes counts", () => {
    const r = emptyReport();
    r.schemas.modified.push({ name: "Pet" });
    r.properties.push({ path: "/x" });
    r.warnings.push({ code: "x", message: "y", path: "/" });
    const s = importSpecOpenApiAuditSummarize(r);
    expect(s.ok).toBe(false);
    expect(s.schemasModified).toBe(1);
    expect(s.propertyChanges).toBe(1);
    expect(s.warningCount).toBe(1);
  });
});
