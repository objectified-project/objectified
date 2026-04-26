/**
 * Deterministic fixtures for the redesigned Published surface.
 *
 * The mockup carries traffic, latency, error, consumer, lineage, and
 * activity affordances that have **no backing helpers in `lib/db/helper.ts`
 * today** (see the recon report). Until those helpers ship, this module
 * is the single source of "made-up but stable" data: every value is
 * derived from the version row's `id` via a seeded PRNG, so the same row
 * always renders the same numbers across reloads and devices.
 *
 * Design rule: the rest of the codebase MUST NOT import this module.
 * Components import `./types` and consume the result of `decoratePublished*`
 * functions. When real helpers ship in Phase 5+, only the call-sites that
 * read from this module need to flip — the type contract is unchanged.
 */

import {
  publishedErrorTier,
  type PublishedMethod,
  type PublishedRowState,
  publishedRowStateChipLabel,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import type {
  PublishedReleaseNotes,
  PublishedRowDecoration,
  PublishedVersionActivityEvent,
  PublishedVersionAlert,
  PublishedVersionConsumer,
  PublishedVersionDetail,
  PublishedVersionLineage,
  PublishedVersionLineageNode,
  PublishedVersionMetrics,
  PublishedVersionRow,
  PublishedVersionSchemaSummary,
  PublishedVersionTopOperation,
} from './types';

/**
 * mulberry32 — fast, deterministic, 32-bit. Sufficient for picking
 * "stable random-looking" numbers from a string seed. Not for crypto.
 */
function makeRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = h || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);
const intBetween = (rng: () => number, lo: number, hi: number) =>
  Math.floor(between(rng, lo, hi + 1));

/** Daily age of a published row, in days. */
function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const ms = Date.now() - then;
  return Math.max(0, Math.floor(ms / 86400000));
}

