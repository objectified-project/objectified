'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Link2,
  Loader2,
  Timer,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@lib/utils';

export type RepositoryAttentionDetailPayload = {
  reasons: string[];
  items: Array<{ reason: string; paths: string[] }>;
  openCount: number;
  attentionScore: number;
  lastChangeAt: string;
  refreshedAt: string;
};

type Props = {
  repositoryId: string;
  detail: RepositoryAttentionDetailPayload | null;
  loading: boolean;
  loadError: string | null;
  /** Reasons removed from rollup but still shown fading out */
  fadingReasons: ReadonlySet<string>;
};

const REASON_ORDER = [
  'token_revoked',
  'manifest_error',
  'parse_error',
  'import_failed',
  'mapping_required',
  'stale_checksum',
  'scheduler_paused',
  'repeated_failures',
] as const;

function formatReasonTitle(reason: string): string {
  return reason.replace(/_/g, ' ');
}

function reasonSortKey(reason: string): number {
  const i = REASON_ORDER.indexOf(reason as (typeof REASON_ORDER)[number]);
  return i >= 0 ? i : REASON_ORDER.length;
}

function reasonPillClass(reason: string) {
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
    case 'mapping_required':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
    case 'scheduler_paused':
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100';
    case 'repeated_failures':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
}

function topReasonIcon(reason: string) {
  const c = 'h-4 w-4 shrink-0';
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

function reasonExplanation(reason: string): string {
  switch (reason) {
    case 'token_revoked':
      return 'The linked GitHub account has lost the required scopes — reconnect to resume scanning.';
    case 'manifest_error':
      return 'The repository manifest could not be applied; fix the manifest to classify specs correctly.';
    case 'parse_error':
      return 'The last scan could not parse one or more spec files.';
    case 'import_failed':
      return 'A recent import job failed for one or more specs — review the sync history.';
    case 'stale_checksum':
      return 'Auto-import is off but content changed — import or adjust promotion settings.';
    case 'mapping_required':
      return 'A manifest project mapping conflict blocked auto-import — map this spec to a project on the Specs tab.';
    case 'scheduler_paused':
      return 'Scheduled polling is paused for this repository.';
    case 'repeated_failures':
      return 'Multiple consecutive scan or poll failures — review scans and restore connectivity.';
    default:
      return 'This repository needs attention.';
  }
}

function fixLabel(reason: string): string {
  switch (reason) {
    case 'stale_checksum':
      return 'Import';
    case 'mapping_required':
      return 'Map';
    default:
      return 'Fix';
  }
}

export function RepositoryIssuesTab({ repositoryId, detail, loading, loadError, fadingReasons }: Props) {
  const router = useRouter();
  const listTitleId = useId();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const baseHref = `/ade/dashboard/repositories/${repositoryId}`;

  const navigateFix = useCallback(
    (reason: string) => {
      switch (reason) {
        case 'token_revoked':
          router.push('/ade/dashboard/linked-accounts');
          return;
        case 'manifest_error':
          router.push(`${baseHref}?tab=manifest`);
          return;
        case 'parse_error':
          router.push(`${baseHref}?tab=files&fileStatus=parse_error`);
          return;
        case 'import_failed':
          router.push(`${baseHref}?tab=sync`);
          return;
        case 'repeated_failures':
          router.push(`${baseHref}?tab=scans`);
          return;
        case 'scheduler_paused':
          router.push(`${baseHref}?tab=scans`);
          return;
        case 'stale_checksum':
          router.push(`${baseHref}?tab=specs&status=importable`);
          return;
        case 'mapping_required':
          router.push(`${baseHref}?tab=specs`);
          return;
        default:
          router.push(`${baseHref}?tab=files`);
      }
    },
    [baseHref, router],
  );

  const displayItems = useMemo(() => {
    const byReason = new Map<string, { reason: string; paths: string[] }>();
    if (detail?.items?.length) {
      for (const it of detail.items) {
        byReason.set(it.reason, it);
      }
    }
    const keys = new Set<string>([...byReason.keys(), ...fadingReasons]);
    const out = [...keys].map((reason) => byReason.get(reason) ?? { reason, paths: [] });
    return out.sort((a, b) => {
      const d = reasonSortKey(a.reason) - reasonSortKey(b.reason);
      if (d !== 0) return d;
      return a.reason.localeCompare(b.reason);
    });
  }, [detail?.items, fadingReasons]);

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden />
        Loading attention…
      </div>
    );
  }

  if (loadError && !detail) {
    return (
      <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id={listTitleId} className="text-base font-semibold text-gray-900 dark:text-white">
            Issues needing attention
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            One card per active rollup reason — fixes deep-link to the right surface.
          </p>
        </div>
        {detail?.refreshedAt ? (
          <span className="text-[10px] font-mono text-gray-400 tabular-nums">Roll-up · refresh every 5s</span>
        ) : null}
      </div>

      <ul className="space-y-3" aria-labelledby={listTitleId}>
        {displayItems.map((item) => {
          const isFading = fadingReasons.has(item.reason);
          const pathCount = item.paths.length;
          const exp = expanded[item.reason] ?? pathCount <= 3;

          return (
            <li
              key={item.reason}
              className={cn(
                'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/70 shadow-sm transition-opacity duration-500',
                isFading ? 'opacity-40 pointer-events-none' : 'opacity-100',
              )}
            >
              <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                        reasonPillClass(item.reason),
                      )}
                    >
                      {topReasonIcon(item.reason)}
                      <span className="capitalize">{formatReasonTitle(item.reason)}</span>
                    </span>
                    {isFading ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        Resolved
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{reasonExplanation(item.reason)}</p>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {pathCount === 0 ? (
                      <span>
                        {item.reason === 'token_revoked' ? '1 affected repository action' : 'No individual file paths'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-expanded={exp}
                        aria-controls={`paths-${item.reason}`}
                        onClick={() => setExpanded((prev) => ({ ...prev, [item.reason]: !exp }))}
                        className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {pathCount} affected file{pathCount === 1 ? '' : 's'}
                        {exp ? (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden={true} />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden={true} />
                        )}
                      </button>
                    )}
                  </div>
                  {pathCount > 0 && exp ? (
                    <ul id={`paths-${item.reason}`} className="mt-2 max-h-40 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 divide-y divide-gray-100 dark:divide-gray-800 text-xs font-mono">
                      {item.paths.map((p) => (
                        <li key={p} className="px-2 py-1.5 truncate" title={p}>
                          {p}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => navigateFix(item.reason)}
                  disabled={isFading}
                >
                  {fixLabel(item.reason)}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
