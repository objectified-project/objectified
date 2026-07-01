'use client';

/**
 * CatalogLintPanel (MFI-25.5, #4090) — the inline Lint & Score pane.
 *
 * The mockup renders lint *inline* in the detail's Lint & Score tab (mockup lint pane,
 * `index.html:496-506`, `1529-1540`), not just behind the `CatalogLintReportDialog`. This component
 * fetches the same authoritative server report (`GET /api/catalog/{id}/lint`) the dialog uses and
 * renders it as:
 *   - a **grade gauge** — an SVG progress ring coloured by the score band, with the server letter
 *     grade + `score/100` in the centre;
 *   - **category bars** — real per-category 0–100 scores when MFI-25.6 ships them (`report.categories`),
 *     otherwise a graceful **severity breakdown** derived from the findings (which categories carry
 *     the most severe findings), so the bars are always meaningful without inventing a score;
 *   - a **findings list** — severity chip + rule + message + a MUST/SHOULD conformance chip.
 *
 * The fetch is **lazy** (only once the Lint tab is active) and **one-shot** (re-activating never
 * refetches), mirroring {@link CatalogSourceViewer}. The full dialog stays reachable from the header
 * lint orb and the "Open full report" affordance here, so the itemized history view is preserved.
 *
 * The score/grade are the server's authoritative values — nothing here recomputes them; the tier
 * helper is used only to pick band colours.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, FileSearch, History, RefreshCw } from 'lucide-react';
import { cn } from '@lib/utils';
import { dashboardPanelClass } from '@/app/components/ade/dashboard/dashboardScreenClasses';
import {
  fetchCatalogLintReport,
  gradeChipClass,
  severityBadgeClass,
  sortLintFindings,
  type VersionLintReport,
} from '@/app/utils/version-lint-report';
import { getNumericScoreTier } from '@/app/utils/numeric-score-tier';
import {
  deriveCategorySeverityBreakdown,
  gaugeDashOffset,
  humanizeCategory,
  mustLabelForSeverity,
  resolveCategoryScores,
  type CategorySeverityBreakdown,
} from '@/app/utils/catalog-lint-panel';

/** SVG progress-ring geometry (viewBox 0 0 40 40, radius 16 like `SchemaVersionScoringPanel`). */
const GAUGE_R = 16;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

interface CatalogLintPanelProps {
  /** The catalog item id to lint (a project id). */
  itemId: string;
  /** Whether the Lint tab is active; the report is fetched the first time this is true. */
  active: boolean;
  /** Opens the full `CatalogLintReportDialog` (the itemized report the orb opens — kept for history). */
  onOpenReport: () => void;
  /** Opens the quality-history dialog; disabled by the caller when there is no history/score. */
  onOpenQualityHistory: () => void;
  /** Whether a quality score/history exists (drives the history button's enabled state). */
  qualityAvailable: boolean;
}

/** The fetch lifecycle of the lint report (`idle`/`loading` render the spinner). */
type LintStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** The severity chips shown in each fallback category bar, in severity order. */
const BREAKDOWN_SEGMENTS: readonly {
  key: keyof Pick<CategorySeverityBreakdown, 'error' | 'warning' | 'info'>;
  fillClass: string;
}[] = [
  { key: 'error', fillClass: 'bg-rose-500' },
  { key: 'warning', fillClass: 'bg-amber-500' },
  { key: 'info', fillClass: 'bg-sky-500' },
];

/**
 * The grade gauge: an SVG ring filled to `score`%, tinted by the score band, with the server letter
 * grade and `score/100` in the centre. Static (no mount animation) to stay trivially testable.
 */
function GradeGauge({ score, grade }: { score: number; grade: string }) {
  const tier = getNumericScoreTier(score);
  const letter = (grade || '').trim() || '–';
  return (
    <div className="flex flex-col items-center gap-3" data-testid="catalog-lint-gauge">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r={GAUGE_R}
            fill="none"
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth="3.5"
          />
          <circle
            cx="20"
            cy="20"
            r={GAUGE_R}
            fill="none"
            className={cn('stroke-current transition-all duration-500', tier.gaugeStrokeClass)}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={GAUGE_C}
            strokeDashoffset={gaugeDashOffset(score, GAUGE_C)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn('font-mono text-3xl font-bold leading-none tabular-nums', tier.textClass)}
            data-testid="catalog-lint-gauge-grade"
          >
            {letter}
          </span>
          <span className="mt-1 font-mono text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
            {score}/100
          </span>
        </div>
      </div>
      <span
        className={cn(
          'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold',
          gradeChipClass(letter),
        )}
      >
        Grade {letter}
      </span>
      <span className="text-center text-[11px] text-gray-500 dark:text-gray-400">
        {tier.shortLabel} · deterministic lint
      </span>
    </div>
  );
}

