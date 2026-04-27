'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Download,
  ExternalLink,
  FileWarning,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Switch } from '@/app/components/ui/Switch';
import type { RepositorySpecRecord, RepositorySpecStatus } from './RepositorySpecsTab';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const statusPillClass: Record<RepositorySpecStatus, string> = {
  importing: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  imported: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  parse_error: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  manifest_error: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  not_imported: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  unchanged_checksum: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const statusLabel: Record<RepositorySpecStatus, string> = {
  importing: 'Importing',
  imported: 'Imported',
  parse_error: 'Parse error',
  manifest_error: 'Manifest error',
  not_imported: 'Not imported',
  unchanged_checksum: 'Unchanged',
};

function StatusPill({ status }: { status: RepositorySpecStatus }) {
  const Icon = status === 'imported'
    ? CheckCircle2
    : status === 'importing'
      ? Loader2
      : status === 'parse_error' || status === 'manifest_error'
        ? AlertCircle
        : status === 'unchanged_checksum'
          ? CircleDot
          : CircleDashed;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusPillClass[status]}`}
      data-testid={`spec-drawer-status-${status}`}
    >
      <Icon className={status === 'importing' ? 'w-3 h-3 animate-spin' : 'w-3 h-3'} />
      {statusLabel[status]}
    </span>
  );
}

const formatPillClass: Record<string, string> = {
  openapi_3_0: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  openapi_3_1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  swagger_2_0: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  json_schema: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  json_schema_2020_12: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  asyncapi_2_6: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  graphql: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
};

function getFormatPillClass(format: string | null | undefined): string {
  const key = (format || 'unknown').toLowerCase();
  return formatPillClass[key] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

interface RecentImportSummary {
  id: string;
  state: string;
  sourceKind: string;
  operation: string;
  branch: string;
  createdAt: string;
  conflictCount: number;
  targetVersionId: string | null;
  targetProjectSlug: string | null;
  changeReportId: string | null;
  lintSummary: {
    errors: number;
    warnings: number;
    info: number;
    sourceImportJobId: string | null;
    derivedFrom: 'none' | 'import_job' | 'import_job_change_report';
  };
}

interface SpecDetailResponse {
  success: boolean;
  spec?: RepositorySpecRecord;
  branch?: string;
  path?: string;
  fullName?: string;
  provider?: 'github';
  providerWebUrl?: string | null;
  providerRawUrl?: string | null;
  recentImports?: RecentImportSummary[];
  lintSummary?: {
    errors: number;
    warnings: number;
    info: number;
    sourceImportJobId: string | null;
    derivedFrom: string;
  };
  error?: string;
}

interface SpecContentResponse {
  success: boolean;
  fileId?: string;
  repositoryId?: string;
  branch?: string;
  path?: string;
  format?: string | null;
  encoding?: 'utf-8' | 'base64';
  content?: string | null;
  sizeBytes?: number | null;
  truncated?: boolean;
  tooLargeForPreview?: boolean;
  maxInlineBytes?: number;
  contentChecksum?: string | null;
  providerRawUrl?: string | null;
  fetchedAt?: string;
  error?: string;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '—';
  return new Date(ts).toLocaleString();
}

function formatSizeBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Pick the Monaco language id for the spec preview. We prefer the format
 * coming from the backend, then fall back to the file extension. Anything
 * we don't recognise renders as plain text so Monaco doesn't fail to load.
 */
function inferMonacoLanguage(format: string | null | undefined, path: string | null | undefined): string {
  const fmt = (format || '').toLowerCase();
  if (fmt === 'json_schema' || fmt === 'json_schema_2020_12') return 'json';
  if (fmt === 'graphql') return 'graphql';
  if (fmt.startsWith('openapi') || fmt.startsWith('asyncapi') || fmt === 'swagger_2_0') {
    return path && /\.json$/i.test(path) ? 'json' : 'yaml';
  }
  if (path) {
    if (/\.json$/i.test(path)) return 'json';
    if (/\.ya?ml$/i.test(path)) return 'yaml';
    if (/\.graphql$/i.test(path)) return 'graphql';
  }
  return 'plaintext';
}

function shortJobId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

interface RepositorySpecDetailDrawerProps {
  spec: RepositorySpecRecord;
  repositoryId: string;
  /** Overrides the in-row spec record once the detail endpoint resolves. */
  onSpecRefresh: (spec: RepositorySpecRecord) => void;
  /** Drawer-side selection switch handler. Mirrors the row-level Switch. */
  onSelectionToggle: (
    fileId: string,
    payload: { importEnabled?: boolean; autoImportEnabled?: boolean },
  ) => Promise<void> | void;
  isPatchPending: boolean;
  onClose: () => void;
}

/**
 * Spec detail drawer (REPO-9.6).
 *
 * Lazily fetches:
 *   GET /api/repositories/{id}/specs/{fileId}/detail   — header metadata, lint
 *                                                        summary, recent imports
 *   GET /api/repositories/{id}/specs/{fileId}/content  — capped at 2 MB; falls
 *                                                        back to a download
 *                                                        prompt for larger
 *                                                        files
 *
 * Both fetches happen in parallel on mount and re-trigger when the user clicks
 * "Refresh". The drawer also wires up Esc-to-close at the dialog level so it
 * works regardless of which inner control has focus.
 */
export function RepositorySpecDetailDrawer({
  spec,
  repositoryId,
  onSpecRefresh,
  onSelectionToggle,
  isPatchPending,
  onClose,
}: RepositorySpecDetailDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const [detail, setDetail] = useState<SpecDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');

  const [content, setContent] = useState<SpecContentResponse | null>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [contentError, setContentError] = useState('');

  const [showRaw, setShowRaw] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const loadDetail = useCallback(async () => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/specs/${spec.fileId}/detail`,
      );
      const data = (await response.json()) as SpecDetailResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load spec detail');
      }
      setDetail(data);
      if (data.spec) onSpecRefresh(data.spec);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load spec detail';
      setDetailError(message);
    } finally {
      setDetailLoading(false);
    }
  }, [repositoryId, spec.fileId, onSpecRefresh]);

  const loadContent = useCallback(async () => {
    setContentLoading(true);
    setContentError('');
    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/specs/${spec.fileId}/content`,
      );
      const data = (await response.json()) as SpecContentResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load spec content');
      }
      setContent(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load spec content';
      setContentError(message);
    } finally {
      setContentLoading(false);
    }
  }, [repositoryId, spec.fileId]);

  useEffect(() => {
    void loadDetail();
    void loadContent();
  }, [loadDetail, loadContent]);

  const onCopyLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'specs');
    url.searchParams.set('fileId', spec.fileId);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }, [spec.fileId]);

  const language = useMemo(
    () => (showRaw ? 'plaintext' : inferMonacoLanguage(spec.format, spec.path)),
    [showRaw, spec.format, spec.path],
  );

  const previewText = useMemo(() => {
    if (!content || content.encoding !== 'utf-8' || content.content == null) return '';
    return content.content;
  }, [content]);

  const lintSummary = detail?.lintSummary ?? { errors: 0, warnings: 0, info: 0 };
  const recentImports = detail?.recentImports ?? [];
  const providerWebUrl = detail?.providerWebUrl ?? null;
  const providerRawUrl = detail?.providerRawUrl ?? content?.providerRawUrl ?? null;

  return (
    <div
      className="fixed top-12 right-0 bottom-0 left-0 z-40 bg-black/30"
      role="presentation"
      onClick={onClose}
      data-testid="spec-drawer-overlay"
    >
      <aside
        ref={drawerRef}
        className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white dark:bg-gray-900 shadow-xl overflow-auto flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Spec detail drawer"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
        data-testid="spec-drawer"
      >
        <header className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
              Spec detail
            </p>
            <p
              className="text-sm font-medium font-mono mt-1 truncate"
              title={spec.path}
              data-testid="spec-drawer-path"
            >
              {spec.path}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1 font-mono">
                branch
                <span className="text-gray-700 dark:text-gray-200">{spec.branch}</span>
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${getFormatPillClass(spec.format)}`}
              >
                {spec.format || 'unknown'}
              </span>
              <StatusPill status={spec.status} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onCopyLink()}
              data-testid="spec-drawer-copy-link"
              title="Copy a deep link to this spec"
            >
              {copyState === 'copied' ? (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
              ) : (
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy link'}
            </Button>
            {providerWebUrl ? (
              <a
                href={providerWebUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                data-testid="spec-drawer-open-provider"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Open in provider
              </a>
            ) : null}
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close spec drawer"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={onClose}
              data-testid="spec-drawer-close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </header>

        <div className="p-5 space-y-4 text-xs flex-1 overflow-auto">
          {/* ===== Lint summary chips ===== */}
          <section aria-label="Lint summary" data-testid="spec-drawer-lint-summary" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mr-1">
              Lint
            </span>
            <LintChip
              count={lintSummary.errors}
              label="errors"
              icon={AlertCircle}
              tone="rose"
              testId="spec-drawer-lint-errors"
            />
            <LintChip
              count={lintSummary.warnings}
              label="warnings"
              icon={FileWarning}
              tone="amber"
              testId="spec-drawer-lint-warnings"
            />
            <LintChip
              count={lintSummary.info}
              label="info"
              icon={Info}
              tone="indigo"
              testId="spec-drawer-lint-info"
            />
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => { void loadDetail(); void loadContent(); }}
              className="ml-auto"
              data-testid="spec-drawer-refresh"
              title="Re-fetch detail + content"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${detailLoading || contentLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </section>

          {/* ===== Selection state ===== */}
          <section
            className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60"
            aria-label="Selection state"
          >
            <div className="px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold">Import</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Tracks this spec for change reports and import jobs.
                </p>
              </div>
              <Switch
                checked={spec.importEnabled}
                disabled={isPatchPending}
                onCheckedChange={(checked) => {
                  void onSelectionToggle(spec.fileId, { importEnabled: checked });
                }}
                aria-label={`Toggle import for ${spec.path}`}
                data-testid="spec-drawer-import-toggle"
              />
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold">Auto-import</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Apply incoming change reports automatically (requires import enabled).
                </p>
              </div>
              <Switch
                checked={spec.autoImportEnabled}
                disabled={isPatchPending || !spec.importEnabled}
                onCheckedChange={(checked) => {
                  void onSelectionToggle(spec.fileId, { autoImportEnabled: checked });
                }}
                aria-label={`Toggle auto-import for ${spec.path}`}
                data-testid="spec-drawer-auto-toggle"
              />
            </div>
            <div className="px-3 py-2 flex justify-between gap-3 items-center">
              <span className="text-gray-500">Last imported</span>
              <span className="font-mono text-[11px]">{formatTimestamp(spec.lastImportedAt)}</span>
            </div>
          </section>

          {/* ===== Preview ===== */}
          <section aria-label="Preview" className="space-y-2" data-testid="spec-drawer-preview">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                Preview
              </p>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={showRaw}
                  onChange={(event) => setShowRaw(event.target.checked)}
                  data-testid="spec-drawer-show-raw"
                />
                Show raw
              </label>
            </div>

            {contentLoading ? (
              <div className="flex items-center gap-2 text-gray-500 px-2 py-6" data-testid="spec-drawer-content-loading">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading file content…
              </div>
            ) : contentError ? (
              <div
                className="rounded-md border border-rose-200 dark:border-rose-700/40 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-rose-700 dark:text-rose-300 flex items-center gap-2"
                role="alert"
                data-testid="spec-drawer-content-error"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {contentError}
              </div>
            ) : content?.tooLargeForPreview ? (
              <div
                className="rounded-md border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-3 text-amber-800 dark:text-amber-200 space-y-2"
                data-testid="spec-drawer-too-large"
              >
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  File too large to preview
                </div>
                <p className="text-[11px]">
                  This file is {formatSizeBytes(content.sizeBytes)}, which exceeds the {formatSizeBytes(content.maxInlineBytes)} inline preview cap.
                </p>
                {providerRawUrl ? (
                  <a
                    href={providerRawUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs px-2.5 py-1.5 rounded-md border border-amber-300 bg-white dark:bg-amber-900/30 hover:bg-amber-50 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-100"
                    data-testid="spec-drawer-download"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download raw file
                  </a>
                ) : null}
              </div>
            ) : content?.encoding === 'base64' ? (
              <div
                className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-3 text-gray-600 dark:text-gray-300 space-y-2"
                data-testid="spec-drawer-binary"
              >
                <p>Binary content (base64) — cannot render an inline preview.</p>
                {providerRawUrl ? (
                  <a
                    href={providerRawUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download raw file
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <MonacoEditor
                  height="320px"
                  language={language}
                  value={previewText}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                  }}
                />
              </div>
            )}
            {content && !content.tooLargeForPreview && content.encoding === 'utf-8' ? (
              <p className="text-[10px] font-mono text-gray-400">
                {formatSizeBytes(content.sizeBytes)} · {language} · fetched {formatTimestamp(content.fetchedAt)}
              </p>
            ) : null}
          </section>

          {/* ===== Recent imports ===== */}
          <section aria-label="Recent imports" data-testid="spec-drawer-recent-imports">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1.5">
              Recent imports
            </p>
            {detailLoading ? (
              <div className="flex items-center gap-2 text-gray-500 px-2 py-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : detailError ? (
              <div
                className="rounded-md border border-rose-200 dark:border-rose-700/40 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-rose-700 dark:text-rose-300"
                role="alert"
              >
                {detailError}
              </div>
            ) : recentImports.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No imports yet for this file.</p>
            ) : (
              <ul className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
                {recentImports.map((job) => (
                  <li
                    key={job.id}
                    className="px-3 py-2 flex items-center justify-between gap-3"
                    data-testid={`spec-drawer-import-${job.id}`}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] truncate">
                        {shortJobId(job.id)} · {job.operation}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {formatTimestamp(job.createdAt)} · {job.state}
                        {job.conflictCount > 0 ? ` · ${job.conflictCount} conflict${job.conflictCount === 1 ? '' : 's'}` : ''}
                      </p>
                    </div>
                    {job.changeReportId ? (
                      <a
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 inline-flex items-center text-[11px]"
                        href={`/ade/dashboard/repositories/${repositoryId}?tab=sync&importJobId=${encodeURIComponent(job.id)}`}
                      >
                        Change report
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-400">no change report</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

interface LintChipProps {
  count: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'rose' | 'amber' | 'indigo';
  testId: string;
}

function LintChip({ count, label, icon: Icon, tone, testId }: LintChipProps) {
  const toneClass = {
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  }[tone];
  const isQuiet = count === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
        isQuiet ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : toneClass
      }`}
      data-testid={testId}
    >
      <Icon className="w-3 h-3" />
      {count} {label}
    </span>
  );
}