/** Render a duration in days as "12 d ago" / "3 h ago". */
function relativeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const ms = Date.now() - then;
  if (ms < 60000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60000)} m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`;
  if (ms < 30 * 86_400_000) return `${Math.floor(ms / 86_400_000)} d ago`;
  return `${Math.floor(ms / (30 * 86_400_000))} mo ago`;
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

export function fakeMetricsForVersion(row: PublishedVersionRow): PublishedVersionMetrics {
  const rng = makeRng(`metrics:${row.id}`);
  const age = daysSince(row.published_at);

  // Hot rows skew higher; stale rows decay; mid-life rows sit in a comfortable band.
  const ageMultiplier = age < 14 ? 1.4 : age < 60 ? 1 : 0.45;
  const baseRequests = intBetween(rng, 1500, 250000);
  const requests24h = Math.round(baseRequests * ageMultiplier);

  const hourlyRequests: number[] = [];
  for (let i = 0; i < 24; i += 1) {
    const wave = 0.6 + 0.4 * Math.sin((i / 24) * Math.PI * 2 + rng() * 6);
    hourlyRequests.push(Math.max(1, Math.round((requests24h / 24) * wave)));
  }

  const requestsWoW = between(rng, -0.18, 0.32);
  const p50Ms = Math.round(between(rng, 14, 110));
  const p95Ms = Math.round(p50Ms * between(rng, 1.8, 3.5));
  const errorRate = Math.max(0, between(rng, -0.004, 0.018));
  const consumers = intBetween(rng, 1, 28);
  const newConsumers = intBetween(rng, 0, Math.min(5, consumers));

  // Stale rows haven't been seen in days; everything else got hit recently.
  const lastSeenMs =
    age >= 60
      ? Date.now() - intBetween(rng, 5, 25) * 86_400_000
      : Date.now() - intBetween(rng, 5, 14_400) * 1000;

  return {
    requests24h,
    requestsWoW,
    p50Ms,
    p95Ms,
    errorRate,
    consumers,
    newConsumers,
    lastSeenAt: new Date(lastSeenMs).toISOString(),
    hourlyRequests,
  };
}

/* ------------------------------------------------------------------ */
/* Row decoration (state + chip label)                                 */
/* ------------------------------------------------------------------ */

/**
 * Pick a row state from metrics. Order of precedence matches the design
 * doc: stale > problem > hot > ok. A row never carries two states.
 */
export function decoratePublishedRow(
  row: PublishedVersionRow,
  metrics: PublishedVersionMetrics,
): PublishedRowDecoration {
  const age = daysSince(row.published_at);
  let state: PublishedRowState = 'ok';

  if (age >= 60 && metrics.requests24h < 1500) {
    state = 'stale';
  } else if (publishedErrorTier(metrics.errorRate) === 'bad') {
    state = 'problem';
  } else if (metrics.requests24h >= 100_000) {
    state = 'hot';
  }

  return { state, chipLabel: publishedRowStateChipLabel[state] };
}

/* ------------------------------------------------------------------ */
/* Schema summary                                                      */
/* ------------------------------------------------------------------ */

export function fakeSchemaSummary(row: PublishedVersionRow): PublishedVersionSchemaSummary {
  const rng = makeRng(`schema:${row.id}`);
  const paths = intBetween(rng, 6, 48);
  const operations = paths * intBetween(rng, 2, 5);
  const schemas = intBetween(rng, paths, paths * 8);
  const webhooks = intBetween(rng, 0, 12);
  return { paths, operations, schemas, webhooks };
}

/* ------------------------------------------------------------------ */
/* Top operations                                                      */
/* ------------------------------------------------------------------ */

const SAMPLE_OPS: Array<{ method: PublishedMethod; path: string }> = [
  { method: 'GET', path: '/invoices/{id}' },
  { method: 'POST', path: '/charges' },
  { method: 'GET', path: '/subscriptions' },
  { method: 'POST', path: '/refunds' },
  { method: 'DELETE', path: '/subscriptions/{id}' },
  { method: 'GET', path: '/customers' },
  { method: 'POST', path: '/webhooks' },
  { method: 'PATCH', path: '/customers/{id}' },
  { method: 'GET', path: '/balance' },
  { method: 'POST', path: '/transfers' },
];

export function fakeTopOperations(
  row: PublishedVersionRow,
  metrics: PublishedVersionMetrics,
): PublishedVersionTopOperation[] {
  const rng = makeRng(`topops:${row.id}`);
  const picks = [...SAMPLE_OPS]
    .map((op) => ({ op, sortKey: rng() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 5)
    .map(({ op }) => op);

  let remaining = metrics.requests24h;
  return picks.map((op, idx) => {
    const fraction = idx === picks.length - 1 ? 1 : between(rng, 0.18, 0.42);
    const requests = Math.max(1, Math.round(remaining * fraction));
    remaining -= requests;
    const sparkline = Array.from({ length: 12 }, () => Math.max(1, Math.round(between(rng, 0.4, 1) * requests / 12)));
    return { method: op.method, path: op.path, requests, sparkline };
  });
}

/* ------------------------------------------------------------------ */
/* Consumers                                                           */
/* ------------------------------------------------------------------ */

const SAMPLE_OWNERS = [
  { key: 'partner-stripe-prod', owner: 'Stripe Inc.' },
  { key: 'internal-billing-svc', owner: 'Platform · Acme' },
  { key: 'partner-shopify-staging', owner: 'Shopify Inc.' },
  { key: 'mobile-app-ios-prod', owner: 'Mobile · Acme' },
  { key: 'analytics-internal', owner: 'Analytics · Acme' },
  { key: 'legacy-finance-etl', owner: 'Finance · Acme' },
  { key: 'partner-zapier-prod', owner: 'Zapier' },
  { key: 'docs-site-fetcher', owner: 'Docs · Acme' },
];

export function fakeConsumers(
  row: PublishedVersionRow,
  metrics: PublishedVersionMetrics,
): PublishedVersionConsumer[] {
  const rng = makeRng(`consumers:${row.id}`);
  const count = Math.min(metrics.consumers, SAMPLE_OWNERS.length);
  const picked = [...SAMPLE_OWNERS]
    .map((owner) => ({ owner, sortKey: rng() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, count);

  let remaining = metrics.requests24h;
  return picked.map(({ owner }, idx) => {
    const fraction = idx === picked.length - 1 ? 1 : between(rng, 0.15, 0.5);
    const requests24h = Math.max(0, Math.round(remaining * fraction));
    remaining -= requests24h;
    const requests7d = Math.round(requests24h * between(rng, 5.4, 7.6));
    const expired = idx === picked.length - 1 && rng() > 0.6;
    const expiresMs = expired
      ? Date.now() - intBetween(rng, 1, 30) * 86_400_000
      : Date.now() + intBetween(rng, 7, 220) * 86_400_000;
    const errorRate = expired ? 0 : Math.max(0, between(rng, -0.003, 0.012));
    return {
      apiKeyId: `${row.id}::${owner.key}`,
      apiKeyLabel: owner.key,
      ownerLabel: owner.owner,
      requests24h: expired ? 0 : requests24h,
      requests7d,
      errorRate,
      lastSeenAt: new Date(
        expired
          ? Date.now() - intBetween(rng, 8, 30) * 86_400_000
          : Date.now() - intBetween(rng, 5, 14_400) * 1000,
      ).toISOString(),
      expiresAt: rng() > 0.85 && !expired ? null : new Date(expiresMs).toISOString(),
      expired,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Lineage                                                             */
/* ------------------------------------------------------------------ */

function bumpSemver(version: string, delta: 'patch-down' | 'pre-up'): string {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return delta === 'pre-up' ? `${version}.next` : `${version}.prev`;
  const [, major, minor, patch] = match;
  if (delta === 'patch-down') {
    const p = Math.max(0, Number(patch) - 1);
    return `${major}.${minor}.${p}`;
  }
  return `${major}.${Number(minor) + 1}.0-rc1`;
}

export function fakeLineage(
  row: PublishedVersionRow,
  metrics: PublishedVersionMetrics,
): PublishedVersionLineage {
  const rng = makeRng(`lineage:${row.id}`);
  const hasParent = rng() > 0.2;
  const hasChild = rng() > 0.55;
  const age = daysSince(row.published_at);

  const self: PublishedVersionLineageNode = {
    id: row.id,
    versionId: `v${row.version_id}`,
    state: 'published',
    ageDays: age,
    meta: `${formatRequestsShort(metrics.requests24h)} req · 24h · ${metrics.consumers} consumers`,
  };

  const parent: PublishedVersionLineageNode | null = hasParent
    ? {
        id: null,
        versionId: `v${bumpSemver(row.version_id, 'patch-down')}`,
        state: 'deprecated',
        ageDays: age + intBetween(rng, 30, 120),
        meta: `${intBetween(rng, 1, 18)}k req · 24h · ${intBetween(rng, 1, 6)} consumers`,
      }
    : null;

  const child: PublishedVersionLineageNode | null = hasChild
    ? {
        id: null,
        versionId: `v${bumpSemver(row.version_id, 'pre-up')}`,
        state: 'rc',
        ageDays: intBetween(rng, 1, 14),
        meta: 'in review',
      }
    : null;

  return { parent, self, child };
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

export function fakeActivity(row: PublishedVersionRow): PublishedVersionActivityEvent[] {
  const rng = makeRng(`activity:${row.id}`);
  const author = row.creator_name ?? 'unknown';
  const events: PublishedVersionActivityEvent[] = [
    {
      id: `${row.id}::publish`,
      kind: 'publish',
      title: `Published v${row.version_id}`,
      meta: `${author} · approved by ${pickReviewer(rng)}, ${pickReviewer(rng)}`,
      when: relativeAgo(row.published_at),
    },
    {
      id: `${row.id}::visibility`,
      kind: 'visibility-change',
      title: `Visibility set to ${row.visibility}`,
      meta:
        row.visibility === 'public'
          ? `${author} · was: private (during pre-release window)`
          : `${author} · restricted to API keys`,
      when: relativeAgo(row.published_at),
    },
  ];

  if (rng() > 0.4) {
    events.push({
      id: `${row.id}::consumers`,
      kind: 'consumers-added',
      title: `${intBetween(rng, 1, 4)} new consumers`,
      meta: 'Added in last 24 h',
      when: 'today',
    });
  }
  if (rng() > 0.5) {
    events.push({
      id: `${row.id}::error-alert`,
      kind: 'error-alert',
      title: 'Errors trending up',
      meta: 'Auto alert · error rate climbing on a hot operation',
      when: `${intBetween(rng, 1, 5)} d ago`,
    });
  }
  events.push({
    id: `${row.id}::downloads`,
    kind: 'spec-download',
    title: `Spec downloaded · ${intBetween(rng, 200, 4000).toLocaleString()} times`,
    meta: 'Last 24 h · YAML + JSON combined',
    when: '24 h',
  });
  if (rng() > 0.7) {
    events.push({
      id: `${row.id}::lineage`,
      kind: 'lineage-update',
      title: 'Lineage updated',
      meta: 'Child draft created from this version',
      when: `${intBetween(rng, 1, 7)} d ago`,
    });
  }
  return events;
}

const REVIEWERS = ['Mira L.', 'Devon R.', 'Sasha P.', 'Nico T.', 'Jules W.'];
function pickReviewer(rng: () => number): string {
  return REVIEWERS[Math.floor(rng() * REVIEWERS.length)];
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export function fakeAlerts(
  row: PublishedVersionRow,
  metrics: PublishedVersionMetrics,
  consumers: PublishedVersionConsumer[],
): PublishedVersionAlert[] {
  const alerts: PublishedVersionAlert[] = [];
  if (publishedErrorTier(metrics.errorRate) !== 'good') {
    alerts.push({
      id: `${row.id}::errors`,
      tone: publishedErrorTier(metrics.errorRate) === 'bad' ? 'critical' : 'warning',
      title: 'Errors trending up',
      body: `Error rate at ${(metrics.errorRate * 100).toFixed(2)} % over the last 7 d.`,
    });
  }
  const expiringSoon = consumers.find(
    (c) =>
      !c.expired &&
      c.expiresAt &&
      new Date(c.expiresAt).getTime() - Date.now() < 14 * 86_400_000,
  );
  if (expiringSoon) {
    alerts.push({
      id: `${row.id}::key`,
      tone: 'warning',
      title: 'Consumer key expiring',
      body: `${expiringSoon.apiKeyLabel} expires soon (${expiringSoon.requests24h.toLocaleString()} req / 24h).`,
    });
  }
  if (daysSince(row.published_at) >= 60 && metrics.requests24h < 1500) {
    alerts.push({
      id: `${row.id}::stale`,
      tone: 'info',
      title: 'Catalog link looks stale',
      body: 'No meaningful traffic in 60 d. Consider deprecating or hiding from the catalog.',
    });
  }
  return alerts;
}

/* ------------------------------------------------------------------ */
/* Release notes                                                       */
/* ------------------------------------------------------------------ */

export function fakeReleaseNotes(row: PublishedVersionRow): PublishedReleaseNotes {
  const rng = makeRng(`notes:${row.id}`);
  const titleSuffixes = [
    'Recurring billing & dunning',
    'Schema cleanup & deprecations',
    'New webhooks & idempotency',
    'Pagination & cursor unification',
    'Subscription lifecycle',
  ];
  const title = `v${row.version_id} — ${titleSuffixes[Math.floor(rng() * titleSuffixes.length)]}`;
  const supersedes = `v${bumpSemver(row.version_id, 'patch-down')}`;

  const breakingPool = [
    '`POST /charges` requires `currency` in the body (was query param).',
    'Response field `amount` is now an integer in minor units (was decimal).',
    '`GET /customers` removes the deprecated `legacy_id` field.',
  ];
  const addedPool = [
    '`/subscriptions` — list, create, update, cancel.',
    '`/dunning` — retry policy & webhooks.',
    'Webhook `invoice.payment_retry`.',
    '`/transfers` — partner-to-partner settlement.',
  ];
  const improvedPool = [
    'Idempotency keys honored on `/refunds`.',
    'Pagination cursor format unified across resources.',
    'Tighter validation on `currency` codes (ISO-4217).',
  ];

  return {
    title,
    publishedRel: relativeAgo(row.published_at),
    supersedes,
    breaking: pickN(rng, breakingPool, intBetween(rng, 0, 2)),
    added: pickN(rng, addedPool, intBetween(rng, 1, 3)),
    improved: pickN(rng, improvedPool, intBetween(rng, 1, 2)),
    migrationGuideUrl: '#',
  };
}

function pickN<T>(rng: () => number, pool: T[], n: number): T[] {
  return [...pool]
    .map((item) => ({ item, key: rng() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, Math.max(0, Math.min(n, pool.length)))
    .map((entry) => entry.item);
}

/* ------------------------------------------------------------------ */
/* Detail bundle                                                       */
/* ------------------------------------------------------------------ */

export function fakeDetailBundle(row: PublishedVersionRow): PublishedVersionDetail {
  const metrics = fakeMetricsForVersion(row);
  const consumers = fakeConsumers(row, metrics);
  return {
    row,
    metrics,
    schema: fakeSchemaSummary(row),
    topOperations: fakeTopOperations(row, metrics),
    consumers,
    lineage: fakeLineage(row, metrics),
    activity: fakeActivity(row),
    alerts: fakeAlerts(row, metrics, consumers),
    releaseNotes: fakeReleaseNotes(row),
  };
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

/** Compact request-count formatter ("412k", "1.2M", "823"). */
export function formatRequestsShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return `${n}`;
}

/** Format a w/w delta as "▲ 8 % w/w" / "▼ 3 % w/w" / "≈ flat". */
export function formatWoW(fraction: number): { label: string; tone: 'up' | 'down' | 'flat' } {
  const pct = Math.round(fraction * 100);
  if (pct >= 1) return { label: `▲ ${pct} % w/w`, tone: 'up' };
  if (pct <= -1) return { label: `▼ ${Math.abs(pct)} % w/w`, tone: 'down' };
  return { label: '≈ flat', tone: 'flat' };
}

export { relativeAgo };
