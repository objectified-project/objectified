'use client';

import { useState, type ComponentType, type MouseEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranchPlus,
  Hourglass,
  Key,
  Link as LinkIcon,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

export type LinkedAccountRowHealth =
  | 'healthy'
  | 'scope_missing'
  | 'revoked'
  | 'network_error'
  | null;

/**
 * Row data the card needs. Deliberately a wider shape than the page's
 * `LinkedAccount` so the row stays decoupled from API field renames.
 */
export interface LinkedAccountRowAccount {
  id: string;
  provider: string;
  provider_email: string;
  provider_username: string | null;
  access_token_suffix?: string | null;
  token_expires_at?: string | null;
  created_at: string;
  last_login_at: string | null;
  repository_count: number;
  health_status: LinkedAccountRowHealth;
  health_checked_at: string | null;
}

export interface LinkedAccountRowProvider {
  name: string;
  displayName: string;
  /** Brand colour applied to the icon tile background. */
  color: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Whether this provider supports a Personal Access Token in addition to OAuth. */
  patSupported: boolean;
}

export interface LinkedAccountRowProps {
  account: LinkedAccountRowAccount;
  provider: LinkedAccountRowProvider;
  selected: boolean;
  onToggleSelect: () => void;
  onVerify: () => void;
  onUpdatePat: () => void;
  onReconnect: () => void;
  onUnlink: () => void;
  /** Drill-in target — usually the Repositories list filtered by this account. */
  reposHref: string;
  disabled?: boolean;
  formatDate: (iso: string) => string;
  /** Injectable for deterministic rendering in tests/storybook. When omitted
   *  the component captures `Date.now()` once per render via `useMemo`. */
  now?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ExpiryPresentation {
  /** Tailwind classes applied to the PAT badge background + text. */
  toneClass: string;
  /** Suffix appended to the PAT badge label (e.g. `· 12 d`). Omitted when no expiry data. */
  suffix: string | null;
  /** Sub-line under the row meta describing the PAT lifecycle. */
  detail: string | null;
  /** True when the token is within the urgent (≤14 d) window. */
  urgent: boolean;
}

function describePatExpiry(expiresAt: string | null | undefined, now: number): ExpiryPresentation {
  if (!expiresAt) {
    return {
      toneClass: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200',
      suffix: null,
      detail: null,
      urgent: false,
    };
  }
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) {
    return {
      toneClass: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200',
      suffix: null,
      detail: null,
      urgent: false,
    };
  }
  const days = Math.ceil((expiresMs - now) / DAY_MS);
  if (days <= 0) {
    return {
      toneClass: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
      suffix: 'expired',
      detail: 'PAT expired — rotate to resume scans',
      urgent: true,
    };
  }
  if (days <= 14) {
    return {
      toneClass: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
      suffix: `${days} d`,
      detail: `PAT expires in ${days} ${days === 1 ? 'day' : 'days'}`,
      urgent: true,
    };
  }
  if (days <= 45) {
    return {
      toneClass: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
      suffix: `${days} d`,
      detail: `PAT expires in ${days} days`,
      urgent: false,
    };
  }
  return {
    toneClass: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200',
    suffix: null,
    detail: `PAT valid for ${days} more days`,
    urgent: false,
  };
}

interface HealthPresentation {
  label: string;
  toneClass: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  needsReconnect: boolean;
}

function describeHealth(status: LinkedAccountRowHealth): HealthPresentation {
  switch (status) {
    case 'healthy':
      return {
        label: 'Healthy',
        toneClass:
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        Icon: CheckCircle2,
        needsReconnect: false,
      };
    case 'scope_missing':
      return {
        label: 'Scope missing',
        toneClass:
          'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        Icon: ShieldAlert,
        needsReconnect: true,
      };
    case 'revoked':
      return {
        label: 'Revoked',
        toneClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        Icon: AlertTriangle,
        needsReconnect: true,
      };
    case 'network_error':
      return {
        label: 'Network error',
        toneClass:
          'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        Icon: AlertTriangle,
        needsReconnect: true,
      };
    default:
      return {
        label: 'Pending verification',
        toneClass: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
        Icon: ShieldCheck,
        needsReconnect: false,
      };
  }
}

function formatRelativeAge(iso: string | null | undefined, now: number): string {
  if (!iso) return 'never';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 'unknown';
  const deltaMs = now - ts;
  if (deltaMs < 60 * 1000) return 'just now';
  if (deltaMs < 60 * 60 * 1000) return `${Math.floor(deltaMs / (60 * 1000))} m ago`;
  if (deltaMs < DAY_MS) return `${Math.floor(deltaMs / (60 * 60 * 1000))} h ago`;
  return `${Math.floor(deltaMs / DAY_MS)} d ago`;
}

const methodBadgeBaseClass =
  'inline-flex items-center gap-1 h-[1.125rem] px-1.5 rounded text-[10px] font-medium';

interface IconActionProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}

function IconAction({ title, onClick, disabled, tone = 'default', children }: IconActionProps) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';
  const handler = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!disabled) onClick();
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={handler}
      className={`p-1.5 rounded border border-gray-200 dark:border-gray-700 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${toneClass}`}
    >
      {children}
    </button>
  );
}

