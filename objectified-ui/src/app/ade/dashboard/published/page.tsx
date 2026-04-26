'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Eye,
  Lock,
  Globe,
  Search,
  LayoutGrid,
  List,
  Download,
  BellPlus,
  AlertOctagon,
  Sparkles,
  Snowflake,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getPublishedVersionsForTenant,
  updateVersionVisibility,
  getApiKeysForTenant,
} from '../../../../../lib/db/helper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { LoadingState } from '../../../components/ui/LoadingState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TooltipProvider } from '../../../components/ui/Tooltip';
import { useDialog } from '../../../components/providers/DialogProvider';
import {
  dashboardContentStackClass,
  dashboardMainClass,
  dashboardPanelClass,
  publishedHeaderShellClass,
  publishedHeaderIconTileClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { PublishedKpiBand } from './PublishedKpiBand';
import { PublishedCatalogBanner } from './PublishedCatalogBanner';
import { PublishedTable, type ViewKind } from './PublishedTable';
import {
  PublishedCardsAlternate,
  PublishedCardsGrid,
} from './PublishedCardsAlternate';
import {
  decoratePublishedRow,
  fakeMetricsForVersion,
} from './_internal/fixtures';
import type {
  PublishedRowDecoration,
  PublishedVersionMetrics,
  PublishedVersionRow,
} from './_internal/types';

interface ApiKeySummary {
  id: string;
  enabled: boolean;
  expires_at: string | null;
}

type FilterKey = 'all' | 'public' | 'private' | 'hot' | 'stale' | 'errors';
type LayoutMode = 'table' | 'cards';

const FILTER_DEFS: Array<{
  key: FilterKey;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'all', label: 'All', Icon: List },
  { key: 'public', label: 'Public', Icon: Globe },
  { key: 'private', label: 'Private', Icon: Lock },
  { key: 'hot', label: 'Top used', Icon: Sparkles },
  { key: 'stale', label: 'Stale', Icon: Snowflake },
  { key: 'errors', label: 'Errors > 1%', Icon: AlertOctagon },
];

