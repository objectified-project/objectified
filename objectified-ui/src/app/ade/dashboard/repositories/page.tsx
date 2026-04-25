'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranchPlus, Search } from 'lucide-react';
import { SiGithub } from 'react-icons/si';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Alert } from '@/app/components/ui/Alert';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Skeleton } from '@/app/components/ui/Skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/Dialog';
import {
  dashboardContentStackClass,
  dashboardMainClass,
  dashboardPanelClass,
  dashboardTableWrapClass,
  dashboardTableTheadClass,
  dashboardTbodyClass,
  dashboardThClass,
  dashboardThRightClass,
  dashboardTrHoverClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { getRepositoriesI18nBundle } from './i18n';

interface LinkedAccount {
  id: string;
  provider: string;
  provider_username?: string;
  provider_email?: string;
}

interface RepoSummary {
  id: number;
  name: string;
  full_name: string;
  description?: string | null;
  default_branch?: string;
}

interface BranchItem {
  branch: string;
  subpathGlob: string;
  pollIntervalSec?: number;
}

interface RegisteredRepository {
  id: string;
  provider: string;
  owner: string;
  name: string;
  fullName: string;
  status: string;
  branches: string[];
  lastScanAt?: string | null;
}

function formatRepositoryStatus(status: string): string {
  if (status === 'archived') return 'Disabled';
  if (status === 'scan_in_progress') return 'Scan in progress';
  return status.replace(/_/g, ' ');
}

type RepositorySortField = 'name' | 'lastScan' | 'status';
type RepositorySortDirection = 'asc' | 'desc';

function formatLastScan(lastScanAt: string | null | undefined): string {
  if (!lastScanAt) return 'Never';
  return new Date(lastScanAt).toLocaleString();
}

function statusChipClass(status: string): string {
  if (status === 'healthy') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200';
  }
  if (status === 'warnings') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200';
  }
  if (status === 'error') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200';
  }
  if (status === 'scan_in_progress') {
    return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200';
  }
  if (status === 'archived') {
    return 'bg-slate-200 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

const RepositoriesPage = () => {
  const router = useRouter();
  const copy = getRepositoriesI18nBundle('en');

  const [repositories, setRepositories] = useState<RegisteredRepository[]>([]);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<RepositorySortField>('lastScan');
  const [sortDirection, setSortDirection] = useState<RepositorySortDirection>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LinkedAccount | null>(null);
  const [githubRepos, setGithubRepos] = useState<RepoSummary[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<RepoSummary | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<BranchItem[]>([]);
  const [customBranchPattern, setCustomBranchPattern] = useState('');
  const [manifest, setManifest] = useState('');
  const [isWizardBusy, setIsWizardBusy] = useState(false);

  const loadRepositories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/repositories');
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load repositories');
      }
      setRepositories(data.repositories || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load repositories';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRepositories();
  }, [loadRepositories]);

  const openWizard = async () => {
    setWizardOpen(true);
    setWizardStep(0);
    setSelectedAccount(null);
    setSelectedRepo(null);
    setGithubRepos([]);
    setBranches([]);
    setSelectedBranches([]);
    setCustomBranchPattern('');
    setManifest('');
    setRepoSearch('');
    setErrorMessage('');
    try {
      const response = await fetch('/api/linked-accounts');
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load linked accounts');
      }
      setLinkedAccounts((data.accounts || []).filter((account: LinkedAccount) => account.provider === 'github'));
    } catch {
      setLinkedAccounts([]);
    }
  };

  const loadReposForAccount = async (account: LinkedAccount) => {
    setSelectedAccount(account);
    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranches([]);
    setCustomBranchPattern('');
    setIsWizardBusy(true);
    try {
      const response = await fetch(`/api/sso/github/repos?accountId=${encodeURIComponent(account.id)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load repositories');
      }
      setGithubRepos(data.repositories || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load repositories';
      setErrorMessage(message);
    } finally {
      setIsWizardBusy(false);
    }
  };

  const loadBranchesForRepo = async (repo: RepoSummary) => {
    if (!selectedAccount) return;
    setSelectedRepo(repo);
    setIsWizardBusy(true);
    try {
      const response = await fetch(
        `/api/sso/github/branches?accountId=${encodeURIComponent(selectedAccount.id)}&repo=${encodeURIComponent(repo.full_name)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load branches');
      }
      const availableBranches = Array.isArray(data.branches) ? data.branches : [];
      const defaultBranchName =
        (typeof data.defaultBranch === 'string' && data.defaultBranch) || repo.default_branch || null;
      const defaultBranch =
        defaultBranchName && availableBranches.includes(defaultBranchName)
          ? [{ branch: defaultBranchName, subpathGlob: '**/*' }]
          : [];
      setBranches(availableBranches);
      setSelectedBranches(defaultBranch);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load branches';
      setErrorMessage(message);
    } finally {
      setIsWizardBusy(false);
    }
  };

  const filteredSourceRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return githubRepos;
    return githubRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(q) || (repo.description || '').toLowerCase().includes(q)
    );
  }, [githubRepos, repoSearch]);

  const providerOptions = useMemo(() => {
    return Array.from(new Set(repositories.map((repo) => repo.provider))).sort((a, b) => a.localeCompare(b));
  }, [repositories]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(repositories.map((repo) => repo.status))).sort((a, b) => a.localeCompare(b));
  }, [repositories]);

  const filteredAndSortedRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = repositories.filter((repo) => {
      const matchesSearch =
        q.length === 0 ||
        repo.fullName.toLowerCase().includes(q) ||
        repo.name.toLowerCase().includes(q) ||
        repo.owner.toLowerCase().includes(q);
      const matchesProvider = providerFilter === 'all' || repo.provider === providerFilter;
      const matchesStatus = statusFilter === 'all' || repo.status === statusFilter;
      return matchesSearch && matchesProvider && matchesStatus;
    });

    const sorted = [...filtered].sort((left, right) => {
      if (sortField === 'name') {
        return left.fullName.localeCompare(right.fullName);
      }
      if (sortField === 'status') {
        return formatRepositoryStatus(left.status).localeCompare(formatRepositoryStatus(right.status));
      }
      const leftStamp = left.lastScanAt ? Date.parse(left.lastScanAt) : 0;
      const rightStamp = right.lastScanAt ? Date.parse(right.lastScanAt) : 0;
      return leftStamp - rightStamp;
    });

    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [repositories, providerFilter, search, sortDirection, sortField, statusFilter]);

  const handleSort = (field: RepositorySortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection(field === 'lastScan' ? 'desc' : 'asc');
      return;
    }
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const triggerScanNow = async (repository: RegisteredRepository) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const fallbackBranch = repository.branches[0] || 'main';
      const response = await fetch(`/api/repositories/${repository.id}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: fallbackBranch, force: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to queue repository scan');
      }
      await loadRepositories();
      setSuccessMessage(copy.scanQueuedMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to queue repository scan';
      setErrorMessage(message);
    }
  };

  const togglePauseState = async (repository: RegisteredRepository) => {
    setErrorMessage('');
    setSuccessMessage('');
    const isArchived = repository.status === 'archived';
    const action = isArchived ? 'unarchive' : 'archive';
    try {
      const response = await fetch(`/api/repositories/${repository.id}/${action}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to ${isArchived ? 'resume' : 'pause'} repository`);
      }
      await loadRepositories();
      setSuccessMessage(isArchived ? copy.resumedMessage : copy.pausedMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${isArchived ? 'resume' : 'pause'} repository`;
      setErrorMessage(message);
    }
  };

  const toggleBranch = (branchName: string) => {
    setSelectedBranches((prev) => {
      const exists = prev.some((entry) => entry.branch === branchName);
      if (exists) {
        return prev.filter((entry) => entry.branch !== branchName);
      }
      return [...prev, { branch: branchName, subpathGlob: '**/*' }];
    });
  };

  const updateSubpath = (branchName: string, value: string) => {
    setSelectedBranches((prev) =>
      prev.map((entry) =>
        entry.branch === branchName
          ? { ...entry, subpathGlob: value }
          : entry
      )
    );
  };

  const updatePollInterval = (branchName: string, value: string) => {
    const next = Number.parseInt(value, 10);
    setSelectedBranches((prev) =>
      prev.map((entry) =>
        entry.branch === branchName
          ? { ...entry, pollIntervalSec: Number.isFinite(next) ? next : undefined }
          : entry
      )
    );
  };

  const addCustomBranch = () => {
    const branchPattern = customBranchPattern.trim();
    if (!branchPattern) return;
    setSelectedBranches((prev) => {
      if (prev.some((entry) => entry.branch === branchPattern)) {
        return prev;
      }
      return [...prev, { branch: branchPattern, subpathGlob: '**/*' }];
    });
    setCustomBranchPattern('');
  };

  const goNext = () => {
    if (wizardStep === 0 && !selectedAccount) {
      setErrorMessage(copy.accountRequired);
      return;
    }
    if (wizardStep === 1 && !selectedRepo) {
      setErrorMessage(copy.repoRequired);
      return;
    }
    if (wizardStep === 2 && selectedBranches.length === 0) {
      setErrorMessage(copy.branchesRequired);
      return;
    }
    setErrorMessage('');
    setWizardStep((step) => Math.min(step + 1, 3));
  };

  const submitRegistration = async () => {
    if (!selectedAccount || !selectedRepo || selectedBranches.length === 0) return;
    setIsWizardBusy(true);
    setErrorMessage('');
    try {
      const [owner, name] = selectedRepo.full_name.split('/');
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedAccountId: selectedAccount.id,
          provider: 'github',
          owner,
          name,
          branches: selectedBranches.map((branch) => ({
            branch: branch.branch.trim(),
            subpathGlob: branch.subpathGlob.trim() || undefined,
            pollIntervalSec: branch.pollIntervalSec,
          })),
          manifest: manifest.trim() ? manifest : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to register repository');
      }
      const normalizedRepository = {
        ...data.repository,
        branches: Array.isArray(data.repository?.branches)
          ? data.repository.branches
              .map((branch: string | { name?: string; branch?: string }) =>
                typeof branch === 'string' ? branch : branch?.name ?? branch?.branch,
              )
              .filter((branchName: unknown): branchName is string => typeof branchName === 'string')
          : [],
      };
      setWizardOpen(false);
      setSuccessMessage(copy.successMessage);
      setRepositories((prev) => [normalizedRepository, ...prev]);
      router.push(`/ade/dashboard/repositories/${data.repository.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register repository';
      setErrorMessage(message);
    } finally {
      setIsWizardBusy(false);
    }
  };

  const showNoLinkedAccountsPrompt = wizardStep === 0 && linkedAccounts.length === 0;
  const selectedCustomBranches = selectedBranches.filter(
    (entry) => !branches.includes(entry.branch)
  );

  return (
    <>
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <GitBranchPlus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                {copy.pageTitle}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{copy.pageSubtitle}</p>
            </div>
            <Button onClick={() => void openWizard()}>{copy.addRepositoryButton}</Button>
          </div>
        </div>
      </header>

      <main className={dashboardMainClass}>
        <div className={dashboardContentStackClass}>
          {successMessage && (
            <Alert variant="success" onClose={() => setSuccessMessage('')}>
              {successMessage}
            </Alert>
          )}
          {errorMessage && (
            <Alert variant="error" onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
          )}

          <section className={`${dashboardPanelClass} p-4`}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="pl-8"
                />
              </div>
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                aria-label={copy.tableProvider}
              >
                <option value="all">{copy.providerAll}</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label={copy.tableStatus}
              >
                <option value="all">{copy.statusAll}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatRepositoryStatus(status)}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section>
            {!isLoading && filteredAndSortedRepos.length === 0 ? (
              <EmptyState
                icon={<GitBranchPlus className="h-10 w-10" />}
                title={copy.emptyTitle}
                description={copy.emptyDescription}
                action={<Button onClick={() => void openWizard()}>{copy.emptyAction}</Button>}
              />
            ) : (
              <div className={dashboardTableWrapClass}>
                <table className="min-w-full">
                  <thead className={dashboardTableTheadClass}>
                    <tr>
                      <th className={dashboardThClass}>
                        <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1">
                          {copy.tableRepo}
                          {sortField === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : null}
                        </button>
                      </th>
                      <th className={dashboardThClass}>{copy.tableProvider}</th>
                      <th className={dashboardThClass}>{copy.tableBranches}</th>
                      <th className={dashboardThClass}>
                        <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1">
                          {copy.tableStatus}
                          {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : null}
                        </button>
                      </th>
                      <th className={dashboardThClass}>
                        <button type="button" onClick={() => handleSort('lastScan')} className="inline-flex items-center gap-1">
                          {copy.tableLastScan}
                          {sortField === 'lastScan' ? (sortDirection === 'asc' ? '↑' : '↓') : null}
                        </button>
                      </th>
                      <th className={dashboardThRightClass}>{copy.tableActions}</th>
                    </tr>
                  </thead>
                  <tbody className={dashboardTbodyClass}>
                    {isLoading
                      ? Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={`skeleton-${idx}`} className={dashboardTrHoverClass}>
                            <td className="px-6 py-4"><Skeleton className="h-4 w-52" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-6 w-28 rounded-full" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-8 w-60" /></td>
                          </tr>
                        ))
                      : filteredAndSortedRepos.map((repo) => (
                          <tr key={repo.id} className={dashboardTrHoverClass}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {repo.fullName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 capitalize">
                              {repo.provider}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                              {(repo.branches || []).join(', ')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusChipClass(repo.status)}`}>
                                {formatRepositoryStatus(repo.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                              {formatLastScan(repo.lastScanAt)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => void triggerScanNow(repo)}>
                                  {copy.scanNowButton}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => void togglePauseState(repo)}>
                                  {repo.status === 'archived' ? copy.resumeButton : copy.pauseButton}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => router.push(`/ade/dashboard/repositories/${repo.id}`)}
                                >
                                  {copy.openDetailButton}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.wizardTitle}</DialogTitle>
            <DialogDescription>{copy.wizardDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {wizardStep === 0 && (
              <div className="space-y-3">
                {!showNoLinkedAccountsPrompt ? (
                  <p className="text-sm font-medium">{copy.stepAccountTitle}</p>
                ) : null}
                {linkedAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => void loadReposForAccount(account)}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${
                      selectedAccount?.id === account.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <SiGithub className="h-4 w-4" />
                      <span className="text-sm">{account.provider_username || account.provider_email}</span>
                    </div>
                  </button>
                ))}
                {linkedAccounts.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {copy.noLinkedAccountsQuestion}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setWizardOpen(false);
                          router.push('/ade/dashboard/linked-accounts');
                        }}
                      >
                        {copy.yesButton}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setWizardOpen(false)}
                      >
                        {copy.noButton}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {wizardStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{copy.stepRepoTitle}</p>
                <Input
                  value={repoSearch}
                  onChange={(event) => setRepoSearch(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                />
                <div className="max-h-44 overflow-auto space-y-2">
                  {filteredSourceRepos.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => void loadBranchesForRepo(repo)}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        selectedRepo?.id === repo.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{repo.full_name}</div>
                      {repo.description ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{repo.description}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
                {selectedRepo?.default_branch ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {copy.defaultBranchLabel}: <span className="font-medium">{selectedRepo.default_branch}</span>
                  </p>
                ) : null}
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{copy.stepBranchesTitle}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{copy.availableBranchesLabel}</p>
                <div className="max-h-52 overflow-auto space-y-2">
                  {branches.map((branchName) => {
                    const selected = selectedBranches.find((entry) => entry.branch === branchName);
                    return (
                      <div key={branchName} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(selected)}
                            onChange={() => toggleBranch(branchName)}
                          />
                          {branchName}
                        </label>
                        {selected ? (
                          <div className="space-y-2 mt-2">
                            <Input
                              placeholder={copy.branchSubpathPlaceholder}
                              value={selected.subpathGlob}
                              onChange={(event) => updateSubpath(branchName, event.target.value)}
                            />
                            <Input
                              type="number"
                              min={15}
                              max={86400}
                              placeholder={copy.pollIntervalPlaceholder}
                              value={selected.pollIntervalSec ?? ''}
                              onChange={(event) => updatePollInterval(branchName, event.target.value)}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <p className="text-sm font-medium">{copy.addBranchPatternLabel}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={customBranchPattern}
                      onChange={(event) => setCustomBranchPattern(event.target.value)}
                      placeholder={copy.branchPatternPlaceholder}
                    />
                    <Button type="button" variant="outline" onClick={addCustomBranch}>
                      {copy.addPatternButton}
                    </Button>
                  </div>
                </div>
                {selectedCustomBranches.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomBranches.map((branch) => (
                      <div key={branch.branch} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{branch.branch}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => toggleBranch(branch.branch)}
                          >
                            {copy.removeButton}
                          </Button>
                        </div>
                        <Input
                          placeholder={copy.branchSubpathPlaceholder}
                          value={branch.subpathGlob}
                          onChange={(event) => updateSubpath(branch.branch, event.target.value)}
                        />
                        <Input
                          type="number"
                          min={15}
                          max={86400}
                          placeholder={copy.pollIntervalPlaceholder}
                          value={branch.pollIntervalSec ?? ''}
                          onChange={(event) => updatePollInterval(branch.branch, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{copy.stepManifestTitle}</p>
                <textarea
                  value={manifest}
                  onChange={(event) => setManifest(event.target.value)}
                  className="w-full min-h-40 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm bg-white dark:bg-gray-900"
                  placeholder={copy.manifestPlaceholder}
                />
              </div>
            )}
          </div>

          {!showNoLinkedAccountsPrompt ? (
            <DialogFooter>
              <Button variant="outline" onClick={() => setWizardOpen(false)} disabled={isWizardBusy}>
                {copy.wizardCancel}
              </Button>
              {wizardStep > 0 ? (
                <Button variant="outline" onClick={() => setWizardStep((step) => step - 1)} disabled={isWizardBusy}>
                  {copy.wizardBack}
                </Button>
              ) : null}
              {wizardStep < 3 ? (
                <Button onClick={goNext} disabled={isWizardBusy}>
                  {copy.wizardNext}
                </Button>
              ) : (
                <Button onClick={() => void submitRegistration()} disabled={isWizardBusy}>
                  {copy.wizardSubmit}
                </Button>
              )}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RepositoriesPage;