/**
 * One row in the Linked Accounts list. Layout (left → right):
 *   [checkbox] [provider tile] [name + method badges + status] [action rail]
 *
 * The middle column also stacks a meta line (email, linked, last sign-in,
 * last verified) and a 3-up grid (scopes, repos drill-in, token age).
 *
 * The component is presentational — all data mutation runs through the
 * supplied handlers. This makes it trivial to host inside other screens
 * (e.g. an Identity drawer) without duplicating render logic.
 */
export function LinkedAccountRow({
  account,
  provider,
  selected,
  onToggleSelect,
  onVerify,
  onUpdatePat,
  onReconnect,
  onUnlink,
  reposHref,
  disabled,
  formatDate,
  now: nowProp,
}: LinkedAccountRowProps) {
  // `Date.now()` is impure and can't appear in a default argument or
  // render body (React 19 purity rule). The lazy `useState` initializer
  // runs exactly once on mount, which is the canonical safe spot.
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? mountedAt;
  const Icon = provider.icon;
  const health = describeHealth(account.health_status);
  const expiry = describePatExpiry(account.token_expires_at, now);
  const hasPat = Boolean(account.access_token_suffix);
  const handle = account.provider_username || account.provider_email;

  // Background tints when the row is selected or carries an unhealthy state.
  // Selection wins over health so the user can see what's actively chosen.
  const rowToneClass = selected
    ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
    : health.needsReconnect
      ? 'bg-amber-50/30 dark:bg-amber-950/10'
      : '';

  const ageDays = (() => {
    const ts = Date.parse(account.created_at);
    if (!Number.isFinite(ts)) return null;
    return Math.max(0, Math.floor((now - ts) / DAY_MS));
  })();

  return (
    <li className={`px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-900/30 ${rowToneClass}`}>
      <div className="flex items-start gap-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={disabled}
          aria-label={`Select ${provider.displayName} ${handle}`}
          className="mt-3.5 h-4 w-4 rounded border-gray-300 text-indigo-600 shrink-0 cursor-pointer"
        />

        <div
          className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 text-white"
          style={{ backgroundColor: provider.color }}
          aria-hidden="true"
        >
          <Icon size={20} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{provider.displayName}</p>
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">@{handle}</span>

            <span
              className={`${methodBadgeBaseClass} bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200`}
              title="Signed in via OAuth"
            >
              <LinkIcon className="w-3 h-3" />
              <span>OAuth</span>
            </span>

            {hasPat && (
              <span
                className={`${methodBadgeBaseClass} font-mono ${expiry.toneClass}`}
                title={
                  expiry.suffix
                    ? `Personal Access Token ending in ${account.access_token_suffix} · ${expiry.suffix}`
                    : `Personal Access Token ending in ${account.access_token_suffix}`
                }
              >
                <Key className="w-3 h-3" />
                <span>
                  ••••{account.access_token_suffix}
                  {expiry.suffix ? ` · ${expiry.suffix}` : ''}
                </span>
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${health.toneClass}`}
            >
              <health.Icon className="w-3 h-3" />
              <span>{health.label}</span>
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">
            {account.provider_email}
            {' · linked '}
            {formatDate(account.created_at)}
            {' · last sign-in '}
            {account.last_login_at ? formatDate(account.last_login_at) : 'never'}
            {' · last verified '}
            {formatRelativeAge(account.health_checked_at, now)}
          </p>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Scopes</span>
              <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                {/* TODO(linked-accounts/phase5): persist + render granted scopes
                    from external_auth_providers.profile_data. Today the column
                    isn't captured at link-time, so the row is intentionally
                    honest about that gap. */}
                {account.health_status === 'scope_missing'
                  ? 'reconnect to inspect'
                  : 'recorded at next OAuth round-trip'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <GitBranchPlus className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Repos</span>
              {account.repository_count > 0 ? (
                <a
                  href={reposHref}
                  className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {account.repository_count} using this account →
                </a>
              ) : (
                <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                  none yet
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <Hourglass className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Token age</span>
              <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                {ageDays === null ? '—' : `${ageDays} d`}
                {expiry.detail ? ` · ${expiry.detail}` : ''}
              </span>
            </div>
          </div>

          {health.needsReconnect && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onReconnect}
                disabled={disabled}
                className="px-2.5 py-1 text-xs rounded-md bg-amber-500 hover:bg-amber-600 text-white inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LinkIcon className="w-3 h-3" />
                Reconnect with required scopes
              </button>
              {provider.patSupported && hasPat && (
                <button
                  type="button"
                  onClick={onUpdatePat}
                  disabled={disabled}
                  className="px-2.5 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Key className="w-3 h-3" />
                  Rotate PAT
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <IconAction title="Verify now" onClick={onVerify} disabled={disabled}>
            <RefreshCw className="w-3.5 h-3.5" />
          </IconAction>
          {provider.patSupported && (
            <IconAction
              title={hasPat ? 'Update PAT' : 'Add PAT'}
              onClick={onUpdatePat}
              disabled={disabled}
            >
              <Key className="w-3.5 h-3.5" />
            </IconAction>
          )}
          <IconAction title="Reconnect OAuth" onClick={onReconnect} disabled={disabled}>
            <LinkIcon className="w-3.5 h-3.5" />
          </IconAction>
          <IconAction title="Unlink" onClick={onUnlink} disabled={disabled} tone="danger">
            <Trash2 className="w-3.5 h-3.5" />
          </IconAction>
        </div>
      </div>
    </li>
  );
}
