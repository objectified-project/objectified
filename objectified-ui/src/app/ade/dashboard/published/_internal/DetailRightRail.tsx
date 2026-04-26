'use client';

import {
  QrCode,
  Image as ImageIcon,
  FileImage,
  Globe,
  Lock,
  GitBranch,
  ArrowDown,
  Bell,
  History,
  Rocket,
  UserPlus,
  TrendingUp,
  Download,
  KeyRound,
  AlertOctagon,
  CircleAlert,
  Snowflake,
} from 'lucide-react';
import {
  publishedQrFauxClass,
  publishedVisibilityPillClass,
  publishedLineageNodeClass,
  publishedLineageThisClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import type {
  PublishedVersionActivityEvent,
  PublishedVersionAlert,
  PublishedVersionLineage,
  PublishedVersionLineageNode,
  PublishedVersionRow,
} from './types';

export interface DetailRightRailProps {
  row: PublishedVersionRow;
  lineage: PublishedVersionLineage;
  alerts: PublishedVersionAlert[];
  activity: PublishedVersionActivityEvent[];
  /** Used by the QR card's caption — the spec URL the QR encodes. */
  specUrl: string;
  onToggleVisibility?: () => void;
  onDownloadQr?: (format: 'png' | 'svg') => void;
  /** Click → switch the tab strip to "activity". */
  onSeeAllActivity?: () => void;
  /** Click → drill into the project's versions screen (full version list). */
  onSeeAllVersions?: () => void;
  /** Click → drill into a sibling lineage node (parent/child). */
  onOpenLineageNode?: (node: PublishedVersionLineageNode) => void;
}

/**
 * Right rail on the per-version detail page. Five stacked cards in
 * priority order:
 *
 *   1. Quick share (QR + PNG/SVG download)
 *   2. Visibility (current pill + flip + audit recap)
 *   3. Lineage (parent / this / child stacked nodes)
 *   4. Alerts (lifecycle alerts, max 3)
 *   5. Recent activity (4 most recent events with circular tone-icons)
 *
 * The cards are independent — host page can hide any of them by passing
 * empty data (alerts/activity).
 */
export function DetailRightRail({
  row,
  lineage,
  alerts,
  activity,
  specUrl,
  onToggleVisibility,
  onDownloadQr,
  onSeeAllActivity,
  onSeeAllVersions,
  onOpenLineageNode,
}: DetailRightRailProps) {
  return (
    <>
      <QrCard onDownload={onDownloadQr} specUrl={specUrl} />
      <VisibilityCard row={row} activity={activity} onToggle={onToggleVisibility} />
      <LineageCard
        lineage={lineage}
        onOpenNode={onOpenLineageNode}
        onSeeAllVersions={onSeeAllVersions}
      />
      {alerts.length > 0 ? <AlertsCard alerts={alerts} /> : null}
      {activity.length > 0 ? (
        <RecentActivityCard activity={activity} onSeeAll={onSeeAllActivity} />
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* QR card                                                          */
/* ---------------------------------------------------------------- */

interface QrCardProps {
  specUrl: string;
  onDownload?: (format: 'png' | 'svg') => void;
}

function QrCard({ specUrl, onDownload }: QrCardProps) {
  return (
    <RailCard
      icon={<QrCode className="w-4 h-4 text-indigo-500" />}
      title="Quick share"
      rightSlot={<span className="text-[10px] font-mono text-gray-400">opens spec</span>}
    >
      <div className="flex items-start gap-3">
        <div className="w-28 h-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center shrink-0">
          <div className={`w-24 h-24 ${publishedQrFauxClass}`} aria-hidden="true" title={specUrl} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
            Scan to open the OpenAPI spec on a phone, or download the QR for docs.
          </p>
          <code
            className="block text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate"
            title={specUrl}
          >
            {specUrl}
          </code>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onDownload?.('png')}
              disabled={!onDownload}
              className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-[11px] inline-flex items-center gap-1 transition-colors disabled:opacity-60"
            >
              <ImageIcon className="w-3 h-3" /> PNG
            </button>
            <button
              type="button"
              onClick={() => onDownload?.('svg')}
              disabled={!onDownload}
              className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-[11px] inline-flex items-center gap-1 transition-colors disabled:opacity-60"
            >
              <FileImage className="w-3 h-3" /> SVG
            </button>
          </div>
        </div>
      </div>
    </RailCard>
  );
}

/* ---------------------------------------------------------------- */
/* Visibility card                                                  */
/* ---------------------------------------------------------------- */

interface VisibilityCardProps {
  row: PublishedVersionRow;
  activity: PublishedVersionActivityEvent[];
  onToggle?: () => void;
}

function VisibilityCard({ row, activity, onToggle }: VisibilityCardProps) {
  const isPublic = row.visibility === 'public';
  const next = isPublic ? 'private' : 'public';
  const auditEvents = activity
    .filter((e) => e.kind === 'visibility-change' || e.kind === 'publish' || e.kind === 'lineage-update')
    .slice(0, 3);

  return (
    <RailCard
      icon={<Globe className="w-4 h-4 text-emerald-500" />}
      title="Visibility"
      rightSlot={<span className={publishedVisibilityPillClass[row.visibility]}>
        {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
        {isPublic ? 'Public' : 'Private'}
      </span>}
    >
      <p className="text-[12px] text-gray-600 dark:text-gray-400">
        {isPublic
          ? 'Consumers can fetch the spec without an API key. Listed in the public catalog.'
          : 'Spec access requires an enabled API key on this tenant. Hidden from the public catalog.'}
      </p>
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-3 w-full h-8 rounded-md border border-slate-300 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          {isPublic ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
          Switch to {next}
        </button>
      ) : null}
      {auditEvents.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 space-y-1.5 text-[11px] font-mono text-gray-500 dark:text-gray-400">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Audit</p>
          {auditEvents.map((event) => (
            <p key={event.id}>· <AuditEventLine event={event} /></p>
          ))}
        </div>
      ) : null}
    </RailCard>
  );
}

function AuditEventLine({ event }: { event: PublishedVersionActivityEvent }) {
  const author = event.meta.split('·')[0]?.trim();
  if (event.kind === 'visibility-change') {
    const setPublic = event.title.toLowerCase().includes('public');
    return (
      <>
        made{' '}
        <span className={setPublic ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-300'}>
          {setPublic ? 'public' : 'private'}
        </span>{' '}
        {event.when}
        {author ? <> by {author}</> : null}
      </>
    );
  }
  if (event.kind === 'publish') {
    return (
      <>
        published {event.when}
        {author ? <> by {author}</> : null}
      </>
    );
  }
  return (
    <>
      {event.title.toLowerCase()} {event.when}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Lineage card                                                     */
/* ---------------------------------------------------------------- */

interface LineageCardProps {
  lineage: PublishedVersionLineage;
  onOpenNode?: (node: PublishedVersionLineageNode) => void;
  onSeeAllVersions?: () => void;
}

function LineageCard({ lineage, onOpenNode, onSeeAllVersions }: LineageCardProps) {
  return (
    <RailCard
      icon={<GitBranch className="w-4 h-4 text-indigo-500" />}
      title="Lineage"
      rightSlot={
        onSeeAllVersions ? (
          <button
            type="button"
            onClick={onSeeAllVersions}
            className="text-[10px] font-mono text-indigo-500 hover:underline"
          >
            All versions →
          </button>
        ) : null
      }
    >
      <div className="space-y-2.5">
        {lineage.parent ? (
          <LineageNodeRow node={lineage.parent} relation="parent" onOpen={onOpenNode} />
        ) : (
          <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 px-3 py-2 text-center">
            no parent — this is the first published version
          </p>
        )}
        {lineage.parent ? <LineageArrow /> : null}
        <LineageNodeRow node={lineage.self} relation="this" />
        {lineage.child ? <LineageArrow /> : null}
        {lineage.child ? (
          <LineageNodeRow node={lineage.child} relation="child" onOpen={onOpenNode} />
        ) : (
          <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 px-3 py-2 text-center">
            no successor in flight
          </p>
        )}
      </div>
    </RailCard>
  );
}

function LineageArrow() {
  return (
    <div className="flex justify-center text-gray-300 dark:text-gray-600" aria-hidden="true">
      <ArrowDown className="w-3.5 h-3.5" />
    </div>
  );
}

interface LineageNodeRowProps {
  node: PublishedVersionLineageNode;
  relation: 'parent' | 'this' | 'child';
  onOpen?: (node: PublishedVersionLineageNode) => void;
}

const RELATION_CHIP: Record<LineageNodeRowProps['relation'], string> = {
  parent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  this: 'bg-indigo-600 text-white',
  child: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const STATE_TONE: Record<PublishedVersionLineageNode['state'], string> = {
  published: 'text-emerald-600 dark:text-emerald-400',
  deprecated: 'text-gray-400 dark:text-gray-500',
  rc: 'text-sky-600 dark:text-sky-400',
  draft: 'text-sky-600 dark:text-sky-400',
};

function LineageNodeRow({ node, relation, onOpen }: LineageNodeRowProps) {
  const isThis = relation === 'this';
  const className = isThis ? publishedLineageThisClass : publishedLineageNodeClass;
  const Inner = (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-1 py-0.5 rounded ${RELATION_CHIP[relation]}`}
        >
          {relation}
        </span>
        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
          {node.versionId}
        </span>
        <span className={`ml-auto text-[10px] font-mono ${STATE_TONE[node.state]}`}>
          {node.state} · {ageLabel(node.ageDays)}
        </span>
      </div>
      {node.meta ? (
        <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">{node.meta}</p>
      ) : null}
    </>
  );

  if (isThis || !onOpen) {
    return <div className={className}>{Inner}</div>;
  }
  return (
    <button type="button" onClick={() => onOpen(node)} className={`${className} text-left w-full`}>
      {Inner}
    </button>
  );
}

function ageLabel(days: number): string {
  if (days < 1) return 'today';
  if (days === 1) return '1 d';
  if (days < 30) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${Math.round(days / 365)} y`;
}

/* ---------------------------------------------------------------- */
/* Alerts card                                                      */
/* ---------------------------------------------------------------- */

interface AlertsCardProps {
  alerts: PublishedVersionAlert[];
}

const ALERT_SHELL: Record<PublishedVersionAlert['tone'], string> = {
  warning: 'border-amber-200 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-900/15',
  critical: 'border-rose-200 dark:border-rose-700/40 bg-rose-50/60 dark:bg-rose-900/15',
  info: 'border-sky-200 dark:border-sky-700/40 bg-sky-50/60 dark:bg-sky-900/15',
};

const ALERT_TITLE_CLASS: Record<PublishedVersionAlert['tone'], string> = {
  warning: 'text-amber-800 dark:text-amber-200',
  critical: 'text-rose-800 dark:text-rose-200',
  info: 'text-sky-800 dark:text-sky-200',
};

const ALERT_BODY_CLASS: Record<PublishedVersionAlert['tone'], string> = {
  warning: 'text-amber-700/80 dark:text-amber-200/70',
  critical: 'text-rose-700/80 dark:text-rose-200/70',
  info: 'text-sky-700/80 dark:text-sky-200/70',
};

function alertIcon(alert: PublishedVersionAlert) {
  if (alert.title.toLowerCase().includes('error')) {
    return <TrendingUp className="w-3.5 h-3.5" />;
  }
  if (alert.title.toLowerCase().includes('key')) {
    return <KeyRound className="w-3.5 h-3.5" />;
  }
  if (alert.title.toLowerCase().includes('stale') || alert.title.toLowerCase().includes('catalog')) {
    return <Snowflake className="w-3.5 h-3.5" />;
  }
  return alert.tone === 'critical' ? (
    <AlertOctagon className="w-3.5 h-3.5" />
  ) : (
    <CircleAlert className="w-3.5 h-3.5" />
  );
}

function AlertsCard({ alerts }: AlertsCardProps) {
  return (
    <RailCard
      icon={<Bell className="w-4 h-4 text-amber-500" />}
      title="Alerts"
      rightSlot={
        <span className="text-[10px] font-mono text-gray-400">
          {alerts.length} active
        </span>
      }
    >
      <div className="space-y-2">
        {alerts.slice(0, 3).map((alert) => (
          <div
            key={alert.id}
            className={`rounded-md border ${ALERT_SHELL[alert.tone]} px-3 py-2`}
          >
            <p className={`text-[12px] font-semibold ${ALERT_TITLE_CLASS[alert.tone]} inline-flex items-center gap-1.5`}>
              {alertIcon(alert)} {alert.title}
            </p>
            <p className={`text-[11px] font-mono ${ALERT_BODY_CLASS[alert.tone]} mt-0.5`}>
              {alert.body}
            </p>
          </div>
        ))}
      </div>
    </RailCard>
  );
}

/* ---------------------------------------------------------------- */
/* Recent activity card                                              */
/* ---------------------------------------------------------------- */

interface RecentActivityCardProps {
  activity: PublishedVersionActivityEvent[];
  onSeeAll?: () => void;
}

const EVENT_BADGE: Record<PublishedVersionActivityEvent['kind'], string> = {
  publish: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  'visibility-change': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  'consumers-added': 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  'error-alert': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  'spec-download': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  'lineage-update': 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
};

function eventIcon(kind: PublishedVersionActivityEvent['kind']) {
  switch (kind) {
    case 'publish':
      return <Rocket className="w-3.5 h-3.5" />;
    case 'visibility-change':
      return <Globe className="w-3.5 h-3.5" />;
    case 'consumers-added':
      return <UserPlus className="w-3.5 h-3.5" />;
    case 'error-alert':
      return <TrendingUp className="w-3.5 h-3.5" />;
    case 'spec-download':
      return <Download className="w-3.5 h-3.5" />;
    case 'lineage-update':
      return <GitBranch className="w-3.5 h-3.5" />;
  }
}

function RecentActivityCard({ activity, onSeeAll }: RecentActivityCardProps) {
  return (
    <RailCard
      icon={<History className="w-4 h-4 text-indigo-500" />}
      title="Recent activity"
      rightSlot={
        onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[10px] font-mono text-indigo-500 hover:underline"
          >
            All →
          </button>
        ) : null
      }
    >
      <ul className="space-y-2.5">
        {activity.slice(0, 4).map((event) => (
          <li key={event.id} className="flex items-start gap-2.5 text-[12px]">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${EVENT_BADGE[event.kind]}`}
            >
              {eventIcon(event.kind)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-gray-900 dark:text-gray-100 truncate">{event.title}</p>
              <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{event.when}</p>
            </div>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

/* ---------------------------------------------------------------- */
/* Shared rail card chrome                                          */
/* ---------------------------------------------------------------- */

interface RailCardProps {
  icon: React.ReactNode;
  title: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

function RailCard({ icon, title, rightSlot, children }: RailCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h3>
        </div>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

export { RailCard };
