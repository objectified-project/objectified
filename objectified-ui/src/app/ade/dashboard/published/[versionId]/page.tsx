'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Terminal,
  UsersRound,
  History,
  ArrowLeft,
  Eye,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getPublishedVersionDetail,
  updateVersionVisibility,
} from '../../../../../../lib/db/helper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Label } from '../../../../components/ui/Label';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { TooltipProvider } from '../../../../components/ui/Tooltip';
import { useDialog } from '../../../../components/providers/DialogProvider';
import {
  dashboardContentStackClass,
  dashboardMainClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { PublishedDetailHeader } from '../_internal/PublishedDetailHeader';
import { PublishedDetailHero } from '../_internal/PublishedDetailHero';
import { OverviewTab, type ViewKind } from '../_internal/OverviewTab';
import { DetailRightRail } from '../_internal/DetailRightRail';
import { CodeTab } from '../_internal/CodeTab';
import { ConsumersTab } from '../_internal/ConsumersTab';
import { ActivityTab } from '../_internal/ActivityTab';
import { decoratePublishedRow, fakeDetailBundle } from '../_internal/fixtures';
import type {
  PublishedVersionDetail,
  PublishedVersionLineageNode,
  PublishedVersionRow,
} from '../_internal/types';

type TabKey = 'overview' | 'code' | 'consumers' | 'activity';

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'code', label: 'Code', icon: Terminal },
  { key: 'consumers', label: 'Consumers', icon: UsersRound },
  { key: 'activity', label: 'Activity', icon: History },
];

