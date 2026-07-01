/**
 * Pure presentation helpers for the inline Lint & Score panel (MFI-25.5, #4090).
 *
 * The panel renders a grade gauge, category bars, and a findings list from the server lint report
 * (`GET /api/catalog/{id}/lint`). These helpers are the panel's data-shaping layer, kept pure (no
 * React, no DOM) so the gauge geometry, the category-bar source selection, and the MUST/SHOULD
 * mapping are unit-testable in isolation. The authoritative score/grade always come from the server
 * report — nothing here recomputes them.
 */

import type {
  LintCategoryScore,
  LintSeverity,
  VersionLintFinding,
  VersionLintReport,
} from './version-lint-report';

/** A category's severity tally, used for the fallback bars when real category scores are absent. */
export interface CategorySeverityBreakdown {
  /** The raw category key from the findings (e.g. `documentation`). */
  category: string;
  error: number;
  warning: number;
  info: number;
  /** Total findings in the category (error + warning + info). */
  total: number;
}

/** Clamp any numeric input to an integer in the inclusive 0–100 score range. */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Resolve the per-category rollup scores (MFI-25.6) from a report, or `null` when the enrichment is
 * absent so the caller can fall back to the severity breakdown. Filters out malformed entries and
 * clamps scores into range; returns `null` (not `[]`) when there is nothing usable, so an empty
 * `categories: []` from the server reads the same as "not provided".
 */
export function resolveCategoryScores(
  report: Pick<VersionLintReport, 'categories'> | null | undefined,
): LintCategoryScore[] | null {
  const raw = report?.categories;
  if (!Array.isArray(raw)) return null;
  const scores = raw
    .filter(
      (c): c is LintCategoryScore =>
        !!c && typeof c.name === 'string' && c.name.trim() !== '' && Number.isFinite(c.score),
    )
    .map((c) => ({ name: c.name, score: clampScore(c.score) }));
  return scores.length > 0 ? scores : null;
}

/** Severity weight for ordering (higher = more severe), matching the findings sort. */
const SEVERITY_WEIGHT: Record<string, number> = { error: 100, warning: 10, info: 1 };

/**
 * Group findings by category into severity tallies, ordered by severity weight (categories with
 * errors first, then warnings, then info), breaking ties alphabetically. This is the graceful
 * fallback for the category bars until real per-category scores (MFI-25.6) are available: it renders
 * the shape of the problem (which categories carry the most severe findings) without inventing a
 * 0–100 score the server has not computed.
 */
export function deriveCategorySeverityBreakdown(
  findings: readonly VersionLintFinding[],
): CategorySeverityBreakdown[] {
  const byCategory = new Map<string, CategorySeverityBreakdown>();
  for (const f of findings) {
    const key = (f.category || 'other').trim() || 'other';
    let row = byCategory.get(key);
    if (!row) {
      row = { category: key, error: 0, warning: 0, info: 0, total: 0 };
      byCategory.set(key, row);
    }
    if (f.severity === 'error' || f.severity === 'warning' || f.severity === 'info') {
      row[f.severity] += 1;
    }
    row.total += 1;
  }
  return [...byCategory.values()].sort((a, b) => {
    const wa = a.error * SEVERITY_WEIGHT.error + a.warning * SEVERITY_WEIGHT.warning + a.info;
    const wb = b.error * SEVERITY_WEIGHT.error + b.warning * SEVERITY_WEIGHT.warning + b.info;
    if (wa !== wb) return wb - wa;
    return a.category.localeCompare(b.category);
  });
}

/**
 * The conformance strength a finding's severity implies, mirroring the mockup's MUST/SHOULD chip:
 * an `error` is a MUST (a hard requirement violated); a `warning`/`info` is a SHOULD (a
 * recommendation). Derived from severity because the report has no separate MUST/SHOULD field.
 */
export function mustLabelForSeverity(severity: LintSeverity | string): 'MUST' | 'SHOULD' {
  return severity === 'error' ? 'MUST' : 'SHOULD';
}

/**
 * Humanize a category key for a bar label: `api-design` / `api_design` → `Api design`. Kept simple
 * (sentence case on the first token) so it degrades cleanly for unknown categories.
 */
export function humanizeCategory(category: string): string {
  const spaced = category.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return 'Other';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The `stroke-dashoffset` for an SVG progress ring so that `score`% of the circumference is drawn.
 * A score of 100 fills the ring (offset 0); 0 leaves it empty (offset = circumference). The input is
 * clamped so out-of-range scores never over/under-draw the arc.
 */
export function gaugeDashOffset(score: number, circumference: number): number {
  const pct = clampScore(score) / 100;
  return circumference * (1 - pct);
}
