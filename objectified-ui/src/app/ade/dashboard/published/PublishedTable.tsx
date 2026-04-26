'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Lock,
  Globe,
  Copy,
  ExternalLink,
  QrCode,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  KeyRound,
  Terminal,
  FileText,
  GitMerge,
  Braces,
  EyeOff,
} from 'lucide-react';
import {
  dashboardPanelClass,
  dashboardTableTheadClass,
  dashboardThClass,
  dashboardThRightClass,
  publishedRowStateInsetClass,
  publishedRowStateChipClass,
  publishedThSortableClass,
  publishedThActiveClass,
  publishedVisibilityPillClass,
  publishedErrorTier,
  publishedErrorTierClass,
  projectAvatarGradientClasses,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/Tooltip';
import { Sparkline } from './_internal/Sparkline';
import { formatRequestsShort, formatWoW, relativeAgo } from './_internal/fixtures';
import type {
  PublishedRowDecoration,
  PublishedVersionMetrics,
  PublishedVersionRow,
} from './_internal/types';

export type ViewKind = 'open' | 'arazzo' | 'json' | 'swagger';
export type SortColumn = 'version' | 'visibility' | 'requests' | 'p50' | 'errors' | 'consumers' | 'activity';
export type SortDirection = 'asc' | 'desc';

export interface PublishedTableProps {
  versions: PublishedVersionRow[];
  metricsById: Map<string, PublishedVersionMetrics>;
  decorationsById: Map<string, PublishedRowDecoration>;
  selectedIds: Set<string>;
  onSelectedChange: (ids: Set<string>) => void;
  onOpenDetail: (row: PublishedVersionRow) => void;
  onCopyUrl: (row: PublishedVersionRow) => void;
  onOpenView: (row: PublishedVersionRow, kind: ViewKind) => void;
  onToggleVisibility: (row: PublishedVersionRow) => void;
  onShowQr?: (row: PublishedVersionRow) => void;
  onCopyCurl?: (row: PublishedVersionRow) => void;
  onUnpublish?: (row: PublishedVersionRow) => void;
  /** Mono path shown in the Access URL cell (without protocol/host). */
  pathFor: (row: PublishedVersionRow) => string;
  /** Selector for the page-size dropdown. */
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

/**
 * Dense, sortable table with row-state inset bars, inline URL actions,
 * a click-toggle visibility pill, an activity sparkline cell, and a
 * `⋯` per-row action menu. Selection state is owned by the parent so
 * a bulk-action toolbar can render above the panel when rows are
 * selected.
 *
 * The first column is a click-target (project name + semver pill)
 * that drills into the per-version detail page; everything else
 * stays inside the table.
 */
export function PublishedTable({
  versions,
  metricsById,
  decorationsById,
  selectedIds,
  onSelectedChange,
  onOpenDetail,
  onCopyUrl,
  onOpenView,
  onToggleVisibility,
  onShowQr,
  onCopyCurl,
  onUnpublish,
  pathFor,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: PublishedTableProps) {
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDirection }>({
    column: 'requests',
    dir: 'desc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[1] ?? 25);

  const sorted = useMemo(() => sortVersions(versions, metricsById, sort), [versions, metricsById, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const sliceStart = (safePage - 1) * pageSize;
  const slice = sorted.slice(sliceStart, sliceStart + pageSize);

  const visibleIds = slice.map((v) => v.id);
  const allOnPageSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = visibleIds.some((id) => selectedIds.has(id));

  const togglePageSelection = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) {
      visibleIds.forEach((id) => next.delete(id));
    } else {
      visibleIds.forEach((id) => next.add(id));
    }
    onSelectedChange(next);
  };

  const toggleRowSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const onHeaderClick = (column: SortColumn) => {
    setSort((prev) => {
      if (prev.column !== column) return { column, dir: defaultDirFor(column) };
      return { column, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  return (
    <div className={`${dashboardPanelClass} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className={dashboardTableTheadClass}>
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  aria-label={allOnPageSelected ? 'Deselect all on page' : 'Select all on page'}
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                  }}
                  onChange={togglePageSelection}
                />
              </th>
              <SortableTh label="Version" column="version" sort={sort} onClick={onHeaderClick} />
              <SortableTh label="Visibility" column="visibility" sort={sort} onClick={onHeaderClick} />
              <th className={dashboardThClass}>Access URL</th>
              <SortableTh label="Req · 24h" column="requests" sort={sort} onClick={onHeaderClick} align="right" />
              <SortableTh label="p50" column="p50" sort={sort} onClick={onHeaderClick} align="right" />
              <SortableTh label="Errors" column="errors" sort={sort} onClick={onHeaderClick} align="right" />
              <SortableTh label="Cons." column="consumers" sort={sort} onClick={onHeaderClick} align="right" />
              <SortableTh label="Activity" column="activity" sort={sort} onClick={onHeaderClick} />
              <th className={`${dashboardThRightClass} w-16`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {slice.map((row) => (
              <PublishedRow
                key={row.id}
                row={row}
                metrics={metricsById.get(row.id)}
                decoration={decorationsById.get(row.id)}
                selected={selectedIds.has(row.id)}
                onToggleSelected={() => toggleRowSelection(row.id)}
                onOpenDetail={() => onOpenDetail(row)}
                onCopyUrl={() => onCopyUrl(row)}
                onOpenView={(kind) => onOpenView(row, kind)}
                onToggleVisibility={() => onToggleVisibility(row)}
                onShowQr={onShowQr ? () => onShowQr(row) : undefined}
                onCopyCurl={onCopyCurl ? () => onCopyCurl(row) : undefined}
                onUnpublish={onUnpublish ? () => onUnpublish(row) : undefined}
                pathFor={pathFor}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 text-[11px] font-mono text-gray-500 dark:text-gray-400 flex-wrap">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 text-[11px]"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="ml-2">
            {sorted.length === 0 ? 0 : sliceStart + 1}–{Math.min(sliceStart + pageSize, sorted.length)} of {sorted.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
            className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center"
          >
            Prev
          </button>
          <span className="px-2">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

interface SortableThProps {
  label: string;
  column: SortColumn;
  sort: { column: SortColumn; dir: SortDirection };
  onClick: (column: SortColumn) => void;
  align?: 'left' | 'right';
}

function SortableTh({ label, column, sort, onClick, align = 'left' }: SortableThProps) {
  const isActive = sort.column === column;
  const baseClass = align === 'right' ? dashboardThRightClass : dashboardThClass;
  const className = `${baseClass} ${publishedThSortableClass}${isActive ? ` ${publishedThActiveClass}` : ''}`;
  return (
    <th
      scope="col"
      tabIndex={0}
      aria-sort={isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onClick(column)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(column);
        }
      }}
      className={className}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}>
        {label}
        {isActive ? (
          sort.dir === 'asc' ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

interface PublishedRowProps {
  row: PublishedVersionRow;
  metrics: PublishedVersionMetrics | undefined;
  decoration: PublishedRowDecoration | undefined;
  selected: boolean;
  onToggleSelected: () => void;
  onOpenDetail: () => void;
  onCopyUrl: () => void;
  onOpenView: (kind: ViewKind) => void;
  onToggleVisibility: () => void;
  onShowQr?: () => void;
  onCopyCurl?: () => void;
  onUnpublish?: () => void;
  pathFor: (row: PublishedVersionRow) => string;
}

function PublishedRow({
  row,
  metrics,
  decoration,
  selected,
  onToggleSelected,
  onOpenDetail,
  onCopyUrl,
  onOpenView,
  onToggleVisibility,
  onShowQr,
  onCopyCurl,
  onUnpublish,
  pathFor,
}: PublishedRowProps) {
  const state = decoration?.state ?? 'ok';
  const stateClass = publishedRowStateInsetClass[state];
  const wow = metrics ? formatWoW(metrics.requestsWoW) : null;
  const errorTier = metrics ? publishedErrorTier(metrics.errorRate) : null;
  const errorClass = errorTier ? publishedErrorTierClass[errorTier] : '';

  return (
    <tr
      className={`group hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 transition-colors ${stateClass} ${
        selected ? 'bg-indigo-500/5 dark:bg-indigo-500/10' : ''
      }`}
    >
      <td className="px-4 py-3 align-top w-10">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          checked={selected}
          aria-label={`Select ${row.project_name} v${row.version_id}`}
          onChange={onToggleSelected}
        />
      </td>

      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-3 min-w-0">
          <ProjectAvatar projectId={row.project_id} projectName={row.project_name} />
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 inline-flex items-center gap-2 transition-colors text-left"
            >
              <span className="truncate">{row.project_name}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> v{row.version_id}
              </span>
              {decoration?.chipLabel ? (
                <span
                  className={`text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${publishedRowStateChipClass[state]}`}
                >
                  {decoration.chipLabel}
                </span>
              ) : null}
            </button>
            <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {row.creator_name ? `by ${row.creator_name}` : 'unknown publisher'} · {relativeAgo(row.published_at)}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleVisibility}
              className={publishedVisibilityPillClass[row.visibility]}
            >
              {row.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {row.visibility === 'public' ? 'Public' : 'Private'}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Click to make {row.visibility === 'public' ? 'private' : 'public'}
          </TooltipContent>
        </Tooltip>
      </td>

      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2 min-w-0">
          <code className="font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">
            {pathFor(row)}
          </code>
          {row.visibility === 'private' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40">
                  <KeyRound className="w-3 h-3" /> key
                </span>
              </TooltipTrigger>
              <TooltipContent>Requires an enabled API key</TooltipContent>
            </Tooltip>
          ) : null}
          <button
            type="button"
            onClick={onCopyUrl}
            title="Copy URL"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {onShowQr ? (
            <button
              type="button"
              onClick={onShowQr}
              title="Show QR"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-500 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onOpenView('open')}
            title="Open OpenAPI spec"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>

      <td className="px-4 py-3 align-top text-right">
        {metrics ? (
          <div className="font-mono">
            <div className="text-sm text-gray-900 dark:text-gray-100">{formatRequestsShort(metrics.requests24h)}</div>
            {wow ? (
              <div
                className={`text-[10px] ${
                  wow.tone === 'up'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : wow.tone === 'down'
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {wow.label}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="font-mono text-gray-400">—</span>
        )}
      </td>

      <td className="px-4 py-3 align-top text-right font-mono">
        {metrics ? (
          <span className="text-gray-900 dark:text-gray-100">
            {metrics.p50Ms}
            <span className="text-gray-400 dark:text-gray-500 text-[10px]">ms</span>
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      <td className={`px-4 py-3 align-top text-right font-mono ${errorClass}`}>
        {metrics ? `${(metrics.errorRate * 100).toFixed(2)}%` : <span className="text-gray-400">—</span>}
      </td>

      <td className="px-4 py-3 align-top text-right font-mono text-gray-700 dark:text-gray-200">
        {metrics ? metrics.consumers.toLocaleString() : <span className="text-gray-400">—</span>}
      </td>

      <td className="px-4 py-3 align-top">
        {metrics ? (
          <div className="flex items-center gap-2 min-w-0">
            <Sparkline
              points={metrics.hourlyRequests}
              tone={state === 'problem' ? 'rose' : state === 'stale' ? 'amber' : 'indigo'}
              area
              width={100}
              height={20}
              className="w-24 h-5 shrink-0"
            />
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate">
              {metrics.lastSeenAt ? relativeAgo(metrics.lastSeenAt) : '—'}
            </span>
          </div>
        ) : (
          <span className="font-mono text-gray-400">—</span>
        )}
      </td>

      <td className="px-4 py-3 align-top text-right">
        <RowActionMenu
          row={row}
          onOpenView={onOpenView}
          onCopyUrl={onCopyUrl}
          onShowQr={onShowQr}
          onCopyCurl={onCopyCurl}
          onToggleVisibility={onToggleVisibility}
          onUnpublish={onUnpublish}
        />
      </td>
    </tr>
  );
}

interface ProjectAvatarProps {
  projectId: string;
  projectName: string;
}

function ProjectAvatar({ projectId, projectName }: ProjectAvatarProps) {
  const initials = useMemo(() => deriveInitials(projectName), [projectName]);
  const gradient = useMemo(() => pickAvatarGradient(projectId), [projectId]);
  return (
    <div
      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-mono font-semibold text-[11px] shrink-0`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function deriveInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '··';
  const parts = trimmed.split(/[-_\s]+/u).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function pickAvatarGradient(projectId: string): string {
  let h = 0;
  for (let i = 0; i < projectId.length; i += 1) {
    h = (h * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return projectAvatarGradientClasses[h % projectAvatarGradientClasses.length];
}

interface RowActionMenuProps {
  row: PublishedVersionRow;
  onOpenView: (kind: ViewKind) => void;
  onCopyUrl: () => void;
  onShowQr?: () => void;
  onCopyCurl?: () => void;
  onToggleVisibility: () => void;
  onUnpublish?: () => void;
}

function RowActionMenu({
  row,
  onOpenView,
  onCopyUrl,
  onShowQr,
  onCopyCurl,
  onToggleVisibility,
  onUnpublish,
}: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  const close = () => setOpen(false);

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={handleTriggerClick}
        title="Actions"
        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && position ? (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          <div
            className="fixed z-30 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1"
            style={{ top: position.top, right: position.right }}
            onClick={(e) => e.stopPropagation()}
          >
            <ActionMenuGroup label="View">
              <ActionItem
                icon={<FileText className="w-4 h-4 text-blue-500" />}
                label="OpenAPI spec"
                onClick={() => {
                  close();
                  onOpenView('open');
                }}
              />
              <ActionItem
                icon={<FileText className="w-4 h-4 text-fuchsia-500" />}
                label="Swagger UI"
                onClick={() => {
                  close();
                  onOpenView('swagger');
                }}
              />
              <ActionItem
                icon={<GitMerge className="w-4 h-4 text-emerald-500" />}
                label="Arazzo"
                onClick={() => {
                  close();
                  onOpenView('arazzo');
                }}
              />
              <ActionItem
                icon={<Braces className="w-4 h-4 text-violet-500" />}
                label="JSON Schema"
                onClick={() => {
                  close();
                  onOpenView('json');
                }}
              />
            </ActionMenuGroup>
            <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
            <ActionItem
              icon={<Copy className="w-4 h-4 text-blue-500" />}
              label="Copy URL"
              onClick={() => {
                close();
                onCopyUrl();
              }}
            />
            {onShowQr ? (
              <ActionItem
                icon={<QrCode className="w-4 h-4 text-indigo-500" />}
                label="Show QR"
                onClick={() => {
                  close();
                  onShowQr();
                }}
              />
            ) : null}
            {onCopyCurl ? (
              <ActionItem
                icon={<Terminal className="w-4 h-4 text-amber-500" />}
                label="Copy as cURL"
                onClick={() => {
                  close();
                  onCopyCurl();
                }}
              />
            ) : null}
            <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
            <ActionItem
              icon={
                row.visibility === 'public' ? (
                  <Lock className="w-4 h-4 text-slate-500" />
                ) : (
                  <Globe className="w-4 h-4 text-emerald-500" />
                )
              }
              label={row.visibility === 'public' ? 'Make private' : 'Make public'}
              onClick={() => {
                close();
                onToggleVisibility();
              }}
            />
            {onUnpublish ? (
              <ActionItem
                icon={<EyeOff className="w-4 h-4 text-rose-500" />}
                label="Unpublish"
                tone="danger"
                onClick={() => {
                  close();
                  onUnpublish();
                }}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ActionMenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider font-semibold text-gray-400">
        {label}
      </p>
      {children}
    </div>
  );
}

interface ActionItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}

function ActionItem({ icon, label, onClick, tone = 'default' }: ActionItemProps) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30'
      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-colors ${toneClass}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function defaultDirFor(column: SortColumn): SortDirection {
  if (column === 'version' || column === 'visibility') return 'asc';
  return 'desc';
}

function sortVersions(
  versions: PublishedVersionRow[],
  metricsById: Map<string, PublishedVersionMetrics>,
  sort: { column: SortColumn; dir: SortDirection },
): PublishedVersionRow[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const value = (row: PublishedVersionRow): string | number => {
    const m = metricsById.get(row.id);
    switch (sort.column) {
      case 'version':
        return `${row.project_name.toLowerCase()} ${row.version_id}`;
      case 'visibility':
        return row.visibility;
      case 'requests':
        return m?.requests24h ?? -1;
      case 'p50':
        return m?.p50Ms ?? Number.POSITIVE_INFINITY;
      case 'errors':
        return m?.errorRate ?? -1;
      case 'consumers':
        return m?.consumers ?? -1;
      case 'activity':
        return m?.lastSeenAt ? new Date(m.lastSeenAt).getTime() : 0;
      default:
        return 0;
    }
  };
  return [...versions].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}
