'use client';

import {
  History,
  Rocket,
  Globe,
  UserPlus,
  TrendingUp,
  Download,
  GitBranch,
} from 'lucide-react';
import type { PublishedVersionActivityEvent } from './types';

export interface ActivityTabProps {
  activity: PublishedVersionActivityEvent[];
}

/**
 * Activity tab body. A vertical timeline scoped to one version. Each
 * event renders as:
 *
 *   ● Title             ← tone-colored dot anchored on the left rule
 *     meta line · when
 *
 * Empty state shows when the host page passes an empty array (newly
 * published versions with no audit events yet, for example).
 */
export function ActivityTab({ activity }: ActivityTabProps) {
  if (activity.length === 0) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center mb-3">
          <History className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No activity yet</p>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          Publication events, visibility changes, alert triggers, and consumer milestones
          will appear here as they happen.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <History className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity</h2>
        <span className="font-mono text-[11px] text-gray-400">
          full audit trail · scoped to this version
        </span>
      </header>
      <div className="p-4">
        <ol className="relative ml-3 space-y-4 border-l-2 border-gray-200 dark:border-gray-700">
          {activity.map((event) => (
            <TimelineItem key={event.id} event={event} />
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Timeline item                                                    */
/* ---------------------------------------------------------------- */

const DOT_TONE: Record<PublishedVersionActivityEvent['kind'], { ring: string; bg: string; icon: string }> = {
  publish: {
    ring: 'border-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: 'text-emerald-600 dark:text-emerald-300',
  },
  'visibility-change': {
    ring: 'border-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: 'text-emerald-600 dark:text-emerald-300',
  },
  'consumers-added': {
    ring: 'border-purple-500',
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    icon: 'text-purple-600 dark:text-purple-300',
  },
  'error-alert': {
    ring: 'border-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    icon: 'text-amber-600 dark:text-amber-300',
  },
  'spec-download': {
    ring: 'border-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    icon: 'text-blue-600 dark:text-blue-300',
  },
  'lineage-update': {
    ring: 'border-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-700',
    icon: 'text-gray-500 dark:text-gray-400',
  },
};

function eventIcon(kind: PublishedVersionActivityEvent['kind']) {
  switch (kind) {
    case 'publish':
      return <Rocket className="w-2.5 h-2.5" />;
    case 'visibility-change':
      return <Globe className="w-2.5 h-2.5" />;
    case 'consumers-added':
      return <UserPlus className="w-2.5 h-2.5" />;
    case 'error-alert':
      return <TrendingUp className="w-2.5 h-2.5" />;
    case 'spec-download':
      return <Download className="w-2.5 h-2.5" />;
    case 'lineage-update':
      return <GitBranch className="w-2.5 h-2.5" />;
  }
}

function TimelineItem({ event }: { event: PublishedVersionActivityEvent }) {
  const tone = DOT_TONE[event.kind];
  return (
    <li className="ml-4 relative">
      <span
        className={`absolute -left-[25px] top-1 w-4 h-4 rounded-full ${tone.bg} border-2 ${tone.ring} flex items-center justify-center`}
        aria-hidden="true"
      >
        <span className={tone.icon}>{eventIcon(event.kind)}</span>
      </span>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{event.title}</p>
      <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
        {event.when}
        {event.meta ? <> · {renderMetaWithCode(event.meta)}</> : null}
      </p>
    </li>
  );
}

/**
 * Renders the meta line, recognising backtick-delimited inline code
 * (e.g. `partner-stripe-prod`) so version IDs / key names render as
 * `<code>` spans.
 */
function renderMetaWithCode(meta: string) {
  const segments = meta.split(/(`[^`]+`)/g);
  return segments.map((segment, idx) => {
    if (segment.startsWith('`') && segment.endsWith('`')) {
      return (
        <code key={idx} className="font-mono text-gray-700 dark:text-gray-200">
          {segment.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{segment}</span>;
  });
}
