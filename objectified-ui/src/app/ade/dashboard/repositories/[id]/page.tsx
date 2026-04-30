'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Download,
  FileCode2,
  GitBranch,
  Github,
  Globe,
  RefreshCw,
  GitCommitHorizontal,
  Plus,
} from 'lucide-react';
import { Button, buttonVariants } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { LoadingState } from '@/app/components/ui/LoadingState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/Select';
import { toast } from 'sonner';
import { cn } from '@lib/utils';
import {
  type DashboardRepository,
  type RepositoryStatus,
  RepositoryKpiCard,
  dashboardRepositoryFromApi,
  formatLastScan,
  repoInitials,
} from '@/app/components/ade/dashboard/repositories/repositoryStoreUi';

type RepoTab = 'overview' | 'files' | 'imports' | 'settings';

function providerSlug(repo: DashboardRepository): string {
  if (repo.provider === 'github' && repo.full_name && !repo.full_name.includes('://')) {
    return `github.com/${repo.full_name}`;
  }
  if (repo.clone_url) {
    try {
      const u = new URL(repo.clone_url);
      const path = u.pathname.replace(/\.git\/?$/i, '') || '/';
      return `${u.hostname}${path === '/' ? '' : path}`;
    } catch {
      /* ignore */
    }
  }
  return repo.full_name || '—';
}

function statusPill(status: RepositoryStatus) {
  switch (status) {
    case 'ready':
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          Active
        </span>
      );
    case 'scanning':
      return (
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          Scanning
        </span>
      );
    case 'pending':
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          Pending
        </span>
      );
    case 'error':
      return (
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
          Error
        </span>
      );
    case 'archived':
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          Archived
        </span>
      );
    default:
      return null;
  }
}

