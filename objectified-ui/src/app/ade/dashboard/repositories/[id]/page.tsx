'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertOctagon,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  FileSearch,
  GitBranch,
  GitBranchPlus,
  GitPullRequestArrow,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Save,
  ScanSearch,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Alert } from '@/app/components/ui/Alert';
import { Input } from '@/app/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/Tabs';
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
  repositoryPanelClass,
  repositoryPanelEyebrowClass,
  repositoryPanelHeaderClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { RepositoryStatusChip } from '@/app/components/ade/dashboard/RepositoryStatusChip';
import { RepositorySpecsTab } from '@/app/components/ade/dashboard/RepositorySpecsTab';
import { repositoryManifestSchema } from '@/lib/repositoryManifestSchema';
import { getRepositoriesI18nBundle } from '../i18n';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const rowHeightPx = 56;
const fileViewportMinHeightPx = 420;
// Reserved for everything between the viewport's top and the bottom of the window
// (panel footer + page padding). Used as a safety margin when sizing the viewport.
const fileViewportBottomReservePx = 64;
const repo63IssueUrl = 'https://github.com/KenSuenobu/objectified-commercial/issues/2796';

type RepositoryTab = 'branches' | 'files' | 'specs' | 'scans' | 'sync' | 'manifest' | 'settings';
const repositoryTabs: RepositoryTab[] = ['branches', 'files', 'specs', 'scans', 'sync', 'manifest', 'settings'];

type SpecFilter = 'all' | 'importable' | 'imported' | 'failing' | 'awaiting_selection';
const specFilterValues: SpecFilter[] = ['all', 'importable', 'imported', 'failing', 'awaiting_selection'];

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
  manifest?: string | null;
  archivedAt?: string | null;
  branches: Array<{ branch: string; subpathGlob?: string; pollIntervalSec?: number }>;
  timeline: RepositoryTimelineItem[];
}

interface BranchRow {
  branch: string;
  subpathGlob: string;
  pollIntervalSec?: number;
}

interface ScanRecord {
  id: string;
  branch: string;
  commitSha: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  filesSeen: number;
  filesClassified: number;
  filesUnknown: number;
  filesFailed: number;
  diffSummary: {
    added?: number;
    modified?: number;
    removed?: number;
    unchanged?: number;
  };
  eventLog?: unknown;
  event_log?: unknown;
  errorDetail?: unknown;
  error_detail?: unknown;
}

interface ScanFileRecord {
  id: string;
  scanId: string;
  path: string;
  blobSha: string | null;
  format: string | null;
  confidence: number | null;
  discriminator: string | null;
  tracked: boolean;
  projectSlug: string | null;
  versionStrategy: string | null;
  status: string;
  qualityScore: number | null;
  promote: 'auto' | 'manual' | null;
  settingsJson: Record<string, unknown> | null;
}

interface SyncHistoryRecord {
  id: string;
  state: string;
  operation: string;
  branch: string;
  sourceUri: string;
  repositoryFileId: string;
  conflictRecords: Array<{ schemaName?: string; kinds?: string[]; message?: string }>;
  createdAt: string;
}