const PublishedVersions = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();

  const [versions, setVersions] = useState<PublishedVersionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [layout, setLayout] = useState<LayoutMode>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [changingVisibility, setChangingVisibility] = useState<string | null>(null);

  const [apiKeyDialog, setApiKeyDialog] = useState<{
    row: PublishedVersionRow;
    kind: ViewKind;
  } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const currentTenantId = (session?.user as { current_tenant_id?: string } | undefined)?.current_tenant_id;

  const isApiKeyExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };
  const enabledApiKeys = apiKeys.filter((k) => k.enabled && !isApiKeyExpired(k.expires_at));
  const hasEnabledApiKey = enabledApiKeys.length > 0;

  useEffect(() => {
    if (!currentTenantId) {
      setVersions([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getPublishedVersionsForTenant(currentTenantId)
      .then((result) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(result) as PublishedVersionRow[];
          setVersions(parsed);
        } catch (error) {
          console.error('Failed to parse published versions:', error);
          setVersions([]);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Failed to load published versions:', error);
        setVersions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTenantId]);

  useEffect(() => {
    if (!currentTenantId) {
      setApiKeys([]);
      return;
    }
    let cancelled = false;
    getApiKeysForTenant(currentTenantId).then((result) => {
      if (cancelled) return;
      try {
        const keys = JSON.parse(result) as ApiKeySummary[];
        setApiKeys(keys);
      } catch {
        setApiKeys([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentTenantId]);

  /* ----------------------------- derived data ----------------------------- */

  const metricsById = useMemo(() => {
    const map = new Map<string, PublishedVersionMetrics>();
    for (const row of versions) map.set(row.id, fakeMetricsForVersion(row));
    return map;
  }, [versions]);

  const decorationsById = useMemo(() => {
    const map = new Map<string, PublishedRowDecoration>();
    for (const row of versions) {
      const m = metricsById.get(row.id);
      if (!m) continue;
      map.set(row.id, decoratePublishedRow(row, m));
    }
    return map;
  }, [versions, metricsById]);

  const filteredVersions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return versions.filter((row) => {
      if (q) {
        const haystack = [
          row.project_name,
          row.version_id,
          row.description ?? '',
          row.tenant_name,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      switch (filter) {
        case 'public':
          return row.visibility === 'public';
        case 'private':
          return row.visibility === 'private';
        case 'hot':
          return decorationsById.get(row.id)?.state === 'hot';
        case 'stale':
          return decorationsById.get(row.id)?.state === 'stale';
        case 'errors': {
          const m = metricsById.get(row.id);
          return !!m && m.errorRate > 0.01;
        }
        default:
          return true;
      }
    });
  }, [versions, searchQuery, filter, decorationsById, metricsById]);

  /* ----------------------------- URL helpers ----------------------------- */

  const restApiBaseUrl = process.env.NEXT_PUBLIC_REST_API_BASE_URL || 'http://localhost:8000/v1';

  const accessPath = (row: PublishedVersionRow) =>
    `${row.tenant_slug}/${row.project_slug}/${row.version_id}`;
  const fullSchemaUrl = (row: PublishedVersionRow) =>
    `${restApiBaseUrl}/schema/${accessPath(row)}`;
  const fullSwaggerUrl = (row: PublishedVersionRow) =>
    `${restApiBaseUrl}/swagger/${accessPath(row)}`;
  const fullArazzoUrl = (row: PublishedVersionRow) =>
    `${restApiBaseUrl}/arazzo/${accessPath(row)}`;
  const fullJsonUrl = (row: PublishedVersionRow) =>
    `${restApiBaseUrl}/json/${accessPath(row)}`;
  const tablePathFor = (row: PublishedVersionRow) => `schema/${accessPath(row)}`;

  const urlForKind = (row: PublishedVersionRow, kind: ViewKind) => {
    switch (kind) {
      case 'open':
        return fullSchemaUrl(row);
      case 'swagger':
        return fullSwaggerUrl(row);
      case 'arazzo':
        return fullArazzoUrl(row);
      case 'json':
        return fullJsonUrl(row);
    }
  };

  const withApiKey = (baseUrl: string, key: string | undefined) => {
    if (!key?.trim()) return baseUrl;
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}api_key=${encodeURIComponent(key.trim())}`;
  };

  const catalogUrl = useMemo(() => {
    if (versions.length === 0) return `${restApiBaseUrl}/catalog`;
    return `${restApiBaseUrl}/catalog/${versions[0].tenant_slug}`;
  }, [versions, restApiBaseUrl]);

  /* ----------------------------- row actions ----------------------------- */

  const handleCopyUrl = async (row: PublishedVersionRow) => {
    try {
      await navigator.clipboard.writeText(fullSchemaUrl(row));
      toast.success('Published API URL copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy URL to clipboard.');
    }
  };

  const handleOpenView = (row: PublishedVersionRow, kind: ViewKind) => {
    if (row.visibility === 'private') {
      setApiKeyInput('');
      setApiKeyDialog({ row, kind });
      return;
    }
    window.open(urlForKind(row, kind), '_blank', 'noopener,noreferrer');
  };

  const handleApiKeyDialogOpen = () => {
    if (!apiKeyDialog) return;
    const url = urlForKind(apiKeyDialog.row, apiKeyDialog.kind);
    window.open(withApiKey(url, apiKeyInput), '_blank', 'noopener,noreferrer');
    setApiKeyDialog(null);
    setApiKeyInput('');
  };

  const handleToggleVisibility = async (row: PublishedVersionRow) => {
    const newVisibility = row.visibility === 'public' ? 'private' : 'public';
    const confirmed = await confirmDialog({
      title: `Change Visibility to ${newVisibility.toUpperCase()}`,
      message:
        newVisibility === 'public'
          ? 'Change visibility to PUBLIC?\n\nThis will make the OpenAPI Specification available without an API Key.'
          : 'Change visibility to PRIVATE?\n\nThis will require an API Key for access.',
      variant: 'warning',
      confirmLabel: 'Change Visibility',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    try {
      setChangingVisibility(row.id);
      const result = await updateVersionVisibility(row.id, newVisibility);
      const response = JSON.parse(result) as { success: boolean; error?: string };
      if (response.success) {
        setVersions((prev) =>
          prev.map((v) => (v.id === row.id ? { ...v, visibility: newVisibility } : v)),
        );
        toast.success(`Visibility changed to ${newVisibility}.`);
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
      setChangingVisibility(null);
    }
  };

  const handleShowQr = () => {
    toast('QR generation lands in a follow-up.', {
      description: 'For now, copy the URL and use any QR generator.',
    });
  };

  const handleCopyCurl = async (row: PublishedVersionRow) => {
    const command =
      row.visibility === 'private'
        ? `curl "${fullSchemaUrl(row)}" \\\n  -H "Accept: application/yaml" \\\n  -H "X-API-Key: $OBJECTIFIED_API_KEY"`
        : `curl "${fullSchemaUrl(row)}" \\\n  -H "Accept: application/yaml"`;
    try {
      await navigator.clipboard.writeText(command);
      toast.success('cURL copied to clipboard.');
    } catch {
      toast.error('Failed to copy cURL to clipboard.');
    }
  };

  const handleUnpublish = async (row: PublishedVersionRow) => {
    const confirmed = await confirmDialog({
      title: 'Unpublish version?',
      message: `Unpublishing v${row.version_id} of ${row.project_name} will hide it from the catalog and stop serving the spec to consumers.`,
      variant: 'warning',
      confirmLabel: 'Unpublish',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    toast('Unpublish flow lands in a follow-up.', {
      description: 'The full unpublish-with-consumer-impact dialog is part of Phase 5.',
    });
  };

  const handleOpenDetail = (row: PublishedVersionRow) => {
    router.push(`/ade/dashboard/published/${row.id}`);
  };

  /* ----------------------------- bulk actions ----------------------------- */

  const handleBulkVisibility = async (target: 'public' | 'private') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = await confirmDialog({
      title: `Make ${ids.length} ${ids.length === 1 ? 'version' : 'versions'} ${target}`,
      message:
        target === 'public'
          ? 'Selected versions will be served without an API key.'
          : 'Selected versions will require an API key for access.',
      variant: 'warning',
      confirmLabel: `Make ${target}`,
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    let okCount = 0;
    for (const id of ids) {
      try {
        const result = await updateVersionVisibility(id, target);
        const response = JSON.parse(result) as { success: boolean };
        if (response.success) okCount += 1;
      } catch (error) {
        console.error('bulk visibility failed for', id, error);
      }
    }
    if (okCount > 0) {
      setVersions((prev) =>
        prev.map((v) => (selectedIds.has(v.id) ? { ...v, visibility: target } : v)),
      );
      toast.success(`Updated ${okCount} of ${ids.length}.`);
    } else {
      toast.error('No versions could be updated.');
    }
    setSelectedIds(new Set());
  };

  const handleBulkCopyUrls = async () => {
    const urls = Array.from(selectedIds)
      .map((id) => versions.find((v) => v.id === id))
      .filter((v): v is PublishedVersionRow => !!v)
      .map(fullSchemaUrl)
      .join('\n');
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls);
      toast.success(`Copied ${selectedIds.size} URL${selectedIds.size === 1 ? '' : 's'}.`);
    } catch {
      toast.error('Failed to copy URLs to clipboard.');
    }
  };

  const handleBulkExport = () => {
    const rows = Array.from(selectedIds)
      .map((id) => versions.find((v) => v.id === id))
      .filter((v): v is PublishedVersionRow => !!v);
    if (rows.length === 0) return;
    const header = 'project,version,visibility,access_url,published_at\n';
    const csv =
      header +
      rows
        .map((r) =>
          [r.project_name, r.version_id, r.visibility, fullSchemaUrl(r), r.published_at]
            .map(csvCell)
            .join(','),
        )
        .join('\n');
    triggerDownload(csv, 'published-versions.csv');
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} as CSV.`);
  };

  /* ----------------------------- tenant gate ----------------------------- */

  if (!currentTenantId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-full blur-3xl opacity-60" />
          <div className="relative bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">No tenant selected</h2>
                <p className="text-amber-800 dark:text-amber-200 mb-4">
                  Please select a tenant before managing publications.
                </p>
                <Button asChild>
                  <a href="/ade/dashboard/tenants">Go to Tenants</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------- render ----------------------------- */

  const tenantName = versions[0]?.tenant_name ?? 'this tenant';
  const publicCount = versions.filter((v) => v.visibility === 'public').length;

  const showResultsBlock = !isLoading && versions.length > 0;

  return (
    <TooltipProvider>
      <header className={publishedHeaderShellClass}>
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className={publishedHeaderIconTileClass}>
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                API portal · {tenantName}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Published</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 max-w-2xl">
                Live API specs serving consumers — operational health, visibility, and access at a glance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkExport}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                toast('Subscribe-to-changes lands in a follow-up.', {
                  description: 'Webhook + email digests for visibility flips and new publications.',
                })
              }
            >
              <BellPlus className="w-3.5 h-3.5" /> Subscribe
            </Button>
          </div>
        </div>
      </header>

      <main className={dashboardMainClass}>
        <div className={dashboardContentStackClass}>
          {showResultsBlock ? (
            <PublishedCatalogBanner
              tenantName={tenantName}
              publicCount={publicCount}
              catalogUrl={catalogUrl}
              onShowQr={() =>
                toast('QR generation lands in a follow-up.', {
                  description: 'For now, copy the URL and use any QR generator.',
                })
              }
              onOpenSettings={() =>
                toast('Catalog settings lands in a follow-up.', {
                  description: 'Custom domain, branding, terms, hidden tags.',
                })
              }
            />
          ) : null}

          {showResultsBlock ? (
            <PublishedKpiBand
              versions={versions}
              metricsById={metricsById}
              enabledApiKeyCount={enabledApiKeys.length}
              totalApiKeyCount={apiKeys.length}
            />
          ) : null}

          {showResultsBlock ? (
            <div className={`${dashboardPanelClass} px-3 py-2 flex items-center gap-2 flex-wrap`}>
              <div className="relative flex-1 min-w-[16rem]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by project, version, or description…"
                  className="pl-9 h-9"
                />
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {FILTER_DEFS.map(({ key, label, Icon }) => {
                  const active = filter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`h-7 px-2 rounded-md text-[11px] font-medium inline-flex items-center gap-1 border transition-colors ${
                        active
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700/60'
                          : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                      }`}
                    >
                      <Icon className="w-3 h-3" /> {label}
                    </button>
                  );
                })}
              </div>

              <span className="hidden md:block w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" aria-hidden="true" />

              <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setLayout('cards')}
                  className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 transition-colors ${
                    layout === 'cards'
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-medium'
                      : 'text-gray-500 hover:text-indigo-500'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Cards
                </button>
                <button
                  type="button"
                  onClick={() => setLayout('table')}
                  className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 transition-colors ${
                    layout === 'table'
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-medium'
                      : 'text-gray-500 hover:text-indigo-500'
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> Table
                </button>
              </div>
            </div>
          ) : null}

          {selectedIds.size > 0 ? (
            <div className="rounded-lg border border-indigo-300 dark:border-indigo-700/70 bg-indigo-50/70 dark:bg-indigo-500/10 px-3 py-2 flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-medium text-indigo-700 dark:text-indigo-300">
                {selectedIds.size} selected
              </span>
              <span className="w-px h-5 bg-indigo-200 dark:bg-indigo-700/50" aria-hidden="true" />
              <Button size="sm" variant="outline" className="gap-1" onClick={() => handleBulkVisibility('public')}>
                <Globe className="w-3 h-3" /> Make public
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => handleBulkVisibility('private')}>
                <Lock className="w-3 h-3" /> Make private
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={handleBulkCopyUrls}>
                Copy URLs
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={handleBulkExport}>
                <Download className="w-3 h-3" /> Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 ml-auto text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-700/50 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                onClick={() => setSelectedIds(new Set())}
              >
                <XCircle className="w-3 h-3" /> Clear
              </Button>
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState minHeightClassName="min-h-[400px]" message="Loading published versions…" />
          ) : versions.length === 0 ? (
            <EmptyState
              icon={<Eye className="h-10 w-10" />}
              title="No published versions"
              description="You don't have any published versions yet. Publish a version to make it available via API."
            />
          ) : filteredVersions.length === 0 ? (
            <EmptyState
              icon={<Search className="h-10 w-10" />}
              title="No matching versions"
              description="No published versions match your search or filter selection."
              variant="compact"
              showOrbs={false}
              iconContainerClassName="from-gray-400 to-gray-500 shadow-gray-500/30"
            />
          ) : layout === 'table' ? (
            <>
              <PublishedTable
                versions={filteredVersions}
                metricsById={metricsById}
                decorationsById={decorationsById}
                selectedIds={selectedIds}
                onSelectedChange={setSelectedIds}
                onOpenDetail={handleOpenDetail}
                onCopyUrl={handleCopyUrl}
                onOpenView={handleOpenView}
                onToggleVisibility={(row) => {
                  if (changingVisibility === row.id) return;
                  void handleToggleVisibility(row);
                }}
                onShowQr={handleShowQr}
                onCopyCurl={handleCopyCurl}
                onUnpublish={handleUnpublish}
                pathFor={tablePathFor}
              />
              <PublishedCardsAlternate
                versions={filteredVersions}
                metricsById={metricsById}
                decorationsById={decorationsById}
                onOpenDetail={handleOpenDetail}
                onCopyUrl={handleCopyUrl}
                onOpenView={handleOpenView}
                onToggleVisibility={(row) => {
                  if (changingVisibility === row.id) return;
                  void handleToggleVisibility(row);
                }}
                pathFor={tablePathFor}
              />
            </>
          ) : (
            <>
              <PublishedCardsGrid
                versions={filteredVersions}
                metricsById={metricsById}
                decorationsById={decorationsById}
                onOpenDetail={handleOpenDetail}
                onCopyUrl={handleCopyUrl}
                onOpenView={handleOpenView}
                onToggleVisibility={(row) => {
                  if (changingVisibility === row.id) return;
                  void handleToggleVisibility(row);
                }}
                pathFor={tablePathFor}
              />
              <details className={`${dashboardPanelClass} group`}>
                <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                  <span className="font-semibold">Table view</span>
                  <span className="font-mono text-[11px] text-gray-400">— same data, dense table layout</span>
                </summary>
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  <PublishedTable
                    versions={filteredVersions}
                    metricsById={metricsById}
                    decorationsById={decorationsById}
                    selectedIds={selectedIds}
                    onSelectedChange={setSelectedIds}
                    onOpenDetail={handleOpenDetail}
                    onCopyUrl={handleCopyUrl}
                    onOpenView={handleOpenView}
                    onToggleVisibility={(row) => {
                      if (changingVisibility === row.id) return;
                      void handleToggleVisibility(row);
                    }}
                    onShowQr={handleShowQr}
                    onCopyCurl={handleCopyCurl}
                    onUnpublish={handleUnpublish}
                    pathFor={tablePathFor}
                  />
                </div>
              </details>
            </>
          )}
        </div>
      </main>

      <Dialog open={!!apiKeyDialog} onOpenChange={(open) => !open && setApiKeyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key required</DialogTitle>
            <DialogDescription>
              This version is private. Enter an API key to open with authentication. You can create or copy a
              key from the API Keys page.
              {!hasEnabledApiKey ? (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  This tenant has no enabled API keys yet.
                </span>
              ) : null}
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

function csvCell(value: string): string {
  if (value === null || value === undefined) return '';
  const needsQuoting = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default PublishedVersions;
