/**
 * Activity event derivation for the Linked Accounts dashboard.
 *
 * We don't have a dedicated audit log table for linked accounts yet, so the
 * timeline is derived from the columns we already store on each linked
 * account: `created_at`, `last_login_at`, `health_checked_at`, and the
 * `health_status` outcome of the last probe. Rotation and unlink history
 * require a real audit table — see TODO(linked-accounts/phase5).
 *
 * Pure function so it's trivial to test and to reuse from server code.
 */

export type LinkedAccountActivityHealth =
  | 'healthy'
  | 'scope_missing'
  | 'revoked'
  | 'network_error'
  | null;

/**
 * Row shape needed to derive activity. A deliberate superset of
 * `LinkedAccountKpiRow` — the KPI module doesn't need user-identifying
 * fields, but the activity timeline does.
 */
export interface LinkedAccountActivityRow {
  id: string;
  provider: string;
  provider_email: string;
  provider_username: string | null;
  created_at: string;
  last_login_at: string | null;
  health_status: LinkedAccountActivityHealth;
  health_checked_at?: string | null;
}

export type LinkedAccountActivityKind =
  | 'linked'
  | 'sign_in'
  | 'verified_healthy'
  | 'verified_failed'
  | 'pending_verification';

export interface LinkedAccountActivityEvent {
  /** Stable id, suitable as a React key. */
  id: string;
  kind: LinkedAccountActivityKind;
  occurred_at: string;
  account_id: string;
  provider: string;
  /** Username when set, falling back to email. Always present when sourced. */
  provider_handle: string;
  /** Short human-readable detail, ready to render. */
  detail: string;
}

function handleFor(account: LinkedAccountActivityRow): string {
  return account.provider_username || account.provider_email || account.provider;
}

function detailForHealth(status: LinkedAccountActivityHealth): string {
  switch (status) {
    case 'healthy':
      return 'Token healthy';
    case 'scope_missing':
      return 'Required scope missing';
    case 'revoked':
      return 'Token revoked at provider';
    case 'network_error':
      return 'Provider unreachable';
    default:
      return 'Awaiting first probe';
  }
}

function healthKind(status: LinkedAccountActivityHealth): LinkedAccountActivityKind {
  if (status === 'healthy') return 'verified_healthy';
  if (status === null) return 'pending_verification';
  return 'verified_failed';
}

export interface DeriveActivityOptions {
  /** Cap on returned events. Default 5 to match the dashboard slot. */
  limit?: number;
  /** Override "now" for deterministic tests. */
  now?: number;
}

export function deriveLinkedAccountActivity(
  accounts: LinkedAccountActivityRow[],
  options: DeriveActivityOptions = {},
): LinkedAccountActivityEvent[] {
  const { limit = 5, now = Date.now() } = options;

  const events: LinkedAccountActivityEvent[] = [];

  for (const account of accounts) {
    const handle = handleFor(account);

    if (account.created_at) {
      events.push({
        id: `${account.id}:linked`,
        kind: 'linked',
        occurred_at: account.created_at,
        account_id: account.id,
        provider: account.provider,
        provider_handle: handle,
        detail: 'Linked via OAuth handshake',
      });
    }

    if (account.last_login_at) {
      events.push({
        id: `${account.id}:signin`,
        kind: 'sign_in',
        occurred_at: account.last_login_at,
        account_id: account.id,
        provider: account.provider,
        provider_handle: handle,
        detail: 'Signed in',
      });
    }

    if (account.health_checked_at) {
      events.push({
        id: `${account.id}:health`,
        kind: healthKind(account.health_status),
        occurred_at: account.health_checked_at,
        account_id: account.id,
        provider: account.provider,
        provider_handle: handle,
        detail: detailForHealth(account.health_status),
      });
    }
  }

  return events
    .filter((event) => {
      const ts = Date.parse(event.occurred_at);
      // Drop garbage timestamps and anything from the future to avoid the
      // timeline lying about an event that hasn't happened yet.
      return Number.isFinite(ts) && ts <= now;
    })
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, limit);
}
