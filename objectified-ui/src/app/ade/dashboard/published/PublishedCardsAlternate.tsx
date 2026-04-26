'use client';

import { useMemo } from 'react';
import { Lock, Globe, Copy, ExternalLink, KeyRound, ChevronRight } from 'lucide-react';
import {
  publishedCardAccentClass,
  publishedRowStateChipClass,
  publishedVisibilityPillClass,
  publishedUrlBlockClass,
  publishedErrorTier,
  publishedErrorTierClass,
  projectAvatarGradientClasses,
  dashboardPanelClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { Sparkline } from './_internal/Sparkline';
import { formatRequestsShort, formatWoW, relativeAgo } from './_internal/fixtures';
import type {
  PublishedRowDecoration,
  PublishedVersionMetrics,
  PublishedVersionRow,
} from './_internal/types';
import type { ViewKind } from './PublishedTable';

export interface PublishedCardsAlternateProps {
  versions: PublishedVersionRow[];
  metricsById: Map<string, PublishedVersionMetrics>;
  decorationsById: Map<string, PublishedRowDecoration>;
  onOpenDetail: (row: PublishedVersionRow) => void;
  onCopyUrl: (row: PublishedVersionRow) => void;
  onOpenView: (row: PublishedVersionRow, kind: ViewKind) => void;
  onToggleVisibility: (row: PublishedVersionRow) => void;
  pathFor: (row: PublishedVersionRow) => string;
}

/**
 * Always-open card grid. Used when the user picks "Cards" from the
 * view toggle — it becomes the primary surface and the table is what
 * gets collapsed below.
 */
export function PublishedCardsGrid(props: PublishedCardsAlternateProps) {
  const { versions } = props;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {versions.map((row) => (
        <PublishedCard key={row.id} row={row} {...props} />
      ))}
    </div>
  );
}

/**
 * Card-grid view, surfaced as a collapsed `<details>` panel underneath
 * the default table on the listing. Cards reuse the same row-state
 * palette (top accent strip + state chip + errors tone) so flipping
 * the view doesn't move the eye to a new vocabulary.
 */
export function PublishedCardsAlternate(props: PublishedCardsAlternateProps) {
  const { versions } = props;
  return (
    <details className={`${dashboardPanelClass} group`}>
      <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
        <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
        <span className="font-semibold">Cards view</span>
        <span className="font-mono text-[11px] text-gray-400">
          — same data, card-per-version layout · {versions.length} {versions.length === 1 ? 'card' : 'cards'}
        </span>
      </summary>
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <PublishedCardsGrid {...props} />
      </div>
    </details>
  );
}

interface PublishedCardProps extends PublishedCardsAlternateProps {
  row: PublishedVersionRow;
}

