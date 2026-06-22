'use client';

/**
 * Repository detail "Specs" tab — per-file refresh status (RAR-5.1, #3532).
 *
 * Lists every imported-file lineage for the repository with its materialized
 * refresh state (RAR-2.3), last-refreshed time, next-due time (RAR-3.1 cadence),
 * and a divergence indicator (RAR-4.4). Diverged files are rendered visually
 * distinct and link to the review action (the file's diff view on the Files tab).
 *
 * Data comes from `GET /api/repositories/{id}/refresh-specs`; the status is
 * derived on the client with `computeRefreshStatus`, the same logic the REST
 * read model applies server-side, so the chip matches the state machine exactly.
 *
 * The fetching wrapper (`RepositorySpecsTab`) and the pure presentational table
 * (`RepositorySpecsTable`) are split so the table can be unit-tested with fixed
 * rows and a fixed clock.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@lib/utils';
import {
  getRefreshStatusPresentation,
  refreshStatusChipToneClasses,
} from './repository-refresh-status-chip-copy';
import { computeNextDue, computeRefreshStatus } from './repository-refresh-status';

/** One per-file refresh row as returned by the refresh-specs endpoint. */
export type RepositoryRefreshSpec = {
  id: string;
  path: string;
  branch: string;
  project_id: string | null;
  project_name: string | null;
  project_slug: string | null;
  last_imported_committed_at: string | null;
  last_imported_blob_sha: string | null;
  remote_committed_at: string | null;
  remote_blob_sha: string | null;
  is_refreshing: boolean;
  last_refresh_failed: boolean;
  last_refreshed_at: string | null;
  spec_updated_at: string | null;
  refresh_interval_seconds: number;
  repo_last_refreshed_at: string | null;
  auto_refresh_enabled: boolean;
};

/** Deep-link into the Files tab and open the file's review (diff) view. */
export function repositorySpecReviewHref(
  repositoryId: string,
  path: string,
  branch: string,
): string {
  const qs = new URLSearchParams();
  qs.set('tab', 'files');
  qs.set('path', path);
  qs.set('branch', branch);
  return `/ade/dashboard/repositories/${encodeURIComponent(repositoryId)}/preview?${qs.toString()}`;
}

/**
 * Human-readable "x ago" for a past ISO timestamp, relative to `now`. Returns a
 * neutral em dash when the timestamp is absent or unparseable.
 *
 * @param iso An ISO-8601 timestamp or null.
 * @param now Reference epoch milliseconds (defaults to the current time).
 * @returns A short relative string such as "3m ago", or "—".
 */
export function formatRefreshedAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.floor((now - t) / 1000);
  if (sec < 0) return 'just now';
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Human-readable next-due label from a {@link computeNextDue} result.
 *  - `null` (auto-refresh off) → "Paused"
 *  - `'due'` (never swept) or a past time → "Due now"
 *  - a future time → "in 4m" / "in 2h" / "in 3d"
 *
 * @param nextDue The result of {@link computeNextDue}.
 * @param now Reference epoch milliseconds (defaults to the current time).
 * @returns A short label describing when the next refresh is due.
 */
