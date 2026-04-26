'use client';

import { Activity, Gauge, CircleAlert, UsersRound, Layers } from 'lucide-react';
import {
  publishedErrorTier,
  publishedErrorTierClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { Sparkline } from './Sparkline';
import { formatRequestsShort, formatWoW } from './fixtures';
import type { PublishedVersionMetrics, PublishedVersionSchemaSummary } from './types';

export interface PublishedDetailHeroProps {
  metrics: PublishedVersionMetrics;
  schema: PublishedVersionSchemaSummary;
  /** Latency target for p50, in ms. Default 75. */
  p50TargetMs?: number;
  /** Latency target for p95, in ms. Default 250. */
  p95TargetMs?: number;
}

/**
 * Six-cell hero KPI strip on the per-version detail page. Each cell
 * is a compact panel with:
 *   - eyebrow label + tone icon (top-right)
 *   - large mono value
 *   - small mono footnote (target / count / breakdown)
 *
 * The first cell carries the activity sparkline alongside the value.
 * Tones follow the listing palette (sky / emerald / amber / rose /
 * purple / indigo) for consistency.
 */
export function PublishedDetailHero({
  metrics,
  schema,
  p50TargetMs = 75,
  p95TargetMs = 250,
}: PublishedDetailHeroProps) {
  const wow = formatWoW(metrics.requestsWoW);
  const errorTier = publishedErrorTier(metrics.errorRate);
  const errorClass = publishedErrorTierClass[errorTier];
  const errorIconClass =
    errorTier === 'good'
      ? 'text-emerald-500'
      : errorTier === 'warn'
      ? 'text-amber-500'
      : 'text-rose-500';
  const errorCount = Math.round(metrics.requests24h * metrics.errorRate);

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Cell
        label="Req · 24h"
        icon={<Activity className="w-3.5 h-3.5 text-sky-500" />}
        value={formatRequestsShort(metrics.requests24h)}
        footnote={wow.label}
        footnoteClass={
          wow.tone === 'up'
            ? 'text-emerald-600 dark:text-emerald-400'
            : wow.tone === 'down'
            ? 'text-rose-500 dark:text-rose-400'
            : undefined
        }
        sparkline={
          <Sparkline
            points={metrics.hourlyRequests}
            tone={wow.tone === 'down' ? 'rose' : wow.tone === 'flat' ? 'slate' : 'emerald'}
            area
            width={64}
            height={20}
            className="w-16 h-5"
          />
        }
      />
      <Cell
        label="p50"
        icon={<Gauge className="w-3.5 h-3.5 text-emerald-500" />}
        value={
          <>
            {metrics.p50Ms}
            <span className="text-sm text-gray-400 font-normal">ms</span>
          </>
        }
        footnote={`target ≤ ${p50TargetMs}ms`}
      />
      <Cell
        label="p95"
        icon={<Gauge className="w-3.5 h-3.5 text-amber-500" />}
        value={
          <>
            {metrics.p95Ms}
            <span className="text-sm text-gray-400 font-normal">ms</span>
          </>
        }
        footnote={`target ≤ ${p95TargetMs}ms`}
      />
      <Cell
        label="Errors"
        icon={<CircleAlert className={`w-3.5 h-3.5 ${errorIconClass}`} />}
        value={
          <>
            <span className={errorClass}>
              {(metrics.errorRate * 100).toFixed(2)}
              <span className="text-sm font-normal">%</span>
            </span>
          </>
        }
        footnote={`${errorCount.toLocaleString()} of ${formatRequestsShort(metrics.requests24h)}`}
      />
      <Cell
        label="Consumers"
        icon={<UsersRound className="w-3.5 h-3.5 text-purple-500" />}
        value={metrics.consumers.toLocaleString()}
        footnote={
          metrics.newConsumers > 0
            ? `+${metrics.newConsumers} new`
            : 'no new this week'
        }
        footnoteClass={
          metrics.newConsumers > 0 ? 'text-emerald-600 dark:text-emerald-400' : undefined
        }
      />
      <Cell
        label="Schema"
        icon={<Layers className="w-3.5 h-3.5 text-indigo-500" />}
        value={
          <>
            {schema.schemas.toLocaleString()}{' '}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">schemas</span>
          </>
        }
        footnote={`${schema.paths} paths · ${schema.operations} ops`}
      />
    </section>
  );
}

interface CellProps {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  footnote: string;
  footnoteClass?: string;
  sparkline?: React.ReactNode;
}

function Cell({ label, icon, value, footnote, footnoteClass, sparkline }: CellProps) {
  const footnoteCls = footnoteClass ?? 'text-gray-500 dark:text-gray-400';
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
          {label}
        </p>
        {icon}
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <div className="min-w-0">
          <p className="text-xl font-bold font-mono leading-none text-gray-900 dark:text-gray-100">
            {value}
          </p>
          <p className={`text-[10px] font-mono mt-1 ${footnoteCls}`}>{footnote}</p>
        </div>
        {sparkline ? <div className="shrink-0">{sparkline}</div> : null}
      </div>
    </div>
  );
}
