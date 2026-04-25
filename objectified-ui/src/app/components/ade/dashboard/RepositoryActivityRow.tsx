'use client';

import type { ReactNode } from 'react';
import { repositoryActivityRowClass } from './dashboardScreenClasses';

export type RepositoryActivityTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const TONE_DOT_CLASS: Record<RepositoryActivityTone, string> = {
  neutral: 'bg-gray-300 dark:bg-gray-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-indigo-500',
};

export interface RepositoryActivityRowProps {
  /** Optional icon shown in the leading slot. Falls back to a tone-coloured dot. */
  icon?: ReactNode;
  tone?: RepositoryActivityTone;
  /** Primary line — usually the actor + verb. */
  title: ReactNode;
  /** Optional secondary line of supporting detail. */
  meta?: ReactNode;
  /** Optional right-side timestamp / badge. */
  timestamp?: ReactNode;
  className?: string;
}

/**
 * Single row in the recent-activity / sync-history feeds. Aligns a leading
 * icon (or tone dot), a title + meta block, and an optional trailing
 * timestamp. Used both inside the dashboard activity panel and in the detail
 * page sync-history list.
 */
export function RepositoryActivityRow({
  icon,
  tone = 'neutral',
  title,
  meta,
  timestamp,
  className,
}: RepositoryActivityRowProps) {
  return (
    <div className={`${repositoryActivityRowClass}${className ? ` ${className}` : ''}`}>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
        {icon ?? <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT_CLASS[tone]}`} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{title}</div>
        {meta ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta}</div>
        ) : null}
      </div>
      {timestamp ? (
        <span className="shrink-0 font-mono text-[11px] text-gray-500 dark:text-gray-400">
          {timestamp}
        </span>
      ) : null}
    </div>
  );
}
