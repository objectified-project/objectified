'use client';

/**
 * CatalogVersionsPanel (MFI-25.7, #4092) — the inline version **timeline** in the catalog detail
 * Versions tab.
 *
 * The mockup replaces the old off-page-only link with an inline timeline (mockup versions pane,
 * `index.html:493-499`, `1489`): revisions listed newest-first, each with a checkbox, so the reader
 * can **tick any two** and open the existing versions-dashboard diff with both revisions preselected.
 * The off-page "Open version history" link is retained as a fallback (and the only affordance when
 * there are fewer than two revisions to compare).
 *
 * Data comes from the same `GET /api/versions?projectId={id}` endpoint the versions dashboard uses
 * (catalog items are versioned on the shared versions table). The fetch is **lazy** (only once the
 * Versions tab is first active) and **one-shot** (re-activating never refetches), mirroring
 * {@link CatalogLintPanel}. All selection maths + the diff deep-link live in
 * `catalog-versions-timeline` so this component stays a thin view.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeftRight, GitBranch, Lock, RefreshCw } from 'lucide-react';
import { cn } from '@lib/utils';
import { dashboardPanelClass } from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { formatVersionWithPrefix, getVersionRevisionNote } from '@/app/utils/version-display';
import {
  buildVersionDiffHref,
  canDiffRevisions,
  MAX_DIFF_SELECTION,
  sortRevisionsNewestFirst,
  toggleRevisionSelection,
  type CatalogVersionRevision,
} from '@/app/utils/catalog-versions-timeline';

interface CatalogVersionsPanelProps {
  /** The catalog item id (a project id) whose revisions to list. */
  itemId: string;
  /** Whether the Versions tab is active; revisions are fetched the first time this is true. */
  active: boolean;
}

/** The fetch lifecycle of the version list (`idle`/`loading` render the spinner). */
type VersionsStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** Format an ISO timestamp for display; falls back to the raw value / em dash. */
function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

/**
 * Fetch a project's revisions from the shared versions endpoint. Throws on a non-OK response or an
 * `{ success: false }` envelope so the caller can surface a retryable error.
 */