function TabBtn({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-b-2 py-3 text-sm font-medium transition-colors',
        active
          ? 'border-indigo-500 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
          : 'border-transparent text-gray-600 dark:text-gray-300'
      )}
    >
      {children}
      {badge !== undefined ? (
        <span
          className={cn(
            'ml-1 rounded-full px-1.5 py-0.5 text-[10px]',
            active
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'bg-gray-200 dark:bg-gray-700'
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default function RepositoryDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { data: session } = useSession();
  const currentTenantId = (session?.user as { current_tenant_id?: string })?.current_tenant_id;

  const [repo, setRepo] = useState<DashboardRepository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<RepoTab>('overview');

  const load = useCallback(async () => {
    if (!currentTenantId || !id) {
      setRepo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repositories/${encodeURIComponent(id)}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText);
      }
      const raw = data && typeof data === 'object' ? (data as { repository?: unknown }).repository : null;
      const parsed = dashboardRepositoryFromApi(raw);
      if (!parsed) {
        throw new Error('Invalid response from server');
      }
      setRepo(parsed);
    } catch (e) {
      console.error(e);
      setRepo(null);
      const msg = e instanceof Error ? e.message : 'Could not load repository';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentTenantId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filesTotal = repo?.total_files ?? 0;
  const importable = repo?.importable_count ?? null;

  const webUrl = useMemo(() => {
    if (!repo?.clone_url) return null;
    const u = repo.clone_url.replace(/\.git$/i, '');
    if (repo.provider === 'github' && u.includes('github.com')) {
      return u;
    }
    return null;
  }, [repo]);

  const lastScanValue =
    repo?.last_scanned_at != null
      ? formatLastScan(repo.last_scanned_at, repo.status === 'error')
      : 'Never';

  const lastScanSubtitle =
    repo?.last_scanned_at != null
      ? repo.status === 'error'
        ? 'Last job reported an error; details will map from scan job records.'
        : 'From `last_scanned_at` on this repository row (full diff summaries require scan job API).'
      : '`last_scanned_at` is unset until the first completed indexing job writes it.';

  if (!currentTenantId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-8 dark:border-amber-700/50 dark:from-amber-900/20 dark:to-yellow-900/20">
            <h2 className="mb-2 text-xl font-bold text-amber-900 dark:text-amber-100">No tenant selected</h2>
            <p className="mb-4 text-amber-800 dark:text-amber-200">Select a tenant to view repositories.</p>
            <Link href="/ade/dashboard/tenants" className={cn(buttonVariants())}>
              Go to Tenants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50 dark:bg-gray-900">
      <div
        className={cn(
          'shrink-0 border-b border-gray-200 bg-white px-6 pb-0 pt-6 dark:border-gray-700 dark:bg-gray-800',
          (loading || error || !repo) && 'pb-6'
        )}
      >
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <Link
            href="/ade/dashboard/repositories"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'shrink-0 gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            )}
          >
            ← Repositories
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => void load()}
            disabled={loading || !id}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Refresh data
          </Button>
        </div>

        {loading ? (
          <LoadingState message="Loading repository…" />
        ) : error || !repo ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-6 dark:border-rose-800/50 dark:bg-rose-950/30">
            <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-100">Repository unavailable</h2>
            <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">{error ?? 'Not found'}</p>
            <Link href="/ade/dashboard/repositories" className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}>
              Back to list
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-start gap-4">
              <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 font-mono text-lg font-bold text-white">
                {repoInitials(repo.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-bold">{repo.name}</h1>
                  {statusPill(repo.status)}
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {repo.provider === 'github' ? (
                      <Github className="h-3 w-3 shrink-0" aria-hidden />
                    ) : (
                      <Globe className="h-3 w-3 shrink-0 text-indigo-500" aria-hidden />
                    )}
                    {providerSlug(repo)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-[11px] text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
                    {repo.default_branch}
                  </span>
                </div>
                <p className="mt-1.5 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                  {repo.description?.trim()
                    ? repo.description
                    : 'No description from the provider metadata on this registration.'}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => toast.message('Rescan runs when scan jobs are wired to the API.')}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Rescan
                </Button>
                <Select defaultValue={repo.default_branch}>
                  <SelectTrigger className="h-9 w-[140px] gap-1 border-gray-200 dark:border-gray-700">
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={repo.default_branch}>{repo.default_branch}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => toast.message('Import starts from indexed files once the files API exists.')}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Import file…
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 py-4 md:grid-cols-4 dark:border-gray-700">
              <RepositoryKpiCard
                label="Files indexed"
                value={filesTotal.toLocaleString()}
                subtitle="From `total_files` after tree indexing; directory counts need scan metadata (not stored yet)."
              />
              <RepositoryKpiCard
                label="Importable"
                value={importable != null ? importable.toLocaleString() : '—'}
                subtitle={
                  importable != null
                    ? 'From `importable_count` after classification passes over indexed paths.'
                    : '`importable_count` is null until detection runs and persists per-repo totals.'
                }
                valueClassName={
                  importable != null ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
                }
              />
              <RepositoryKpiCard
                label="Imports (30d)"
                value="—"
                subtitle="Requires import events keyed by repository UUID + rolling window (API pending)."
              />
              <RepositoryKpiCard
                label="Last scan"
                value={lastScanValue}
                subtitle={lastScanSubtitle}
                valueClassName={
                  repo.last_scanned_at == null || repo.status === 'error'
                    ? 'text-gray-400 dark:text-gray-500'
                    : undefined
                }
              />
            </div>

            <div className="-mx-6 flex gap-6 border-t border-gray-200 px-6 text-sm dark:border-gray-700">
              <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>
                Overview
              </TabBtn>
              <TabBtn active={tab === 'files'} onClick={() => setTab('files')} badge={filesTotal.toLocaleString()}>
                Files
              </TabBtn>
              <TabBtn active={tab === 'imports'} onClick={() => setTab('imports')}>
                Imports
              </TabBtn>
              <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')}>
                Settings
              </TabBtn>
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {!loading && repo && tab === 'overview' && (
        <div className="space-y-6 px-6 py-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent scans</h3>
                <button
                  type="button"
                  className="text-[11px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                  onClick={() => toast.message('Scan history needs a `tenant_repository_scan_jobs` (or similar) collection exposed over REST.')}
                >
                  View scan history →
                </button>
              </div>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Each row will represent one indexing pass: branch or tag name, resolved commit SHA, file add/remove
                counts, duration, and outcome. Data will come from background workers writing scan job rows linked to{' '}
                <span className="font-mono text-xs">tenant_repositories.id</span>. Nothing is listed yet because that
                pipeline is not exposed to the UI.
              </p>
              {repo.last_scanned_at ? (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Registration shows last activity hint:{' '}
                  <span className="font-mono">{formatLastScan(repo.last_scanned_at, repo.status === 'error')}</span>
                  {repo.status === 'error' ? ' (status reports an error).' : '.'}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Importable mix</h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                A breakdown (OpenAPI, Arazzo, JSON Schema, AsyncAPI, …) will use per-file classification tags stored
                alongside indexed paths. Design open: either normalized counts on the repository row or a side table
                keyed by repo + scan job.
              </p>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Until then, only the aggregate <span className="font-mono">importable_count</span> above reflects stored
                state ({importable != null ? importable.toLocaleString() : 'currently null'}).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent imports from this repo</h3>
              <button
                type="button"
                className="text-[11px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                onClick={() => setTab('imports')}
              >
                See all →
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <tr>
                  <th className="py-2 text-left font-semibold">File</th>
                  <th className="text-left font-semibold">Project</th>
                  <th className="text-left font-semibold">Version</th>
                  <th className="text-left font-semibold">Imported by</th>
                  <th className="text-left font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Import audit rows will join file path, target project/version, user id, and timestamp from the import
                    pipeline. That feed is not connected yet, so there is nothing to show for this repository.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && repo && tab === 'files' && (
        <div className="space-y-4 px-6 py-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <span className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
              <GitBranch className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Branch</span>
              <span className="font-mono font-medium">{repo.default_branch}</span>
            </span>
            <span className="hidden h-6 border-l border-gray-200 sm:inline-block dark:border-gray-700" />
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Tip commit / age will display after git tip resolution per branch (not implemented).
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="font-mono">{filesTotal.toLocaleString()}</span> files (
              <span className="font-mono">total_files</span>)
            </span>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 opacity-75 dark:border-gray-700 dark:bg-gray-800">
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Filters below mirror the intended UX; they stay disabled until the files API accepts preset + glob +
              regex parameters on list queries.
            </p>
            <fieldset disabled className="space-y-3">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-4">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Importable preset
                  </label>
                  <select className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100">
                    <option>All importable types</option>
                  </select>
                </div>
                <div className="col-span-12 md:col-span-5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Glob filter (comma-separated)
                  </label>
                  <Input placeholder="**/*.yaml" className="mt-1 font-mono text-sm" />
                </div>
                <div className="col-span-12 md:col-span-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Regex (optional)
                  </label>
                  <Input placeholder="e.g. v\\d+\\.yaml$" className="mt-1 font-mono text-sm" />
                </div>
              </div>
            </fieldset>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-200">{filesTotal.toLocaleString()}</span>{' '}
                indexed paths · importable subset uses{' '}
                <span className="font-semibold text-indigo-500 dark:text-indigo-400">
                  {importable != null ? importable.toLocaleString() : '—'}
                </span>
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Browse path:</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono dark:bg-gray-700">/</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                <tr>
                  <th className="w-10 px-4 py-2 text-left font-semibold">
                    <input type="checkbox" disabled className="rounded border-gray-300 dark:border-gray-600" aria-label="Select all" />
                  </th>
                  <th className="py-2 text-left font-semibold">Path</th>
                  <th className="text-left font-semibold">Detected kind</th>
                  <th className="text-left font-semibold">Confidence</th>
                  <th className="text-left font-semibold">Size</th>
                  <th className="text-left font-semibold">Last commit</th>
                  <th className="pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Rows will list repository-relative paths with detection scores from the indexer. Expect pagination and
                    stable sort by path; binary assets may be omitted or summarized. No endpoint returns file rows yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && repo && tab === 'imports' && (
        <div className="space-y-4 px-6 py-6">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import history</h3>
              <fieldset disabled className="flex flex-wrap items-center gap-2 opacity-70">
                <select className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100">
                  <option>All projects</option>
                </select>
                <select className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100">
                  <option>All outcomes</option>
                </select>
              </fieldset>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">When</th>
                  <th className="text-left font-semibold">File · commit</th>
                  <th className="text-left font-semibold">Project · version</th>
                  <th className="text-left font-semibold">Outcome</th>
                  <th className="text-left font-semibold">By</th>
                  <th className="pr-4 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    This table needs import transactions referencing repository id, source path, commit SHA, destination
                    project/version, actor, and outcome codes. Wire the read API first, then enable filters and row
                    actions.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && repo && tab === 'settings' && (
        <div className="max-w-3xl space-y-4 px-6 py-6">
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="border-b border-gray-100 pb-2 text-sm font-semibold dark:border-gray-700 dark:text-gray-100">Source</h3>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Provider
                </label>
                <p className="mt-1 inline-flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  {repo.provider === 'github' ? <Github className="h-4 w-4" aria-hidden /> : <Globe className="h-4 w-4 text-indigo-500" />}
                  <span className="capitalize">{repo.provider.replace('_', ' ')}</span>
                  {repo.source === 'linked_account' ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">(linked account)</span>
                  ) : repo.source === 'public_url' ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">(public URL)</span>
                  ) : null}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Clone URL</label>
                <p className="mt-1 break-all font-mono text-xs text-gray-900 dark:text-gray-100">{repo.clone_url ?? '—'}</p>
                {webUrl ? (
                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400"
                  >
                    Open in browser →
                  </a>
                ) : null}
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Default branch
                </label>
                <Input readOnly value={repo.default_branch} className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Subpath glob (optional)
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Not stored on <span className="font-mono">tenant_repositories</span> yet; future column or child table to
                  limit scan roots.
                </p>
                <Input disabled placeholder="e.g. specs/**" className="mt-2 font-mono text-sm" />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="border-b border-gray-100 pb-2 text-sm font-semibold dark:border-gray-700 dark:text-gray-100">Scan cadence</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Scheduling + webhook secrets are product decisions: poll interval vs GitHub/GitLab push hooks. Persist on a
              repo settings extension once requirements settle.
            </p>
            <fieldset disabled className="grid grid-cols-1 gap-4 text-sm opacity-70 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Schedule</label>
                <select className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100">
                  <option>Not configured</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Webhook</label>
                <p className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                  Inactive — delivery logs will mirror webhook worker tables when added.
                </p>
              </div>
            </fieldset>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="border-b border-gray-100 pb-2 text-sm font-semibold dark:border-gray-700 dark:text-gray-100">
              Default importer mappings
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Maps glob → detected kind → default project/version hints for the import wizard. Requires persistence (likely
              JSON on repo settings or normalized mapping rows).
            </p>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <tr>
                  <th className="py-2 text-left font-semibold">Path glob</th>
                  <th className="text-left font-semibold">Detected kind</th>
                  <th className="text-left font-semibold">Default project</th>
                  <th className="text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    No mappings saved for this repository yet.
                  </td>
                </tr>
              </tbody>
            </table>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add mapping
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-800 dark:bg-rose-900/20">
            <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-200">Danger zone</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Soft-delete on <span className="font-mono">tenant_repositories</span> or hard delete with cascading scan/import
                rows — confirm product policy before exposing DELETE.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => toast.message('DELETE /v1/tenants/…/repositories/{id} is not implemented yet.')}
              >
                Remove repository
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
