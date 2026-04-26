/**
 * Typed shapes shared across the redesigned Published listing & detail
 * pages. The DB layer (`getPublishedVersionsForTenant`) returns the
 * `PublishedVersionRow` columns directly; everything else here is either:
 *
 *   (a) computed from the row (e.g. `PublishedRowState`), or
 *   (b) sourced from the fixtures module today and slated to be replaced
 *       by real DB helpers in a follow-up phase (metrics, consumers,
 *       lineage children, scoped activity).
 *
 * Keeping these centralised means the cut-over from fixtures to live
 * helpers is a one-file swap — components import the type, fixtures
 * implement it, the eventual helper implements it.
 */

import type {
  PublishedMethod,
  PublishedRowState,
  PublishedVisibility,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';

/** Row shape returned verbatim by `getPublishedVersionsForTenant`. */
export interface PublishedVersionRow {
  id: string;
  version_id: string;
  description: string | null;
  visibility: PublishedVisibility;
  published_at: string;
  created_at: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  creator_name: string | null;
  creator_email: string | null;
}

/**
 * Operational metrics for one published version. All windowed values are
 * keyed by their window in the field name so the call-site is explicit.
 */
export interface PublishedVersionMetrics {
  /** Total request count over the last 24 h. */
  requests24h: number;
  /** Week-over-week delta as a fraction (0.08 = +8 %). May be negative. */
  requestsWoW: number;
  /** Latency p50 in milliseconds, computed over the 24h window. */
  p50Ms: number;
  /** Latency p95 in milliseconds. */
  p95Ms: number;
  /** Error rate as a fraction (0.002 = 0.2 %). */
  errorRate: number;
  /** Number of distinct API keys with traffic on this version in 24h. */
  consumers: number;
  /** Number of consumer keys that newly appeared in the last 7 d. */
  newConsumers: number;
  /** Last-seen timestamp ISO string. */
  lastSeenAt: string | null;
  /**
   * 24-point sparkline (one point per hour). Used by the KPI strip on
   * the detail page and the per-row activity sparkline on the listing.
   */
  hourlyRequests: number[];
}

/** Lightweight schema summary for the detail page's "Schema & usage" card. */
export interface PublishedVersionSchemaSummary {
  paths: number;
  operations: number;
  schemas: number;
  webhooks: number;
}

/** One operation in the "top ops by volume" list on the detail page. */
export interface PublishedVersionTopOperation {
  method: PublishedMethod;
  path: string;
  /** Request count over the displayed window (matches metrics.requests24h). */
  requests: number;
  /** 12-point sparkline (one per 2h slot). */
  sparkline: number[];
  /** Optional callout (e.g. "+ new in v2.5.0", "⚠ Breaking — currency moved to body"). */
  note?: string;
  /** Tone for the inline note. */
  noteTone?: 'positive' | 'warning' | 'breaking' | 'neutral';
}

/** One per-API-key consumer row on the Consumers tab. */
export interface PublishedVersionConsumer {
  apiKeyId: string;
  /** Display label (truncated key alias / name). Never the raw secret. */
  apiKeyLabel: string;
  ownerLabel: string;
  requests24h: number;
  requests7d: number;
  errorRate: number;
  lastSeenAt: string;
  /** ISO timestamp; `null` = never expires. */
  expiresAt: string | null;
  /** True when the key is past its expiry. */
  expired: boolean;
}

export interface PublishedVersionLineageNode {
  /** `id` from `odb.versions` (UUID), or `null` for the synthetic placeholder. */
  id: string | null;
  /** Semver string ("v2.4.6"). */
  versionId: string;
  /** "deprecated", "published", "draft", "rc". */
  state: 'published' | 'deprecated' | 'draft' | 'rc';
  /** Days since this node entered its current state. */
  ageDays: number;
  /** Optional supporting line ("11k req · 24h · 2 consumers" etc.). */
  meta?: string;
}

export interface PublishedVersionLineage {
  parent: PublishedVersionLineageNode | null;
  /** Always present — the version we're rendering. */
  self: PublishedVersionLineageNode;
  child: PublishedVersionLineageNode | null;
}

/** Scoped activity event for the detail page Activity tab + rail recap. */
export interface PublishedVersionActivityEvent {
  id: string;
  kind:
    | 'publish'
    | 'visibility-change'
    | 'consumers-added'
    | 'error-alert'
    | 'spec-download'
    | 'lineage-update';
  title: string;
  meta: string;
  /** Relative-time string ("12 d ago"). */
  when: string;
}

export interface PublishedVersionAlert {
  id: string;
  tone: 'warning' | 'critical' | 'info';
  title: string;
  body: string;
}

/**
 * Full bundle for the detail page. Right rail and tabs all read from
 * here so the component tree stays prop-driven and the eventual live
 * helper has one shape to fulfil.
 */
export interface PublishedVersionDetail {
  row: PublishedVersionRow;
  metrics: PublishedVersionMetrics;
  schema: PublishedVersionSchemaSummary;
  topOperations: PublishedVersionTopOperation[];
  consumers: PublishedVersionConsumer[];
  lineage: PublishedVersionLineage;
  activity: PublishedVersionActivityEvent[];
  alerts: PublishedVersionAlert[];
  /**
   * Markdown-ish release notes block. Fixtures generate something
   * structured today; a future helper can return the persisted notes.
   */
  releaseNotes: PublishedReleaseNotes;
}

export interface PublishedReleaseNotes {
  /** Human title ("v2.5.0 — Recurring billing & dunning"). */
  title: string;
  /** Relative published-at string ("12 d ago"). */
  publishedRel: string;
  /** Predecessor semver ("v2.4.6") when applicable. */
  supersedes?: string;
  breaking: string[];
  added: string[];
  improved: string[];
  /** URL to a migration / commit / PR. */
  migrationGuideUrl?: string;
}

/**
 * Row decoration computed from the row + metrics. Drives the inset bar,
 * the card top accent, the state chip, and the errors-cell tone.
 */
export interface PublishedRowDecoration {
  state: PublishedRowState;
  /** Optional state chip label, derived from the state ("top used" etc.). */
  chipLabel: string | null;
}