function PublishedCard({
  row,
  metricsById,
  decorationsById,
  onOpenDetail,
  onCopyUrl,
  onOpenView,
  onToggleVisibility,
  pathFor,
}: PublishedCardProps) {
  const metrics = metricsById.get(row.id);
  const decoration = decorationsById.get(row.id);
  const state = decoration?.state ?? 'ok';
  const accent = state === 'ok' ? publishedCardAccentClass[row.visibility] : publishedCardAccentClass[state];
  const wow = metrics ? formatWoW(metrics.requestsWoW) : null;
  const errorTier = metrics ? publishedErrorTier(metrics.errorRate) : null;
  const errorClass = errorTier ? publishedErrorTierClass[errorTier] : 'text-gray-700 dark:text-gray-200';

  const initials = useMemo(() => deriveInitials(row.project_name), [row.project_name]);
  const gradient = useMemo(() => pickAvatarGradient(row.project_id), [row.project_id]);

  return (
    <article className="relative rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden flex flex-col">
      <div className={`h-1 ${accent}`} aria-hidden="true" />
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-mono font-semibold text-xs shrink-0`}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpenDetail(row)}
              className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 truncate text-left transition-colors"
            >
              {row.project_name}
            </button>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> v{row.version_id}
              </span>
              {decoration?.chipLabel ? (
                <span
                  className={`text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${publishedRowStateChipClass[state]}`}
                >
                  {decoration.chipLabel}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleVisibility(row)}
            className={publishedVisibilityPillClass[row.visibility]}
          >
            {row.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {row.visibility === 'public' ? 'Public' : 'Private'}
          </button>
        </div>

        {row.description ? (
          <p className="text-[12px] text-gray-600 dark:text-gray-400 line-clamp-2">{row.description}</p>
        ) : null}

        <div className={`${publishedUrlBlockClass} px-3 py-2 flex items-center gap-2 min-w-0`}>
          <code className="font-mono text-[11px] text-indigo-700 dark:text-indigo-300 truncate flex-1 min-w-0">
            {pathFor(row)}
          </code>
          {row.visibility === 'private' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40">
              <KeyRound className="w-3 h-3" /> key
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onCopyUrl(row)}
            className="p-1 rounded hover:bg-white dark:hover:bg-gray-900 text-gray-400 hover:text-indigo-500 transition-colors"
            title="Copy URL"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenView(row, 'open')}
            className="p-1 rounded hover:bg-white dark:hover:bg-gray-900 text-gray-400 hover:text-indigo-500 transition-colors"
            title="Open OpenAPI spec"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Stat
            label="Req · 24h"
            value={metrics ? formatRequestsShort(metrics.requests24h) : '—'}
            footnote={
              wow
                ? wow.label
                : undefined
            }
            footnoteTone={wow ? wow.tone : undefined}
          />
          <Stat
            label="p50"
            value={metrics ? `${metrics.p50Ms}ms` : '—'}
          />
          <Stat
            label="Errors"
            value={metrics ? `${(metrics.errorRate * 100).toFixed(2)}%` : '—'}
            valueClass={errorClass}
          />
          <Stat
            label="Cons."
            value={metrics ? metrics.consumers.toLocaleString() : '—'}
          />
        </div>

        {metrics ? (
          <div className="flex items-center gap-2">
            <Sparkline
              points={metrics.hourlyRequests}
              tone={state === 'problem' ? 'rose' : state === 'stale' ? 'amber' : 'indigo'}
              area
              width={140}
              height={24}
              className="w-full h-6"
            />
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 shrink-0">
              {metrics.lastSeenAt ? relativeAgo(metrics.lastSeenAt) : '—'}
            </span>
          </div>
        ) : null}

        <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
            {row.creator_name ? `by ${row.creator_name}` : 'unknown publisher'} · {relativeAgo(row.published_at)}
          </p>
          <button
            type="button"
            onClick={() => onOpenDetail(row)}
            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 inline-flex items-center gap-1 transition-colors"
          >
            View details <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </article>
  );
}

interface StatProps {
  label: string;
  value: string;
  valueClass?: string;
  footnote?: string;
  footnoteTone?: 'up' | 'down' | 'flat';
}

function Stat({ label, value, valueClass, footnote, footnoteTone }: StatProps) {
  const footnoteClass =
    footnoteTone === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : footnoteTone === 'down'
      ? 'text-rose-500 dark:text-rose-400'
      : 'text-gray-400 dark:text-gray-500';
  return (
    <div className="rounded-md bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-center">
      <p className="text-[9px] uppercase tracking-wider font-semibold text-gray-400">{label}</p>
      <p className={`font-mono text-sm mt-0.5 ${valueClass ?? 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
      {footnote ? (
        <p className={`font-mono text-[9px] mt-0.5 ${footnoteClass} truncate`}>{footnote}</p>
      ) : null}
    </div>
  );
}

function deriveInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '··';
  const parts = trimmed.split(/[-_\s]+/u).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function pickAvatarGradient(projectId: string): string {
  let h = 0;
  for (let i = 0; i < projectId.length; i += 1) {
    h = (h * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return projectAvatarGradientClasses[h % projectAvatarGradientClasses.length];
}
