'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, FileBarChart2, GitCommitHorizontal, Loader2, Timer } from 'lucide-react';
import { buttonVariants } from '@/app/components/ui/Button';
import { Alert } from '@/app/components/ui/Alert';
import { Skeleton } from '@/app/components/ui/Skeleton';
import {
  dashboardContentStackClass,
  dashboardMainClass,
  repositoryHeaderEyebrowClass,
  repositoryHeaderIconTileClass,
  repositoryHeaderShellClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';

type ScanMetadata = {
  commitSha: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
};

type ReportErr = {
  kind?: string;
  path?: string | null;
  code?: string | null;
  message?: string;
  errorDetail?: string | null;
};

type FilePayload = {
  fileId?: string;
  path: string;
  status: string;
  format?: string | null;
  confidence?: number | null;
  importEnabled?: boolean;
  autoImportEnabled?: boolean;
  tracked?: boolean;
  discriminator?: string | null;
};

type ComparePrev = {
  otherReportId: string;
  totalsDelta: Record<string, number>;
  filePathsAdded: number;
  filePathsRemoved: number;
  filePathsInBoth: number;
};

type ReportDetail = {
  id: string;
  scanId: string;
  repositoryId: string;
  generatedAt: string;
  attentionScore: number;
  totals: Record<string, number | boolean>;
  payload: FilePayload[];
  errors: ReportErr[];
  scan: ScanMetadata | null;
  previousReportId: string | null;
  compareToPrevious: ComparePrev | null;
};

function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function toErrorDetailText(detail: unknown): string {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail.trim() ? detail : '';
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return JSON.stringify(item, null, 2);
        return String(item);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof detail === 'object') return JSON.stringify(detail, null, 2);
  return String(detail);
}

function errorConsoleText(err: ReportErr): string {
  const head = [err.message, err.path ? `Path: ${err.path}` : null, err.code ? `Code: ${err.code}` : null]
    .filter(Boolean)
    .join('\n');
  const detail = toErrorDetailText(err.errorDetail);
  if (!head && !detail) return 'No error detail on record for this item.';
  return [head, detail || null].filter(Boolean).join('\n\n');
}

export default function RepositoryScanReportDrillInPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? '');
  const scanIdParam = String(params.scanId ?? '');

  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const listMsgId = useId();

  const loadDetail = useCallback(
    async (reportId: string, signal?: AbortSignal) => {
      const res = await fetch(`/api/repositories/${encodeURIComponent(id)}/scan-reports/${encodeURIComponent(reportId)}`, {
        signal,
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to load scan report');
      }
      return body.data as ReportDetail;
    },
    [id],
  );

  const resolveLatest = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetch(`/api/repositories/${encodeURIComponent(id)}/scan-reports`, { signal });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to list scan reports');
      }
      const items = (body.data as { items?: { id: string }[] })?.items ?? [];
      if (items.length < 1 || !items[0].id) {
        throw new Error('No materialized scan report found for this repository yet.');
      }
      return String(items[0].id);
    },
    [id],
  );

  useEffect(() => {
    if (!id) return;
    setError('');
    setIsLoading(true);
    setDetail(null);
    const ac = new AbortController();
    (async () => {
      try {
        if (scanIdParam === 'latest') {
          const rid = await resolveLatest(ac.signal);
          router.replace(`/ade/dashboard/repositories/${id}/reports/${rid}`);
          return;
        }
        const d = await loadDetail(scanIdParam, ac.signal);
        setDetail(d);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    })();
    return () => ac.abort();
  }, [id, loadDetail, resolveLatest, router, scanIdParam]);

  const totals = detail?.totals;
  const compare = detail?.compareToPrevious;

  const liveMessage = useMemo(() => {
    if (isLoading) return 'Loading scan report';
    if (error) return error;
    if (!detail) return 'Empty';
    return `Report ${detail.id} loaded.`;
  }, [detail, error, isLoading]);

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
                  <Link
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    href={`/ade/dashboard/repositories/${id}`}
                  >
                    {id}
                  </Link>
                  <span className="mx-2 text-gray-400" aria-hidden>
                    /
                  </span>
                  <Link
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    href="/ade/dashboard/repositories/reports"
                  >
                    Scan reports
                  </Link>
                </p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scanned repository report</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Snapshot of server materialized totals and files at scan time (read-only, no live provider calls).
                </p>
              </div>
            </div>
            {detail && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-sm" title={detail.id}>
                  Report {detail.id}
                </span>
              </div>
            )}
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

          {isLoading && scanIdParam === 'latest' && (
            <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Resolving the latest report…
            </p>
          )}

          {isLoading && scanIdParam !== 'latest' && (
            <div className="space-y-3" aria-label="Loading report">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}

          {detail && !isLoading && (
            <>
              <section
                className="rounded-lg border border-gray-200/80 dark:border-slate-600/50 bg-white/90 dark:bg-slate-800/30 p-4"
                aria-label="Report summary"
              >
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Summary</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border border-gray-200/60 dark:border-slate-600/30 p-3">
                    <p className="text-xs uppercase text-gray-500">Attention score</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
                      {detail.attentionScore}
                    </p>
                  </div>
                  {totals && (
                    <>
                      {(
                        [
                          ['Discovered', totals.discovered],
                          ['Importable', totals.importable],
                          ['Imported (committed)', totals.imported],
                          ['Failing', totals.failing],
                          ['Parse errors', totals.parseError],
                          ['Manifest errors', totals.manifestError],
                          ['Awaiting selection', totals.awaitingSelection],
                        ] as const
                      ).map(([label, n]) => (
                        <div
                          key={String(label)}
                          className="rounded-md border border-gray-200/60 dark:border-slate-600/30 p-3"
                        >
                          <p className="text-xs uppercase text-gray-500">{label}</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
                            {typeof n === 'boolean' ? (n ? 1 : 0) : Number(n ?? 0)}
                          </p>
                        </div>
                      ))}
                      {totals.scanFailed && (
                        <div className="rounded-md border border-rose-200/80 dark:border-rose-800/50 p-3 col-span-full">
                          <p className="text-xs font-medium text-rose-800 dark:text-rose-200">Last scan state</p>
                          <p className="text-sm text-rose-800 dark:text-rose-200">This snapshot marks the scan as failed</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {detail.scan && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-800 dark:text-gray-100">
                    <p className="inline-flex items-center gap-1.5">
                      <GitCommitHorizontal className="w-4 h-4 text-gray-400" aria-hidden />
                      <span className="font-mono text-xs break-all">SHA {detail.scan.commitSha}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Trigger</span>{' '}
                      <span className="capitalize">{detail.scan.trigger}</span>
                    </p>
                    <p className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <Timer className="w-3.5 h-3.5" aria-hidden />
                      <span>Started {formatTime(detail.scan.startedAt)}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Finished</span> {formatTime(detail.scan.finishedAt || undefined)}
                    </p>
                    <p>
                      <span className="text-gray-500">Scan job</span> <span className="font-mono text-xs">{detail.scanId}</span>
                    </p>
                  </div>
                )}
              </section>

              {compare && (
                <section
                  className="rounded-lg border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-4"
                  aria-label="Compare with previous"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Compare with previous scan</h2>
                      <p className="text-xs text-indigo-800/90 dark:text-indigo-200/80 mt-1">
                        Path churn: {compare.filePathsAdded} added, {compare.filePathsRemoved} removed,{' '}
                        {compare.filePathsInBoth} in both. Totals delta is current report minus the prior snapshot.
                      </p>
                    </div>
                    <Link
                      className={buttonVariants({ size: 'sm', variant: 'outline' })}
                      href={`/ade/dashboard/repositories/${id}/reports/${compare.otherReportId}`}
                    >
                      Open previous report
                    </Link>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left py-1.5 pr-2 text-gray-500">Metric</th>
                          <th className="text-left py-1.5 tabular-nums">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(compare.totalsDelta).map(([k, v]) => (
                          <tr key={k} className="border-t border-indigo-200/50 dark:border-indigo-800/30">
                            <td className="py-1 pr-2 text-gray-700 dark:text-gray-200">{k}</td>
                            <td className="py-1 font-mono tabular-nums text-gray-900 dark:text-white">
                              {v > 0 ? `+${v}` : v}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section
                className="rounded-lg border border-gray-200/80 dark:border-slate-600/50 overflow-hidden"
                aria-label="Files in this snapshot"
              >
                <h2 className="px-3 py-2.5 text-sm font-semibold bg-gray-50/90 dark:bg-slate-800/50">Files (snapshot)</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50/90 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">Path</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">Status</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">Format</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">Selection</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500">Auto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payload.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-3 text-gray-500">
                            No file rows in this report (for example, a failed scan before classification).
                          </td>
                        </tr>
                      )}
                      {detail.payload.map((r) => (
                        <tr key={r.path + (r.fileId || '')} className="border-t border-gray-200/60 dark:border-slate-600/30">
                          <td className="px-3 py-2 font-mono text-xs break-all text-gray-900 dark:text-white">{r.path}</td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{r.status}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{r.format || '—'}</td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                            {r.importEnabled ? 'on' : 'off'}
                          </td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                            {r.autoImportEnabled ? 'on' : 'off'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {detail.errors.length > 0 && (
                <section
                  className="rounded-lg border border-gray-200/80 dark:border-slate-600/50 p-4"
                  aria-label="Report errors"
                >
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Errors</h2>
                  <ul className="space-y-2">
                    {detail.errors.map((e, i) => (
                      <li key={i}>
                        <details
                          className="rounded-md border border-rose-200/70 dark:border-rose-800/40 bg-rose-50/50 dark:bg-rose-950/20"
                        >
                          <summary className="px-3 py-2 text-sm text-rose-900 dark:text-rose-100 cursor-pointer">
                            {e.kind === 'scan' ? 'Scan' : e.path || 'File'}: {e.message}
                          </summary>
                          <pre
                            className="mt-0 max-h-72 overflow-auto border-t border-rose-200/50 dark:border-rose-800/30 px-3 py-2 font-mono text-[11px] whitespace-pre-wrap break-words leading-relaxed text-rose-900 dark:text-rose-200"
                            tabIndex={0}
                          >
                            {errorConsoleText(e)}
                          </pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="flex flex-wrap gap-2">
                <Link
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  href="/ade/dashboard/repositories/reports"
                >
                  Back to tenant report
                </Link>
                <Link className={buttonVariants({ variant: 'default', size: 'sm' })} href={`/ade/dashboard/repositories/${id}`}>
                  Repository
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
