'use client';

/**
 * Branch picker (checkout) for the canvas toolbar and git menu (#2722 GLI-03).
 */

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, GitBranch, Plus } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import { useStudio } from '../StudioContext';
import { Spinner } from '@/app/components/ui/Spinner';
import type { VersionBranchRow } from '@/app/components/ade/version-dialogs/types';
import type { Version } from '../editor/components/types';
import { formatVersionSelectorLabel } from '@/app/utils/version-display';
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

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<VersionBranchRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [pendingCheckout, setPendingCheckout] = useState<VersionBranchRow | null>(null);

  const cached = selectedProjectId ? versionBranchesByProjectId[selectedProjectId] : undefined;

  const currentVersion = useMemo(
    () => versions.find((v) => String(v.id) === String(selectedVersionId)),
    [versions, selectedVersionId]
  );

  const branchesForLabel = useMemo(() => {
    if (cached?.length) return cached;
    return list;
  }, [cached, list]);

  const resolvedBranch = useMemo(() => {
    if (!selectedVersionId || !branchesForLabel.length) return null;
    return resolveActiveBranchForRevision(selectedVersionId, branchesForLabel);
  }, [selectedVersionId, branchesForLabel]);

  const displayBranch: VersionBranchRow | null = useMemo(() => {
    if (selectedBranchId && branchesForLabel.length) {
      const byId = branchesForLabel.find((b) => b.id === selectedBranchId);
      if (byId) return byId;
    }
    return resolvedBranch;
  }, [selectedBranchId, branchesForLabel, resolvedBranch]);

  const sortedBranches = useMemo(() => sortBranchesForPicker(list), [list]);

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
      const r = await fetch(`/api/projects/${encodeURIComponent(selectedProjectId)}/version-branches`);
      const d = (await r.json()) as { success?: boolean; branches?: VersionBranchRow[] };
      if (d.success && Array.isArray(d.branches)) {
        setVersionBranchesForProject(selectedProjectId, d.branches);
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

  const chipLabel = displayBranch?.name ?? '—';
  const tooltipBits: string[] = [];
  if (displayBranch?.tip_version_id) {
    tooltipBits.push(`Tip revision: ${displayBranch.tip_version_id}`);
  }
  if (currentVersion) {
    tooltipBits.push(`Canvas: ${formatVersionSelectorLabel(currentVersion)}`);
  }
  const title = tooltipBits.join('\n');

  const triggerClass =
    variant === 'toolbar'
      ? `inline-flex max-w-[min(14rem,46vw)] items-center gap-1.5 rounded-lg border border-gray-200/55 bg-white/45 px-2.5 py-2 text-sm font-medium text-gray-800 shadow-md backdrop-blur-md transition-all hover:border-indigo-300/60 hover:bg-white/65 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-gray-600/45 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:border-indigo-500/45 dark:hover:bg-gray-900/55`
      : `flex w-full max-w-full items-center justify-between gap-2 rounded-lg border border-gray-200/80 bg-white/60 px-2.5 py-2 text-left text-sm font-medium text-gray-900 shadow-sm backdrop-blur-sm transition-all hover:border-indigo-300/50 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-gray-600/60 dark:bg-gray-900/50 dark:text-gray-100 dark:hover:border-indigo-500/40`;

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={triggerClass}
            title={title}
            aria-label={`Current branch: ${chipLabel}. Open branch picker.`}
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
            className="z-[10060] w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
            sideOffset={6}
            align={variant === 'toolbar' ? 'end' : 'start'}
            onKeyDown={onKeyDown}
          >
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
