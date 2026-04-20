'use client';

/**
 * Toolbar Commit control for the Designer canvas (#2724 GLI-05).
 */

import { GitCommit } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import { useStudio } from '../StudioContext';
import { usePushConflictBanner } from '@/app/providers/PushConflictBannerProvider';
import { CommitRevisionDialog } from '@/app/components/ade/version-dialogs/CommitRevisionDialog';
import type { Version } from '../editor/components/types';
import { resolveActiveBranchForRevision } from '@/app/ade/studio/lib/studio-branch-resolve';
import type { VersionBranchRow } from '@/app/components/ade/version-dialogs/types';

const toolbarCommitClass =
  'relative shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-200/55 bg-white/45 px-3 py-2 text-sm font-medium text-gray-800 shadow-md backdrop-blur-md transition-all hover:border-indigo-300/60 hover:bg-white/65 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-gray-600/45 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:border-indigo-500/45 dark:hover:bg-gray-900/55';

export type CanvasCommitButtonProps = {
  versions: Version[];
  setVersions: Dispatch<SetStateAction<Version[]>>;
};

export type CanvasCommitButtonHandle = {
  open: () => void;
};

export const CanvasCommitButton = forwardRef<CanvasCommitButtonHandle, CanvasCommitButtonProps>(
  function CanvasCommitButton({ versions, setVersions }, ref) {
    const { setPushConflictFrom409 } = usePushConflictBanner();
    const [commitOpen, setCommitOpen] = useState(false);

    const {
      selectedProjectId,
      selectedVersionId,
      selectedBranchId,
      setSelectedVersionId,
      setIsReadOnly,
      triggerCanvasRefresh,
      triggerSidebarRefresh,
      syncLocalDirty,
      canvasPresentationMode,
      setVersionBranchesForProject,
      isReadOnly,
      versionBranchesByProjectId,
    } = useStudio();

    const branchesForLabel = useMemo(
      () => (selectedProjectId ? (versionBranchesByProjectId[selectedProjectId] ?? []) : []),
      [selectedProjectId, versionBranchesByProjectId]
    );

    const resolvedBranch = useMemo(() => {
      if (!selectedVersionId || !branchesForLabel.length) return null;
      return resolveActiveBranchForRevision(selectedVersionId, branchesForLabel);
    }, [selectedVersionId, branchesForLabel]);

    const lockBranchId = useMemo(() => {
      if (selectedBranchId && branchesForLabel.some((b) => b.id === selectedBranchId)) {
        return selectedBranchId;
      }
      return resolvedBranch?.id ?? null;
    }, [selectedBranchId, branchesForLabel, resolvedBranch]);

    const currentVersion = useMemo(
      () => versions.find((v) => String(v.id) === String(selectedVersionId)),
      [versions, selectedVersionId]
    );

    const currentRevisionRef = useMemo(
      () =>
        currentVersion
          ? {
              id: currentVersion.id,
              version_id: currentVersion.version_id,
              shortMessage: currentVersion.shortMessage ?? currentVersion.description ?? null,
            }
          : null,
      [currentVersion]
    );

    const refreshVersionList = useCallback(async (): Promise<Version[] | null> => {
      if (!selectedProjectId) return null;
      try {
        const response = await fetch(`/api/versions?projectId=${encodeURIComponent(selectedProjectId)}`);
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.versions)) {
          return null;
        }
        const list = result.versions as Version[];
        setVersions(list);
        return list;
      } catch {
        return null;
      }
    }, [selectedProjectId, setVersions]);

    const refreshBranchList = useCallback(async () => {
      if (!selectedProjectId) return;
      try {
        const r = await fetch(`/api/projects/${encodeURIComponent(selectedProjectId)}/version-branches`);
        const d = (await r.json()) as { success?: boolean; branches?: VersionBranchRow[] };
        if (r.ok && d.success && Array.isArray(d.branches)) {
          setVersionBranchesForProject(selectedProjectId, d.branches);
        }
      } catch {
        /* best-effort */
      }
    }, [selectedProjectId, setVersionBranchesForProject]);

    const tryOpen = useCallback(() => {
      if (!selectedProjectId || !selectedVersionId) return;
      if (isReadOnly) {
        toast.warning('This revision is read-only. Pull the latest to commit new work.');
        return;
      }
      setCommitOpen(true);
    }, [selectedProjectId, selectedVersionId, isReadOnly]);

    useImperativeHandle(ref, () => ({ open: tryOpen }), [tryOpen]);

    if (!selectedProjectId || !selectedVersionId || canvasPresentationMode) {
      return null;
    }

    const readOnlyTitle = 'This revision is read-only. Pull the latest to commit new work.';

    return (
      <>
        <button
          type="button"
          className={toolbarCommitClass}
          onClick={() => tryOpen()}
          aria-disabled={isReadOnly}
          aria-keyshortcuts="Meta+Enter Control+Enter"
          title={isReadOnly ? readOnlyTitle : 'Commit a new revision (⌘/Ctrl+Enter)'}
          aria-label={isReadOnly ? readOnlyTitle : 'Commit new revision'}
        >
          {syncLocalDirty ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 shadow-sm ring-2 ring-white dark:ring-gray-900"
              aria-hidden
            />
          ) : null}
          <GitCommit className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
          <span className={isReadOnly ? 'cursor-not-allowed opacity-50' : ''}>Commit</span>
        </button>

        <CommitRevisionDialog
          open={commitOpen}
          onOpenChange={setCommitOpen}
          projectId={selectedProjectId}
          currentRevision={currentRevisionRef}
          lockedBranchId={lockBranchId}
          onStaleHead={(info) => {
            if (!selectedProjectId) return;
            setPushConflictFrom409({
              projectId: selectedProjectId,
              message: info.message ?? 'Server has a newer head revision.',
              currentHeadRevisionId: info.currentHeadRevisionId,
              currentHead: info.currentHead ?? null,
            });
          }}
          onCreated={async (result) => {
            const list = await refreshVersionList();
            await refreshBranchList();
            if (result.id) {
              setSelectedVersionId(result.id);
              setIsReadOnly(result.published ?? false);
            } else if (list && list[0]) {
              setSelectedVersionId(list[0].id);
              setIsReadOnly(list[0].published ?? false);
            }
            triggerCanvasRefresh();
            triggerSidebarRefresh();
          }}
        />
      </>
    );
  }
);

CanvasCommitButton.displayName = 'CanvasCommitButton';
