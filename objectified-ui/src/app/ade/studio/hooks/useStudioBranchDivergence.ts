'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../StudioContext';
import { resolveActiveBranchForRevision } from '@/app/ade/studio/lib/studio-branch-resolve';
import type { VersionBranchRow } from '@/app/components/ade/version-dialogs/types';

export type BranchDivergencePayload = {
  ahead: number;
  behind: number;
  mergeBase?: { revisionId?: string | null } | null;
  against?: { name?: string | null; tipRevisionId?: string | null } | null;
  branch?: { tipRevisionId?: string | null } | null;
  aheadSample?: Array<{ revisionId?: string; shortMessage?: string | null }>;
  behindSample?: Array<{ revisionId?: string; shortMessage?: string | null }>;
};

/**
 * Fetches default-branch vs active-branch divergence for the current canvas revision (#2723 GLI-04).
 * Used by `BranchDivergenceChip` and `DesignerCanvasGitMenu` sync-from-default (#2725 GLI-06).
 */
export function useStudioBranchDivergence() {
  const {
    selectedProjectId,
    selectedVersionId,
    selectedBranchId,
    sidebarRefreshKey,
    canvasPresentationMode,
    versionBranchesByProjectId,
  } = useStudio();

  const [data, setData] = useState<BranchDivergencePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);

  const branchesForLabel = useMemo(
    () => (selectedProjectId ? (versionBranchesByProjectId[selectedProjectId] ?? []) : []),
    [selectedProjectId, versionBranchesByProjectId]
  );

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

  const showDivergence = Boolean(
    selectedProjectId &&
      selectedVersionId &&
      displayBranch &&
      displayBranch.is_default === false &&
      !canvasPresentationMode
  );

  const branchIdForFetch = displayBranch?.id ?? '';

  useEffect(() => {
    etagRef.current = null;
    setData(null);
    setError(null);
  }, [branchIdForFetch, selectedProjectId]);

  useEffect(() => {
    if (!showDivergence || !selectedProjectId || !branchIdForFetch) return;

    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/projects/${encodeURIComponent(selectedProjectId)}/version-branches/${encodeURIComponent(branchIdForFetch)}/divergence`;
        const headers: Record<string, string> = {};
        if (etagRef.current) {
          headers['If-None-Match'] = etagRef.current;
        }
        const r = await fetch(url, { signal: ac.signal, headers });
        const etag = r.headers.get('etag');
        if (r.status === 304) {
          return;
        }
        if (!r.ok) {
          const j = (await r.json().catch(() => null)) as { detail?: unknown; error?: string } | null;
          const msg =
            typeof j?.error === 'string'
              ? j.error
              : typeof j?.detail === 'object' && j.detail !== null && 'message' in j.detail
                ? String((j.detail as { message?: string }).message ?? 'Request failed')
                : 'Could not load branch divergence';
          setError(msg);
          setData(null);
          return;
        }
        if (etag) {
          etagRef.current = etag;
        }
        const json = (await r.json()) as BranchDivergencePayload;
        setData(json);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setError('Could not load branch divergence');
        setData(null);
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [showDivergence, selectedProjectId, branchIdForFetch, sidebarRefreshKey]);

  const defaultBranchName = useMemo(() => {
    const fromBranches = branchesForLabel.find((b) => b.is_default)?.name?.trim() ?? '';
    if (fromBranches) return fromBranches;
    return data?.against?.name?.trim() ?? '';
  }, [branchesForLabel, data?.against?.name]);

  const activeBranchName = displayBranch?.name?.trim() ?? '';

  return {
    selectedProjectId,
    showDivergence,
    data,
    loading,
    error,
    displayBranch,
    branchesForLabel,
    defaultBranchName,
    activeBranchName,
  };
}
