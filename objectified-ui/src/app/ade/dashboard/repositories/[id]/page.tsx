'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GitBranchPlus, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Alert } from '@/app/components/ui/Alert';
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
  provider: string;
  owner: string;
  name: string;
  fullName: string;
  status: string;
  branches: Array<{ branch: string; subpathGlob?: string }>;
  timeline: RepositoryTimelineItem[];
}

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const copy = getRepositoriesI18nBundle('en');
  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
        setRepository(data.repository);
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
                      </li>
                    ))}
                  </ul>
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
