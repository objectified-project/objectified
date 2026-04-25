import type { ReactNode } from 'react';

/**
 * Minimal shape needed to derive dashboard KPIs from a repository row.
 * Both the Repositories list page and the global Dashboard home consume
 * the same `/api/repositories` endpoint, so they share this projection.
 */
export interface RepositoryKpiRow {
  id: string;
  status: string;
  lastScanAt?: string | null;
  lastScanDurationMs?: number | null;
  lastScanBranch?: string | null;
}

export interface RepositoryKpis<R extends RepositoryKpiRow> {
  tracked: number;
  healthy: number;
  scanning: number;
  warnings: number;
  scanned24h: number;
  stale: number;
  healthyPct: number;
  scannedSeries: number[];
  avgScanMs: number | null;
  slowestScan: R | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SCANNED_SERIES_DAYS = 7;
const RECENT_TIMED_WINDOW_DAYS = 7;

/**
 * Pure derivation of the KPI strip shown on the Repositories dashboard and
 * the global home dashboard. Kept as a single source of truth so both screens
 * stay in lockstep when the formula changes.
 *
 * `now` is injectable for deterministic testing; defaults to wall-clock.
 */
export function deriveRepositoryKpis<R extends RepositoryKpiRow>(
  repositories: R[],
  now: number = Date.now(),
): RepositoryKpis<R> {
  const tracked = repositories.length;
  const healthy = repositories.filter((repo) => repo.status === 'healthy').length;
  const scanning = repositories.filter((repo) => repo.status === 'scan_in_progress').length;
  const warnings = repositories.filter(
    (repo) =>
      repo.status === 'warnings' || repo.status === 'error' || repo.status === 'failed',
  ).length;

  const dayThreshold = now - DAY_MS;
  const scanned24h = repositories.filter(
    (repo) => repo.lastScanAt && Date.parse(repo.lastScanAt) >= dayThreshold,
  ).length;
  const stale = repositories.filter(
    (repo) => !repo.lastScanAt || Date.parse(repo.lastScanAt) < dayThreshold,
  ).length;
  const healthyPct = tracked === 0 ? 0 : Math.round((healthy / tracked) * 100);

  // 7-day daily scan-activity series, derived from each repo's most recent
  // scan timestamp. The only sparkline we can ship honestly today — the other
  // cards lack the historical signal needed for a real trend.
  const scannedSeries = Array.from({ length: SCANNED_SERIES_DAYS }, (_, idx) => {
    const bucketEnd = now - (SCANNED_SERIES_DAYS - 1 - idx) * DAY_MS;
    const bucketStart = bucketEnd - DAY_MS;
    return repositories.filter((repo) => {
      if (!repo.lastScanAt) return false;
      const ts = Date.parse(repo.lastScanAt);
      return ts >= bucketStart && ts < bucketEnd;
    }).length;
  });

  // Average and slowest "last scan" durations. We pull from each repo's most
  // recent scan so the dashboard reflects current pipeline health without an
  // extra aggregate API call. Repos that have never been scanned (or where
  // the backend hasn't surfaced timing data yet) are skipped.
  const recentTimedThreshold = now - RECENT_TIMED_WINDOW_DAYS * DAY_MS;
  const recentTimedScans = repositories.filter(
    (repo) =>
      repo.lastScanDurationMs != null &&
      repo.lastScanAt &&
      Date.parse(repo.lastScanAt) >= recentTimedThreshold,
  );
  const avgScanMs =
    recentTimedScans.length === 0
      ? null
      : Math.round(
          recentTimedScans.reduce(
            (sum, repo) => sum + (repo.lastScanDurationMs ?? 0),
            0,
          ) / recentTimedScans.length,
        );

  let slowestScan: R | null = null;
  for (const repo of repositories) {
    if (repo.lastScanDurationMs == null) continue;
    if (
      slowestScan === null ||
      (repo.lastScanDurationMs ?? 0) > (slowestScan.lastScanDurationMs ?? 0)
    ) {
      slowestScan = repo;
    }
  }

  return {
    tracked,
    healthy,
    scanning,
    warnings,
    scanned24h,
    stale,
    healthyPct,
    scannedSeries,
    avgScanMs,
    slowestScan,
  };
}

/**
 * Compose the "Xm Ys" value used in the Avg/Slowest scan KPI cards. The unit
 * suffix ("m"/"s") renders smaller and tinted via `suffixToneClass` so the
 * card matches the mockup typography (numeral dominant, unit accent).
 * Returns `fallback` when no duration data is available.
 */
export function formatScanDuration(
  ms: number | null | undefined,
  fallback: string,
  suffixToneClass = 'text-gray-400 dark:text-gray-500',
): ReactNode {
  if (ms == null || !Number.isFinite(ms)) return fallback;
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const suffix = `text-lg font-semibold ${suffixToneClass} ml-0.5`;
  if (minutes === 0) {
    return (
      <>
        {seconds}
        <span className={suffix}>s</span>
      </>
    );
  }
  return (
    <>
      {minutes}
      <span className={suffix}>m</span> {seconds}
      <span className={suffix}>s</span>
    </>
  );
}
