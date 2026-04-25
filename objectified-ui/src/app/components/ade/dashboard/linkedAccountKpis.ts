/**
 * Pure derivation of the KPI strip shown on the Linked Accounts dashboard.
 * Kept side-effect free and `now`-injectable so the formula can be exercised
 * from tests without mocking the wall clock.
 *
 * Mirrors the shape of `repositoryKpis.tsx` so both dashboards present and
 * consume KPI data the same way through `RepositoryKpiCard`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type LinkedAccountHealth =
  | 'healthy'
  | 'scope_missing'
  | 'revoked'
  | 'network_error'
  | null;

export interface LinkedAccountKpiRow {
  provider: string;
  created_at: string;
  /** Absent for OAuth providers that don't expose an expiry. */
  token_expires_at?: string | null;
  /** Last 4–6 chars of a stored PAT, or null when no PAT is set. */
  access_token_suffix?: string | null;
  repository_count: number;
  health_status: LinkedAccountHealth;
  health_checked_at?: string | null;
}

export interface LinkedAccountKpis {
  /** Number of currently linked providers (one per row). */
  linked: number;
  /** Catalog size we surface in the UI ("3 of 5"). Exposed so the page can
   *  render the denominator without re-importing the provider config. */
  available: number;
  healthy: number;
  /** Anything not healthy and not pending: scope_missing, revoked, network_error. */
  needsAttention: number;
  /** Sum of repos credentialed across all linked accounts. */
  reposCredentialed: number;
  /** Average days since each account's `created_at`, rounded. `null` when no rows. */
  avgTokenAgeDays: number | null;
  /** Days until the soonest token expiry, or `null` when no account has one. */
  nextExpiryDays: number | null;
  /** Row whose token expires first, surfaced for the KPI subtitle. */
  nextExpiryRow: LinkedAccountKpiRow | null;
  /** How many of the linked accounts have a stored PAT. */
  patCount: number;
  /** How many of the linked accounts are OAuth-only (no PAT stored). */
  oauthOnlyCount: number;
}

export function deriveLinkedAccountKpis<R extends LinkedAccountKpiRow>(
  accounts: R[],
  availableProviderCount: number,
  now: number = Date.now(),
): LinkedAccountKpis {
  const linked = accounts.length;
  const healthy = accounts.filter((a) => a.health_status === 'healthy').length;
  const needsAttention = accounts.filter(
    (a) =>
      a.health_status === 'scope_missing' ||
      a.health_status === 'revoked' ||
      a.health_status === 'network_error',
  ).length;
  const reposCredentialed = accounts.reduce(
    (sum, a) => sum + (Number.isFinite(a.repository_count) ? a.repository_count : 0),
    0,
  );

  const ageSamples = accounts
    .map((a) => Date.parse(a.created_at))
    .filter((ts) => Number.isFinite(ts))
    .map((ts) => Math.max(0, Math.floor((now - ts) / DAY_MS)));
  const avgTokenAgeDays =
    ageSamples.length === 0
      ? null
      : Math.round(ageSamples.reduce((sum, n) => sum + n, 0) / ageSamples.length);

  let nextExpiryRow: R | null = null;
  let nextExpiryMs: number | null = null;
  for (const account of accounts) {
    if (!account.token_expires_at) continue;
    const ts = Date.parse(account.token_expires_at);
    if (!Number.isFinite(ts)) continue;
    if (nextExpiryMs === null || ts < nextExpiryMs) {
      nextExpiryMs = ts;
      nextExpiryRow = account;
    }
  }
  const nextExpiryDays =
    nextExpiryMs === null ? null : Math.max(0, Math.ceil((nextExpiryMs - now) / DAY_MS));

  const patCount = accounts.filter((a) => Boolean(a.access_token_suffix)).length;

  return {
    linked,
    available: availableProviderCount,
    healthy,
    needsAttention,
    reposCredentialed,
    avgTokenAgeDays,
    nextExpiryDays,
    nextExpiryRow,
    patCount,
    oauthOnlyCount: linked - patCount,
  };
}
