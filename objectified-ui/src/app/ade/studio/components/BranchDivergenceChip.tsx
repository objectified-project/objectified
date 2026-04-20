'use client';

/**
 * Ahead / behind default-branch chip for the canvas toolbar (#2723 GLI-04).
 */

import { GitCompareArrows } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useStudio } from '../StudioContext';
import { resolveActiveBranchForRevision } from '@/app/ade/studio/lib/studio-branch-resolve';
import {
  branchDivergenceChipToneClasses,
  getBranchDivergenceChipPresentation,
} from '@/app/ade/studio/lib/branch-divergence-chip-copy';
import type { VersionBranchRow } from '@/app/components/ade/version-dialogs/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/Tooltip';
import { Spinner } from '@/app/components/ui/Spinner';
export type BranchDivergenceChipProps = {
  variant: 'toolbar' | 'menu';
};

type DivergencePayload = {
  ahead: number;
  behind: number;
  mergeBase?: { revisionId?: string | null } | null;
  against?: { name?: string | null; tipRevisionId?: string | null } | null;
  branch?: { tipRevisionId?: string | null } | null;
  aheadSample?: Array<{ revisionId?: string; shortMessage?: string | null }>;
  behindSample?: Array<{ revisionId?: string; shortMessage?: string | null }>;
};

function shortRev(id: string): string {
  const t = id.trim();
  if (t.length <= 10) return t;
  return `${t.slice(0, 8)}…`;
}

export function BranchDivergenceChip({ variant }: BranchDivergenceChipProps) {
  const router = useRouter();
  const {
    selectedProjectId,
    selectedVersionId,
    selectedBranchId,
    sidebarRefreshKey,
    canvasPresentationMode,
    versionBranchesByProjectId,
  } = useStudio();

  const [data, setData] = useState<DivergencePayload | null>(null);
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

  const showChip = Boolean(
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
    if (!showChip || !selectedProjectId || !branchIdForFetch) return;

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
        const json = (await r.json()) as DivergencePayload;
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
  }, [showChip, selectedProjectId, branchIdForFetch, sidebarRefreshKey]);

  const { label, tone } = (() => {
    if (error) return { label: 'Divergence unavailable', tone: 'muted' as const };
    if (!data) return { label: loading ? 'Checking…' : '…', tone: 'muted' as const };
    return getBranchDivergenceChipPresentation(
      data.ahead ?? 0,
      data.behind ?? 0,
      data.against?.name?.trim() || 'main'
    );
  })();
  const toneClass = branchDivergenceChipToneClasses(tone);

  const mergeBaseId = data?.mergeBase?.revisionId?.trim() ?? '';
  const branchTipId = data?.branch?.tipRevisionId?.trim() ?? displayBranch?.tip_version_id ?? '';

  const openCompare = useCallback(() => {
    if (loading || error) return;
    if (!selectedProjectId || !mergeBaseId || !branchTipId) {
      toast.error('Merge base or branch tip is not available yet.');
      return;
    }
    const qs = new URLSearchParams({
      projectId: selectedProjectId,
      compareOpen: '1',
      compareBase: mergeBaseId,
      compareHead: branchTipId,
    });
    router.push(`/ade/dashboard/versions?${qs.toString()}`);
  }, [selectedProjectId, mergeBaseId, branchTipId, router, loading, error]);

  const tooltipBody = useMemo(() => {
    if (loading && !data) {
      return <span className="text-gray-100 dark:text-gray-900">Loading divergence…</span>;
    }
    if (!data) {
      return <span className="text-gray-100 dark:text-gray-900">No divergence data yet.</span>;
    }
    const aheadN = data.ahead ?? 0;
    const behindN = data.behind ?? 0;
    const aheadRows = (data.aheadSample ?? []).slice(0, 5);
    const behindRows = (data.behindSample ?? []).slice(0, 5);
    if (!aheadRows.length && !behindRows.length) {
      return <span className="text-gray-100 dark:text-gray-900">No sample commits loaded.</span>;
    }
    return (
      <div className="space-y-3 text-left text-xs normal-case font-normal">
        {aheadRows.length > 0 && (
          <div>
            <div className="mb-1 font-semibold text-gray-100 dark:text-gray-900">
              Ahead ({aheadN} commit{aheadN === 1 ? '' : 's'})
            </div>
            <ul className="list-disc space-y-1 pl-4 text-gray-100 dark:text-gray-900">
              {aheadRows.map((row, i) => (
                <li key={row.revisionId ?? `ahead-${i}`}>
                  <span className="opacity-90">{row.shortMessage?.trim() || '(no message)'}</span>
                  {row.revisionId ? (
                    <span className="ml-1 font-mono text-[10px] opacity-80">({shortRev(row.revisionId)})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        {behindRows.length > 0 && (
          <div>
            <div className="mb-1 font-semibold text-gray-100 dark:text-gray-900">
              Behind ({behindN} commit{behindN === 1 ? '' : 's'})
            </div>
            <ul className="list-disc space-y-1 pl-4 text-gray-100 dark:text-gray-900">
              {behindRows.map((row, i) => (
                <li key={row.revisionId ?? `behind-${i}`}>
                  <span className="opacity-90">{row.shortMessage?.trim() || '(no message)'}</span>
                  {row.revisionId ? (
                    <span className="ml-1 font-mono text-[10px] opacity-80">({shortRev(row.revisionId)})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }, [data, loading]);

  if (!showChip) {
    return null;
  }

  const menuExtra = variant === 'menu' ? ' mt-2 w-full max-w-full justify-center' : '';

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`${toneClass}${menuExtra} ${
              loading || error || !mergeBaseId || !branchTipId ? 'opacity-60' : ''
            }`}
            aria-label={`${label}. Open compare with default branch.`}
            disabled={loading || Boolean(error) || !mergeBaseId || !branchTipId}
            aria-disabled={loading || Boolean(error) || !mergeBaseId || !branchTipId}
            onClick={() => openCompare()}
          >
            {loading ? (
              <Spinner size="sm" className="shrink-0 text-current" />
            ) : (
              <GitCompareArrows className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            )}
            <span className="min-w-0 truncate leading-tight">
              {error ? <span className="text-red-700 dark:text-red-300">{label}</span> : label}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align={variant === 'toolbar' ? 'end' : 'center'}
          className="max-w-sm border border-gray-700 bg-gray-900 text-gray-100 dark:border-gray-300 dark:bg-gray-100 dark:text-gray-900"
        >
          {error ? (
            <span className="text-xs text-red-300 dark:text-red-700">{error}</span>
          ) : (
            tooltipBody
          )}
          {!error && (
            <p className="mt-2 border-t border-gray-700 pt-2 text-[10px] text-gray-300 dark:border-gray-300 dark:text-gray-600">
              Click to open Compare Version Schemas (merge base → branch tip). Press Escape to close.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
