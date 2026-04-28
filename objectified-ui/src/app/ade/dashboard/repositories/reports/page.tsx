'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BookmarkPlus,
  ChevronDown,
  ChevronLeft,
  Download,
  FileBarChart2,
  Loader2,
  RotateCcw,
  Search,
  Star,
  Timer,
  X,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Alert } from '@/app/components/ui/Alert';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { cn } from '@lib/utils';
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
  repositoryHeaderEyebrowClass,
  repositoryHeaderIconTileClass,
  repositoryHeaderShellClass,
  repositoryKpiCardClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { subscribeRepositoryCorpusStatsRefresh } from '@/app/utils/repository-dashboard-broadcast';

const PROVIDERS = [
  { id: 'all', label: 'All' },
  { id: 'github', label: 'GitHub' },
  { id: 'gitlab', label: 'GitLab' },
  { id: 'bitbucket', label: 'Bitbucket' },
] as const;

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'importable', label: 'Importable' },
  { id: 'imported', label: 'Imported' },
  { id: 'failing', label: 'Failing' },
  { id: 'awaiting', label: 'Awaiting selection' },
  { id: 'stale', label: 'Stale' },
] as const;

type ScanReportTotals = {
  discovered: number;
  importable: number;
  imported: number;
  failing: number;
  parseError: number;
  manifestError: number;
  awaitingSelection: number;
  scanFailed: boolean;
};

type ScanReportRow = {
  repositoryId: string;
  fullName: string;
  provider: string;
  branchCount: number;
  lastScanAt: string | null;
  lastScanId: string | null;
  lastReportId: string | null;
  totals: ScanReportTotals | null;
  attentionScore: number;
  stale: boolean;
};

type RepositoryCorpusStats = {
  repositoriesTracked: number;
  importableSpecs: number;
  awaitingSelection: number;
  parseErrors: number;
  manifestErrors: number;
  refreshedAt: string;
};

