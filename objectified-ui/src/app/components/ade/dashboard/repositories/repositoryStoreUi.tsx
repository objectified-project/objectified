'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { GitBranch, Github, Gitlab, Globe, FileCode2 } from 'lucide-react';
import { SiBitbucket } from 'react-icons/si';
import { cn } from '@lib/utils';

export type RepositoryProvider = 'github' | 'gitlab' | 'bitbucket' | 'public_url';
export type RepositoryStatus = 'pending' | 'scanning' | 'ready' | 'error' | 'archived';

export interface DashboardRepository {
  id: string;
  name: string;
  full_name: string;
  description?: string | null;
  provider: RepositoryProvider;
  default_branch: string;
  visibility?: 'public' | 'private';
  status: RepositoryStatus;
  last_scanned_at?: string | null;
  total_files?: number | null;
  importable_count?: number | null;
}

export function repoInitials(name: string): string {
  const parts = name.replace(/[/_-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const compact = name.replace(/[^a-zA-Z0-9]/g, '');
  return compact.slice(0, 2).toUpperCase() || 'R';
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function RepositorySparkline({ seed, errorTint }: { seed: string; errorTint?: boolean }) {
  const h = hashSeed(seed);
  const heights = Array.from({ length: 8 }, (_, i) => 4 + ((h >> (i * 3)) % 14));
  return (
    <div className="flex h-5 items-end gap-[2px]">
      {heights.map((px, i) => (
        <span
          key={i}
          className={cn('inline-block w-[3px] rounded-sm', errorTint && i >= 5 ? 'bg-rose-400/70' : 'bg-indigo-400/70')}
          style={{ height: `${px}px` }}
        />
      ))}
    </div>
  );
}

export function repositoryStatusLabel(status: RepositoryStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'scanning':
      return 'Scanning';
    case 'ready':
      return 'Ready';
    case 'error':
      return 'Error';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
}

export function repositoryStatusClass(status: RepositoryStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'scanning':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
    case 'ready':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'error':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    case 'archived':
      return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function ProviderBadge({ provider }: { provider: RepositoryProvider }) {
  if (provider === 'github') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
        <Github className="h-3 w-3" aria-hidden />
        GitHub
      </span>
    );
  }
  if (provider === 'gitlab') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
        <Gitlab className="h-3 w-3 text-orange-500" aria-hidden />
        GitLab
      </span>
    );
  }
  if (provider === 'bitbucket') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
        <SiBitbucket className="h-3 w-3 text-sky-600" aria-hidden />
        Bitbucket
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
      <Globe className="h-3 w-3 text-indigo-500" aria-hidden />
      Public URL
    </span>
  );
}

const gradientForIndex = (i: number) => {
  const g = [
    'from-emerald-500 to-teal-500',
    'from-indigo-500 to-purple-500',
    'from-purple-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-cyan-500 to-blue-500',
  ];
  return g[i % g.length];
};

export function RepositoryCard({ repo, index }: { repo: DashboardRepository; index: number }) {
  const files = repo.total_files ?? 0;
  const importable = repo.importable_count;
  const scanLabel = formatLastScan(repo.last_scanned_at, repo.status === 'error');
  const grad = gradientForIndex(index);

  return (
    <div
      className={cn(
        'block rounded-xl border border-gray-200 bg-white p-5 transition-all duration-200 dark:border-gray-700 dark:bg-gray-800',
        'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/15'
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-mono text-xs font-bold text-white',
              grad
            )}
          >
            {repoInitials(repo.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{repo.name}</p>
            <p className="truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">{repo.full_name}</p>
          </div>
        </div>
        <span
          className={cn(
            'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            repositoryStatusClass(repo.status)
          )}
        >
          {repositoryStatusLabel(repo.status)}
        </span>
      </div>
      {repo.description ? (
        <p className="mb-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{repo.description}</p>
      ) : (
        <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">No description</p>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
        <ProviderBadge provider={repo.provider} />
        <span className="inline-flex items-center gap-1">
          <GitBranch className="h-3 w-3" aria-hidden />
          {repo.default_branch}
        </span>
        <span className="inline-flex items-center gap-1">
          <FileCode2 className="h-3 w-3" aria-hidden />
          {files.toLocaleString()} files
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono font-semibold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
            {importable != null ? `${importable} importable` : '— importable'}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500 dark:text-gray-400">{scanLabel}</span>
        </div>
        <RepositorySparkline seed={repo.id} errorTint={repo.status === 'error'} />
      </div>
    </div>
  );
}

export function formatLastScan(iso: string | null | undefined, failed: boolean): string {
  if (failed) return 'Scan failed';
  if (!iso) return 'Never scanned';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ManageLinkedAccountsLink() {
  return (
    <Link href="/ade/dashboard/linked-accounts" className="text-[11px] font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
      Manage linked accounts →
    </Link>
  );
}

export function SourceOptionCard({
  selected,
  icon,
  title,
  description,
  onSelect,
  radioName,
}: {
  selected: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
  radioName: string;
}) {
  return (
    <label
      className={cn(
        'cursor-pointer rounded-lg border-2 p-4 transition-colors',
        selected
          ? 'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-900/10'
          : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700 dark:hover:border-indigo-600'
      )}
    >
      <div className="flex items-start gap-3">
        <input type="radio" name={radioName} checked={selected} onChange={onSelect} className="mt-1" />
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            {icon}
            {title}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </label>
  );
}

export function LinkedAccountIcon({ provider }: { provider: string }) {
  const p = provider.toLowerCase();
  if (p === 'gitlab') return <Gitlab className="h-4 w-4 text-orange-500" aria-hidden />;
  if (p === 'bitbucket') return <SiBitbucket className="h-4 w-4 text-sky-600" aria-hidden />;
  return <Github className="h-4 w-4" aria-hidden />;
}