/** A real per-category 0–100 score bar (MFI-25.6 data path). */
function CategoryScoreBar({ name, score }: { name: string; score: number }) {
  const tier = getNumericScoreTier(score);
  return (
    <div data-testid="catalog-lint-category-bar">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-700 dark:text-gray-300">{humanizeCategory(name)}</span>
        <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400">{score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          className={cn('h-full rounded-full transition-all duration-500', tier.barSolidClass)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/**
 * A fallback category bar: a severity-proportioned track (error/warning/info segments) plus the
 * per-severity counts. Used until real per-category scores (MFI-25.6) land.
 */
function CategoryBreakdownBar({ row }: { row: CategorySeverityBreakdown }) {
  return (
    <div data-testid="catalog-lint-category-breakdown">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-700 dark:text-gray-300">{humanizeCategory(row.category)}</span>
        <span className="flex items-center gap-1.5 font-mono tabular-nums text-gray-500 dark:text-gray-400">
          {BREAKDOWN_SEGMENTS.filter((s) => row[s.key] > 0).map((s) => (
            <span key={s.key}>
              {row[s.key]} {s.key}
            </span>
          ))}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        {BREAKDOWN_SEGMENTS.map((s) =>
          row[s.key] > 0 ? (
            <div
              key={s.key}
              className={s.fillClass}
              style={{ width: `${(row[s.key] / row.total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

/**
 * Render a catalog item's lint report inline: grade gauge, category bars, and findings list.
 * Fetches lazily on first activation of the Lint tab and exposes a retry on failure.
 */
export function CatalogLintPanel({
  itemId,
  active,
  onOpenReport,
  onOpenQualityHistory,
  qualityAvailable,
}: CatalogLintPanelProps) {
  const [status, setStatus] = useState<LintStatus>('idle');
  const [report, setReport] = useState<VersionLintReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Guards the one-shot lazy fetch so re-activating the tab never re-fetches.
  const fetchStartedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Lazy + one-shot fetch of the lint report. The guard (active + not-yet-started) sits at the top,
  // before any setState, so the effect stays a single `void` call with no synchronous cascading
  // render (mirrors CatalogSourceViewer). `retry` re-opens the one-shot by clearing the ref.
  const loadReport = useCallback(async () => {
    if (!active || fetchStartedRef.current) return;
    fetchStartedRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setErrorMessage(null);
    // Resolve into locals and commit the outcome once in `finally`, so the fetch drives a single
    // terminal state transition (loaded/error) rather than several branch-by-branch setState calls.
    let loadedReport: VersionLintReport | null = null;
    let failureMessage: string | null = null;
    try {
      loadedReport = await fetchCatalogLintReport(itemId, { signal: controller.signal });
    } catch (e) {
      failureMessage = e instanceof Error ? e.message : 'Failed to load lint report.';
    } finally {
      if (controller.signal.aborted) {
        /* superseded by a newer fetch/unmount — leave state to the newer run. */
      } else if (failureMessage != null) {
        setErrorMessage(failureMessage);
        setStatus('error');
      } else {
        setReport(loadedReport);
        setStatus('loaded');
      }
    }
  }, [active, itemId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Retry from the error affordance — an event handler, so re-opening the one-shot and re-running
  // the fetch synchronously is fine.
  const retry = useCallback(() => {
    fetchStartedRef.current = false;
    void loadReport();
  }, [loadReport]);

  const findings = report ? sortLintFindings(report.findings) : [];
  const categoryScores = resolveCategoryScores(report);
  const breakdown = report ? deriveCategorySeverityBreakdown(report.findings) : [];

  return (
    <section className={`${dashboardPanelClass} p-6`} data-testid="catalog-detail-lint">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Lint &amp; score
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="catalog-detail-quality-history"
            onClick={onOpenQualityHistory}
            disabled={!qualityAvailable}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:hover:bg-gray-800"
          >
            <History className="h-4 w-4 text-indigo-500" /> Quality history
          </button>
          <button
            type="button"
            data-testid="catalog-detail-lint-report"
            onClick={onOpenReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <FileSearch className="h-4 w-4 text-indigo-500" /> Open full report
          </button>
        </div>
      </div>

      {status === 'idle' || status === 'loading' ? (
        <p
          data-testid="catalog-lint-loading"
          className="mt-6 text-sm text-gray-500 dark:text-gray-400"
        >
          Loading lint report…
        </p>
      ) : status === 'error' ? (
        <div
          data-testid="catalog-lint-error"
          className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/30"
        >
          <span className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {errorMessage || 'Failed to load lint report.'}
          </span>
          <button
            type="button"
            data-testid="catalog-lint-retry"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : report ? (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Grade gauge */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <GradeGauge score={report.score} grade={report.grade} />
          </div>

          {/* Category bars + findings */}
          <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div data-testid="catalog-lint-categories">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Categories
              </h3>
              {categoryScores ? (
                <div className="mt-3 space-y-3">
                  {categoryScores.map((c) => (
                    <CategoryScoreBar key={c.name} name={c.name} score={c.score} />
                  ))}
                </div>
              ) : breakdown.length > 0 ? (
                <>
                  <div className="mt-3 space-y-3">
                    {breakdown.map((row) => (
                      <CategoryBreakdownBar key={row.category} row={row} />
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
                    Severity breakdown by category — per-category 0–100 scores arrive with the lint
                    rollup enrichment (MFI-25.6).
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  No category findings.
                </p>
              )}
            </div>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Findings
            </h3>
            {findings.length === 0 ? (
              <p
                data-testid="catalog-lint-no-findings"
                className="mt-3 text-sm text-gray-600 dark:text-gray-300"
              >
                No findings — clean bill of health.
              </p>
            ) : (
              <ul className="mt-3 space-y-2" data-testid="catalog-lint-findings">
                {findings.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-700/60 dark:bg-gray-900/30"
                  >
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        severityBadgeClass(f.severity),
                      )}
                    >
                      {f.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-gray-700 dark:text-gray-300">{f.rule}</p>
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">{f.message}</p>
                      {f.path ? (
                        <p className="mt-0.5 font-mono text-[11px] text-gray-400 dark:text-gray-500">
                          {f.path}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        mustLabelForSeverity(f.severity) === 'MUST'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                      )}
                    >
                      {mustLabelForSeverity(f.severity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
