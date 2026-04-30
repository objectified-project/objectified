'use client';

import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  FileCode2,
  Loader2,
  Workflow,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/Button';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { cn } from '@lib/utils';
import {
  formatMetadataCell,
  parseRepositoryFileSpecMetadata,
} from '@lib/repository-file-spec-metadata';

/** Indexed file row from the repository files list API (subset used by file detail). */
export type RepositoryFileDetailRow = {
  id: string;
  path: string;
  name: string;
  ext?: string | null;
  size_bytes?: number | null;
  blob_sha?: string | null;
  detected_kind?: string | null;
  display_kind: string;
  confidence: string;
};

type FileContentApi = {
  success?: boolean;
  path: string;
  branch: string;
  display_kind: string;
  confidence: string;
  blob_sha?: string | null;
  size_bytes?: number | null;
  content: string;
  truncated?: boolean;
  error?: string;
};

type FileViewTab = 'source' | 'diff' | 'visualize';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(520px,70vh)] items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
      Loading editor…
    </div>
  ),
});

/** Monaco `language` id derived from path (extension + well-known basenames). */
function monacoLanguageFromRepositoryPath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, '/');
  const base = trimmed.split('/').pop() ?? trimmed;
  const lower = base.toLowerCase();

  if (lower === 'dockerfile' || lower.endsWith('/dockerfile')) return 'dockerfile';
  if (lower === 'makefile' || lower === 'gnumakefile' || lower.endsWith('/makefile')) return 'makefile';
  if (lower === 'jenkinsfile' || lower.endsWith('/jenkinsfile')) return 'plaintext';
  if (lower.endsWith('.graphql') || lower.endsWith('.gql')) return 'graphql';

  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot + 1) : '';

  switch (ext) {
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'json':
    case 'avsc':
      return 'json';
    case 'sql':
    case 'ddl':
      return 'sql';
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'xml':
      return 'xml';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
      return 'scss';
    case 'less':
      return 'less';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescriptreact';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'javascriptreact';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'toml':
      return 'ini';
    case 'ini':
    case 'cfg':
    case 'conf':
      return 'ini';
    case 'properties':
      return 'ini';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'kt':
    case 'kts':
      return 'kotlin';
    case 'rb':
      return 'ruby';
    case 'php':
      return 'php';
    case 'cs':
      return 'csharp';
    case 'proto':
      return 'plaintext';
    case 'prisma':
      return 'sql';
    default:
      if (lower.endsWith('schema.prisma')) return 'sql';
      return 'plaintext';
  }
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function shortSha(sha: string | null | undefined): string {
  if (!sha) return '—';
  const s = sha.trim();
  return s.length > 7 ? s.slice(0, 7) : s;
}

function githubBlobHref(base: string | null, branch: string, path: string): string | null {
  if (!base) return null;
  const trimmed = base.replace(/\.git\/?$/i, '').replace(/\/$/, '');
  if (!trimmed.includes('github.com')) return null;
  const encPath = path
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  return `${trimmed}/blob/${encodeURIComponent(branch)}/${encPath}`;
}

function kindPillClass(displayKind: string): string {
  const k = displayKind.toLowerCase();
  if (k.includes('openapi')) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  }
  if (k.includes('arazzo')) {
    return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
  }
  if (k.includes('asyncapi')) {
    return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300';
  }
  if (k.includes('json schema')) {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
  }
  if (k.includes('graphql')) {
    return 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function tabBtnClass(active: boolean): string {
  return cn(
    'px-3 py-1.5 text-xs transition-colors',
    active
      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'
      : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
  );
}

function MetadataCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      aria-hidden
    >
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-3">
            <Skeleton className="h-3.5 w-20 shrink-0" />
            <Skeleton className="h-3.5 max-w-[55%] flex-1" />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

function VerdictCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      aria-hidden
    >
      <Skeleton className="mb-3 h-4 w-36" />
      <Skeleton className="h-[4.5rem] w-full rounded-lg" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
    </div>
  );
}

function SuggestedTargetCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      aria-hidden
    >
      <Skeleton className="mb-3 h-4 w-36" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 max-w-sm w-[80%]" />
    </div>
  );
}

function SourcePanelSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="hidden h-3 w-28 sm:block" />
      </div>
      <div className="h-[min(520px,70vh)] min-h-[240px] w-full p-2">
        <Skeleton className="h-full min-h-[220px] w-full rounded-sm" />
      </div>
    </div>
  );
}

