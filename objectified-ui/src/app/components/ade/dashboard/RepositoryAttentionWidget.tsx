'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ChevronRight,
  Clock,
  ExternalLink,
  GitBranch,
  KeyRound,
  Link2,
  Timer,
} from 'lucide-react';
import { formatRelativeTime } from '@/app/ade/dashboard/versions/version-history-dag';
import { dashboardPanelClass, repositoryActivityRowClass } from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { cn } from '@lib/utils';
import { subscribeRepositoryDashboardWidgetRefresh } from '@/app/utils/repository-dashboard-broadcast';

const SCAN_REPORT_HREF = '/ade/dashboard/repositories/reports';
const REFRESH_MS = 5000;

type AttentionItem = {
  repositoryId: string;
  fullName: string;
  reasons: string[];
  topReason: string;
  detailTab: string;
  openCount: number;
  attentionScore: number;
  lastChangeAt: string;
};

type AttentionResponse = {
  items: AttentionItem[];
  repositoriesTracked: number;
  needingAttentionCount: number;
  otherHealthyCount: number;
  refreshedAt: string;
};

function topReasonPillClass(reason: string) {
  switch (reason) {
    case 'token_revoked':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
    case 'parse_error':
    case 'import_failed':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 'manifest_error':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200';
    case 'stale_checksum':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 'scheduler_paused':
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100';
    case 'repeated_failures':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
}

function topReasonIcon(reason: string) {
  const c = 'h-3.5 w-3.5 shrink-0';
  if (reason === 'token_revoked') return <KeyRound className={c} aria-hidden />;
  if (reason === 'stale_checksum') return <Timer className={c} aria-hidden />;
  if (reason === 'parse_error' || reason === 'manifest_error') {
    return <AlertOctagon className={c} aria-hidden />;
  }
  if (reason === 'scheduler_paused' || reason === 'repeated_failures') {
    return <Link2 className={c} aria-hidden />;
  }
  return <AlertTriangle className={c} aria-hidden />;
}

function formatTopReasonLabel(reason: string) {
  return reason.replace(/_/g, ' ');
}

export function RepositoryAttentionWidget() {
  const [data, setData] = useState<AttentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const listId = useId();

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const res = await fetch('/api/dashboard/repository-attention?limit=5', { signal, cache: 'no-store' });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; data?: AttentionResponse; error?: string };
      if (signal?.aborted) return;
      if (!res.ok || j.success === false) {
        setData(null);
        setLoadError(j.error || 'Failed to load repositories');
        return;
      }
      if (j.data) {
        setData(j.data);
      } else {
        setData({
          items: [],
          repositoriesTracked: 0,
          needingAttentionCount: 0,
          otherHealthyCount: 0,
          refreshedAt: '',
        });
      }
    } catch (e) {
      if (signal?.aborted) return;
      setData(null);
      setLoadError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  useEffect(() => {
    return subscribeRepositoryDashboardWidgetRefresh(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void load();
    };
    const id = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const hasRows = (data?.items.length ?? 0) > 0;
  const allHealthy = !loadError && !loading && data && !hasRows;
  const footerText =
    data && data.otherHealthyCount > 0
      ? `All other ${data.otherHealthyCount} repositor${data.otherHealthyCount === 1 ? 'y' : 'ies'}: healthy`
      : null;

  return (
    <div className={cn(dashboardPanelClass, 'overflow-hidden')}>
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug" id={listId}>
                Repositories Needing Attention
              </h3>
            </div>
          </div>
          <Link
            href={SCAN_REPORT_HREF}
            className="shrink-0 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            View scan report
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div>
        {loading && (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2 py-2">
                <Skeleton className="h-4 w-2/5 max-w-xs" />
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-12 ml-auto" />
              </div>
            ))}
          </div>
        )}
        {!loading && loadError && (
          <p className="p-4 text-sm text-rose-600 dark:text-rose-400" role="alert">
            {loadError}
          </p>
        )}
        {allHealthy && (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mx-auto mb-4">
              <GitBranch className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">All scanned repositories are healthy.</p>
          </div>
        )}
        {hasRows && !loading && data && (
          <ul
            className="divide-y divide-gray-100 dark:divide-gray-800"
            role="list"
            aria-labelledby={listId}
          >
            {data.items.map((row) => {
              const rel = formatRelativeTime(row.lastChangeAt);
              const fileLabel = row.openCount === 1 ? '1 file' : `${row.openCount} files`;
              const href = `/ade/dashboard/repositories/${row.repositoryId}/issues`;
              return (
                <li key={row.repositoryId} className={cn(repositoryActivityRowClass, 'items-center gap-2')}>
                  <Link
                    href={href}
                    className="group flex min-w-0 flex-1 items-center gap-2 -mx-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <span
                      className="min-w-0 font-medium text-sm text-gray-900 dark:text-white truncate"
                      title={row.fullName}
                    >
                      {row.fullName}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                        topReasonPillClass(row.topReason)
                      )}
                      title={row.reasons.join(', ')}
                    >
                      {topReasonIcon(row.topReason)}
                      <span className="font-mono truncate max-w-[10rem] sm:max-w-[12rem]">
                        {formatTopReasonLabel(row.topReason)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">{fileLabel}</span>
                    <span
                      className="shrink-0 text-xs text-gray-400 dark:text-gray-500 tabular-nums inline-flex items-center gap-0.5"
                      title="Last change"
                    >
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {rel || '—'}
                    </span>
                    <span className="shrink-0 text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" aria-hidden>
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {footerText && hasRows && (
          <p className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
            {footerText}
          </p>
        )}
      </div>
    </div>
  );
}