function buildRawDiffPreview(file: ScanFileRecord): string {
  if (file.status === 'new') {
    return `+ Added file ${file.path}\n+ blob: ${file.blobSha || 'unknown'}\n+ format: ${file.format || 'unknown'}`;
  }
  if (file.status === 'removed') {
    return `- Removed file ${file.path}\n- previous blob: ${file.blobSha || 'unknown'}`;
  }
  if (file.status === 'modified') {
    return `~ Modified ${file.path}\n- old blob: (previous scan)\n+ new blob: ${file.blobSha || 'unknown'}`;
  }
  return `No textual diff available for ${file.path}\nStatus: ${file.status}`;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString();
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return 'n/a';
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return 'n/a';
  const elapsedSec = Math.floor((finished - started) / 1000);
  if (elapsedSec < 60) return `${elapsedSec}s`;
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${seconds}s`;
}

/**
 * Human-friendly "X ago" string for a single timestamp. Returns `null` when
 * the input is missing/invalid so callers can decide on their own fallback
 * (an em-dash, "Never", etc.) rather than rendering "NaN ago".
 */
function formatRelativeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return null;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec} s ago`;
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `${minutes} m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(months / 12);
  return `${years} y ago`;
}

function shortSha(sha: string | null | undefined, length = 7): string {
  if (!sha) return '';
  return sha.length > length ? sha.slice(0, length) : sha;
}

function toErrorDetailText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join('\n');
  if (typeof value === 'object') {
    const detail = value as { detail?: unknown; message?: unknown };
    if (typeof detail.detail === 'string') return detail.detail;
    if (typeof detail.message === 'string') return detail.message;
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function toEventLogLines(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      if (entry && typeof entry === 'object') {
        const item = entry as {
          timestamp?: string;
          level?: string;
          message?: string;
          error?: string;
          stack?: string;
          detail?: string;
        };
        const prefixBits = [item.timestamp, item.level].filter(Boolean).join(' ');
        const body = item.message || item.error || item.detail || '';
        const line = [prefixBits, body].filter(Boolean).join(' ').trim();
        if (item.stack && line) return [line, item.stack];
        if (item.stack) return [item.stack];
        if (line) return [line];
        return [JSON.stringify(entry, null, 2)];
      }
      return [String(entry)];
    });
  }
  if (typeof value === 'string') return [value];
  if (typeof value === 'object') return [JSON.stringify(value, null, 2)];
  return [String(value)];
}

function extractScanErrorConsole(scan: ScanRecord): string {
  const eventLogValue = scan.eventLog ?? scan.event_log;
  const detailValue = scan.errorDetail ?? scan.error_detail;
  const sections: string[] = [];
  const eventLines = toEventLogLines(eventLogValue);
  if (eventLines.length > 0) {
    sections.push(eventLines.join('\n'));
  }
  const detailText = toErrorDetailText(detailValue);
  if (detailText) {
    sections.push(detailText);
  }
  if (sections.length === 0) {
    return 'No event log or error detail available for this failed scan.';
  }
  return sections.join('\n\n');
}

/**
 * Tone classes for scan-status pills/dots used in the timeline. Static map so
 * Tailwind's JIT picks the colours up.
 */
const scanStatusToneClass: Record<string, { dot: string; pill: string }> = {
  complete: {
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  pending: {
    dot: 'bg-indigo-500 animate-pulse',
    pill: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  walking: {
    dot: 'bg-indigo-500 animate-pulse',
    pill: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  sniffing: {
    dot: 'bg-indigo-500 animate-pulse',
    pill: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  failed: {
    dot: 'bg-rose-500',
    pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  skipped_unchanged: {
    dot: 'bg-slate-400',
    pill: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
};

function getScanStatusTone(status: string) {
  return scanStatusToneClass[status] ?? scanStatusToneClass.complete;
}

const fileFormatPillClass: Record<string, string> = {
  openapi: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  openapi_3_0: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  openapi_3_1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  json_schema: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'json-schema': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  asyncapi: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  graphql: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
};

function getFileFormatPillClass(format: string | null | undefined): string {
  const key = (format || 'unknown').toLowerCase();
  return fileFormatPillClass[key] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

const fileStatusPillClass: Record<string, string> = {
  classified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  modified: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  unchanged: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  removed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  parse_error: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  manifest_error: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  unknown: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  ignored: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

function getFileStatusPillClass(status: string | null | undefined): string {
  const key = (status || 'unknown').toLowerCase();
  return fileStatusPillClass[key] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

/**
 * Quality score colour band — emerald >=80, amber 60-79, rose <60.
 * Matches the dashboard mockup's quality-bar behaviour.
 */
function getQualityTone(score: number | null | undefined): { text: string; bar: string } | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 80) return { text: 'text-emerald-500', bar: 'bg-emerald-500' };
  if (score >= 60) return { text: 'text-amber-500', bar: 'bg-amber-500' };
  return { text: 'text-rose-500', bar: 'bg-rose-500' };
}

const tabIcons: Record<RepositoryTab, React.ComponentType<{ className?: string }>> = {
  branches: GitBranch,
  files: FileSearch,
  specs: FileCode2,
  scans: Activity,
  sync: GitPullRequestArrow,
  manifest: FileCode2,
  settings: Settings2,
};

const tabLabel: Record<RepositoryTab, string> = {
  branches: 'Branches',
  files: 'Files',
  specs: 'Specs',
  scans: 'Scans',
  sync: 'Sync history',
  manifest: 'Manifest',
  settings: 'Settings',
};

/**
 * Underline-style tab trigger styling. Overrides the default pill TabsTrigger
 * via `cn`/`twMerge` so the trigger reads as a flat tab inside the panel
 * header bar (matches the detail-page mockup).
 */
const tabTriggerClass = [
  'h-auto rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium gap-2',
  'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
  'data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent',
  'data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400',
  'data-[state=active]:shadow-none',
].join(' ');

const tabListClass = [
  'h-auto w-full justify-start rounded-none bg-transparent dark:bg-transparent p-0',
  'border-b border-gray-200 dark:border-gray-700 px-4 overflow-x-auto',
].join(' ');

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = getRepositoriesI18nBundle('en');
  const repositoryId = params?.id || '';

  const activeTab = useMemo<RepositoryTab>(() => {
    const queryTab = searchParams.get('tab');
    if (queryTab && repositoryTabs.includes(queryTab as RepositoryTab)) {
      return queryTab as RepositoryTab;
    }
    return 'branches';
  }, [searchParams]);

  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [branchRows, setBranchRows] = useState<BranchRow[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [customBranchPattern, setCustomBranchPattern] = useState('');
  const [manifestDraft, setManifestDraft] = useState('');
  const [ownerInput, setOwnerInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [scanFiles, setScanFiles] = useState<ScanFileRecord[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryRecord[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<ScanFileRecord | null>(null);
  const [fileScrollTop, setFileScrollTop] = useState(0);
  const [fileViewportHeightPx, setFileViewportHeightPx] = useState(fileViewportMinHeightPx);
  const [formatFilter, setFormatFilter] = useState('all');
  const [fileStatusFilter, setFileStatusFilter] = useState('all');
  const [filePathFilter, setFilePathFilter] = useState('');
  const [isLoadingRepository, setIsLoadingRepository] = useState(true);
  const [isLoadingScans, setIsLoadingScans] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [isSavingBranches, setIsSavingBranches] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingManifest, setIsSavingManifest] = useState(false);
  const [isMutatingLifecycle, setIsMutatingLifecycle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileViewportRef = useRef<HTMLDivElement | null>(null);
  const fileDrawerRef = useRef<HTMLElement | null>(null);

  const [manifestValidation, setManifestValidation] = useState<{ valid: boolean; errors: string[] }>({ valid: true, errors: [] });
  const [scanTriggerFilter, setScanTriggerFilter] = useState('all');
  const [scanStatusFilter, setScanStatusFilter] = useState('all');
  const [scanBranchFilter, setScanBranchFilter] = useState('all');
  const [expandedScanErrorId, setExpandedScanErrorId] = useState('');

  useEffect(() => {
    const source = manifestDraft.trim();
    if (!source) {
      setManifestValidation({ valid: true, errors: [] });
      return;
    }
    let cancelled = false;
    Promise.all([
      import('ajv/dist/2020'),
      import('yaml'),
    ]).then(([{ default: Ajv2020 }, { parse: parseYaml }]) => {
      if (cancelled) return;
      const ajv = new Ajv2020({ allErrors: true, strict: false });
      const validate = ajv.compile(repositoryManifestSchema);
      try {
        const parsed = parseYaml(source);
        const valid = validate(parsed);
        if (cancelled) return;
        if (valid) {
          setManifestValidation({ valid: true, errors: [] });
        } else {
          const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'}: ${e.message ?? 'Invalid'}`);
          setManifestValidation({ valid: false, errors });
        }
      } catch (e) {
        if (cancelled) return;
        setManifestValidation({ valid: false, errors: [e instanceof Error ? e.message : 'Invalid YAML'] });
      }
    }).catch((e) => {
      if (cancelled) return;
      setManifestValidation({ valid: false, errors: [e instanceof Error ? e.message : 'Invalid YAML'] });
    });
    return () => { cancelled = true; };
  }, [manifestDraft]);

  const setTab = useCallback((nextTab: RepositoryTab) => {
    const nextQuery = new URLSearchParams(searchParams.toString());
    nextQuery.set('tab', nextTab);
    router.replace(`/ade/dashboard/repositories/${repositoryId}?${nextQuery.toString()}`);
  }, [repositoryId, router, searchParams]);

  const queryStatusFilter: SpecFilter = useMemo(() => {
    const queryStatus = searchParams.get('status');
    if (queryStatus === 'parse_error' || queryStatus === 'manifest_error') return 'failing';
    if (queryStatus === 'imported') return 'imported';
    if (queryStatus === 'not_imported') return 'awaiting_selection';
    if (queryStatus === 'importable') return 'importable';
    if (queryStatus && specFilterValues.includes(queryStatus as SpecFilter)) {
      return queryStatus as SpecFilter;
    }
    return 'all';
  }, [searchParams]);

  const setSpecFilterQuery = useCallback((nextFilter: SpecFilter) => {
    const nextQuery = new URLSearchParams(searchParams.toString());
    if (nextFilter === 'all') {
      nextQuery.delete('status');
    } else {
      nextQuery.set('status', nextFilter);
    }
    nextQuery.set('tab', 'specs');
    router.replace(`/ade/dashboard/repositories/${repositoryId}?${nextQuery.toString()}`);
  }, [repositoryId, router, searchParams]);

  const initialSpecFileId = searchParams.get('fileId');

  /**
   * Round-trips the spec drawer's open/closed state through the URL
   * (`?fileId=`) so the drawer is deep-linkable per REPO-9.6. We only call
   * `router.replace` when the value actually changes to keep history clean.
   */
  const setSpecFileIdQuery = useCallback((nextFileId: string | null) => {
    const current = searchParams.get('fileId') ?? null;
    if (current === nextFileId) return;
    const nextQuery = new URLSearchParams(searchParams.toString());
    if (nextFileId) {
      nextQuery.set('fileId', nextFileId);
      nextQuery.set('tab', 'specs');
    } else {
      nextQuery.delete('fileId');
    }
    router.replace(`/ade/dashboard/repositories/${repositoryId}?${nextQuery.toString()}`);
  }, [repositoryId, router, searchParams]);

  const loadRepository = useCallback(async () => {
    if (!repositoryId) return;
    setIsLoadingRepository(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/repositories/${repositoryId}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load repository');
      }
      const loadedRepository = data.repository as RepositoryDetail;
      setRepository(loadedRepository);
      setOwnerInput(loadedRepository.owner);
      setNameInput(loadedRepository.name);
      setManifestDraft(loadedRepository.manifest || '');
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
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load repository';
      setErrorMessage(message);
    } finally {
      setIsLoadingRepository(false);
    }
  }, [repositoryId]);

  const loadScans = useCallback(async () => {
    if (!repositoryId) return;
    setIsLoadingScans(true);
    try {
      const response = await fetch(`/api/repositories/${repositoryId}/scans?limit=100`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load scan history');
      }
      const scanRows = Array.isArray(data.items) ? (data.items as ScanRecord[]) : [];
      setScans(scanRows);
      const queryScanId = searchParams.get('scanId');
      const defaultScanId = queryScanId && scanRows.some((scan) => scan.id === queryScanId)
        ? queryScanId
        : (scanRows[0]?.id || '');
      setSelectedScanId(defaultScanId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load scan history';
      setErrorMessage(message);
    } finally {
      setIsLoadingScans(false);
    }
  }, [repositoryId, searchParams]);

  const loadScanFiles = useCallback(async () => {
    if (!repositoryId || !selectedScanId) return;
    setIsLoadingFiles(true);
    try {
      const response = await fetch(`/api/repositories/${repositoryId}/scans/${selectedScanId}/files?limit=200`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load scan files');
      }
      const rows = Array.isArray(data.items) ? (data.items as ScanFileRecord[]) : [];
      setScanFiles(rows);
      setSelectedFile(null);
      setFileScrollTop(0);
      if (fileViewportRef.current) {
        fileViewportRef.current.scrollTop = 0;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load scan files';
      setErrorMessage(message);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [repositoryId, selectedScanId]);

  const loadSyncHistory = useCallback(async () => {
    if (!repositoryId) return;
    setIsLoadingSync(true);
    try {
      const response = await fetch(`/api/repositories/${repositoryId}/sync-history?limit=100`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load sync history');
      }
      setSyncHistory(Array.isArray(data.items) ? (data.items as SyncHistoryRecord[]) : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load sync history';
      setErrorMessage(message);
    } finally {
      setIsLoadingSync(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    void loadRepository();
  }, [loadRepository]);

  useEffect(() => {
    if (activeTab === 'scans' || activeTab === 'files') {
      void loadScans();
    }
    if (activeTab === 'sync') {
      void loadSyncHistory();
    }
  }, [activeTab, loadScans, loadSyncHistory]);

  useEffect(() => {
    if (activeTab === 'files' && selectedScanId) {
      void loadScanFiles();
    }
  }, [activeTab, loadScanFiles, selectedScanId]);

  useEffect(() => {
    if (selectedFile && fileDrawerRef.current) {
      const firstFocusable = fileDrawerRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }
  }, [selectedFile]);

  const filteredFiles = useMemo(() => {
    const pathQuery = filePathFilter.trim().toLowerCase();
    return scanFiles.filter((file) => {
      if (formatFilter !== 'all' && (file.format || 'unknown') !== formatFilter) return false;
      if (fileStatusFilter !== 'all' && file.status !== fileStatusFilter) return false;
      if (pathQuery && !file.path.toLowerCase().includes(pathQuery)) return false;
      return true;
    });
  }, [fileStatusFilter, formatFilter, filePathFilter, scanFiles]);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(fileScrollTop / rowHeightPx) - 6);
    const end = Math.min(filteredFiles.length, Math.ceil((fileScrollTop + fileViewportHeightPx) / rowHeightPx) + 6);
    return { start, end };
  }, [fileScrollTop, fileViewportHeightPx, filteredFiles.length]);

  useEffect(() => {
    if (activeTab !== 'files') return;
    const measure = () => {
      const node = fileViewportRef.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      const next = Math.max(
        fileViewportMinHeightPx,
        Math.floor(window.innerHeight - top - fileViewportBottomReservePx),
      );
      setFileViewportHeightPx((current) => (current === next ? current : next));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeTab, isLoadingFiles]);

  const visibleFiles = useMemo(
    () => filteredFiles.slice(visibleRange.start, visibleRange.end),
    [filteredFiles, visibleRange.end, visibleRange.start]
  );

  const normalizeScanFilterValue = useCallback((value?: string | null) => value || 'unknown', []);

  const scanTriggerOptions = useMemo(
    () => Array.from(new Set(scans.map((scan) => normalizeScanFilterValue(scan.trigger)))),
    [normalizeScanFilterValue, scans]
  );

  const scanStatusOptions = useMemo(
    () => Array.from(new Set(scans.map((scan) => normalizeScanFilterValue(scan.status)))),
    [normalizeScanFilterValue, scans]
  );

  const scanBranchOptions = useMemo(
    () => Array.from(new Set(scans.map((scan) => normalizeScanFilterValue(scan.branch)))),
    [normalizeScanFilterValue, scans]
  );

  const filteredScans = useMemo(() => {
    return scans.filter((scan) => {
      if (scanTriggerFilter !== 'all' && normalizeScanFilterValue(scan.trigger) !== scanTriggerFilter) return false;
      if (scanStatusFilter !== 'all' && normalizeScanFilterValue(scan.status) !== scanStatusFilter) return false;
      if (scanBranchFilter !== 'all' && normalizeScanFilterValue(scan.branch) !== scanBranchFilter) return false;
      return true;
    });
  }, [normalizeScanFilterValue, scanBranchFilter, scanStatusFilter, scanTriggerFilter, scans]);

  /**
   * Latest scan = first row from `loadScans`, which the API returns
   * newest-first. Used by the header eyebrow and the summary strip so the
   * page always reflects "what just happened" without an extra request.
   */
  const latestScan = scans.length > 0 ? scans[0] : null;
  const previousScan = scans.length > 1 ? scans[1] : null;

  const headerEyebrow = useMemo(() => {
    if (!repository) return '';
    const parts: string[] = [];
    parts.push(repository.provider || 'github');
    parts.push(`${branchRows.length} branch${branchRows.length === 1 ? '' : 'es'} tracked`);
    const lastScanRel = formatRelativeTime(latestScan?.startedAt || latestScan?.finishedAt);
    if (lastScanRel) {
      parts.push(`last scan ${lastScanRel}`);
    }
    if (latestScan?.startedAt && latestScan?.finishedAt) {
      const dur = formatDuration(latestScan.startedAt, latestScan.finishedAt);
      if (dur && dur !== 'n/a') parts.push(dur);
    }
    if (latestScan?.commitSha) {
      parts.push(`sha ${shortSha(latestScan.commitSha)}`);
    }
    return parts.join(' · ');
  }, [repository, branchRows.length, latestScan]);

  const tabCounts: Partial<Record<RepositoryTab, number>> = useMemo(
    () => ({
      branches: branchRows.length || undefined,
      files: scanFiles.length || undefined,
      scans: scans.length || undefined,
      sync: syncHistory.length || undefined,
    }),
    [branchRows.length, scanFiles.length, scans.length, syncHistory.length],
  );

  const saveBranches = async () => {
    if (!repository || branchRows.length === 0) {
      setErrorMessage(copy.branchesRequired);
      return;
    }
    setIsSavingBranches(true);
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
        updatedRepository.branches.map((branch) => ({
          branch: branch.branch,
          subpathGlob: branch.subpathGlob ?? '',
          pollIntervalSec: branch.pollIntervalSec ?? undefined,
        })),
      );
      setSuccessMessage(copy.branchesUpdatedMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update branches';
      setErrorMessage(message);
    } finally {
      setIsSavingBranches(false);
    }
  };

  const saveSettings = async () => {
    if (!repository) return;
    const owner = ownerInput.trim();
    const name = nameInput.trim();
    if (!owner || !name) {
      setErrorMessage(copy.ownerNameRequired);
      return;
    }
    setIsSavingSettings(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await fetch(`/api/repositories/${repository.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, name }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update repository settings');
      }
      const updatedRepository = data.repository as RepositoryDetail;
      setRepository(updatedRepository);
      setOwnerInput(updatedRepository.owner);
      setNameInput(updatedRepository.name);
      setSuccessMessage(copy.settingsUpdatedMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update repository settings';
      setErrorMessage(message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const saveManifest = async () => {
    if (!repository) return;
    if (!manifestValidation.valid) {
      setErrorMessage('Fix manifest validation errors before saving.');
      return;
    }
    setIsSavingManifest(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await fetch(`/api/repositories/${repository.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest: manifestDraft }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update repository manifest');
      }
      setRepository(data.repository as RepositoryDetail);
      setSuccessMessage('Repository manifest saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update repository manifest';
      setErrorMessage(message);
    } finally {
      setIsSavingManifest(false);
    }
  };

  const triggerScanNow = async () => {
    if (!repository) return;
    const branch = branchRows[0]?.branch || repository.branches[0]?.branch || 'main';
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await fetch(`/api/repositories/${repository.id}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch, force: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to queue scan');
      }
      setSuccessMessage(copy.scanQueuedMessage);
      await loadScans();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to queue scan';
      setErrorMessage(message);
    }
  };

  const updateLifecycle = async (action: 'archive' | 'unarchive') => {
    if (!repository) return;
    setIsMutatingLifecycle(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await fetch(`/api/repositories/${repository.id}/${action}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update repository lifecycle');
      }
      setRepository(data.repository as RepositoryDetail);
      setSuccessMessage(action === 'archive' ? copy.repositoryDisabledMessage : copy.repositoryEnabledMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update repository lifecycle';
      setErrorMessage(message);
    } finally {
      setIsMutatingLifecycle(false);
    }
  };

  const deleteRepository = async () => {
    if (!repository) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/repositories/${repository.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmFullName: deleteConfirmation }),
      });
      if (response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete repository');
      }
      router.push('/ade/dashboard/repositories');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete repository';
      setErrorMessage(message);
      setIsDeleting(false);
    }
  };

  const isArchived = repository?.status === 'archived';

  return (
    <>
      <header className={repositoryHeaderShellClass}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={repositoryHeaderIconTileClass}>
              <GitBranchPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold leading-tight font-mono truncate">
                  {repository?.fullName || copy.pageTitle}
                </h2>
                {repository ? <RepositoryStatusChip status={repository.status} /> : null}
              </div>
              <p className={`${repositoryHeaderEyebrowClass} truncate`}>
                {repository ? headerEyebrow : 'Loading repository details...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button onClick={() => void triggerScanNow()} disabled={!repository || isArchived}>
              <ScanSearch className="w-4 h-4 mr-2" />
              {copy.scanNowButton}
            </Button>
            {repository ? (
              isArchived ? (
                <Button
                  variant="outline"
                  onClick={() => void updateLifecycle('unarchive')}
                  disabled={isMutatingLifecycle}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {copy.enableButton}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => void updateLifecycle('archive')}
                  disabled={isMutatingLifecycle}
                >
                  <Pause className="w-4 h-4 mr-2" />
                  {copy.pauseButton}
                </Button>
              )
            ) : null}
            <Button variant="outline" onClick={() => router.push('/ade/dashboard/repositories')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {copy.backButton}
            </Button>
          </div>
        </div>
      </header>

      <main className={dashboardMainClass}>
        <div className={dashboardContentStackClass}>
          {errorMessage ? <Alert variant="error" onClose={() => setErrorMessage('')}>{errorMessage}</Alert> : null}
          {successMessage ? <Alert variant="success" onClose={() => setSuccessMessage('')}>{successMessage}</Alert> : null}

          {isLoadingRepository ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {copy.loadingRepository}
            </div>
          ) : null}

          {repository ? (
            <>
              {/* ===== Summary strip ===== */}
              <section
                aria-label="Repository summary"
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
              >
                <SummaryCard label="Status">
                  <p className="text-sm font-medium mt-2 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${getScanStatusTone(repository.status === 'healthy' ? 'complete' : repository.status === 'warnings' ? 'pending' : repository.status === 'error' ? 'failed' : 'skipped_unchanged').dot}`} />
                    {repository.status === 'archived'
                      ? 'Disabled'
                      : repository.status === 'scan_in_progress'
                        ? 'Scan in progress'
                        : repository.status.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[10px] font-mono text-gray-400 mt-1">
                    {repository.status === 'healthy'
                      ? 'no open errors'
                      : repository.status === 'warnings'
                        ? 'review scan warnings'
                        : repository.status === 'error'
                          ? 'last scan failed'
                          : 'awaiting scan'}
                  </p>
                </SummaryCard>

                <SummaryCard label="Branches tracked">
                  <p className="text-2xl font-bold mt-2 font-mono">{branchRows.length}</p>
                  <p className="text-[10px] font-mono text-gray-400 mt-1 truncate" title={branchRows.map((b) => b.branch).join(' · ')}>
                    {branchRows.length > 0 ? branchRows.map((b) => b.branch).join(' · ') : 'no branches configured'}
                  </p>
                </SummaryCard>

                <SummaryCard label="Files tracked">
                  <p className="text-2xl font-bold mt-2 font-mono">
                    {latestScan ? latestScan.filesSeen : '—'}
                  </p>
                  <p className="text-[10px] font-mono mt-1 text-emerald-500">
                    {latestScan
                      ? `${latestScan.filesClassified} classified · ${latestScan.filesUnknown} unknown · ${latestScan.filesFailed} failed`
                      : 'no scan data'}
                  </p>
                </SummaryCard>

                <SummaryCard label="Last scan">
                  <p className="text-2xl font-bold mt-2 font-mono">
                    {latestScan ? (formatRelativeTime(latestScan.startedAt) ?? '—') : '—'}
                  </p>
                  <p className="text-[10px] font-mono text-gray-400 mt-1 truncate">
                    {latestScan
                      ? `${formatDuration(latestScan.startedAt, latestScan.finishedAt)} · ${latestScan.status}`
                      : 'never scanned'}
                  </p>
                </SummaryCard>

                <SummaryCard label="Diff · vs prev scan">
                  <p className="text-base font-semibold mt-2 font-mono">
                    {latestScan ? (
                      <>
                        <span className="text-emerald-500">+{latestScan.diffSummary.added ?? 0}</span>
                        {' · '}
                        <span className="text-amber-500">~{latestScan.diffSummary.modified ?? 0}</span>
                        {' · '}
                        <span className="text-rose-500">-{latestScan.diffSummary.removed ?? 0}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </p>
                  <p className="text-[10px] font-mono text-gray-400 mt-1">
                    {previousScan ? 'added · modified · removed' : 'no prior scan to compare'}
                  </p>
                </SummaryCard>
              </section>

              {/* ===== Tabbed content ===== */}
              <Tabs value={activeTab} onValueChange={(value) => setTab(value as RepositoryTab)} className="space-y-4">
                <div className={`${repositoryPanelClass}`}>
                  <TabsList className={tabListClass}>
                    {repositoryTabs.map((tab) => {
                      const Icon = tabIcons[tab];
                      const count = tabCounts[tab];
                      return (
                        <TabsTrigger key={tab} value={tab} className={tabTriggerClass}>
                          <Icon className="w-4 h-4" />
                          <span>{tabLabel[tab]}</span>
                          {count != null ? (
                            <span className="font-mono text-[10px] text-gray-400">{count}</span>
                          ) : null}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>

                {/* ============ BRANCHES ============ */}
                <TabsContent value="branches" className={repositoryPanelClass}>
                  <div className={`${repositoryPanelHeaderClass} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="text-base font-semibold">Tracked branches</h3>
                        <p className={repositoryPanelEyebrowClass}>
                          {branchRows.length} of {availableBranches.length || branchRows.length} branches monitored · re-fetch from GitHub to discover new branches
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => void loadRepository()}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Sync from GitHub
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void saveBranches()}
                        disabled={isSavingBranches || branchRows.length === 0}
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        {isSavingBranches ? copy.savingButton : copy.saveBranchesButton}
                      </Button>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-2">
                        {copy.availableBranchesLabel}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableBranches.map((branchName) => {
                          const tracked = branchRows.some((row) => row.branch === branchName);
                          return (
                            <button
                              key={branchName}
                              type="button"
                              onClick={() =>
                                setBranchRows((prev) =>
                                  prev.some((row) => row.branch === branchName)
                                    ? prev.filter((row) => row.branch !== branchName)
                                    : [...prev, { branch: branchName, subpathGlob: '**/*' }],
                                )
                              }
                              className={`px-2.5 py-1 text-xs rounded-full font-mono inline-flex items-center gap-1.5 border transition-colors ${
                                tracked
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/60 dark:text-indigo-300'
                                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              {tracked ? <CheckCircle2 className="w-3 h-3" /> : null}
                              {branchName}
                            </button>
                          );
                        })}
                        {availableBranches.length === 0 ? (
                          <span className="text-xs text-gray-500">No remote branch list available — add patterns below.</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        value={customBranchPattern}
                        onChange={(event) => setCustomBranchPattern(event.target.value)}
                        placeholder={copy.branchPatternPlaceholder}
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          const next = customBranchPattern.trim();
                          if (!next || branchRows.some((row) => row.branch === next)) return;
                          setBranchRows((prev) => [...prev, { branch: next, subpathGlob: '**/*' }]);
                          setCustomBranchPattern('');
                        }}
                      >
                        {copy.addPatternButton}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {branchRows.map((branch, index) => {
                        const isPattern = branch.branch.includes('*');
                        const isDefault = !isPattern && index === 0;
                        return (
                          <div
                            key={branch.branch}
                            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium font-mono text-sm flex items-center gap-1.5 truncate">
                                <GitBranch className={`w-3.5 h-3.5 ${isPattern ? 'text-purple-500' : 'text-indigo-500'}`} />
                                {branch.branch}
                              </span>
                              {isDefault ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  default
                                </span>
                              ) : isPattern ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                  pattern
                                </span>
                              ) : null}
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block">
                                Subpath glob
                              </label>
                              <Input
                                value={branch.subpathGlob}
                                placeholder={copy.branchSubpathPlaceholder}
                                onChange={(event) =>
                                  setBranchRows((prev) =>
                                    prev.map((row) =>
                                      row.branch === branch.branch
                                        ? { ...row, subpathGlob: event.target.value }
                                        : row,
                                    ),
                                  )
                                }
                              />
                              <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block">
                                Poll interval (seconds)
                              </label>
                              <Input
                                type="number"
                                min={15}
                                max={86400}
                                value={branch.pollIntervalSec ?? ''}
                                placeholder={copy.pollIntervalPlaceholder}
                                onChange={(event) => {
                                  const next = Number.parseInt(event.target.value, 10);
                                  setBranchRows((prev) =>
                                    prev.map((row) =>
                                      row.branch === branch.branch
                                        ? { ...row, pollIntervalSec: Number.isFinite(next) ? next : undefined }
                                        : row,
                                    ),
                                  );
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setBranchRows((prev) => prev.filter((row) => row.branch !== branch.branch))}
                              >
                                {copy.removeButton}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* ============ FILES ============ */}
                <TabsContent value="files" className={repositoryPanelClass}>
                  <div className={`${repositoryPanelHeaderClass} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                      <FileSearch className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="text-base font-semibold">Repository files</h3>
                        <p className={repositoryPanelEyebrowClass}>
                          {scanFiles.length} files · classification + quality scoring per file
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:flex-1 sm:min-w-[24rem] sm:justify-end">
                      <select
                        className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                        value={selectedScanId}
                        onChange={(event) => setSelectedScanId(event.target.value)}
                        aria-label="Scan"
                      >
                        {scans.map((scan) => (
                          <option key={scan.id} value={scan.id}>
                            {scan.branch} · {scan.status} · {formatTimestamp(scan.startedAt)}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                        value={formatFilter}
                        onChange={(event) => setFormatFilter(event.target.value)}
                        aria-label="Format"
                      >
                        <option value="all">Format: All</option>
                        {Array.from(new Set(scanFiles.map((file) => file.format || 'unknown'))).map((format) => (
                          <option key={format} value={format}>{format}</option>
                        ))}
                      </select>
                      <select
                        className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                        value={fileStatusFilter}
                        onChange={(event) => setFileStatusFilter(event.target.value)}
                        aria-label="File status"
                      >
                        <option value="all">Status: All</option>
                        {Array.from(new Set(scanFiles.map((file) => file.status))).map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <div className="flex-1 min-w-[16rem]">
                        <Input
                          value={filePathFilter}
                          onChange={(event) => setFilePathFilter(event.target.value)}
                          placeholder="Filter by path substring..."
                          className="h-8 w-full text-xs font-mono"
                          aria-label="Filter path"
                        />
                      </div>
                    </div>
                  </div>

                  {isLoadingFiles ? (
                    <div className="p-5 text-sm text-gray-500">Loading files...</div>
                  ) : (
                    <div
                      ref={fileViewportRef}
                      className="overflow-auto"
                      style={{ height: fileViewportHeightPx }}
                      onScroll={(event) => setFileScrollTop(event.currentTarget.scrollTop)}
                    >
                      <div className="sticky top-0 z-10 grid grid-cols-[1fr_120px_120px_140px] text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50/95 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-700">
                        <div className="px-5 py-2 font-semibold">Path</div>
                        <div className="px-3 py-2 font-semibold">Format</div>
                        <div className="px-3 py-2 font-semibold">Status</div>
                        <div className="px-5 py-2 font-semibold text-right">Quality</div>
                      </div>
                      <div style={{ height: filteredFiles.length * rowHeightPx, position: 'relative' }}>
                        {visibleFiles.map((file, offset) => {
                          const index = visibleRange.start + offset;
                          const quality = getQualityTone(file.qualityScore);
                          const isSelected = selectedFile?.id === file.id;
                          return (
                            <button
                              key={file.id}
                              type="button"
                              className={`absolute left-0 right-0 grid grid-cols-[1fr_120px_120px_140px] items-center text-left border-b border-gray-100 dark:border-gray-700/60 transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50/60 dark:bg-indigo-900/20'
                                  : 'hover:bg-gray-50/60 dark:hover:bg-gray-900/30'
                              }`}
                              style={{ top: index * rowHeightPx, height: rowHeightPx }}
                              onClick={() => setSelectedFile(file)}
                            >
                              <div className="px-5 py-2 font-mono text-xs truncate flex items-center gap-1.5">
                                {isSelected ? <ChevronRight className="w-3 h-3 text-indigo-500 flex-shrink-0" /> : null}
                                <span className="truncate">{file.path}</span>
                              </div>
                              <div className="px-3 py-2">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${getFileFormatPillClass(file.format)}`}>
                                  {file.format || 'unknown'}
                                </span>
                              </div>
                              <div className="px-3 py-2">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${getFileStatusPillClass(file.status)}`}>
                                  {file.status}
                                </span>
                              </div>
                              <div className="px-5 py-2 text-right">
                                {quality ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className={`font-mono text-xs ${quality.text}`}>{file.qualityScore}</span>
                                    <span className="w-12 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden inline-block">
                                      <span className={`block h-1 ${quality.bar}`} style={{ width: `${file.qualityScore}%` }} />
                                    </span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs text-gray-400">—</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="px-5 py-2.5 border-t border-gray-100 dark:border-gray-700/60 text-[11px] text-gray-500 font-mono flex items-center justify-between">
                    <span>
                      Showing {filteredFiles.length} of {scanFiles.length} · virtualized scroll
                    </span>
                    <span>click row · open drawer</span>
                  </div>
                </TabsContent>

                {/* ============ SPECS ============ */}
                <TabsContent value="specs" className={repositoryPanelClass}>
                  <div className={`${repositoryPanelHeaderClass} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                      <FileCode2 className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="text-base font-semibold">Importable specs</h3>
                        <p className={repositoryPanelEyebrowClass}>
                          Files the walker classified with confidence ≥ 50% · toggle import / auto-import per spec
                        </p>
                      </div>
                    </div>
                  </div>
                  <RepositorySpecsTab
                    repositoryId={repository.id}
                    branches={branchRows.map((row) => row.branch).filter((value, index, self) => self.indexOf(value) === index)}
                    initialBranch={branchRows[0]?.branch || ''}
                    initialFilter={queryStatusFilter}
                    onFilterChange={setSpecFilterQuery}
                    initialFileId={initialSpecFileId}
                    onSelectedFileIdChange={setSpecFileIdQuery}
                  />
                </TabsContent>

                {/* ============ SCANS ============ */}
                <TabsContent value="scans" className={repositoryPanelClass}>
                  <div className={`${repositoryPanelHeaderClass} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="text-base font-semibold">Scan timeline</h3>
                        <p className={repositoryPanelEyebrowClass}>
                          {scans.length} scans across all branches · click a failed scan to expand the event log
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => void triggerScanNow()}>
                        <ScanSearch className="h-4 w-4 mr-2" />
                        {copy.scanNowButton}
                      </Button>
                      <a
                        href={repo63IssueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-500"
                      >
                        REPO-6.3 →
                      </a>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {isLoadingScans ? <div className="text-sm text-gray-500">Loading scans...</div> : null}

                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Filter by trigger</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant={scanTriggerFilter === 'all' ? 'secondary' : 'outline'}
                          onClick={() => setScanTriggerFilter('all')}
                        >
                          Trigger: All
                        </Button>
                        {scanTriggerOptions.map((trigger) => (
                          <Button
                            key={trigger}
                            size="sm"
                            variant={scanTriggerFilter === trigger ? 'secondary' : 'outline'}
                            onClick={() => setScanTriggerFilter(trigger)}
                          >
                            Trigger: {trigger}
                          </Button>
                        ))}
                      </div>

                      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Filter by status</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant={scanStatusFilter === 'all' ? 'secondary' : 'outline'}
                          onClick={() => setScanStatusFilter('all')}
                        >
                          Status: All
                        </Button>
                        {scanStatusOptions.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={scanStatusFilter === status ? 'secondary' : 'outline'}
                            onClick={() => setScanStatusFilter(status)}
                          >
                            Status: {status}
                          </Button>
                        ))}
                      </div>

                      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Filter by branch</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant={scanBranchFilter === 'all' ? 'secondary' : 'outline'}
                          onClick={() => setScanBranchFilter('all')}
                        >
                          Branch: All
                        </Button>
                        {scanBranchOptions.map((branch) => (
                          <Button
                            key={branch}
                            size="sm"
                            variant={scanBranchFilter === branch ? 'secondary' : 'outline'}
                            onClick={() => setScanBranchFilter(branch)}
                          >
                            Branch: {branch}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-3 space-y-5 pt-2">
                      {filteredScans.map((scan) => {
                        const tone = getScanStatusTone(scan.status);
                        const isExpanded = expandedScanErrorId === scan.id;
                        return (
                          <li key={scan.id} className="ml-5 relative">
                            <span
                              className={`absolute -left-[28px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${tone.dot}`}
                            />
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap text-sm">
                                  <span className="font-medium">{scan.branch} · {scan.status}</span>
                                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${tone.pill}`}>
                                    {scan.status}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                                  {formatTimestamp(scan.startedAt)} · commit {shortSha(scan.commitSha) || 'pending'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                                  Trigger {scan.trigger} · Duration {formatDuration(scan.startedAt, scan.finishedAt)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                                  Files seen {scan.filesSeen} · classified {scan.filesClassified} · unknown {scan.filesUnknown} · failed {scan.filesFailed}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                                  +{scan.diffSummary.added ?? 0} / ~{scan.diffSummary.modified ?? 0} / -{scan.diffSummary.removed ?? 0}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <a
                                  className="text-xs text-indigo-600 hover:text-indigo-500"
                                  href={`/api/repositories/${repository.id}/scans/${scan.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View repository_scan
                                </a>
                                {scan.status === 'failed' ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setExpandedScanErrorId((current) => (current === scan.id ? '' : scan.id))}
                                  >
                                    {isExpanded ? 'Hide errors' : 'Show errors'}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            {scan.status === 'failed' && isExpanded ? (
                              <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-rose-200 dark:border-rose-700/40 bg-rose-50/60 dark:bg-rose-900/20 p-3 font-mono text-[11px] whitespace-pre overflow-x-auto leading-relaxed text-rose-900 dark:text-rose-200">
                                {extractScanErrorConsole(scan)}
                              </pre>
                            ) : null}
                          </li>
                        );
                      })}
                      {filteredScans.length === 0 && !isLoadingScans ? (
                        <li className="ml-5 text-sm text-gray-500">No scans match the current filters.</li>
                      ) : null}
                    </ol>
                  </div>
                </TabsContent>

                {/* ============ SYNC HISTORY ============ */}
                <TabsContent value="sync" className={repositoryPanelClass}>
                  <div className={`${repositoryPanelHeaderClass} flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                      <GitPullRequestArrow className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="text-base font-semibold">Sync history</h3>
                        <p className={repositoryPanelEyebrowClass}>
                          {syncHistory.length} sync events · pulls in from repo, pushes out to projects
                        </p>
                      </div>
                    </div>
                  </div>
                  {isLoadingSync ? <div className="px-5 py-4 text-sm text-gray-500">Loading sync history...</div> : null}
                  {syncHistory.length === 0 && !isLoadingSync ? (
                    <div className="px-5 py-6 text-sm text-gray-500">No sync events yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="text-left px-5 py-2 font-semibold">Time</th>
                            <th className="text-left px-3 py-2 font-semibold">Direction</th>
                            <th className="text-left px-3 py-2 font-semibold">Branch</th>
                            <th className="text-left px-3 py-2 font-semibold">File</th>
                            <th className="text-left px-3 py-2 font-semibold">Operation</th>
                            <th className="text-left px-3 py-2 font-semibold">State</th>
                            <th className="text-right px-5 py-2 font-semibold">Conflicts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {syncHistory.map((entry) => {
                            const inbound = entry.operation.toLowerCase().includes('upsert') || entry.operation.toLowerCase().includes('create');
                            const stateTone =
                              entry.state === 'committed' || entry.state === 'applied'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : entry.state === 'pending_review' || entry.state.includes('conflict')
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  : entry.state === 'failed' || entry.state === 'skipped'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
                            return (
                              <tr key={entry.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/30">
                                <td className="px-5 py-2.5 font-mono text-[11px] text-gray-500">{formatRelativeTime(entry.createdAt) ?? '—'}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                                    inbound
                                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                  }`}>
                                    {inbound ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                                    {inbound ? 'inbound' : 'outbound'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs">{entry.branch || '—'}</td>
                                <td className="px-3 py-2.5 font-mono text-xs truncate max-w-[280px]" title={entry.sourceUri}>
                                  {entry.sourceUri}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs">{entry.operation}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${stateTone}`}>
                                    {entry.state}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5 text-right font-mono text-xs">
                                  {entry.conflictRecords.length > 0 ? (
                                    <span className="text-amber-500">{entry.conflictRecords.length}</span>
                                  ) : (
                                    <span className="text-gray-400">0</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* ============ MANIFEST ============ */}
                <TabsContent value="manifest" className={repositoryPanelClass}>
                  <div className={`${repositoryPanelHeaderClass} flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                      <FileCode2 className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="text-base font-semibold">Manifest</h3>
                        <p className={`${repositoryPanelEyebrowClass} font-mono`}>
                          .objectified/repo.yaml · validated against the published REPO-2.4 schema
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void saveManifest()}
                      disabled={isSavingManifest || !manifestValidation.valid}
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {isSavingManifest ? copy.savingButton : 'Save manifest'}
                    </Button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <MonacoEditor
                        height="320px"
                        language="yaml"
                        value={manifestDraft}
                        onChange={(value) => setManifestDraft(value ?? '')}
                        options={{ minimap: { enabled: false }, fontSize: 13 }}
                      />
                    </div>
                    {manifestValidation.valid ? (
                      <div className="rounded-md border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        Manifest schema is valid.
                      </div>
                    ) : (
                      <div className="rounded-md border border-rose-200 dark:border-rose-700/40 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                        <div className="font-semibold">Manifest validation errors</div>
                        <ul className="list-disc pl-5 space-y-0.5 font-mono">
                          {manifestValidation.errors.map((error) => <li key={error}>{error}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ============ SETTINGS ============ */}
                <TabsContent value="settings" className="space-y-4">
                  <div className={repositoryPanelClass}>
                    <div className={`${repositoryPanelHeaderClass} flex items-center justify-between gap-3`}>
                      <div className="flex items-center gap-3">
                        <Settings2 className="w-5 h-5 text-indigo-500" />
                        <div>
                          <h3 className="text-base font-semibold">Repository identity</h3>
                          <p className={repositoryPanelEyebrowClass}>Owner and name as stored in Objectified</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void saveSettings()}
                        disabled={isSavingSettings}
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        {isSavingSettings ? copy.savingButton : copy.saveSettingsButton}
                      </Button>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block">
                          Owner
                        </label>
                        <Input
                          value={ownerInput}
                          onChange={(event) => setOwnerInput(event.target.value)}
                          placeholder={copy.ownerPlaceholder}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block">
                          Name
                        </label>
                        <Input
                          value={nameInput}
                          onChange={(event) => setNameInput(event.target.value)}
                          placeholder={copy.namePlaceholder}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-rose-200 dark:border-rose-700/40 overflow-hidden">
                    <div className="px-5 py-4 border-b border-rose-200 dark:border-rose-700/40 bg-rose-50/50 dark:bg-rose-900/15 flex items-center gap-3">
                      <AlertOctagon className="w-5 h-5 text-rose-500" />
                      <div>
                        <h3 className="text-base font-semibold text-rose-700 dark:text-rose-300">Danger zone</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Destructive actions · cannot be undone from the UI
                        </p>
                      </div>
                    </div>
                    <div className="divide-y divide-rose-100 dark:divide-rose-800/40">
                      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{isArchived ? 'Enable scanning' : 'Disable scanning'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isArchived
                              ? 'Re-enable scheduled and push-triggered scans for this repository.'
                              : 'Pauses all scheduled and push-triggered scans · history is preserved.'}
                          </p>
                        </div>
                        {isArchived ? (
                          <Button
                            variant="outline"
                            onClick={() => void updateLifecycle('unarchive')}
                            disabled={isMutatingLifecycle}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            {copy.enableButton}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => void updateLifecycle('archive')}
                            disabled={isMutatingLifecycle}
                          >
                            <Pause className="w-4 h-4 mr-2" />
                            {copy.disableButton}
                          </Button>
                        )}
                      </div>
                      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Delete repository</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Removes all scans, files, and sync history. The source repo on the provider is untouched.
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => setDeleteDialogOpen(true)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {copy.deleteButton}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.deleteDialogTitle}</DialogTitle>
            <DialogDescription>
              {copy.deleteDialogDescriptionPrefix}{' '}
              <span className="font-semibold">{repository?.fullName}</span>{' '}
              {copy.deleteDialogDescriptionSuffix}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            placeholder={repository?.fullName || copy.ownerNameFallbackPlaceholder}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              {copy.cancelButton}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void deleteRepository()}
              disabled={isDeleting || !repository || deleteConfirmation.trim() !== repository.fullName}
            >
              {isDeleting ? copy.savingButton : copy.deleteRepositoryButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedFile ? (
        // Anchor below the 48px platform bar so the drawer header isn't
        // hidden behind it (dashboard layout uses `calc(100vh - 48px)`).
        <div
          className="fixed top-12 right-0 bottom-0 left-0 z-50 bg-black/30"
          role="presentation"
          onClick={() => setSelectedFile(null)}
        >
          <aside
            ref={fileDrawerRef}
            className="absolute right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-gray-900 shadow-xl overflow-auto"
            role="dialog"
            aria-modal="true"
            aria-label="File detail drawer"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => { if (event.key === 'Escape') setSelectedFile(null); }}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                  Classification details
                </p>
                <p
                  className="text-sm font-medium font-mono mt-1 truncate flex items-center gap-1.5"
                  title={selectedFile.path}
                >
                  <FileCode2 className="h-4 w-4 flex-shrink-0" />
                  {selectedFile.path}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close file drawer"
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setSelectedFile(null)}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/60">
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Format</span>
                  <span className="font-mono">{selectedFile.format || 'unknown'}</span>
                </div>
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Status</span>
                  <span className="font-mono">{selectedFile.status}</span>
                </div>
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Tracked</span>
                  <span className={`font-mono ${selectedFile.tracked ? 'text-emerald-500' : ''}`}>
                    {selectedFile.tracked ? 'yes' : 'no'}
                    {selectedFile.tracked && selectedFile.promote ? ` · ${selectedFile.promote}-promote` : ''}
                  </span>
                </div>
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Confidence</span>
                  <span className="font-mono">{selectedFile.confidence ?? 'n/a'}</span>
                </div>
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Discriminator</span>
                  <span className="font-mono truncate max-w-[220px]" title={selectedFile.discriminator || 'n/a'}>
                    {selectedFile.discriminator || 'n/a'}
                  </span>
                </div>
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Project</span>
                  <span className="font-mono">{selectedFile.projectSlug || 'n/a'}</span>
                </div>
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Version strategy</span>
                  <span className="font-mono">{selectedFile.versionStrategy || 'n/a'}</span>
                </div>
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Quality score</span>
                  <span className="font-mono">{selectedFile.qualityScore ?? 'n/a'}</span>
                </div>
                <div className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-500">Blob SHA</span>
                  <span className="font-mono truncate max-w-[220px]" title={selectedFile.blobSha || 'n/a'}>
                    {selectedFile.blobSha ? shortSha(selectedFile.blobSha, 12) + '…' : 'n/a'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1.5">Raw diff</p>
                <pre className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-3 font-mono text-[11px] whitespace-pre overflow-x-auto leading-relaxed">
                  {buildRawDiffPreview(selectedFile)}
                </pre>
              </div>

              {selectedFile.tracked
                && selectedFile.promote === 'manual'
                && (selectedFile.status === 'new' || selectedFile.status === 'modified') ? (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    onClick={() => {
                      setSuccessMessage(`Promotion UI coming soon for ${selectedFile.path}.`);
                      setSelectedFile(null);
                    }}
                  >
                    Promotion UI coming soon
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

/**
 * Compact 1-card cell used inside the summary strip. Pulled out so each
 * card stays one short JSX block in the parent — no extra props plumbing
 * needed.
 */
function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
        {label}
      </p>
      {children}
    </div>
  );
}