async function fetchCatalogVersions(
  itemId: string,
  options?: { signal?: AbortSignal },
): Promise<CatalogVersionRevision[]> {
  const response = await fetch(`/api/versions?projectId=${encodeURIComponent(itemId)}`, {
    method: 'GET',
    signal: options?.signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.success === false) {
    const message =
      (data && (data.error || data.detail)) || `Failed to load versions (HTTP ${response.status})`;
    throw new Error(typeof message === 'string' ? message : 'Failed to load versions');
  }
  return Array.isArray(data.versions) ? (data.versions as CatalogVersionRevision[]) : [];
}

/**
 * Render a catalog item's revisions as an inline, newest-first timeline with two-checkbox diff
 * selection. Fetches lazily on first activation of the Versions tab and exposes a retry on failure.
 */
export function CatalogVersionsPanel({ itemId, active }: CatalogVersionsPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<VersionsStatus>('idle');
  const [revisions, setRevisions] = useState<CatalogVersionRevision[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The two revision ids ticked for diffing (capped at two by `toggleRevisionSelection`).
  const [selected, setSelected] = useState<string[]>([]);
  // Guards the one-shot lazy fetch so re-activating the tab never re-fetches.
  const fetchStartedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Lazy + one-shot fetch of the version list. The guard sits at the top, before any setState, so the
  // effect stays a single `void` call (mirrors CatalogLintPanel). `retry` re-opens it via the ref.
  const loadVersions = useCallback(async () => {
    if (!active || fetchStartedRef.current) return;
    fetchStartedRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setErrorMessage(null);
    let loaded: CatalogVersionRevision[] | null = null;
    let failureMessage: string | null = null;
    try {
      loaded = await fetchCatalogVersions(itemId, { signal: controller.signal });
    } catch (e) {
      failureMessage = e instanceof Error ? e.message : 'Failed to load versions.';
    } finally {
      if (controller.signal.aborted) {
        /* superseded by a newer fetch/unmount — leave state to the newer run. */
      } else if (failureMessage != null) {
        setErrorMessage(failureMessage);
        setStatus('error');
      } else {
        setRevisions(sortRevisionsNewestFirst(loaded ?? []));
        setStatus('loaded');
      }
    }
  }, [active, itemId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Retry from the error affordance — an event handler, so re-opening the one-shot is fine.
  const retry = useCallback(() => {
    fetchStartedRef.current = false;
    void loadVersions();
  }, [loadVersions]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => toggleRevisionSelection(prev, id));
  }, []);

  const diffHref = buildVersionDiffHref(itemId, selected, revisions);
  const canDiff = canDiffRevisions(selected) && diffHref != null;

  const openDiff = useCallback(() => {
    if (diffHref) router.push(diffHref);
  }, [router, diffHref]);

  const openHistory = useCallback(() => {
    router.push(`/ade/dashboard/versions?projectId=${encodeURIComponent(itemId)}`);
  }, [router, itemId]);

  return (
    <section className={`${dashboardPanelClass} p-6`} data-testid="catalog-detail-versions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Versions
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Tick any two revisions to compare them. Catalog items share the versions table with
            Projects.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="catalog-detail-versions-diff"
            onClick={openDiff}
            disabled={!canDiff}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-white disabled:text-gray-400 disabled:hover:bg-white dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40 dark:disabled:border-gray-700 dark:disabled:bg-gray-800 dark:disabled:text-gray-500 dark:disabled:hover:bg-gray-800"
          >
            <ArrowLeftRight className="h-4 w-4" /> Diff
          </button>
          <button
            type="button"
            data-testid="catalog-detail-versions-link"
            onClick={openHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <GitBranch className="h-4 w-4 text-indigo-500" /> Open version history
          </button>
        </div>
      </div>

      {status === 'idle' || status === 'loading' ? (
        <p
          data-testid="catalog-versions-loading"
          className="mt-6 text-sm text-gray-500 dark:text-gray-400"
        >
          Loading versions…
        </p>
      ) : status === 'error' ? (
        <div
          data-testid="catalog-versions-error"
          className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/30"
        >
          <span className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {errorMessage || 'Failed to load versions.'}
          </span>
          <button
            type="button"
            data-testid="catalog-versions-retry"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : revisions.length === 0 ? (
        <p
          data-testid="catalog-versions-empty"
          className="mt-6 text-sm text-gray-600 dark:text-gray-300"
        >
          No revisions yet — this catalog item has a single, unversioned import.
        </p>
      ) : (
        <>
          <p
            data-testid="catalog-versions-selection-hint"
            className="mt-4 text-xs text-gray-500 dark:text-gray-400"
          >
            {selected.length} of {MAX_DIFF_SELECTION} selected
            {canDiff ? ' — ready to diff (old → new).' : '. Select two to enable Diff.'}
          </p>
          <ol className="mt-3 space-y-2" data-testid="catalog-versions-timeline">
            {revisions.map((rev) => {
              const isChecked = selected.includes(rev.id);
              // Once two are ticked, block adding a third by disabling the unticked rows.
              const isDisabled = !isChecked && selected.length >= MAX_DIFF_SELECTION;
              const note = getVersionRevisionNote(rev);
              return (
                <li
                  key={rev.id}
                  data-testid="catalog-versions-row"
                  data-revision-id={rev.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                    isChecked
                      ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-700 dark:bg-indigo-950/30'
                      : 'border-gray-100 bg-gray-50/60 dark:border-gray-700/60 dark:bg-gray-900/30',
                  )}
                >
                  <label
                    className={cn(
                      'mt-0.5 flex shrink-0 items-center',
                      isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
                    )}
                  >
                    <input
                      type="checkbox"
                      data-testid="catalog-versions-checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-700"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => toggle(rev.id)}
                      aria-label={`Select ${formatVersionWithPrefix(rev.version_id)} to diff`}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {formatVersionWithPrefix(rev.version_id)}
                      </span>
                      {rev.published ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <Lock className="h-3 w-3" aria-hidden /> Published
                        </span>
                      ) : null}
                      {rev.lifecycle && rev.lifecycle !== 'stable' ? (
                        <span className="inline-flex items-center rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {rev.lifecycle}
                        </span>
                      ) : null}
                    </div>
                    {note ? (
                      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">{note}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                      {formatTimestamp(rev.created_at)}
                      {rev.creator_name || rev.creator_email
                        ? ` · ${rev.creator_name || rev.creator_email}`
                        : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
