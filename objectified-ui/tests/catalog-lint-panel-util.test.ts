/**
 * Unit tests for the pure Lint & Score panel helpers (MFI-25.5, #4090).
 *
 * These cover the data-shaping the inline panel depends on: gauge geometry, choosing real category
 * scores over the severity-breakdown fallback, the fallback ordering, MUST/SHOULD mapping, and the
 * category humanizer — all without React or the DOM.
 */

import {
  clampScore,
  deriveCategorySeverityBreakdown,
  gaugeDashOffset,
  humanizeCategory,
  mustLabelForSeverity,
  resolveCategoryScores,
} from '../src/app/utils/catalog-lint-panel';
import type { VersionLintFinding } from '../src/app/utils/version-lint-report';

function finding(over: Partial<VersionLintFinding>): VersionLintFinding {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    path: over.path ?? 'components.schemas.X',
    category: over.category ?? 'documentation',
    rule: over.rule ?? 'documentation.missing',
    severity: over.severity ?? 'warning',
    message: over.message ?? 'msg',
  };
}

describe('clampScore', () => {
  it('rounds and clamps into the 0–100 range', () => {
    expect(clampScore(87.4)).toBe(87);
    expect(clampScore(87.6)).toBe(88);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
  });

  it('coerces non-finite input to 0', () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('gaugeDashOffset', () => {
  const C = 100;
  it('leaves the ring empty at 0 and fills it at 100', () => {
    expect(gaugeDashOffset(0, C)).toBe(100);
    expect(gaugeDashOffset(100, C)).toBe(0);
  });
  it('is linear in the score', () => {
    expect(gaugeDashOffset(75, C)).toBeCloseTo(25);
  });
  it('clamps out-of-range scores', () => {
    expect(gaugeDashOffset(200, C)).toBe(0);
    expect(gaugeDashOffset(-10, C)).toBe(100);
  });
});

describe('resolveCategoryScores', () => {
  it('returns null when categories are absent (pre-MFI-25.6)', () => {
    expect(resolveCategoryScores({ categories: null })).toBeNull();
    expect(resolveCategoryScores({ categories: undefined })).toBeNull();
    expect(resolveCategoryScores(null)).toBeNull();
  });

  it('returns null for an empty array (reads as "not provided")', () => {
    expect(resolveCategoryScores({ categories: [] })).toBeNull();
  });

  it('keeps valid entries, clamps scores, and drops malformed ones', () => {
    const result = resolveCategoryScores({
      categories: [
        { name: 'documentation', score: 88.6 },
        { name: 'naming', score: 150 },
        // malformed entries below must be filtered out
        { name: '', score: 50 },
        { name: 'x', score: Number.NaN as unknown as number },
        null as unknown as { name: string; score: number },
      ],
    });
    expect(result).toEqual([
      { name: 'documentation', score: 89 },
      { name: 'naming', score: 100 },
    ]);
  });
});

describe('deriveCategorySeverityBreakdown', () => {
  it('tallies severities per category and totals them', () => {
    const rows = deriveCategorySeverityBreakdown([
      finding({ category: 'documentation', severity: 'warning' }),
      finding({ category: 'documentation', severity: 'info' }),
      finding({ category: 'structure', severity: 'error' }),
    ]);
    const docs = rows.find((r) => r.category === 'documentation');
    expect(docs).toEqual({ category: 'documentation', error: 0, warning: 1, info: 1, total: 2 });
  });

  it('orders categories with the most severe findings first', () => {
    const rows = deriveCategorySeverityBreakdown([
      finding({ category: 'documentation', severity: 'info' }),
      finding({ category: 'documentation', severity: 'info' }),
      finding({ category: 'structure', severity: 'error' }),
    ]);
    // structure (1 error) outranks documentation (2 info) despite fewer findings.
    expect(rows.map((r) => r.category)).toEqual(['structure', 'documentation']);
  });

  it('breaks ties alphabetically and buckets blank categories as "other"', () => {
    const rows = deriveCategorySeverityBreakdown([
      finding({ category: 'naming', severity: 'warning' }),
      finding({ category: 'documentation', severity: 'warning' }),
      finding({ category: '  ', severity: 'warning' }),
    ]);
    expect(rows.map((r) => r.category)).toEqual(['documentation', 'naming', 'other']);
  });

  it('returns [] for no findings', () => {
    expect(deriveCategorySeverityBreakdown([])).toEqual([]);
  });
});

describe('mustLabelForSeverity', () => {
  it('maps error→MUST and everything else→SHOULD', () => {
    expect(mustLabelForSeverity('error')).toBe('MUST');
    expect(mustLabelForSeverity('warning')).toBe('SHOULD');
    expect(mustLabelForSeverity('info')).toBe('SHOULD');
  });
});

describe('humanizeCategory', () => {
  it('sentence-cases and de-slugs the key', () => {
    expect(humanizeCategory('api-design')).toBe('Api design');
    expect(humanizeCategory('documentation')).toBe('Documentation');
    expect(humanizeCategory('best_practices')).toBe('Best practices');
  });
  it('degrades an empty key to "Other"', () => {
    expect(humanizeCategory('   ')).toBe('Other');
  });
});
