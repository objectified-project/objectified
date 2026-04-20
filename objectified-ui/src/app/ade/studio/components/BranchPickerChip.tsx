'use client';

/**
 * Branch picker (checkout) for the canvas toolbar and git menu (#2722 GLI-03).
 * Branch status summary popover (#2726 GLI-07).
 */

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, GitBranch, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import { useStudio } from '../StudioContext';
import { useDraftLockShared } from '@/app/ade/studio/hooks/useDraftLockShared';
import { useStudioBranchDivergence } from '@/app/ade/studio/hooks/useStudioBranchDivergence';
import { formatShortRelativeTime } from '@/app/ade/studio/lib/format-short-relative-time';
import {
  branchDivergenceChipToneClasses,
  getBranchDivergenceChipPresentation,
} from '@/app/ade/studio/lib/branch-divergence-chip-copy';
import { collectRecentRevisionsOnLineage, type VersionLineageRow } from '@/app/ade/studio/lib/studio-branch-status-recent';
import { Spinner } from '@/app/components/ui/Spinner';
import type { VersionBranchRow } from '@/app/components/ade/version-dialogs/types';
import type { Version } from '../editor/components/types';
import { formatVersionSelectorLabel } from '@/app/utils/version-display';
import { countAuthoredRevisionsTowardHead } from '@/app/utils/studio-sync-indicators';
import {
  sortBranchesForPicker,
  resolveActiveBranchForRevision,
} from '@/app/ade/studio/lib/studio-branch-resolve';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/AlertDialog';

const HOVER_OPEN_MS = 250;
const HOVER_CLOSE_MS = 320;

function shortRev(id: string): string {
  const t = id.trim();
  if (t.length <= 10) return t;
  return `${t.slice(0, 8)}…`;
}

