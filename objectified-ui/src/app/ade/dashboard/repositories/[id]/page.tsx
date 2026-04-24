'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GitBranchPlus, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Alert } from '@/app/components/ui/Alert';
import { Input } from '@/app/components/ui/Input';
import { dashboardContentStackClass, dashboardMainClass, dashboardPanelClass } from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { getRepositoriesI18nBundle } from '../i18n';

interface RepositoryTimelineItem {
  id: string;
  type: string;
  status: string;
  message: string;
  createdAt: string;
}

interface RepositoryDetail {
  id: string;
  linkedAccountId: string;
  provider: string;
  owner: string;
  name: string;
  fullName: string;
  status: string;
  branches: Array<{ branch: string; subpathGlob?: string; pollIntervalSec?: number }>;
  timeline: RepositoryTimelineItem[];
}

interface BranchRow {
  branch: string;
  subpathGlob: string;
  pollIntervalSec?: number;
}

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const copy = getRepositoriesI18nBundle('en');
  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [branchRows, setBranchRows] = useState<BranchRow[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [customBranchPattern, setCustomBranchPattern] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const updateSubpath = (branchName: string, next: string) => {
    setBranchRows((prev) =>
      prev.map((row) => (row.branch === branchName ? { ...row, subpathGlob: next } : row))
    );
  };

  const updatePollInterval = (branchName: string, next: string) => {
    const normalized = Number.parseInt(next, 10);
    setBranchRows((prev) =>
      prev.map((row) =>
        row.branch === branchName
          ? { ...row, pollIntervalSec: Number.isFinite(normalized) ? normalized : undefined }
          : row
      )
    );
  };

  const removeBranch = (branchName: string) => {
    setBranchRows((prev) => prev.filter((row) => row.branch !== branchName));
  };

  const addBranch = (branchName: string) => {
    const normalized = branchName.trim();
    if (!normalized) return;
    setBranchRows((prev) => {
      if (prev.some((row) => row.branch === normalized)) {
        return prev;
      }
      return [...prev, { branch: normalized, subpathGlob: '**/*' }];
    });
  };

  const saveBranches = async () => {
    if (!repository || branchRows.length === 0) {
      setErrorMessage(copy.branchesRequired);
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await fetch(`/api/repositories/${repository.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branches: branchRows.map((row) => ({
            branch: row.branch.trim(),
            subpathGlob: row.subpathGlob.trim() || undefined,
            pollIntervalSec: row.pollIntervalSec,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update branches');
      }
      const updatedRepository = data.repository as RepositoryDetail;
      setRepository(updatedRepository);
      setBranchRows(
        (updatedRepository.branches || []).map((branch) => ({
          branch: branch.branch,
          subpathGlob: branch.subpathGlob || '**/*',
          pollIntervalSec: branch.pollIntervalSec,
        }))
      );
      setSuccessMessage('Repository branches updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update branches';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const loadRepository = async () => {
      if (!params?.id) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/repositories/${params.id}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load repository');
        }
        const loadedRepository = data.repository as RepositoryDetail;
        setRepository(loadedRepository);
        setBranchRows(
          (loadedRepository.branches || []).map((branch) => ({
            branch: branch.branch,
            subpathGlob: branch.subpathGlob || '**/*',
            pollIntervalSec: branch.pollIntervalSec,
          }))
        );
        if (loadedRepository.linkedAccountId && loadedRepository.fullName) {
          const branchesResponse = await fetch(
            `/api/sso/github/branches?accountId=${encodeURIComponent(loadedRepository.linkedAccountId)}&repo=${encodeURIComponent(loadedRepository.fullName)}`
          );
          const branchesData = await branchesResponse.json();
          if (branchesResponse.ok && Array.isArray(branchesData.branches)) {
            setAvailableBranches(branchesData.branches);
          } else {
            setAvailableBranches([]);
          }
        } else {
          setAvailableBranches([]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load repository';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };
    void loadRepository();
  }, [params?.id]);

  return (
    <>
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <GitBranchPlus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                {repository?.fullName || copy.pageTitle}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{copy.scanTimelineMessage}</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/ade/dashboard/repositories')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {copy.backButton}
            </Button>
          </div>
        </div>
      </header>

      <main className={dashboardMainClass}>
        <div className={dashboardContentStackClass}>
          {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {copy.loadingRepository}
            </div>
          ) : null}
          {repository ? (
            <>
              <section className={`${dashboardPanelClass} p-5`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">{copy.providerLabel}</div>
                    <div className="font-medium capitalize">{repository.provider}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">{copy.statusLabel}</div>
                    <div className="font-medium">{repository.status}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">{copy.branchesLabel}</div>
                  <ul className="space-y-1 text-sm">
                    {repository.branches.map((branch) => (
                      <li key={branch.branch}>
                        <span className="font-medium">{branch.branch}</span>
                        {branch.subpathGlob ? ` (${branch.subpathGlob})` : ''}
                        {branch.pollIntervalSec ? ` · ${branch.pollIntervalSec}s` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className={`${dashboardPanelClass} p-5 space-y-3`}>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{copy.stepBranchesTitle}</h3>
                {availableBranches.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {availableBranches.map((branchName) => (
                      <Button
                        key={branchName}
                        type="button"
                        size="sm"
                        variant={branchRows.some((row) => row.branch === branchName) ? 'secondary' : 'outline'}
                        onClick={() =>
                          branchRows.some((row) => row.branch === branchName)
                            ? removeBranch(branchName)
                            : addBranch(branchName)
                        }
                      >
                        {branchName}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <p className="text-sm font-medium">{copy.addBranchPatternLabel}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={customBranchPattern}
                      onChange={(event) => setCustomBranchPattern(event.target.value)}
                      placeholder={copy.branchPatternPlaceholder}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        addBranch(customBranchPattern);
                        setCustomBranchPattern('');
                      }}
                    >
                      {copy.addPatternButton}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {branchRows.map((branch) => (
                    <div key={branch.branch} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{branch.branch}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => removeBranch(branch.branch)}>
                          {copy.removeButton}
                        </Button>
                      </div>
                      <Input
                        value={branch.subpathGlob}
                        placeholder={copy.branchSubpathPlaceholder}
                        onChange={(event) => updateSubpath(branch.branch, event.target.value)}
                      />
                      <Input
                        type="number"
                        min={15}
                        max={86400}
                        value={branch.pollIntervalSec ?? ''}
                        placeholder={copy.pollIntervalPlaceholder}
                        onChange={(event) => updatePollInterval(branch.branch, event.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => void saveBranches()} disabled={isSaving || branchRows.length === 0}>
                    {isSaving ? copy.savingButton : copy.saveBranchesButton}
                  </Button>
                </div>
              </section>

              <section className={`${dashboardPanelClass} p-5`}>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{copy.timelineLabel}</h3>
                <ul className="space-y-2">
                  {repository.timeline.map((event) => (
                    <li key={event.id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                      <div className="text-sm font-medium">{event.message}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
