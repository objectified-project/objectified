'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  KeyRound,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import {
  publishedThSortableClass,
  publishedErrorTier,
  publishedErrorTierClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { formatRequestsShort } from './fixtures';
import type { PublishedVersionConsumer } from './types';

type SortKey = 'requests24h' | 'requests7d' | 'errorRate' | 'lastSeenAt' | 'expiresAt';
type SortDir = 'asc' | 'desc';

export interface ConsumersTabProps {
  consumers: PublishedVersionConsumer[];
  /**
   * Total number of API keys configured for this tenant. Used in the
   * footer to put "5 of N keys with traffic" in context.
   */
  totalApiKeyCount?: number;
  /** Where the "Manage keys" link points (typically the api keys page). */
  manageKeysHref?: string;
}

/**
 * Consumers tab body. A dense per-API-key table with sortable numeric
 * columns. Mirrors the listing-table chrome (sticky header, zebra rows,
 * monospaced numeric cells) so the visual language stays consistent.
 *
 * Empty state: a friendly "no consumers yet" panel — usually rendered
 * for newly-published versions with no traffic recorded.
 */
export function ConsumersTab({
  consumers,
  totalApiKeyCount,
  manageKeysHref = '/ade/dashboard/keys',
}: ConsumersTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>('requests24h');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => sortConsumers(consumers, sortKey, sortDir), [consumers, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'lastSeenAt' || key === 'expiresAt' ? 'asc' : 'desc');
    }
  };

  if (consumers.length === 0) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-500 flex items-center justify-center mb-3">
          <Users className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No consumers yet</p>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          Once an API key starts pulling this version&apos;s spec, it will show up here with
          its 24h request volume, error rate, and last-seen timestamp.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <Users className="w-4 h-4 text-purple-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Consumers</h2>
        <span className="font-mono text-[11px] text-gray-400">
          per API key, last 24 h
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700">
            <tr className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              <th className="px-3 py-2.5 text-left">API key</th>
              <th className="px-3 py-2.5 text-left">Owner</th>
              <SortableTh
                label="Req · 24h"
                align="right"
                active={sortKey === 'requests24h'}
                dir={sortDir}
                onClick={() => onSort('requests24h')}
              />
              <SortableTh
                label="Req · 7d"
                align="right"
                active={sortKey === 'requests7d'}
                dir={sortDir}
                onClick={() => onSort('requests7d')}
              />
              <SortableTh
                label="Errors"
                align="right"
                active={sortKey === 'errorRate'}
                dir={sortDir}
                onClick={() => onSort('errorRate')}
              />
              <SortableTh
                label="Last seen"
                align="left"
                active={sortKey === 'lastSeenAt'}
                dir={sortDir}
                onClick={() => onSort('lastSeenAt')}
              />
              <SortableTh
                label="Expires"
                align="left"
                active={sortKey === 'expiresAt'}
                dir={sortDir}
                onClick={() => onSort('expiresAt')}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {sorted.map((row) => (
              <ConsumerRow key={row.apiKeyId} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <footer className="px-3 py-2 text-[11px] font-mono text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700/60 flex items-center gap-2 flex-wrap">
        <span>
          {consumers.length} of {totalApiKeyCount ?? consumers.length} keys with traffic on this version
        </span>
        <span className="flex-1" />
        <Link
          href={manageKeysHref}
          className="text-indigo-500 hover:underline inline-flex items-center gap-1"
        >
          Manage keys <ExternalLink className="w-3 h-3" />
        </Link>
      </footer>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Row                                                              */
/* ---------------------------------------------------------------- */

function ConsumerRow({ row }: { row: PublishedVersionConsumer }) {
  const errorTier = publishedErrorTier(row.errorRate);
  const errorClass = row.expired ? 'text-gray-400' : publishedErrorTierClass[errorTier];
  const expiresInfo = expiryInfo(row);
  const lastSeenInfo = lastSeenLabel(row.lastSeenAt);
  const opacityClass = row.expired ? 'opacity-60' : '';

  return (
    <tr className={`hover:bg-indigo-500/5 ${opacityClass}`}>
      <td className="px-3 py-2.5">
        <code className="font-mono text-[12px] inline-flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
          <KeyRound className={`w-3 h-3 ${row.expired ? 'text-gray-400' : 'text-amber-500'}`} />
          {row.apiKeyLabel}
        </code>
      </td>
      <td className="px-3 py-2.5 text-[12px] text-gray-700 dark:text-gray-300">{row.ownerLabel}</td>
      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700 dark:text-gray-300">
        {row.expired || row.requests24h === 0 ? <span className="text-gray-400">—</span> : formatRequestsShort(row.requests24h)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700 dark:text-gray-300">
        {formatRequestsShort(row.requests7d)}
      </td>
      <td className={`px-3 py-2.5 text-right font-mono text-[12px] ${errorClass}`}>
        {row.expired || row.requests24h === 0 ? <span className="text-gray-400">—</span> : `${(row.errorRate * 100).toFixed(2)}%`}
      </td>
      <td className={`px-3 py-2.5 text-[11px] font-mono ${lastSeenInfo.className}`}>
        {lastSeenInfo.label}
      </td>
      <td className={`px-3 py-2.5 text-[11px] font-mono ${expiresInfo.className}`}>
        {expiresInfo.label}
      </td>
    </tr>
  );
}

/* ---------------------------------------------------------------- */
/* Sortable header                                                  */
/* ---------------------------------------------------------------- */

interface SortableThProps {
  label: string;
  align: 'left' | 'right';
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}

function SortableTh({ label, align, active, dir, onClick }: SortableThProps) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
  const justify = align === 'right' ? 'justify-end' : 'justify-start';
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 ${alignClass} ${publishedThSortableClass}`}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
    >
      <span className={`inline-flex items-center gap-1 ${justify}`}>
        {label}
        <Icon className={`w-3 h-3 ${active ? 'text-indigo-500' : 'text-gray-300 dark:text-gray-600'}`} />
      </span>
    </th>
  );
}

/* ---------------------------------------------------------------- */
/* Helpers                                                          */
/* ---------------------------------------------------------------- */

function sortConsumers(
  consumers: PublishedVersionConsumer[],
  key: SortKey,
  dir: SortDir,
): PublishedVersionConsumer[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...consumers].sort((a, b) => {
    switch (key) {
      case 'requests24h':
        return (a.requests24h - b.requests24h) * factor;
      case 'requests7d':
        return (a.requests7d - b.requests7d) * factor;
      case 'errorRate':
        return (a.errorRate - b.errorRate) * factor;
      case 'lastSeenAt': {
        const aT = new Date(a.lastSeenAt).getTime() || 0;
        const bT = new Date(b.lastSeenAt).getTime() || 0;
        return (aT - bT) * factor;
      }
      case 'expiresAt': {
        // Nulls (never-expires) sort last regardless of direction.
        const aT = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        const bT = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        return (aT - bT) * factor;
      }
    }
  });
}

function lastSeenLabel(iso: string): { label: string; className: string } {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { label: '—', className: 'text-gray-400' };
  const ms = Date.now() - t;
  if (ms < 60_000) return { label: 'just now', className: 'text-gray-500 dark:text-gray-400' };
  if (ms < 3_600_000) return { label: `${Math.floor(ms / 60_000)} m ago`, className: 'text-gray-500 dark:text-gray-400' };
  if (ms < 86_400_000) return { label: `${Math.floor(ms / 3_600_000)} h ago`, className: 'text-gray-500 dark:text-gray-400' };
  if (ms < 7 * 86_400_000) return { label: `${Math.floor(ms / 86_400_000)} d ago`, className: 'text-amber-500 dark:text-amber-400' };
  return { label: `${Math.floor(ms / 86_400_000)} d ago`, className: 'text-amber-500 dark:text-amber-400' };
}

function expiryInfo(row: PublishedVersionConsumer): { label: string; className: string } {
  if (row.expired) {
    return { label: 'expired', className: 'text-rose-500' };
  }
  if (!row.expiresAt) {
    return { label: 'never', className: 'text-gray-500 dark:text-gray-400' };
  }
  const t = new Date(row.expiresAt).getTime();
  if (Number.isNaN(t)) return { label: '—', className: 'text-gray-400' };
  const days = Math.round((t - Date.now()) / 86_400_000);
  if (days <= 0) return { label: 'expired', className: 'text-rose-500' };
  if (days <= 14) return { label: `in ${days} d`, className: 'text-rose-500' };
  if (days <= 30) return { label: `in ${days} d`, className: 'text-amber-500 dark:text-amber-400' };
  return { label: `in ${days} d`, className: 'text-gray-500 dark:text-gray-400' };
}