export function formatNextDue(nextDue: Date | 'due' | null, now: number = Date.now()): string {
  if (nextDue === null) return 'Paused';
  if (nextDue === 'due') return 'Due now';
  const sec = Math.floor((nextDue.getTime() - now) / 1000);
  if (sec <= 0) return 'Due now';
  if (sec < 60) return 'in <1m';
  if (sec < 3600) return `in ${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `in ${Math.floor(sec / 3600)}h`;
  return `in ${Math.floor(sec / 86400)}d`;
}

/** A single refresh-status chip for a spec row. */
function RefreshStatusChip({ status }: { status: string }) {
  const presentation = getRefreshStatusPresentation(status);
  return (
    <span
      className={refreshStatusChipToneClasses(presentation.tone)}
      title={presentation.description}
      aria-label={`Refresh status: ${presentation.label}. ${presentation.description}`}
    >
      {presentation.label}
    </span>
  );
}

/**
 * Pure presentational table of per-file refresh status. Takes already-fetched
 * rows and an optional fixed clock so it renders deterministically in tests.
 *
 * @param repositoryId The repository whose files these specs belong to (for review links).
 * @param specs The per-file refresh rows to render.
 * @param now Reference epoch milliseconds for relative formatting; captured once
 *   by the fetching wrapper so render stays pure (also a test seam).
 */
export function RepositorySpecsTable({
  repositoryId,
  specs,
  now,
}: {
  repositoryId: string;
  specs: RepositoryRefreshSpec[];
  now: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Imported specs</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Per-file auto-refresh status, last refresh, and next due.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          <tr>
            <th className="px-4 py-2 align-middle text-left font-semibold">File</th>
            <th className="px-4 py-2 align-middle text-left font-semibold">Status</th>
            <th className="px-4 py-2 align-middle text-left font-semibold">Last refreshed</th>
            <th className="px-4 py-2 align-middle text-left font-semibold">Next due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {specs.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-12 align-middle text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400"
              >
                No imported specs yet. Open the Files tab, import a specification, and its
                refresh status will appear here.
              </td>
            </tr>
          ) : (
            specs.map((spec) => {
              const status = computeRefreshStatus({
                remoteCommittedAt: spec.remote_committed_at,
                lastImportedCommittedAt: spec.last_imported_committed_at,
                remoteChecksum: spec.remote_blob_sha,
                lastImportedChecksum: spec.last_imported_blob_sha,
                isRefreshing: spec.is_refreshing,
                lastRefreshFailed: spec.last_refresh_failed,
                // No persisted divergence column yet (RAR-4.4 dispatcher wiring
                // pending); rendered when a future signal supplies it.
                diverged: false,
              });
              const isDiverged = status === 'diverged';
              const nextDue = computeNextDue(
                spec.repo_last_refreshed_at,
                spec.refresh_interval_seconds,
                spec.auto_refresh_enabled,
              );
              const lastRefreshed = spec.last_refreshed_at ?? spec.spec_updated_at;
              const reviewHref = repositorySpecReviewHref(repositoryId, spec.path, spec.branch);
              return (
                <tr
                  key={spec.id}
                  data-testid="repository-spec-row"
                  data-status={status}
                  className={cn(
                    'hover:bg-gray-50/80 dark:hover:bg-gray-900/40',
                    isDiverged && 'bg-purple-50/60 dark:bg-purple-950/20',
                  )}
                >
                  <td className="max-w-[260px] px-4 py-2 align-middle">
                    <Link
                      href={reviewHref}
                      className="break-all font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {spec.path}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {spec.project_name ? (
                        <span>
                          {spec.project_name} · {spec.branch}
                        </span>
                      ) : (
                        spec.branch
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 align-middle">
                    <div className="flex flex-col items-start gap-1">
                      <RefreshStatusChip status={status} />
                      {isDiverged ? (
                        <Link
                          href={reviewHref}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:underline dark:text-purple-300"
                        >
                          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                          Review divergence
                        </Link>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 align-middle text-gray-600 dark:text-gray-400">
                    {formatRefreshedAgo(lastRefreshed, now)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 align-middle text-gray-600 dark:text-gray-400">
                    {formatNextDue(nextDue, now)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Fetching wrapper for the Specs tab: loads per-file refresh status for the
 * repository and renders {@link RepositorySpecsTable}, with loading and error
 * states mirroring the Imports tab.
 *
 * @param repositoryId The repository to load refresh specs for.
 */
export function RepositorySpecsTab({ repositoryId }: { repositoryId: string }) {
  const [specs, setSpecs] = useState<RepositoryRefreshSpec[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Capture a single render-stable clock for relative-time formatting so the
  // table stays pure (no Date.now() during render).
  const [now] = useState<number>(() => Date.now());

  const fetchSpecs = useCallback(async () => {
    if (!repositoryId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/repositories/${encodeURIComponent(repositoryId)}/refresh-specs?limit=200`,
        { credentials: 'include' },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        specs?: RepositoryRefreshSpec[];
        error?: string;
      };
      if (!res.ok || data.success !== true) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText);
      }
      setSpecs(Array.isArray(data.specs) ? data.specs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load refresh specs');
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    void fetchSpecs();
  }, [fetchSpecs]);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-6 text-sm text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-300">
        {error}
      </div>
    );
  }

  if (loading && specs.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-12 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading refresh status…
      </div>
    );
  }

  return <RepositorySpecsTable repositoryId={repositoryId} specs={specs} now={now} />;
}
