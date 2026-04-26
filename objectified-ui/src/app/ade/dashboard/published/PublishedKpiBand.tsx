'use client';

import { Globe, Lock, Activity, Users, KeyRound, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { ProjectKpiCard } from '@/app/components/ade/dashboard/ProjectKpiCard';
import { dashboardPanelClass } from '@/app/components/ade/dashboard/dashboardScreenClasses';
import type { PublishedVersionMetrics, PublishedVersionRow } from './_internal/types';
import { formatRequestsShort, formatWoW } from './_internal/fixtures';

export interface PublishedKpiBandProps {
  versions: PublishedVersionRow[];
  metricsById: Map<string, PublishedVersionMetrics>;
  /** Number of api keys for the current tenant that are enabled & not expired. */
  enabledApiKeyCount: number;
  /** Total api keys (any state). Used to decide whether the "missing key" warn shows. */
  totalApiKeyCount: number;
}

/**
 * Top-of-page KPI strip. Four cards:
 *   1. Published versions    — count + new-this-week delta
 *   2. Visibility split      — public / private bar + missing-key warn
 *   3. Requests · 7d         — volume + sparkline + w/w delta
 *   4. Active consumers      — count + new-this-week delta
 *
 * The first/third/fourth reuse `ProjectKpiCard` so the visual language
 * matches the rest of the dashboard. The second is a hand-rolled card
 * because the split bar needs the full card width and won't fit
 * `ProjectKpiCard`'s value/sparkline split.
 */
export function PublishedKpiBand({ versions, metricsById, enabledApiKeyCount, totalApiKeyCount }: PublishedKpiBandProps) {
  const total = versions.length;

  const publicCount = versions.filter((v) => v.visibility === 'public').length;
  const privateCount = total - publicCount;
  const publicPct = total === 0 ? 0 : Math.round((publicCount / total) * 100);
  const privatePct = total === 0 ? 0 : 100 - publicPct;
  const privateMissingKey = privateCount > 0 && enabledApiKeyCount === 0;

  const newThisWeek = versions.filter((v) => withinDays(v.published_at, 7)).length;

  // Aggregate request volume across all versions over the last 7d (we
  // only have hourly 24h fixtures, so the "7d" is a 24h sum × 7 — close
  // enough until real metrics ship).
  let totalRequests7d = 0;
  let totalRequests24h = 0;
  let totalLast24Spark: number[] = Array(24).fill(0);
  let consumerSet = 0;
  let newConsumers = 0;
  let weightedDelta = 0;
  let weightSum = 0;
  for (const v of versions) {
    const m = metricsById.get(v.id);
    if (!m) continue;
    totalRequests24h += m.requests24h;
    totalRequests7d += m.requests24h * 7;
    totalLast24Spark = totalLast24Spark.map((sum, i) => sum + (m.hourlyRequests[i] ?? 0));
    consumerSet += m.consumers;
    newConsumers += m.newConsumers;
    weightedDelta += m.requestsWoW * m.requests24h;
    weightSum += m.requests24h;
  }
  const avgWoW = weightSum === 0 ? 0 : weightedDelta / weightSum;
  const wow = formatWoW(avgWoW);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <ProjectKpiCard
        label="Published versions"
        value={total.toLocaleString()}
        subtitle={
          newThisWeek > 0
            ? `+${newThisWeek} new this week`
            : 'No new publications this week'
        }
        subtitleTone={newThisWeek > 0 ? 'positive' : 'default'}
        subtitleIcon={newThisWeek > 0 ? <TrendingUp className="w-3 h-3" /> : null}
        icon={<Globe className="w-4 h-4" />}
        tone="indigo"
      />

      <article className={`${dashboardPanelClass} p-5`}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
            Visibility
          </p>
          <span className="text-emerald-400 shrink-0" aria-hidden="true">
            <Lock className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono leading-none text-emerald-600 dark:text-emerald-400">
              {publicCount}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">public</span>
            <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">·</span>
            <span className="text-2xl font-bold font-mono leading-none text-slate-600 dark:text-slate-300">
              {privateCount}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">private</span>
          </div>
          {total > 0 ? (
            <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex" aria-hidden="true">
              <div className="h-full bg-emerald-500" style={{ width: `${publicPct}%` }} />
              <div className="h-full bg-slate-400 dark:bg-slate-500" style={{ width: `${privatePct}%` }} />
            </div>
          ) : null}
          <p
            className={`text-[11px] mt-2 flex items-center gap-1 ${
              privateMissingKey
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {privateMissingKey ? (
              <>
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {privateCount} private without an enabled API key
                </span>
              </>
            ) : totalApiKeyCount > 0 ? (
              <>
                <KeyRound className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {enabledApiKeyCount} of {totalApiKeyCount} keys enabled
                </span>
              </>
            ) : (
              <span className="truncate">No API keys configured</span>
            )}
          </p>
        </div>
      </article>

      <ProjectKpiCard
        label="Requests · 7d"
        value={formatRequestsShort(totalRequests7d)}
        subtitle={
          totalRequests24h > 0
            ? `${formatRequestsShort(totalRequests24h)} today · ${wow.label}`
            : 'No traffic recorded'
        }
        subtitleTone={
          wow.tone === 'up' ? 'positive' : wow.tone === 'down' ? 'negative' : 'default'
        }
        subtitleIcon={
          wow.tone === 'up' ? (
            <TrendingUp className="w-3 h-3" />
          ) : wow.tone === 'down' ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )
        }
        icon={<Activity className="w-4 h-4" />}
        tone="sky"
        sparkline={totalLast24Spark}
      />

      <ProjectKpiCard
        label="Active consumers"
        value={consumerSet.toLocaleString()}
        subtitle={
          newConsumers > 0
            ? `+${newConsumers} new this week`
            : 'No new consumers this week'
        }
        subtitleTone={newConsumers > 0 ? 'positive' : 'default'}
        subtitleIcon={newConsumers > 0 ? <TrendingUp className="w-3 h-3" /> : null}
        icon={<Users className="w-4 h-4" />}
        tone="violet"
      />
    </div>
  );
}

function withinDays(iso: string, days: number): boolean {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= days * 86_400_000;
}
