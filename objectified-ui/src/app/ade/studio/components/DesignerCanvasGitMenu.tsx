'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { Download, ExternalLink, GitBranch, GitMerge, History, RefreshCw } from 'lucide-react';
import { useStudio } from '../StudioContext';
import { usePushConflictBanner } from '@/app/providers/PushConflictBannerProvider';
import { formatVersionSelectorLabel } from '@/app/utils/version-display';
import {
  countAuthoredRevisionsTowardHead,
  isRemoteHeadAheadOfSelection,
} from '@/app/utils/studio-sync-indicators';
import { Spinner } from '@/app/components/ui/Spinner';
import type { Version } from '../editor/components/types';

export type DesignerCanvasGitMenuProps = {
  versions: Version[];
  setVersions: Dispatch<SetStateAction<Version[]>>;
};

function versionSyncRow(v: Version) {
  return {
    id: v.id,
    parent_version_id: (v as { parent_version_id?: string | null }).parent_version_id ?? null,
    creator_id: (v as { creator_id?: string | null }).creator_id ?? null,
  };
}

export function DesignerCanvasGitMenu({ versions, setVersions }: DesignerCanvasGitMenuProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { conflict, clearPushConflict } = usePushConflictBanner();
  const [pullLoading, setPullLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);

  const {
    selectedProjectId,
    selectedVersionId,
    setSelectedVersionId,
    setIsReadOnly,
    triggerCanvasRefresh,
    triggerSidebarRefresh,
    syncLocalDirty,
    canvasPresentationMode,
  } = useStudio();

  const sessionUserId = (session?.user as { user_id?: string } | undefined)?.user_id;

  const serverAheadForProject =
    conflict && selectedProjectId && conflict.projectId === selectedProjectId ? conflict : null;

  const syncVersionsForMetrics = useMemo(
    () => versions.map(versionSyncRow),
    [versions]
  );

  const authoredRevisionCount = useMemo(
    () =>
      countAuthoredRevisionsTowardHead(syncVersionsForMetrics, selectedVersionId ?? '', sessionUserId),
    [syncVersionsForMetrics, selectedVersionId, sessionUserId]
  );

  const serverHeadAheadOfSelection = useMemo(
    () => isRemoteHeadAheadOfSelection(syncVersionsForMetrics, selectedVersionId ?? ''),
    [syncVersionsForMetrics, selectedVersionId]
  );

  const showServerAhead = Boolean(serverAheadForProject) || serverHeadAheadOfSelection;

  const currentVersion = useMemo(
    () => versions.find((v) => String(v.id) === String(selectedVersionId)),
    [versions, selectedVersionId]
  );

  const handleOpenMerge = useCallback(() => {
    const pid = serverAheadForProject?.projectId ?? selectedProjectId;
    if (!pid) return;
    router.push(`/ade/dashboard/versions?merge=1&projectId=${encodeURIComponent(pid)}`);
  }, [serverAheadForProject?.projectId, selectedProjectId, router]);

  const handleOpenVersionsDashboard = useCallback(() => {
    if (!selectedProjectId) return;
    router.push(`/ade/dashboard/versions?projectId=${encodeURIComponent(selectedProjectId)}`);
  }, [selectedProjectId, router]);

  const handleRefreshRevisionList = useCallback(async () => {
    if (!selectedProjectId) return;
    setRefreshLoading(true);
    try {
      const response = await fetch(`/api/versions?projectId=${encodeURIComponent(selectedProjectId)}`);
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.versions)) {
        toast.error(typeof result.error === 'string' ? result.error : 'Could not refresh revisions.');
        return;
      }
      const list = result.versions as Version[];
      setVersions(list);
      const stillExists = list.some((v) => String(v.id) === String(selectedVersionId));
      if (!stillExists && list[0]) {
        setSelectedVersionId(list[0].id);
        setIsReadOnly(list[0].published ?? false);
        toast.message('The selected revision is no longer in this project; switched to the newest one.');
      } else {
        toast.success('Revision list updated.');
      }
      triggerSidebarRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshLoading(false);
    }
  }, [
    selectedProjectId,
    selectedVersionId,
    setVersions,
    setSelectedVersionId,
    setIsReadOnly,
    triggerSidebarRefresh,
  ]);

  const handlePullLatest = useCallback(async () => {
    if (!selectedProjectId) return;
    setPullLoading(true);
    try {
      const response = await fetch(`/api/versions?projectId=${encodeURIComponent(selectedProjectId)}`);
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.versions)) {
        toast.error(typeof result.error === 'string' ? result.error : 'Could not load revisions.');
        return;
      }
      const list = result.versions as Version[];
      setVersions(list);

      const headId = serverAheadForProject?.currentHeadRevisionId;
      const fromConflict = headId ? list.find((v) => v.id === headId) : undefined;
      const fromNewest = list[0];
      const next = fromConflict ?? fromNewest;
      if (!next) {
        toast.error('No revisions available. Check the project in Control Panel.');
        return;
      }
      setSelectedVersionId(next.id);
      setIsReadOnly(next.published ?? false);
      clearPushConflict();
      triggerCanvasRefresh();
      triggerSidebarRefresh();
      toast.success('Now on the latest revision.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Pull failed');
    } finally {
      setPullLoading(false);
    }
  }, [
    selectedProjectId,
    serverAheadForProject,
    setVersions,
    setSelectedVersionId,
    setIsReadOnly,
    clearPushConflict,
    triggerCanvasRefresh,
    triggerSidebarRefresh,
  ]);

  if (!selectedProjectId || !selectedVersionId || canvasPresentationMode) {
    return null;
  }

  const pullDisabled = !showServerAhead || pullLoading;

  /** Floating glass chip — matches Layout / Export (translucent, not a solid group panel). */
  const toolbarIconButtonClass =
    'shrink-0 p-2 text-sm font-medium rounded-lg border border-gray-200/55 dark:border-gray-600/45 bg-white/45 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 backdrop-blur-md transition-all duration-200 shadow-md hover:shadow-lg hover:bg-white/65 dark:hover:bg-gray-900/55 hover:border-indigo-300/60 dark:hover:border-indigo-500/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 data-[state=open]:border-indigo-400/70 dark:data-[state=open]:border-indigo-500/50 data-[state=open]:bg-indigo-50/55 dark:data-[state=open]:bg-indigo-950/35 data-[state=open]:shadow-lg';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={toolbarIconButtonClass}
          title="Revision and sync — pull, merge, history"
          aria-label="Revision and sync"
        >
          <GitBranch className="h-5 w-5" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
            className="z-[10050] min-w-[260px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
          sideOffset={6}
          align="end"
        >
            <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-700">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Current revision
              </div>
              <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                {currentVersion ? formatVersionSelectorLabel(currentVersion) : '—'}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                {currentVersion?.published ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    Published
                  </span>
                ) : (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-300/10 dark:text-slate-300">
                    Draft
                  </span>
                )}
                {authoredRevisionCount > 0 && (
                  <span title="Revisions you authored between this selection and the latest revision (main lineage).">
                    {authoredRevisionCount} your revision{authoredRevisionCount === 1 ? '' : 's'} toward head
                  </span>
                )}
                {syncLocalDirty && <span className="text-amber-700 dark:text-amber-300">Unsaved layout</span>}
                {showServerAhead && (
                  <span className="text-indigo-700 dark:text-indigo-300">Server has newer revision</span>
                )}
              </div>
            </div>

            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800 outline-none data-[highlighted]:bg-gray-100 dark:text-gray-200 dark:data-[highlighted]:bg-gray-700"
              onSelect={(e) => {
                e.preventDefault();
                void handlePullLatest();
              }}
              disabled={pullDisabled}
            >
              {pullLoading ? (
                <Spinner size="sm" className="shrink-0" aria-hidden />
              ) : (
                <Download className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              )}
              <span className="flex-1">Switch to latest revision (pull)</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800 outline-none data-[highlighted]:bg-gray-100 dark:text-gray-200 dark:data-[highlighted]:bg-gray-700"
              onSelect={(e) => {
                e.preventDefault();
                void handleRefreshRevisionList();
              }}
              disabled={refreshLoading}
            >
              {refreshLoading ? (
                <Spinner size="sm" className="shrink-0" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              )}
              <span className="flex-1">Refresh revision list</span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-gray-700" />

            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800 outline-none data-[highlighted]:bg-gray-100 dark:text-gray-200 dark:data-[highlighted]:bg-gray-700"
              onSelect={(e) => {
                e.preventDefault();
                handleOpenMerge();
              }}
            >
              <GitMerge className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="flex-1">Merge and conflicts…</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800 outline-none data-[highlighted]:bg-gray-100 dark:text-gray-200 dark:data-[highlighted]:bg-gray-700"
              onSelect={(e) => {
                e.preventDefault();
                handleOpenVersionsDashboard();
              }}
            >
              <History className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="flex-1">Versions and history</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
            </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
