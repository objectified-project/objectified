'use client';

import { useState, type ComponentType } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Hourglass,
  Link2,
  LogIn,
  ShieldAlert,
} from 'lucide-react';
import type {
  LinkedAccountActivityEvent,
  LinkedAccountActivityKind,
} from './linkedAccountActivity';

interface KindPresentation {
  Icon: ComponentType<{ className?: string }>;
  /** Tailwind classes for the circular badge background. */
  badgeClass: string;
  /** Tailwind classes for the icon stroke. */
  iconClass: string;
  /** Verb prefix used in the event copy. */
  verb: string;
}

const KIND_PRESENTATION: Record<LinkedAccountActivityKind, KindPresentation> = {
  linked: {
    Icon: Link2,
    badgeClass: 'bg-indigo-100 dark:bg-indigo-900/40',
    iconClass: 'text-indigo-600 dark:text-indigo-300',
    verb: 'Linked',
  },
  sign_in: {
    Icon: LogIn,
    badgeClass: 'bg-sky-100 dark:bg-sky-900/40',
    iconClass: 'text-sky-600 dark:text-sky-300',
    verb: 'Signed in to',
  },
  verified_healthy: {
    Icon: CheckCircle2,
    badgeClass: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconClass: 'text-emerald-600 dark:text-emerald-300',
    verb: 'Verified',
  },
  verified_failed: {
    Icon: AlertTriangle,
    badgeClass: 'bg-amber-100 dark:bg-amber-900/40',
    iconClass: 'text-amber-600 dark:text-amber-300',
    verb: 'Verification failed for',
  },
  pending_verification: {
    Icon: ShieldAlert,
    badgeClass: 'bg-slate-100 dark:bg-slate-700/40',
    iconClass: 'text-slate-500 dark:text-slate-300',
    verb: 'Awaiting first probe of',
  },
};

const cardClass =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden';
const cardHeaderClass =
  'px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center gap-3';

interface Props {
  events: LinkedAccountActivityEvent[];
  /** Optional override; lazy `useState` initializer pins it at mount. */
  now?: number;
}

export function LinkedAccountActivityTimeline({ events, now: nowProp }: Props) {
  // Same purity escape as `LinkedAccountRow`: lazy `useState` initializer
  // is the canonical safe spot to read `Date.now()`.
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? mountedAt;

  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <History className="w-5 h-5 text-indigo-500" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Recent activity
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Linking, sign-in, and verification events on your linked accounts
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          <Hourglass className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          No recent events yet — link a provider above to start the timeline.
        </div>
      ) : (
        <ol className="divide-y divide-gray-100 dark:divide-gray-700/60 text-sm">
          {events.map((event) => {
            const presentation = KIND_PRESENTATION[event.kind];
            return (
              <li key={event.id} className="px-5 py-3 flex items-center gap-4">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${presentation.badgeClass}`}
                  aria-hidden="true"
                >
                  <presentation.Icon className={`w-3.5 h-3.5 ${presentation.iconClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 dark:text-gray-200">
                    {presentation.verb}{' '}
                    <span className="font-mono">
                      {event.provider} @{event.provider_handle}
                    </span>
                    {event.detail ? (
                      <>
                        {' — '}
                        <span className={presentation.iconClass}>{event.detail}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 shrink-0">
                  {formatRelative(event.occurred_at, now)}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {/* Honest disclosure: rotation + unlink history isn't tracked yet. */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/40 dark:bg-gray-900/30">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Showing the most recent {events.length || '5'} events derived from current
          account state. Token rotation and unlink history will appear once the audit
          log is available.
        </p>
      </div>
    </section>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatRelative(iso: string, now: number): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 'unknown';
  const delta = now - ts;
  if (delta < 60 * 1000) return 'just now';
  if (delta < 60 * 60 * 1000) return `${Math.floor(delta / (60 * 1000))} m ago`;
  if (delta < DAY_MS) return `${Math.floor(delta / (60 * 60 * 1000))} h ago`;
  return `${Math.floor(delta / DAY_MS)} d ago`;
}