export function RepositoryFileDetail({
  repositoryId,
  repositoryName,
  branch,
  file,
  githubWebBase,
  onBack,
}: {
  repositoryId: string;
  repositoryName: string;
  branch: string;
  file: RepositoryFileDetailRow;
  githubWebBase: string | null;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<FileViewTab>('source');
  const [payload, setPayload] = useState<FileContentApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const monacoLanguage = useMemo(() => monacoLanguageFromRepositoryPath(file.path), [file.path]);

  const specMetadata = useMemo(
    () => parseRepositoryFileSpecMetadata(payload?.content ?? '', file.path),
    [payload?.content, file.path]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/repositories/${encodeURIComponent(repositoryId)}/files/${encodeURIComponent(file.id)}/content`,
        { credentials: 'include' }
      );
      const json = (await res.json().catch(() => ({}))) as FileContentApi & { error?: string };
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : res.statusText);
      }
      if (typeof json.content !== 'string') {
        throw new Error('Invalid response from server');
      }
      setPayload(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load file';
      setError(msg);
      setPayload(null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [repositoryId, file.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const blobUrl = githubBlobHref(githubWebBase, branch, file.path);
  const displayKind = payload?.display_kind ?? file.display_kind;
  const confLabel =
    (payload?.confidence ?? file.confidence).toLowerCase().includes('filename') ||
    (payload?.confidence ?? file.confidence).toLowerCase() === 'filename'
      ? 'filename'
      : payload?.confidence ?? file.confidence;

  return (
    <div className="space-y-6" aria-busy={loading}>
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 pb-5 pt-6 dark:border-gray-700">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <ArrowLeft className="h-3 w-3 shrink-0" aria-hidden />
              Back to {repositoryName}
            </button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="break-all font-mono text-gray-600 dark:text-gray-300">{file.path}</span>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              <FileCode2 className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="break-all font-mono text-xl font-bold text-gray-900 dark:text-gray-100">{file.path}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    kindPillClass(displayKind)
                  )}
                >
                  {displayKind}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  confidence: {confLabel}
                </span>
                <span className="inline-flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                      Loading file…
                    </span>
                  ) : (
                    <>
                      {formatBytes(payload?.size_bytes ?? file.size_bytes)} ·{' '}
                      {shortSha(payload?.blob_sha ?? file.blob_sha)} · branch{' '}
                      <span className="text-indigo-600 dark:text-indigo-400">{branch}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-1.5 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => toast.message('Import mapping opens when the import wizard is wired to repository files.')}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Map &amp; import
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 px-6 py-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            {loading ? (
              <>
                <MetadataCardSkeleton />
                <VerdictCardSkeleton />
                <SuggestedTargetCardSkeleton />
              </>
            ) : null}
            {!loading ? (
              <>
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Detected metadata</h3>
              {payload?.truncated ? (
                <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                  File body is truncated; counts below reflect only the loaded portion.
                </p>
              ) : null}
              {specMetadata.parseError && !loading && payload ? (
                <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                  Could not parse as YAML/JSON: {specMetadata.parseError}
                </p>
              ) : null}
              {!loading && payload && specMetadata.format === 'unknown' && !specMetadata.parseError ? (
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  No recognised OpenAPI, Swagger, AsyncAPI, Arazzo, JSON Schema, or GraphQL SDL structure in this file.
                </p>
              ) : null}
              {!loading && payload && specMetadata.format !== 'unknown' ? (
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Values derived from the loaded file (client-side parse). Index kind:{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{displayKind}</span>.
                </p>
              ) : null}
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Spec</dt>
                  <dd className="max-w-[60%] text-right font-medium text-gray-900 dark:text-gray-100">
                    {specMetadata.spec ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Title</dt>
                  <dd className="max-w-[60%] text-right font-medium text-gray-900 dark:text-gray-100">
                    {specMetadata.title ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Version</dt>
                  <dd className="text-right font-mono text-xs text-gray-800 dark:text-gray-200">
                    {specMetadata.version ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Endpoints</dt>
                  <dd className="text-right font-mono text-xs text-gray-800 dark:text-gray-200">
                    {formatMetadataCell(specMetadata.endpoints)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Components</dt>
                  <dd className="text-right font-mono text-xs text-gray-800 dark:text-gray-200">
                    {formatMetadataCell(specMetadata.components)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Servers</dt>
                  <dd className="text-right font-mono text-xs text-gray-800 dark:text-gray-200">
                    {formatMetadataCell(specMetadata.servers)}
                  </dd>
                </div>
                <div className="border-t border-gray-100 pt-2 dark:border-gray-700">
                  <div className="flex justify-between gap-2 text-xs">
                    <dt className="text-gray-500">Path</dt>
                    <dd className="break-all text-right font-mono text-gray-600 dark:text-gray-400">{file.path}</dd>
                  </div>
                  <div className="mt-1 flex justify-between gap-2 text-xs">
                    <dt className="text-gray-500">Blob</dt>
                    <dd className="font-mono text-gray-600 dark:text-gray-400">
                      {shortSha(payload?.blob_sha ?? file.blob_sha)}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Importable verdict</h3>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Content sniff not run yet — verdict after parse pipeline.
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Filename-based detection: <span className="font-mono">{file.detected_kind ?? '—'}</span>. Opening the
                  file loads raw bytes from the provider for your review.
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                <li className="inline-flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
                  Indexed path on branch {branch}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                  Structural validation runs on import
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Suggested target</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Default project mapping from globs will surface here once repository importer mappings exist.
              </p>
            </div>
              </>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            {loading ? (
              <>
                <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-8 w-[4.5rem] rounded-md" />
                    <Skeleton className="h-8 w-[8.5rem] rounded-md" />
                    <Skeleton className="h-8 w-[5.5rem] rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-28 shrink-0 max-sm:hidden" />
                </div>
                <SourcePanelSkeleton />
              </>
            ) : (
              <>
            <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex flex-wrap overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                <button type="button" className={tabBtnClass(tab === 'source')} onClick={() => setTab('source')}>
                  Source
                </button>
                <button type="button" className={tabBtnClass(tab === 'diff')} onClick={() => setTab('diff')}>
                  Diff vs latest import
                </button>
                <button
                  type="button"
                  className={cn(tabBtnClass(tab === 'visualize'), 'inline-flex items-center gap-1')}
                  onClick={() => setTab('visualize')}
                >
                  <Workflow className="h-3 w-3" aria-hidden />
                  Visualize
                </button>
              </div>
              {blobUrl ? (
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  View on GitHub
                </a>
              ) : (
                <span className="text-[11px] text-gray-400">GitHub web link unavailable for this clone URL.</span>
              )}
            </div>

            {error ? (
              <p className="px-4 py-12 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>
            ) : (
              <>
                {tab === 'source' && (
                  <div className="flex flex-col">
                    <p className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-[10px] text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                      Syntax: <span className="text-indigo-600 dark:text-indigo-400">{monacoLanguage}</span>
                      <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                      read-only
                    </p>
                    <div className="h-[min(520px,70vh)] min-h-[240px] w-full overflow-hidden">
                      <MonacoEditor
                        height="100%"
                        path={file.path}
                        language={monacoLanguage}
                        value={payload?.content ?? ''}
                        theme={isDark ? 'vs-dark' : 'light'}
                        options={{
                          readOnly: true,
                          minimap: { enabled: true },
                          scrollBeyondLastLine: false,
                          fontSize: 12,
                          wordWrap: 'on',
                          lineNumbers: 'on',
                          folding: true,
                          padding: { top: 8, bottom: 8 },
                          renderWhitespace: 'selection',
                          automaticLayout: true,
                        }}
                      />
                    </div>
                    {payload?.truncated ? (
                      <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        File body truncated at the server limit (~{(payload.content?.length ?? 0).toLocaleString()}{' '}
                        characters shown). Open on GitHub or clone locally for the full file.
                      </p>
                    ) : null}
                  </div>
                )}
                {tab === 'diff' && (
                  <div className="max-h-[min(520px,70vh)] overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900/50">
                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                      Unified diff vs the last version imported from this path requires import history joined to blob
                      SHAs. Not wired yet.
                    </p>
                    <pre className="font-mono text-xs text-gray-500 dark:text-gray-400">—</pre>
                  </div>
                )}
                {tab === 'visualize' && (
                  <div className="max-h-[min(520px,70vh)] overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900/50">
                    <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                      The mockup&apos;s Visualize tab will use <span className="font-mono">@xyflow/react</span> with
                      nodes and edges from the parsed spec. Hydrate from the importer pipeline when content sniffing is
                      available.
                    </p>
                  </div>
                )}
              </>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