function formatLastScan(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function providerBarClass(provider: string): string {
  if (provider === 'gitlab') return 'bg-orange-500';
  if (provider === 'bitbucket') return 'bg-sky-500';
  return 'bg-gray-700 dark:bg-gray-300';
}

type ScanReportExportListItem = {
  id: string;
  format: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  rowCount: number | null;
  expectedRows: number | null;
  progress: number;
  error: string | null;
};

type ScanReportExportJobDetail = ScanReportExportListItem & {
  downloadUrl?: string;
};

type SavedScanReportFilter = {
  id: string;
  name: string;
  filter: {
    provider: string;
    status: string;
    subtype?: string;
    search?: string;
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

function buildClientExportDownloadUrl(exportId: string, downloadUrl: string | undefined): string | null {
  if (!downloadUrl) return null;
  const q = downloadUrl.split('?')[1];
  if (!q) return null;
  const p = new URLSearchParams(q);
  const token = p.get('token');
  if (!token) return null;
  return `/api/repositories/scan-reports/exports/${encodeURIComponent(exportId)}/content?${new URLSearchParams({ token })}`;
}

function formatExportStatus(status: string): string {
  if (status === 'cancelling') return 'Cancelling…';
  if (status === 'pending' || status === 'running') return 'In progress';
  return status;
}

function attentionCell(
  item: Pick<ScanReportRow, 'stale' | 'totals' | 'attentionScore'>,
): { label: string; title: string } {
  if (item.stale) {
    return { label: 'stale', title: 'Last scan is older than 7 days' };
  }
  if (item.totals?.scanFailed) {
    return { label: '—', title: 'Last scan did not complete successfully' };
  }
  const f = item.totals?.failing ?? 0;
  const a = item.totals?.awaitingSelection ?? 0;
  if (f + a < 1) {
    return { label: '—', title: 'No failing files or specs awaiting selection' };
  }
  return {
    label: `⚠ ${f + a}`,
    title: `${f} failing file(s), ${a} awaiting selection`,
  };
}

export default function ScanReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listMsgId = useId();

  const [rows, setRows] = useState<ScanReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [corpusStats, setCorpusStats] = useState<RepositoryCorpusStats | null>(null);
  const [corpusLoading, setCorpusLoading] = useState(true);
  const [corpusError, setCorpusError] = useState('');
  const [exportJobs, setExportJobs] = useState<ScanReportExportListItem[]>([]);
  const [exportsLoading, setExportsLoading] = useState(false);
  const [exportBusyId, setExportBusyId] = useState<string | null>(null);
  const [exportStartFormat, setExportStartFormat] = useState<null | 'csv' | 'json'>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollGenRef = useRef(0);
  const [savedFilters, setSavedFilters] = useState<SavedScanReportFilter[]>([]);
  const [savedFiltersLoading, setSavedFiltersLoading] = useState(false);
  const [savedFiltersInitialized, setSavedFiltersInitialized] = useState(false);
  const emptyQueryLandingHandledRef = useRef(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetDialogMode, setPresetDialogMode] = useState<'save' | 'rename'>('save');
  const [presetEditingId, setPresetEditingId] = useState<string | null>(null);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [presetSaving, setPresetSaving] = useState(false);
  const [manageFiltersOpen, setManageFiltersOpen] = useState(false);

  const urlProvider = searchParams.get('provider') || 'all';
  const urlStatus = searchParams.get('status') || 'all';
  const urlSubtype = searchParams.get('subtype') || '';
  const urlQ = searchParams.get('q') || '';
  const urlPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [qDraft, setQDraft] = useState(urlQ);
  const qDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQDraft(urlQ);
  }, [urlQ]);

  const setQuery = useCallback(
    (next: Record<string, string | number | null | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === '') p.delete(k);
        else p.set(k, String(v));
      }
      router.push(`${pathname}?${p.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const loadSavedFilters = useCallback(async () => {
    setSavedFiltersLoading(true);
    try {
      const res = await fetch('/api/dashboard/repository-scan-report-saved-filters', { cache: 'no-store' });
      const body = (await res.json()) as {
        success?: boolean;
        data?: { items?: SavedScanReportFilter[] };
      };
      if (!res.ok || !body.success || !body.data?.items) {
        setSavedFilters([]);
        return;
      }
      setSavedFilters(body.data.items);
    } catch {
      setSavedFilters([]);
    } finally {
      setSavedFiltersLoading(false);
      setSavedFiltersInitialized(true);
    }
  }, []);

  const applySavedFilter = useCallback(
    (sf: SavedScanReportFilter) => {
      setQuery({
        provider: sf.filter.provider,
        status: sf.filter.status,
        subtype: sf.filter.subtype || null,
        q: sf.filter.search || null,
        page: 1,
      });
    },
    [setQuery],
  );

  const openSavePresetDialog = useCallback(() => {
    setPresetDialogMode('save');
    setPresetEditingId(null);
    setPresetNameDraft('');
    setPresetDialogOpen(true);
  }, []);

  const openRenamePresetDialog = useCallback((sf: SavedScanReportFilter) => {
    setPresetDialogMode('rename');
    setPresetEditingId(sf.id);
    setPresetNameDraft(sf.name);
    setPresetDialogOpen(true);
    setManageFiltersOpen(false);
  }, []);

  const submitPresetDialog = useCallback(async () => {
    const name = presetNameDraft.trim();
    if (!name) {
      toast.error('Enter a name');
      return;
    }
    setPresetSaving(true);
    try {
      if (presetDialogMode === 'rename' && presetEditingId) {
        const res = await fetch(
          `/api/dashboard/repository-scan-report-saved-filters/${encodeURIComponent(presetEditingId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          },
        );
        const body = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !body.success) {
          toast.error(body.error || 'Could not rename');
          return;
        }
        toast.success('Saved filter renamed');
      } else {
        const res = await fetch('/api/dashboard/repository-scan-report-saved-filters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            isDefault: false,
            filter: {
              provider: urlProvider,
              status: urlStatus,
              subtype: urlSubtype || '',
              search: urlQ.trim(),
            },
          }),
        });
        const body = (await res.json()) as { success?: boolean; error?: string; code?: string };
        if (res.status === 400 && body.code === 'SAVED_FILTER_LIMIT_REACHED') {
          toast.error('Saved filter limit reached', {
            description: body.error || 'Delete an existing filter first.',
          });
          return;
        }
        if (!res.ok || !body.success) {
          toast.error(body.error || 'Could not save filter');
          return;
        }
        toast.success('Filter saved');
      }
      setPresetDialogOpen(false);
      void loadSavedFilters();
    } finally {
      setPresetSaving(false);
    }
  }, [
    presetDialogMode,
    presetEditingId,
    presetNameDraft,
    urlProvider,
    urlStatus,
    urlSubtype,
    urlQ,
    loadSavedFilters,
  ]);

  const setSavedAsDefault = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/dashboard/repository-scan-report-saved-filters/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDefault: true }),
        });
        const body = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !body.success) {
          toast.error(body.error || 'Could not update default');
          return;
        }
        toast.success('Default filter updated');
        void loadSavedFilters();
      } catch {
        toast.error('Could not update default');
      }
    },
    [loadSavedFilters],
  );

  const deleteSavedFilter = useCallback(
    async (id: string) => {
      if (!globalThis.window.confirm('Delete this saved filter?')) return;
      try {
        const res = await fetch(`/api/dashboard/repository-scan-report-saved-filters/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const body = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !body.success) {
          toast.error(body.error || 'Could not delete');
          return;
        }
        toast.message('Saved filter deleted');
        void loadSavedFilters();
      } catch {
        toast.error('Could not delete');
      }
    },
    [loadSavedFilters],
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError('');
    try {
      const p = new URLSearchParams();
      p.set('provider', urlProvider);
      p.set('status', urlStatus);
      if (urlQ.trim()) p.set('q', urlQ.trim());
      p.set('page', String(urlPage));
      p.set('pageSize', String(pageSize));
      const res = await fetch(`/api/repositories/scan-reports?${p.toString()}`, { signal });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to load scan reports');
      }
      const d = body.data;
      setRows(d.items ?? []);
      setTotal(d.total ?? 0);
      setPage(d.page ?? 1);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, urlPage, urlProvider, urlQ, urlStatus]);

  const loadCorpusStats = useCallback(async (signal?: AbortSignal) => {
    setCorpusLoading(true);
    setCorpusError('');
    try {
      const res = await fetch('/api/dashboard/repository-corpus-stats', { signal, cache: 'no-store' });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to load corpus stats');
      }
      setCorpusStats(body.data as RepositoryCorpusStats);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setCorpusError(e instanceof Error ? e.message : 'Failed to load corpus stats');
    } finally {
      setCorpusLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCorpusStats(controller.signal);
    return () => controller.abort();
  }, [loadCorpusStats]);

  useEffect(() => {
    return subscribeRepositoryCorpusStatsRefresh(() => {
      void load();
      void loadCorpusStats();
    });
  }, [load, loadCorpusStats]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadCorpusStats();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loadCorpusStats]);

  useEffect(() => {
    return () => {
      if (qDebounce.current) clearTimeout(qDebounce.current);
    };
  }, []);

  useEffect(() => {
    void loadSavedFilters();
  }, [loadSavedFilters]);

  useEffect(() => {
    if (emptyQueryLandingHandledRef.current) return;
    if (searchParams.toString() !== '') {
      emptyQueryLandingHandledRef.current = true;
      return;
    }
    if (!savedFiltersInitialized) return;
    emptyQueryLandingHandledRef.current = true;
    const def = savedFilters.find((x) => x.isDefault);
    if (!def) return;
    const f = def.filter;
    const p = new URLSearchParams();
    p.set('provider', f.provider);
    p.set('status', f.status);
    if (f.subtype) p.set('subtype', f.subtype);
    if (f.search) p.set('q', f.search);
    p.set('page', '1');
    router.replace(`${pathname}?${p.toString()}`);
  }, [pathname, router, searchParams, savedFilters, savedFiltersInitialized]);

  const loadExportList = useCallback(async () => {
    setExportsLoading(true);
    try {
      const res = await fetch('/api/repositories/scan-reports/exports', { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { items?: unknown[] } };
      if (!res.ok || !body.success || !body.data?.items) {
        return;
      }
      setExportJobs(
        (body.data.items as ScanReportExportListItem[]).map((j) => ({
          ...j,
        })),
      );
    } finally {
      setExportsLoading(false);
    }
  }, []);

  const startExport = useCallback(
    async (format: 'csv' | 'json') => {
      setExportStartFormat(format);
      try {
        const res = await fetch('/api/repositories/scan-reports/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format,
            filter: {
              provider: urlProvider,
              status: urlStatus,
              search: urlQ.trim(),
            },
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: unknown; data?: { exportJobId?: string } };
        if (res.status === 400) {
          const e = body.error;
          if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'EXPORT_ROW_CAP_EXCEEDED') {
            const msg = (e as { message?: string }).message || 'Result set too large. Narrow the filters.';
            toast.error('Export limit exceeded', { description: msg });
            return;
          }
          if (e && typeof e === 'object' && 'message' in e) {
            toast.error(String((e as { message: unknown }).message));
            return;
          }
        }
        if (!res.ok || !body.success) {
          const e = body.error;
          toast.error(
            typeof e === 'string' ? e : res.statusText || 'Failed to start export',
          );
          return;
        }
        const eid = body.data?.exportJobId;
        if (!eid) {
          toast.error('Invalid export response');
          return;
        }
        void loadExportList();
        toast.message('Export started', { description: 'We will notify you when the file is ready.' });
        setPollingJobId(eid);
      } finally {
        setExportStartFormat(null);
      }
    },
    [loadExportList, urlProvider, urlQ, urlStatus],
  );

  const cancelExport = useCallback(
    async (exportId: string) => {
      setExportBusyId(exportId);
      try {
        const res = await fetch(
          `/api/repositories/scan-reports/exports/${encodeURIComponent(exportId)}/cancel`,
          { method: 'POST' },
        );
        const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (!res.ok || !body.success) {
          toast.error(body.error || 'Could not cancel export');
          return;
        }
        toast.message('Cancelling export…');
        void loadExportList();
      } finally {
        setExportBusyId(null);
      }
    },
    [loadExportList],
  );

  const retryExport = useCallback(
    async (exportId: string) => {
      setExportBusyId(exportId);
      try {
        const res = await fetch(
          `/api/repositories/scan-reports/exports/${encodeURIComponent(exportId)}/retry`,
          { method: 'POST' },
        );
        const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; data?: { exportJobId?: string } };
        if (!res.ok || !body.success) {
          toast.error(body.error || 'Retry failed');
          return;
        }
        const e2 = body.data?.exportJobId;
        if (e2) {
          setPollingJobId(e2);
        }
        toast.message('Export restarted');
        void loadExportList();
      } finally {
        setExportBusyId(null);
      }
    },
    [loadExportList],
  );

  useEffect(() => {
    if (!pollingJobId) return;
    const gen = ++pollGenRef.current;
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    let attempts = 0;
    const maxAttempts = 120;
    const tick = async () => {
      if (gen !== pollGenRef.current) return;
      if (attempts++ > maxAttempts) {
        setPollingJobId(null);
        toast.error('Export timed out', { description: 'Refresh the page and check recent exports below.' });
        return;
      }
      try {
        const res = await fetch(`/api/repositories/scan-reports/exports/${encodeURIComponent(pollingJobId)}`, {
          cache: 'no-store',
        });
        const body = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: ScanReportExportJobDetail;
        };
        if (!res.ok || !body.success || !body.data) {
          pollRef.current = setTimeout(tick, 600);
          return;
        }
        const j = body.data;
        if (j.status === 'failed') {
          setPollingJobId(null);
          void loadExportList();
          toast.error('Export failed', { description: j.error || 'See recent exports for details.' });
          return;
        }
        if (j.status === 'cancelled' || j.status === 'cancelling') {
          setPollingJobId(null);
          void loadExportList();
          return;
        }
        if (j.status === 'completed') {
          setPollingJobId(null);
          void loadExportList();
          const link = buildClientExportDownloadUrl(j.id, j.downloadUrl);
          if (link) {
            toast.success('Export ready', {
              action: { label: 'Download', onClick: () => window.open(link, '_blank', 'noopener') },
              description: j.rowCount != null ? `${j.rowCount.toLocaleString()} row(s).` : undefined,
            });
          } else {
            toast.success('Export complete');
          }
          return;
        }
      } catch {
        // network blip: keep polling
      }
      pollRef.current = setTimeout(tick, 600);
    };
    void tick();
    return () => {
      pollGenRef.current += 1;
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [loadExportList, pollingJobId]);

  useEffect(() => {
    void loadExportList();
  }, [loadExportList]);

  const liveMessage = useMemo(() => {
    if (isLoading) return 'Loading scan reports';
    if (error) return error;
    return `Scan reports: ${rows.length} on this page, ${total} match filters.`;
  }, [error, isLoading, rows.length, total]);

  return (
    <>
      <header className={repositoryHeaderShellClass}>
        <div className="px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className={repositoryHeaderIconTileClass} aria-hidden>
                <FileBarChart2 className="w-5 h-5" />
              </span>
              <div>
                <p className={repositoryHeaderEyebrowClass}>
                  <Link
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                    href="/ade/dashboard/repositories"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Repositories
                  </Link>
                  <span className="mx-2 text-gray-400" aria-hidden>
                    /
                  </span>
                  Scan reports
                </p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scanned repository report</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Tenant-wide view of the latest scan materialization per repository (totals are pre-aggregated on the
                  server).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={exportStartFormat !== null}
                    aria-label="Export report"
                  >
                    {exportStartFormat ? (
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 shrink-0" />
                    )}
                    Export
                    <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 min-w-[12rem] rounded-md border border-gray-200/90 bg-white p-1.5 text-sm shadow-md dark:border-slate-600 dark:bg-slate-900"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenu.Item
                      className="flex cursor-default select-none items-center rounded-sm px-2.5 py-1.5 outline-none hover:bg-indigo-50 data-[highlighted]:bg-indigo-50 dark:hover:bg-slate-800 data-[highlighted]:dark:bg-slate-800"
                      onSelect={() => {
                        void startExport('csv');
                      }}
                    >
                      CSV
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="flex cursor-default select-none items-center rounded-sm px-2.5 py-1.5 outline-none hover:bg-indigo-50 data-[highlighted]:bg-indigo-50 dark:hover:bg-slate-800 data-[highlighted]:dark:bg-slate-800"
                      onSelect={() => {
                        void startExport('json');
                      }}
                    >
                      NDJSON (one object per line)
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        </div>
      </header>

      <div id={listMsgId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      <main className={dashboardMainClass}>
        <div className={dashboardContentStackClass}>
          {error && (
            <Alert variant="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {corpusError && (
            <Alert variant="error" onClose={() => setCorpusError('')}>
              {corpusError}
            </Alert>
          )}

          <section
            className="rounded-lg border border-gray-200/80 dark:border-slate-600/50 bg-white/40 dark:bg-slate-900/20 p-3"
            aria-label="Recent scan report exports"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent exports</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {exportsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                <button
                  type="button"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  onClick={() => void loadExportList()}
                >
                  Refresh
                </button>
              </div>
            </div>
            {exportJobs.length < 1 && !exportsLoading ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No exports yet. Use Export to start one.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-200/60 dark:divide-slate-600/40 text-sm">
                {exportJobs.map((job) => {
                  const canCancel = job.status === 'pending' || job.status === 'running' || job.status === 'cancelling';
                  const canRetry = job.status === 'failed' || job.status === 'cancelled';
                  const fmt = job.format === 'json' ? 'NDJSON' : 'CSV';
                  return (
                    <li key={job.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{job.id}</span>
                        <span className="mx-2 text-gray-300">·</span>
                        <span className="text-gray-800 dark:text-gray-100">{fmt}</span>
                        <span className="mx-2 text-gray-300">·</span>
                        <span className="capitalize text-gray-600 dark:text-gray-300">
                          {formatExportStatus(job.status)}
                        </span>
                        {job.status === 'completed' && job.rowCount != null ? (
                          <span className="ml-2 text-gray-500">({job.rowCount.toLocaleString()} rows)</span>
                        ) : null}
                        {job.error ? (
                          <span className="ml-2 text-amber-600 dark:text-amber-400" title={job.error}>
                            {job.error}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {job.status === 'completed' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={async () => {
                              const r = await fetch(
                                `/api/repositories/scan-reports/exports/${encodeURIComponent(job.id)}`,
                                { cache: 'no-store' },
                              );
                              const b = (await r.json().catch(() => ({}))) as {
                                success?: boolean;
                                data?: ScanReportExportJobDetail;
                              };
                              if (!r.ok || !b.success || !b.data) {
                                toast.error('Could not get download link');
                                return;
                              }
                              const link = buildClientExportDownloadUrl(job.id, b.data.downloadUrl);
                              if (link) {
                                window.open(link, '_blank', 'noopener');
                              } else {
                                toast.error('Download not available');
                              }
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={exportBusyId === job.id}
                            onClick={() => void cancelExport(job.id)}
                            className="gap-1"
                          >
                            {exportBusyId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                            Cancel
                          </Button>
                        ) : null}
                        {canRetry ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={exportBusyId === job.id}
                            onClick={() => void retryExport(job.id)}
                            className="gap-1"
                          >
                            {exportBusyId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
            aria-label="Cross-repository corpus summary"
          >
            {(
              [
                {
                  id: 'repos' as const,
                  stat: (c: RepositoryCorpusStats) => c.repositoriesTracked,
                  label: 'Repositories',
                  sub: 'tracked',
                  match: () => urlStatus === 'all',
                  onSelect: () => setQuery({ status: 'all', subtype: null, page: 1 }),
                },
                {
                  id: 'importable' as const,
                  stat: (c: RepositoryCorpusStats) => c.importableSpecs,
                  label: 'Importable',
                  sub: 'specs',
                  match: () => urlStatus === 'importable',
                  onSelect: () => setQuery({ status: 'importable', subtype: null, page: 1 }),
                },
                {
                  id: 'awaiting' as const,
                  stat: (c: RepositoryCorpusStats) => c.awaitingSelection,
                  label: 'Awaiting',
                  sub: 'selection',
                  match: () => urlStatus === 'awaiting',
                  onSelect: () => setQuery({ status: 'awaiting', subtype: null, page: 1 }),
                },
                {
                  id: 'parse' as const,
                  stat: (c: RepositoryCorpusStats) => c.parseErrors,
                  label: 'Parse',
                  sub: 'errors',
                  match: () => urlStatus === 'failing' && urlSubtype === 'parse',
                  onSelect: () => setQuery({ status: 'failing', subtype: 'parse', page: 1 }),
                },
                {
                  id: 'manifest' as const,
                  stat: (c: RepositoryCorpusStats) => c.manifestErrors,
                  label: 'Manifest',
                  sub: 'errors',
                  match: () => urlStatus === 'failing' && urlSubtype === 'manifest',
                  onSelect: () => setQuery({ status: 'failing', subtype: 'manifest', page: 1 }),
                },
              ] as const
            ).map((card) => {
              const active = card.match();
              const n = corpusStats != null ? card.stat(corpusStats) : null;
              return (
                <button
                  type="button"
                  key={card.id}
                  onClick={card.onSelect}
                  className={cn(
                    repositoryKpiCardClass,
                    'text-left w-full min-h-[8.5rem] flex flex-col justify-between transition-shadow',
                    'hover:border-indigo-300 dark:hover:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
                    active
                      ? 'ring-2 ring-indigo-500 border-indigo-500 dark:ring-indigo-400'
                      : 'border-gray-200 dark:border-gray-700',
                  )}
                  aria-pressed={active}
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {card.label}
                    </p>
                    {corpusLoading && corpusStats == null ? (
                      <div className="mt-2">
                        <Skeleton className="h-9 w-20" />
                      </div>
                    ) : (
                      <p className="text-3xl font-bold font-mono leading-none text-gray-900 dark:text-gray-100 mt-2">
                        {n == null || corpusError ? '—' : n}
                      </p>
                    )}
                    <p className="text-[11px] mt-1.5 text-gray-500 dark:text-gray-400">{card.sub}</p>
                  </div>
                </button>
              );
            })}
          </section>

          <section
            className="rounded-lg border border-gray-200/80 dark:border-slate-600/50 bg-white/90 dark:bg-slate-800/30 p-4"
            aria-label="Scan report filters"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={savedFiltersLoading}
                        aria-label="Saved scan report filters"
                      >
                        {savedFiltersLoading ? (
                          <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <BookmarkPlus className="w-4 h-4 shrink-0" aria-hidden />
                        )}
                        Saved filters
                        <ChevronDown className="w-4 h-4 shrink-0 opacity-70" aria-hidden />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="z-50 min-w-[14rem] rounded-md border border-gray-200/90 bg-white p-1.5 text-sm shadow-md dark:border-slate-600 dark:bg-slate-900"
                        align="start"
                        sideOffset={4}
                      >
                        {savedFilters.length < 1 ? (
                          <div className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                            No saved filters yet. Use &quot;Save current filter&quot; below.
                          </div>
                        ) : (
                          savedFilters.map((sf) => (
                            <DropdownMenu.Item
                              key={sf.id}
                              className="flex cursor-default select-none items-center gap-2 rounded-sm px-2.5 py-2 outline-none hover:bg-indigo-50 data-[highlighted]:bg-indigo-50 dark:hover:bg-slate-800 data-[highlighted]:dark:bg-slate-800"
                              onSelect={(e) => {
                                e.preventDefault();
                                applySavedFilter(sf);
                              }}
                            >
                              {sf.isDefault ? (
                                <Star
                                  className="h-3.5 w-3.5 shrink-0 text-amber-500"
                                  aria-hidden
                                  fill="currentColor"
                                />
                              ) : (
                                <span className="inline-block w-3.5 shrink-0" aria-hidden />
                              )}
                              <span className="truncate">{sf.name}</span>
                            </DropdownMenu.Item>
                          ))
                        )}
                        <DropdownMenu.Separator className="my-1 h-px bg-gray-200 dark:bg-slate-600" />
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded-sm px-2.5 py-2 text-xs outline-none hover:bg-indigo-50 data-[highlighted]:bg-indigo-50 dark:hover:bg-slate-800 data-[highlighted]:dark:bg-slate-800"
                          onSelect={(e) => {
                            e.preventDefault();
                            setManageFiltersOpen(true);
                          }}
                        >
                          Manage saved filters…
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                  <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={openSavePresetDialog}>
                    <BookmarkPlus className="w-4 h-4 shrink-0" aria-hidden />
                    Save current filter
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  Provider
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by provider">
                  {PROVIDERS.map((p) => {
                    const active = p.id === urlProvider;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setQuery({ provider: p.id, page: 1 })}
                        aria-pressed={active}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md border transition-colors',
                          active
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200'
                            : 'border-gray-200 dark:border-slate-600 hover:border-gray-300',
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  Status
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by scan status">
                  {STATUS_FILTERS.map((p) => {
                    const active = p.id === urlStatus;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setQuery({ status: p.id, subtype: null, page: 1 })}
                        aria-pressed={active}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md border transition-colors',
                          active
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200'
                            : 'border-gray-200 dark:border-slate-600 hover:border-gray-300',
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 max-w-2xl">
                <div className="flex-1 relative">
                  <Search
                    className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden
                  />
                  <Input
                    className="pl-8"
                    placeholder="Search by repository name, slug, or id…"
                    value={qDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      setQDraft(v);
                      if (qDebounce.current) clearTimeout(qDebounce.current);
                      qDebounce.current = setTimeout(() => {
                        qDebounce.current = null;
                        setQuery({ q: v || null, page: 1 });
                      }, 400);
                    }}
                    aria-label="Search repositories"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200/80 dark:border-slate-600/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" aria-describedby={listMsgId}>
                <caption className="text-left text-xs text-gray-500 dark:text-gray-400 px-3 py-2">
                  Spec columns: I=importable · A=imported (committed) · F=failing · S=awaiting selection. Sorted by
                  attention (highest first), then last scan.
                </caption>
                <thead className="bg-gray-50/90 dark:bg-slate-800/50">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">
                      Repository
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">
                      Provider
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">
                      Branches
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">
                      Last scan
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500"
                    >
                      Specs (I / A / F / S)
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">
                      Attention
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-4">
                        <div className="space-y-2" aria-label="Loading scan report rows">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-7 w-full" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((item) => {
                      const t = item.totals;
                      const i0 = t?.importable ?? 0;
                      const a0 = t?.imported ?? 0;
                      const f0 = t?.failing ?? (t?.parseError ?? 0) + (t?.manifestError ?? 0);
                      const s0 = t?.awaitingSelection ?? 0;
                      const att = attentionCell(item);
                      const reportSegment = item.lastReportId || item.lastScanId;
                      return (
                        <tr key={item.repositoryId} className="border-t border-gray-200/60 dark:border-slate-600/30">
                          <td className="px-3 py-2.5">
                            {reportSegment ? (
                              <Link
                                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                href={`/ade/dashboard/repositories/${item.repositoryId}/reports/${reportSegment}`}
                              >
                                {item.fullName}
                              </Link>
                            ) : (
                              <span className="font-medium text-gray-800 dark:text-gray-100">{item.fullName}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="inline-flex items-center gap-1.5">
                              <span className={cn('w-1.5 h-4 rounded-sm', providerBarClass(item.provider))} />
                              <span className="capitalize text-gray-700 dark:text-gray-200">{item.provider}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-gray-700 dark:text-gray-200">
                            {item.branchCount}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                            {item.stale ? (
                              <span
                                className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300"
                                title="Last scan older than 7 days"
                              >
                                <Timer className="w-3.5 h-3.5" />
                                {formatLastScan(item.lastScanAt)}
                              </span>
                            ) : (
                              formatLastScan(item.lastScanAt)
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-800 dark:text-gray-100 tabular-nums">
                            {i0} / {a0} / {f0} / {s0}
                          </td>
                          <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100" title={att.title}>
                            {att.label}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-2">
                              {reportSegment ? (
                                <Link
                                  className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                                  href={`/ade/dashboard/repositories/${item.repositoryId}/reports/${reportSegment}`}
                                >
                                  Open report
                                </Link>
                              ) : null}
                              <Link
                                className={buttonVariants({ size: 'sm', variant: 'outline' })}
                                href={`/ade/dashboard/repositories/${item.repositoryId}`}
                              >
                                Repository
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && total === 0 && (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No repositories match the current filters.</p>
            )}
            {!isLoading && total > pageSize && (
              <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-slate-600/30 px-3 py-2 text-xs text-gray-500">
                <span>
                  Page {page} · {total} total
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={urlPage <= 1}
                    onClick={() => setQuery({ page: String(Math.max(1, urlPage - 1)) })}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={urlPage * pageSize >= total}
                    onClick={() => setQuery({ page: String(urlPage + 1) })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent showCloseButton={!presetSaving}>
          <DialogHeader>
            <DialogTitle>{presetDialogMode === 'rename' ? 'Rename saved filter' : 'Save current filter'}</DialogTitle>
            <DialogDescription>
              {presetDialogMode === 'rename'
                ? 'Update the display name for this preset.'
                : 'Name this combination of provider, status, subtype, and search.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={presetNameDraft}
            onChange={(e) => setPresetNameDraft(e.target.value)}
            placeholder="e.g. Failing on prod"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitPresetDialog();
              }
            }}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPresetDialogOpen(false)}
              disabled={presetSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitPresetDialog()} disabled={presetSaving}>
              {presetSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" aria-hidden /> : null}
              {presetDialogMode === 'rename' ? 'Save' : 'Save preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageFiltersOpen} onOpenChange={setManageFiltersOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saved filters</DialogTitle>
            <DialogDescription>Apply, rename, set your default landing filter, or delete a preset.</DialogDescription>
          </DialogHeader>
          {savedFilters.length < 1 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No saved filters yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-slate-600">
              {savedFilters.map((sf) => (
                <li
                  key={sf.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {sf.isDefault ? (
                      <Star className="w-4 h-4 text-amber-500 shrink-0" aria-hidden fill="currentColor" />
                    ) : (
                      <span className="inline-block w-4 shrink-0" aria-hidden />
                    )}
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{sf.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        applySavedFilter(sf);
                        setManageFiltersOpen(false);
                      }}
                    >
                      Apply
                    </Button>
                    {!sf.isDefault ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void setSavedAsDefault(sf.id)}>
                        Set default
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => openRenamePresetDialog(sf)}>
                      Rename
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600 dark:text-red-400"
                      onClick={() => void deleteSavedFilter(sf.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManageFiltersOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
