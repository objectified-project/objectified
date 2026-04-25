'use client';

/**
 * Right-column cards on the Linked Accounts dashboard.
 *
 * Three small presentational components live in one file because they're
 * sibling cards that always render together and never need to be reused
 * elsewhere. Splitting into three modules would be churn for no win.
 */

import type { ComponentType } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Key,
  Lightbulb,
  LinkIcon as LinkIconLucide,
  Plus,
  PlusCircle,
  UserRound,
} from 'lucide-react';

export interface RightColumnAccount {
  id: string;
  provider: string;
  provider_email: string;
  provider_username: string | null;
  access_token_suffix?: string | null;
  created_at: string;
}

export interface RightColumnProvider {
  name: string;
  displayName: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  color: string;
  available: boolean;
  patSupported: boolean;
}

const cardClass =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden';
const cardHeaderClass =
  'px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center gap-3';

function getInitials(name: string | null | undefined, fallbackEmail: string | null | undefined) {
  const source = (name && name.trim()) || (fallbackEmail && fallbackEmail.trim()) || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

interface IdentityCardProps {
  displayName: string | null | undefined;
  primaryEmail: string | null | undefined;
  accounts: RightColumnAccount[];
  providers: Record<string, RightColumnProvider>;
  manageProfileHref?: string;
}

/**
 * Compact identity summary: avatar, primary email, then the list of
 * provider-side emails the user signs in with. Marked "primary" when a
 * linked email matches the session's primary email.
 *
 * No "verified" pill — we don't have a verified flag on the OAuth payload
 * today, so we surface the link date instead. Keeping the row honest.
 */
export function LinkedAccountsIdentityCard({
  displayName,
  primaryEmail,
  accounts,
  providers,
  manageProfileHref = '/ade/dashboard/profile',
}: IdentityCardProps) {
  const initials = getInitials(displayName, primaryEmail);
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <UserRound className="w-5 h-5 text-indigo-500" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Your identity
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            How you sign in across linked providers
          </p>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shrink-0"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {displayName || 'Signed-in user'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
              {primaryEmail || 'no primary email'}
              {primaryEmail ? ' · primary email' : ''}
            </p>
          </div>
        </div>

        {accounts.length > 0 && (
          <ul className="mt-4 space-y-2 text-xs">
            {accounts.map((account) => {
              const provider = providers[account.provider];
              const Icon = provider?.icon;
              const isPrimary =
                primaryEmail &&
                account.provider_email &&
                primaryEmail.toLowerCase() === account.provider_email.toLowerCase();
              return (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-2 text-gray-700 dark:text-gray-200"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {Icon ? (
                      <Icon size={14} className="shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 inline-block shrink-0" />
                    )}
                    <span className="truncate font-mono">{account.provider_email}</span>
                  </span>
                  <span className="font-mono text-[10px] text-gray-400 shrink-0">
                    {isPrimary ? 'primary' : `linked ${formatShortDate(account.created_at)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
          <a
            href={manageProfileHref}
            className="text-xs text-indigo-500 hover:underline inline-flex items-center gap-1"
          >
            Manage profile <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </section>
  );
}

function formatShortDate(iso: string) {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ProviderListProps {
  providers: RightColumnProvider[];
  linkedProviderNames: Set<string>;
  onLink: (providerName: string) => void;
  disabled?: boolean;
}

/**
 * Available providers list. One row per provider showing tile + name +
 * supported auth methods + a state badge or Link button. Mirrors the layout
 * used in the Repositories source-picker so the affordance is familiar.
 */
export function LinkedAccountsProviderList({
  providers,
  linkedProviderNames,
  onLink,
  disabled,
}: ProviderListProps) {
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <PlusCircle className="w-5 h-5 text-indigo-500" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Available providers
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Add another sign-in or repo source
          </p>
        </div>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
        {providers.map((provider) => {
          const Icon = provider.icon;
          const isLinked = linkedProviderNames.has(provider.name);
          const methodLabel = provider.patSupported ? 'OAuth · PAT' : 'OAuth';
          return (
            <li
              key={provider.name}
              className={`px-5 py-3 flex items-center gap-3 ${
                provider.available ? '' : 'opacity-60'
              }`}
            >
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-white"
                style={{ backgroundColor: provider.color }}
                aria-hidden="true"
              >
                <Icon size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {provider.displayName}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{methodLabel}</p>
              </div>
              {!provider.available ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  Coming soon
                </span>
              ) : isLinked ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Linked
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onLink(provider.name)}
                  disabled={disabled}
                  className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                  Link
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface TipsCardProps {
  /** Optional override for the scope reference link target. */
  scopeReferenceHref?: string;
}

/**
 * Static "why link more than one provider" tip + scope-reference link.
 * Copy intentionally short; the Linked accounts page is dense enough.
 */
export function LinkedAccountsTipsCard({ scopeReferenceHref }: TipsCardProps) {
  return (
    <section className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-lg border border-indigo-500/20 dark:border-indigo-700/30 p-5">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
        <div className="text-xs space-y-2">
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            Why link more than one provider?
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            OAuth covers sign-in. A{' '}
            <span className="inline-flex items-baseline gap-0.5 font-medium text-gray-700 dark:text-gray-200">
              <Key className="w-3 h-3 self-center" />
              PAT
            </span>{' '}
            lets us read private repos and react to webhook deliveries even when you&apos;re
            offline. We never store the full token — only the last six characters for display.
          </p>
          {scopeReferenceHref ? (
            <a
              href={scopeReferenceHref}
              className="text-indigo-500 hover:underline inline-flex items-center gap-1"
            >
              <LinkIconLucide className="w-3 h-3" />
              Scope reference <ArrowRight className="w-3 h-3" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