function formatRemaining(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export type BranchPickerChipProps = {
  versions: Version[];
  setVersions: Dispatch<SetStateAction<Version[]>>;
  /** Compact label for the floating toolbar; wider block inside the git dropdown. */
  variant: 'toolbar' | 'menu';
  /** Show the "+ Create new branch…" row (uses studio opener from `DesignerCanvasGitMenu`). */
  showCreateBranch?: boolean;
};

export function BranchPickerChip({
  versions,
  setVersions,
  variant,
  showCreateBranch = true,
}: BranchPickerChipProps) {
  const { data: session } = useSession();
  const sessionUserId = (session?.user as { user_id?: string } | undefined)?.user_id;

  const {
    selectedProjectId,
    selectedVersionId,
    setSelectedVersionId,
    setSelectedBranchId,
    selectedBranchId,
    setIsReadOnly,
    triggerCanvasRefresh,
    triggerSidebarRefresh,
    syncLocalDirty,
    setVersionBranchesForProject,
    versionBranchesByProjectId,
    openBranchFromRevisionDialog,
    canvasPresentationMode,
  } = useStudio();

  const {
    displayBranch,
    defaultBranchName,
    showDivergence,
    data: divergenceData,
    loading: divergenceLoading,
    error: divergenceError,
  } = useStudioBranchDivergence();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<VersionBranchRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [pendingCheckout, setPendingCheckout] = useState<VersionBranchRow | null>(null);

  const hoverOpenTimerRef = useRef<number | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const openedFromHoverRef = useRef(false);

  const currentVersion = useMemo(
    () => versions.find((v) => String(v.id) === String(selectedVersionId)),
    [versions, selectedVersionId]
  );

  const currentVersionPublished = currentVersion?.published ?? true;

  const { payload: draftLock, nowMs: draftLockNowMs } = useDraftLockShared(
    selectedProjectId,
    selectedVersionId,
    currentVersionPublished
  );

  const branchesForLabel = useMemo(
    () => (selectedProjectId ? (versionBranchesByProjectId[selectedProjectId] ?? []) : []),
    [selectedProjectId, versionBranchesByProjectId]
  );

  const resolvedBranch = useMemo(() => {
    if (!selectedVersionId || !branchesForLabel.length) return null;
    return resolveActiveBranchForRevision(selectedVersionId, branchesForLabel);
  }, [selectedVersionId, branchesForLabel]);

  const displayBranchLocal: VersionBranchRow | null = useMemo(() => {
    if (selectedBranchId && branchesForLabel.length) {
      const byId = branchesForLabel.find((b) => b.id === selectedBranchId);
      if (byId) return byId;
    }
    return resolvedBranch;
  }, [selectedBranchId, branchesForLabel, resolvedBranch]);

  const effectiveBranch = displayBranch ?? displayBranchLocal;

  const sortedBranches = useMemo(() => sortBranchesForPicker(list), [list]);

  const syncVersionRows = useMemo(
    () =>
      versions.map((v) => {
        const row = v as VersionLineageRow;
        return {
          id: v.id,
          parent_version_id: row.parent_version_id ?? null,
          creator_id: row.creator_id ?? null,
        };
      }),
    [versions]
  );

  const authoredTowardHead = useMemo(
    () => countAuthoredRevisionsTowardHead(syncVersionRows, selectedVersionId ?? '', sessionUserId),
    [syncVersionRows, selectedVersionId, sessionUserId]
  );

  const tipVersionRow = useMemo(() => {
    const tipId = effectiveBranch?.tip_version_id;
    if (!tipId) return null;
    return versions.find((v) => String(v.id) === String(tipId)) as VersionLineageRow | undefined;
  }, [effectiveBranch?.tip_version_id, versions]);

  const recentOnBranch = useMemo(() => {
    const tipId = effectiveBranch?.tip_version_id?.trim();
    if (!tipId) return [];
    return collectRecentRevisionsOnLineage(
      versions as VersionLineageRow[],
      tipId,
      5
    );
  }, [effectiveBranch?.tip_version_id, versions]);

  const divergencePresentation = useMemo(() => {
    if (!showDivergence) {
      return { label: 'On default branch — no divergence vs default.', tone: 'muted' as const };
    }
    if (divergenceError) return { label: 'Divergence unavailable', tone: 'muted' as const };
    if (!divergenceData) {
      return { label: divergenceLoading ? 'Loading…' : '—', tone: 'muted' as const };
    }
    return getBranchDivergenceChipPresentation(
      divergenceData.ahead ?? 0,
      divergenceData.behind ?? 0,
      defaultBranchName?.trim() || 'default'
    );
  }, [showDivergence, divergenceError, divergenceData, divergenceLoading, defaultBranchName]);

  const divergenceToneClass = branchDivergenceChipToneClasses(divergencePresentation.tone);

  const refreshVersions = useCallback(async (): Promise<Version[] | null> => {
    if (!selectedProjectId) return null;
    try {
      const response = await fetch(`/api/versions?projectId=${encodeURIComponent(selectedProjectId)}`);
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.versions)) {
        return null;
      }
      const next = result.versions as Version[];
      setVersions(next);
      return next;
    } catch {
      return null;
    }
  }, [selectedProjectId, setVersions]);

  const loadBranches = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setFetchError(null);
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(selectedProjectId)}/version-branches`);
      const d = (await r.json()) as {
        success?: boolean;
        branches?: VersionBranchRow[];
        error?: string;
      };
      if (!r.ok || !d.success || !Array.isArray(d.branches)) {
        setFetchError(typeof d.error === 'string' ? d.error : 'Could not load branches');
        setList([]);
        return;
      }
      const sorted = sortBranchesForPicker(d.branches);
      setList(sorted);
      setVersionBranchesForProject(selectedProjectId, d.branches);
      const cur = selectedVersionId;
      const idx = sorted.findIndex((b) => String(b.tip_version_id) === String(cur));
      setHighlight(idx >= 0 ? idx : 0);
    } catch {
      setFetchError('Could not load branches');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectedVersionId, setVersionBranchesForProject]);

  useEffect(() => {
    if (!open) return;
    void loadBranches();
  }, [open, loadBranches]);

  useEffect(() => {
    if (!open) return;
    const max = Math.max(0, sortedBranches.length - 1);
    setHighlight((h) => Math.min(h, max));
  }, [open, sortedBranches.length]);

  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
      if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    };
  }, []);

  const clearHoverOpenTimer = () => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
  };

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, HOVER_CLOSE_MS);
  };

  const performCheckout = useCallback(
    async (branch: VersionBranchRow) => {
      if (!selectedProjectId) return;
      const tipId = branch.tip_version_id;
      if (String(tipId) === String(selectedVersionId)) {
        setOpen(false);
        return;
      }
      let nextVersions = versions;
      let tip = versions.find((v) => String(v.id) === String(tipId));
      if (!tip) {
        const refreshed = await refreshVersions();
        if (refreshed) nextVersions = refreshed;
        tip = nextVersions.find((v) => String(v.id) === String(tipId));
      }
      if (!tip) {
        toast.error('Branch tip revision is not available in this session. Refresh the revision list.');
        return;
      }
      setSelectedVersionId(tipId);
      setSelectedBranchId(branch.id);
      setIsReadOnly(tip.published ?? false);
      try {
        const r = await fetch(`/api/projects/${encodeURIComponent(selectedProjectId)}/version-branches`);
        if (r.ok) {
          const d = (await r.json()) as { success?: boolean; branches?: VersionBranchRow[] };
          if (d.success && Array.isArray(d.branches)) {
            setVersionBranchesForProject(selectedProjectId, d.branches);
          }
        }
      } catch {
        // Best-effort branch refresh; checkout should still complete even if this fails.
      }
      triggerCanvasRefresh();
      triggerSidebarRefresh();
      toast.success(`Checked out ${branch.name}`);
      setOpen(false);
    },
    [
      selectedProjectId,
      selectedVersionId,
      versions,
      refreshVersions,
      setSelectedVersionId,
      setSelectedBranchId,
      setIsReadOnly,
      setVersionBranchesForProject,
      triggerCanvasRefresh,
      triggerSidebarRefresh,
    ]
  );

  const requestCheckout = useCallback(
    (branch: VersionBranchRow) => {
      if (String(branch.tip_version_id) === String(selectedVersionId)) {
        setOpen(false);
        return;
      }
      if (syncLocalDirty) {
        setOpen(false);
        setPendingCheckout(branch);
        return;
      }
      void performCheckout(branch);
    },
    [syncLocalDirty, selectedVersionId, performCheckout]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!sortedBranches.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(sortedBranches.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const b = sortedBranches[highlight];
        if (b) requestCheckout(b);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    },
    [sortedBranches, highlight, requestCheckout]
  );

  if (!selectedProjectId || !selectedVersionId || canvasPresentationMode) {
    return null;
  }

  const chipLabel = effectiveBranch?.name ?? '—';
  const tooltipBits: string[] = [];
  if (effectiveBranch?.tip_version_id) {
    tooltipBits.push(`Tip revision: ${effectiveBranch.tip_version_id}`);
  }
  if (currentVersion) {
    tooltipBits.push(`Canvas: ${formatVersionSelectorLabel(currentVersion)}`);
  }
  const title = tooltipBits.join('\n');

  const triggerClass =
    variant === 'toolbar'
      ? `inline-flex max-w-[min(14rem,46vw)] items-center gap-1.5 rounded-lg border border-gray-200/55 bg-white/45 px-2.5 py-2 text-sm font-medium text-gray-800 shadow-md backdrop-blur-md transition-all hover:border-indigo-300/60 hover:bg-white/65 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-gray-600/45 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:border-indigo-500/45 dark:hover:bg-gray-900/55`
      : `flex w-full max-w-full items-center justify-between gap-2 rounded-lg border border-gray-200/80 bg-white/60 px-2.5 py-2 text-left text-sm font-medium text-gray-900 shadow-sm backdrop-blur-sm transition-all hover:border-indigo-300/50 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-gray-600/60 dark:bg-gray-900/50 dark:text-gray-100 dark:hover:border-indigo-500/40`;

  const tipAuthor =
    tipVersionRow?.creator_id?.trim() ?
      tipVersionRow.creator_id === sessionUserId ?
        'You'
      : `${tipVersionRow.creator_id.slice(0, 8)}…`
    : '—';

  const lockLine = (() => {
    if (currentVersionPublished) return 'Published revision — no draft lock.';
    if (!draftLock?.active) return 'No active draft lock.';
    const exp = draftLock.expiresAt;
    const owner = draftLock.ownerUserId;
    if (!exp || !owner) return 'Lock active.';
    const rem = formatRemaining(new Date(exp).getTime() - draftLockNowMs);
    const who = owner === sessionUserId ? 'You' : `${owner.slice(0, 8)}…`;
    return `Held by ${who} · expires in ${rem}`;
  })();

  const dashboardHref =
    selectedProjectId ?
      `/ade/dashboard/versions?projectId=${encodeURIComponent(selectedProjectId)}`
    : '/ade/dashboard/versions';

  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            openedFromHoverRef.current = false;
            clearHoverOpenTimer();
            clearHoverCloseTimer();
          }
        }}
        modal={false}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={triggerClass}
            title={title}
            aria-label={`Current branch: ${chipLabel}. Open branch status and branch picker.`}
            aria-expanded={open}
            onPointerEnter={() => {
              clearHoverCloseTimer();
              clearHoverOpenTimer();
              hoverOpenTimerRef.current = window.setTimeout(() => {
                openedFromHoverRef.current = true;
                setOpen(true);
              }, HOVER_OPEN_MS);
            }}
            onPointerLeave={() => {
              clearHoverOpenTimer();
              if (openedFromHoverRef.current) {
                scheduleClose();
              }
            }}
            onPointerDown={() => {
              openedFromHoverRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                openedFromHoverRef.current = false;
              }
            }}
          >
            <GitBranch className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Branch
              </span>
              <span className="block truncate leading-tight">{chipLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-[10060] w-[min(22.5rem,calc(100vw-2rem))] max-h-[min(70vh,36rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
            sideOffset={6}
            align={variant === 'toolbar' ? 'end' : 'start'}
            onKeyDown={onKeyDown}
            onOpenAutoFocus={(e) => {
              if (openedFromHoverRef.current) {
                e.preventDefault();
                openedFromHoverRef.current = false;
              }
            }}
            onPointerEnter={() => {
              clearHoverCloseTimer();
              clearHoverOpenTimer();
            }}
            onPointerLeave={() => {
              if (openedFromHoverRef.current) {
                scheduleClose();
              }
            }}
          >
            <div className="border-b border-gray-100 px-3 py-3 dark:border-gray-700">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Branch status
              </h2>

              <div className="mt-3 space-y-3 text-sm text-gray-800 dark:text-gray-200">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Branch
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{effectiveBranch?.name ?? '—'}</span>
                    {effectiveBranch?.is_default ?
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        default
                      </span>
                    : null}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Tip{' '}
                    <span className="font-mono text-[11px]">
                      {effectiveBranch?.tip_version_id ? shortRev(String(effectiveBranch.tip_version_id)) : '—'}
                    </span>
                    {tipVersionRow?.created_at ?
                      <>
                        {' '}
                        · {tipAuthor} · {formatShortRelativeTime(tipVersionRow.created_at)}
                      </>
                    : null}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Divergence{defaultBranchName ? ` vs ${defaultBranchName}` : ''}
                  </div>
                  <p className={`mt-1 text-sm ${divergenceToneClass}`}>{divergencePresentation.label}</p>
                  {showDivergence && divergenceData?.mergeBase?.revisionId?.trim() ?
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Merge base{' '}
                      <span className="font-mono text-[11px]">
                        {shortRev(divergenceData.mergeBase.revisionId.trim())}
                      </span>
                    </p>
                  : null}
                  {showDivergence && divergenceData && (divergenceData.aheadSample?.length || divergenceData.behindSample?.length) ?
                    <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      {(divergenceData.aheadSample ?? []).slice(0, 3).map((row, i) => (
                        <li key={row.revisionId ?? `a-${i}`}>
                          ↑ {row.shortMessage?.trim() || '(no message)'}
                          {row.revisionId ?
                            <span className="ml-1 font-mono text-[10px] opacity-80">
                              ({shortRev(row.revisionId)})
                            </span>
                          : null}
                        </li>
                      ))}
                      {(divergenceData.behindSample ?? []).slice(0, 3).map((row, i) => (
                        <li key={row.revisionId ?? `b-${i}`}>
                          ↓ {row.shortMessage?.trim() || '(no message)'}
                          {row.revisionId ?
                            <span className="ml-1 font-mono text-[10px] opacity-80">
                              ({shortRev(row.revisionId)})
                            </span>
                          : null}
                        </li>
                      ))}
                    </ul>
                  : null}
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Working copy
                  </div>
                  <ul className="mt-1 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                    <li>Dirty layout: {syncLocalDirty ? 'Yes' : 'No'}</li>
                    <li>
                      Uncommitted schema edits (lineage){' '}
                      {authoredTowardHead > 0 ? `Yes — ${authoredTowardHead} toward head` : 'No'}
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Locks
                  </div>
                  <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">{lockLine}</p>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Recent commits
                  </div>
                  {recentOnBranch.length === 0 ?
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">No revision history in session.</p>
                  : <ul className="mt-1 space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                      {recentOnBranch.map((row) => (
                        <li key={row.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                          <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
                            {shortRev(row.id)}
                          </span>
                          <span className="min-w-0 flex-1">
                            {(row.shortMessage ?? row.description ?? '').trim() || '(no message)'}
                          </span>
                          <span className="shrink-0 text-gray-500 dark:text-gray-400">
                            {row.created_at ? formatShortRelativeTime(row.created_at) : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  }
                </div>
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                <Link
                  href={dashboardHref}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2 text-xs font-medium text-indigo-900 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-900/50"
                  onClick={() => setOpen(false)}
                >
                  Open Versions dashboard
                  <span aria-hidden className="text-indigo-700 dark:text-indigo-200">
                    ▸
                  </span>
                </Link>
              </div>
            </div>

            <div className="p-1">
              {loading && (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-gray-600 dark:text-gray-300">
                  <Spinner size="sm" className="shrink-0" />
                  Loading branches…
                </div>
              )}
              {!loading && fetchError && (
                <div className="px-3 py-3 text-sm text-red-600 dark:text-red-400">{fetchError}</div>
              )}
              {!loading && !fetchError && sortedBranches.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">No named branches yet.</div>
              )}
              {!loading &&
                !fetchError &&
                sortedBranches.map((b, i) => {
                  const active = String(b.tip_version_id) === String(selectedVersionId);
                  const isSel = selectedBranchId === b.id;
                  const isHi = i === highlight;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                        isHi ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      } ${active ? 'font-semibold text-indigo-800 dark:text-indigo-200' : 'text-gray-800 dark:text-gray-200'}`}
                      onClick={() => requestCheckout(b)}
                      onMouseEnter={() => setHighlight(i)}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {active ? '✓ ' : ''}
                        {b.name}
                      </span>
                      {b.is_default && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          default
                        </span>
                      )}
                      {isSel && (
                        <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">current</span>
                      )}
                    </button>
                  );
                })}
              {showCreateBranch && !loading && (
                <>
                  <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                    onClick={() => {
                      setOpen(false);
                      openBranchFromRevisionDialog();
                    }}
                  >
                    <Plus className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    Create new branch…
                  </button>
                </>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <AlertDialog open={pendingCheckout !== null} onOpenChange={(o) => !o && setPendingCheckout(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved layout changes</AlertDialogTitle>
            <AlertDialogDescription>
              Switching branches will reload the canvas from the branch tip and you may lose unsaved canvas layout
              changes. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const b = pendingCheckout;
                setPendingCheckout(null);
                if (b) void performCheckout(b);
              }}
            >
              Switch branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
