import type { ChangeReportModel } from "../client.js";

export type ImportSpecOpenApiAuditSummary = {
  ok: boolean;
  schemasAdded: number;
  schemasRemoved: number;
  schemasModified: number;
  propertyChanges: number;
  referenceChanges: number;
  relationshipChanges: number;
  documentationChanges: number;
  warningCount: number;
  skippedCount: number;
};

/** True when the change report shows no semantic drift (baseline → candidate). */
export function importSpecOpenApiAuditIsClean(report: ChangeReportModel): boolean {
  const { schemas } = report;
  return (
    schemas.added.length === 0 &&
    schemas.removed.length === 0 &&
    schemas.modified.length === 0 &&
    report.properties.length === 0 &&
    report.references.length === 0 &&
    report.relationships.length === 0 &&
    report.documentation.length === 0
  );
}

export function importSpecOpenApiAuditSummarize(report: ChangeReportModel): ImportSpecOpenApiAuditSummary {
  const { schemas } = report;
  const ok = importSpecOpenApiAuditIsClean(report);
  return {
    ok,
    schemasAdded: schemas.added.length,
    schemasRemoved: schemas.removed.length,
    schemasModified: schemas.modified.length,
    propertyChanges: report.properties.length,
    referenceChanges: report.references.length,
    relationshipChanges: report.relationships.length,
    documentationChanges: report.documentation.length,
    warningCount: report.warnings.length,
    skippedCount: report.skipped.length,
  };
}