const PublishedVersionDetailPage = () => {
  const router = useRouter();
  const params = useParams<{ versionId: string }>();
  const versionId = Array.isArray(params?.versionId) ? params.versionId[0] : params?.versionId;
  const { data: session } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();

  const [bundle, setBundle] = useState<PublishedVersionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [changingVisibility, setChangingVisibility] = useState(false);

  const [apiKeyDialog, setApiKeyDialog] = useState<{ kind: ViewKind } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const currentTenantId = (session?.user as { current_tenant_id?: string } | undefined)?.current_tenant_id;

  useEffect(() => {
    if (!currentTenantId || !versionId) {
      setBundle(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getPublishedVersionDetail(currentTenantId, versionId)
      .then((result) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(result) as
            | {
                success: true;
                row: PublishedVersionRow;
                lineage: {
                  parent: Omit<PublishedVersionLineageNode, 'meta'> | null;
                  child: Omit<PublishedVersionLineageNode, 'meta'> | null;
                };
              }
            | { success: false; error?: string };
          if (!parsed.success) {
            setBundle(null);
            return;
          }
          // Start from the fixture bundle (metrics, consumers, alerts,
          // top-ops, release notes, recent activity) then overlay the
          // real lineage neighbours from the DB. Self stays from the
          // fixture so it keeps its synthesised request/consumer meta.
          const fixture = fakeDetailBundle(parsed.row);
          setBundle({
            ...fixture,
            lineage: {
              parent: parsed.lineage.parent,
              self: fixture.lineage.self,
              child: parsed.lineage.child,
            },
          });
        } catch (error) {
          console.error('Failed to parse published version detail:', error);
          setBundle(null);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Failed to load published version detail:', error);
        setBundle(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTenantId, versionId]);

  /* ----------------------------- URL helpers ----------------------------- */

  const restApiBaseUrl = process.env.NEXT_PUBLIC_REST_API_BASE_URL || 'http://localhost:8000/v1';
  const accessPath = (row: PublishedVersionRow) =>
    `${row.tenant_slug}/${row.project_slug}/${row.version_id}`;
  const urlForKind = useMemo(
    () =>
      (row: PublishedVersionRow, kind: ViewKind): string => {
        const path = accessPath(row);
        switch (kind) {
          case 'open':
            return `${restApiBaseUrl}/schema/${path}`;
          case 'swagger':
            return `${restApiBaseUrl}/swagger/${path}`;
          case 'arazzo':
            return `${restApiBaseUrl}/arazzo/${path}`;
          case 'json':
            return `${restApiBaseUrl}/json/${path}`;
        }
      },
    [restApiBaseUrl],
  );

  const withApiKey = (baseUrl: string, key: string | undefined) => {
    if (!key?.trim()) return baseUrl;
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}api_key=${encodeURIComponent(key.trim())}`;
  };

  /* ----------------------------- handlers ----------------------------- */

  const handleCopyUrl = async (kind: ViewKind) => {
    if (!bundle) return;
    try {
      await navigator.clipboard.writeText(urlForKind(bundle.row, kind));
      toast.success('URL copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy URL.');
    }
  };

  const handleOpenView = (kind: ViewKind) => {
    if (!bundle) return;
    if (bundle.row.visibility === 'private') {
      setApiKeyInput('');
      setApiKeyDialog({ kind });
      return;
    }
    window.open(urlForKind(bundle.row, kind), '_blank', 'noopener,noreferrer');
  };

  const handleApiKeyDialogOpen = () => {
    if (!apiKeyDialog || !bundle) return;
    const url = urlForKind(bundle.row, apiKeyDialog.kind);
    window.open(withApiKey(url, apiKeyInput), '_blank', 'noopener,noreferrer');
    setApiKeyDialog(null);
    setApiKeyInput('');
  };

  const handleToggleVisibility = async () => {
    if (!bundle) return;
    const row = bundle.row;
    const next = row.visibility === 'public' ? 'private' : 'public';
    const confirmed = await confirmDialog({
      title: `Change Visibility to ${next.toUpperCase()}`,
      message:
        next === 'public'
          ? 'Change visibility to PUBLIC?\n\nThis will make the OpenAPI Specification available without an API Key.'
          : 'Change visibility to PRIVATE?\n\nThis will require an API Key for access.',
      variant: 'warning',
      confirmLabel: 'Change Visibility',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    try {
      setChangingVisibility(true);
      const result = await updateVersionVisibility(row.id, next);
      const response = JSON.parse(result) as { success: boolean; error?: string };
      if (response.success) {
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                row: { ...prev.row, visibility: next },
              }
            : prev,
        );
        toast.success(`Visibility changed to ${next}.`);
      } else {
        await alertDialog({
          message: `Failed to update visibility: ${response.error ?? 'unknown error'}`,
          variant: 'error',
        });
      }
    } catch (error) {
      console.error(error);
      await alertDialog({ message: 'An error occurred while updating visibility.', variant: 'error' });
    } finally {
      setChangingVisibility(false);
    }
  };

  const handleShowQr = () =>
    toast('QR generation lands in a follow-up.', {
      description: 'For now, copy the URL and use any QR generator.',
    });

  const handleShare = async () => {
    if (!bundle) return;
    try {
      await navigator.clipboard.writeText(urlForKind(bundle.row, 'open'));
      toast.success('Spec URL copied — share away.');
    } catch {
      toast.error('Failed to copy URL.');
    }
  };

  const handleEditNotes = () =>
    toast('Editable release notes lands in a follow-up.', {
      description: 'Phase 5 wires release-notes persistence.',
    });

  /* ----------------------------- render ----------------------------- */

  if (!currentTenantId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">No tenant selected</h2>
              <p className="text-amber-800 dark:text-amber-200 mb-4">
                Please select a tenant before viewing publication details.
              </p>
              <Button asChild>
                <Link href="/ade/dashboard/tenants">Go to Tenants</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState minHeightClassName="min-h-[400px]" message="Loading publication…" />;
  }

  if (!bundle) {
    return (
      <main className={dashboardMainClass}>
        <div className="max-w-2xl mx-auto">
          <Link
            href="/ade/dashboard/published"
            className="text-[11px] font-mono text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-300 inline-flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> All published versions
          </Link>
          <EmptyState
            icon={<Eye className="h-10 w-10" />}
            title="Publication not found"
            description="This version is not published in the current tenant, or you don't have access to it."
            action={
              <Button onClick={() => router.push('/ade/dashboard/published')}>
                Back to Published
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const { row, metrics, schema, topOperations, releaseNotes } = bundle;
  const decoration = decoratePublishedRow(row, metrics);

  return (
    <TooltipProvider>
      <PublishedDetailHeader
        row={row}
        decoration={decoration}
        schema={schema}
        onShowQr={handleShowQr}
        onShare={handleShare}
        onEditNotes={handleEditNotes}
        onToggleVisibility={changingVisibility ? undefined : handleToggleVisibility}
        onOpenSpec={() => handleOpenView('open')}
      />

      <main className={dashboardMainClass}>
        <div className={dashboardContentStackClass}>
          <PublishedDetailHero metrics={metrics} schema={schema} />

          <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-6 min-w-0">
              <div className="border-b border-gray-200 dark:border-gray-700 -mb-2">
                <nav role="tablist" className="flex items-center gap-1 flex-wrap">
                  {TABS.map(({ key, label, icon: Icon }) => {
                    const isActive = activeTab === key;
                    const count =
                      key === 'consumers'
                        ? bundle.consumers.length
                        : key === 'code'
                        ? 5
                        : null;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(key)}
                        className={`px-3 py-2.5 text-[13px] font-medium border-b-2 inline-flex items-center gap-1.5 transition-colors ${
                          isActive
                            ? 'text-indigo-600 dark:text-indigo-300 border-indigo-600 dark:border-indigo-400'
                            : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-indigo-600 dark:hover:text-indigo-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {label}
                        {count != null ? (
                          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 ml-1">{count}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  <span className="flex-1" />
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 px-2">
                    spec format · OpenAPI 3.1.0
                  </span>
                </nav>
              </div>

              {activeTab === 'overview' ? (
                <OverviewTab
                  row={row}
                  schema={schema}
                  topOperations={topOperations}
                  releaseNotes={releaseNotes}
                  urlForKind={urlForKind}
                  onOpenView={handleOpenView}
                  onCopyUrl={handleCopyUrl}
                  onShowQr={handleShowQr}
                />
              ) : activeTab === 'code' ? (
                <CodeTab
                  row={row}
                  specUrl={urlForKind(row, 'open')}
                  onCopySnippet={(lang) => toast.success(`${lang} snippet copied.`)}
                />
              ) : activeTab === 'consumers' ? (
                <ConsumersTab
                  consumers={bundle.consumers}
                  totalApiKeyCount={bundle.consumers.length}
                  manageKeysHref="/ade/dashboard/api-keys"
                />
              ) : (
                <ActivityTab activity={bundle.activity} />
              )}
            </div>

            <aside className="space-y-4 min-w-0">
              <DetailRightRail
                row={row}
                lineage={bundle.lineage}
                alerts={bundle.alerts}
                activity={bundle.activity}
                specUrl={urlForKind(row, 'open')}
                onToggleVisibility={changingVisibility ? undefined : handleToggleVisibility}
                onDownloadQr={() =>
                  toast('QR download lands in a follow-up.', {
                    description: 'For now, copy the URL and use any QR generator.',
                  })
                }
                onSeeAllActivity={() => setActiveTab('activity')}
                onSeeAllVersions={() => router.push(`/ade/dashboard/projects/${row.project_id}`)}
              />
            </aside>
          </section>
        </div>
      </main>

      <Dialog open={!!apiKeyDialog} onOpenChange={(open) => !open && setApiKeyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key required</DialogTitle>
            <DialogDescription>
              This version is private. Enter an API key to open with authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-input">API key</Label>
              <Input
                id="api-key-input"
                type="password"
                autoComplete="off"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && apiKeyInput.trim()) handleApiKeyDialogOpen();
                }}
                placeholder="sk_..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiKeyDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleApiKeyDialogOpen} disabled={!apiKeyInput.trim()}>
              Open with key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default PublishedVersionDetailPage;
