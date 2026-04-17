'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { diffLines, Change } from 'diff';
import { AppShell } from '../../../../components/AppShell';
import { Breadcrumb } from '../../../../components/Breadcrumb';
import { useTheme, specThemes } from '../../../../components/ThemeProvider';

interface Project {
  id: string;
  name: string;
  tenant_name?: string;
}

interface Version {
  id: string;
  version_id: string;
}

type SpecFormat = 'openapi' | 'arazzo' | 'jsonschema';
type ViewMode = 'side-by-side' | 'unified';

interface CompareClientProps {
  project: Project;
  versions: Version[];
  tenantSlug: string;
  projectSlug: string;
  restApiBaseUrl: string;
  initialV1?: string;
  initialV2?: string;
}

export function CompareClient({
  project,
  versions,
  tenantSlug,
  projectSlug,
  restApiBaseUrl,
  initialV1,
  initialV2,
}: CompareClientProps) {
  const router = useRouter();
  const { specTheme } = useTheme();
  const themeColors = specThemes[specTheme];

  const [format, setFormat] = useState<SpecFormat>('openapi');
  const [version1, setVersion1] = useState(initialV1 || versions[1]?.version_id || '');
  const [version2, setVersion2] = useState(initialV2 || versions[0]?.version_id || '');
  const [spec1, setSpec1] = useState<unknown>(null);
  const [spec2, setSpec2] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [diffResult, setDiffResult] = useState<Change[]>([]);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleLeftScroll = () => {
    if (isSyncingScroll.current || !leftPanelRef.current || !rightPanelRef.current) return;
    isSyncingScroll.current = true;
    rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleRightScroll = () => {
    if (isSyncingScroll.current || !leftPanelRef.current || !rightPanelRef.current) return;
    isSyncingScroll.current = true;
    leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const loadSpecs = useCallback(async () => {
    if (!version1 || !version2) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = format === 'openapi' ? 'schema' : format === 'arazzo' ? 'arazzo' : 'json';
      const [response1, response2] = await Promise.all([
        fetch(`${restApiBaseUrl}/${endpoint}/${tenantSlug}/${projectSlug}/${version1}`),
        fetch(`${restApiBaseUrl}/${endpoint}/${tenantSlug}/${projectSlug}/${version2}`),
      ]);
      if (!response1.ok || !response2.ok) {
        throw new Error('Failed to load specifications');
      }
      const [data1, data2] = await Promise.all([response1.json(), response2.json()]);
      setSpec1(data1);
      setSpec2(data2);
      const content1 = JSON.stringify(data1, null, 2);
      const content2 = JSON.stringify(data2, null, 2);
      setDiffResult(diffLines(content1, content2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [version1, version2, format, restApiBaseUrl, tenantSlug, projectSlug]);

  useEffect(() => {
    if (version1 && version2) {
      loadSpecs();
      router.push(`?v1=${version1}&v2=${version2}`, { scroll: false });
    }
  }, [version1, version2, format, loadSpecs, router]);

  const diffStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const part of diffResult) {
      if (part.added) added += part.value.split('\n').length - 1;
      else if (part.removed) removed += part.value.split('\n').length - 1;
    }
    return { added, removed };
  }, [diffResult]);

  if (versions.length < 2) {
    return (
      <AppShell containerSize="wide">
        <div className="space-y-6 py-8">
          <Breadcrumb
            items={[
              { label: project.tenant_name || tenantSlug, href: `/tenant/${tenantSlug}` },
              { label: project.name, href: `/tenant/${tenantSlug}/${projectSlug}` },
              { label: 'Compare' },
            ]}
          />
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white/40 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Not enough versions
            </h3>
            <p className="mt-1 text-[13px] text-zinc-600 dark:text-zinc-400">
              At least two published versions are required to compare.
            </p>
            <Link
              href={`/tenant/${tenantSlug}/${projectSlug}`}
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand-soft-text)] hover:text-[var(--brand-hover)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to project
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell containerSize="wide">
      <div className="space-y-5 py-8">
        <Breadcrumb
          items={[
            { label: project.tenant_name || tenantSlug, href: `/tenant/${tenantSlug}` },
            { label: project.name, href: `/tenant/${tenantSlug}/${projectSlug}` },
            { label: 'Compare versions' },
          ]}
        />

        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Compare versions
          </h1>
          <p className="mt-1 text-[14px] text-zinc-600 dark:text-zinc-400">
            Diff two published versions of <span className="font-medium">{project.name}</span> side by side.
          </p>
        </header>

        {/* Toolbar */}
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Base">
                <select
                  value={version1}
                  onChange={(e) => setVersion1(e.target.value)}
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-[13px] text-zinc-900 shadow-xs focus-visible:border-[var(--brand)] focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.version_id}>
                      v{v.version_id}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>

              <Field label="Compare">
                <select
                  value={version2}
                  onChange={(e) => setVersion2(e.target.value)}
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-[13px] text-zinc-900 shadow-xs focus-visible:border-[var(--brand)] focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.version_id}>
                      v{v.version_id}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              {!loading && !error && diffResult.length > 0 && (
                <div className="mb-1 flex items-center gap-1.5">
                  <Chip tone="success">+{diffStats.added.toLocaleString()}</Chip>
                  <Chip tone="danger">-{diffStats.removed.toLocaleString()}</Chip>
                </div>
              )}
              <Field label="Format">
                <Segmented
                  value={format}
                  options={[
                    { value: 'openapi', label: 'OpenAPI' },
                    { value: 'arazzo', label: 'Arazzo' },
                    { value: 'jsonschema', label: 'JSON Schema' },
                  ]}
                  onChange={(v) => setFormat(v as SpecFormat)}
                />
              </Field>
              <Field label="View">
                <Segmented
                  value={viewMode}
                  options={[
                    { value: 'side-by-side', label: 'Side by side' },
                    { value: 'unified', label: 'Unified' },
                  ]}
                  onChange={(v) => setViewMode(v as ViewMode)}
                />
              </Field>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-16 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 animate-spin text-[var(--brand)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Loading specifications...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 dark:border-rose-900/50 dark:bg-rose-950/20">
            <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              Could not load specifications
            </h3>
            <p className="mt-1 text-[13px] text-rose-800 dark:text-rose-300/90">{error}</p>
          </div>
        )}

        {!loading && !error && spec1 != null && spec2 != null && diffResult.length > 0 && (
          <>
            <div className="text-[13px] text-zinc-600 dark:text-zinc-400">
              <span className="font-mono">v{version1}</span>{' '}
              <span aria-hidden="true">&rarr;</span>{' '}
              <span className="font-mono">v{version2}</span>
            </div>

            {viewMode === 'unified' ? (
              <div
                className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700"
                style={{ height: '600px', backgroundColor: themeColors.bgColor }}
              >
                <div className="h-full overflow-auto font-mono text-xs">
                  {(() => {
                    let lineNumber = 0;
                    return diffResult.map((part, index) => {
                      const lines = part.value.split('\n').slice(0, -1);
                      return (
                        <div key={index}>
                          {lines.map((line, i) => {
                            if (!part.removed) lineNumber++;
                            const isUnchanged = !part.added && !part.removed;
                            return (
                              <div
                                key={i}
                                className={`flex ${
                                  part.added
                                    ? 'border-l-4 border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
                                    : part.removed
                                    ? 'border-l-4 border-rose-500 bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200'
                                    : ''
                                }`}
                                style={
                                  isUnchanged
                                    ? { backgroundColor: themeColors.bgColor, color: themeColors.textColor }
                                    : undefined
                                }
                              >
                                <div
                                  className={`w-12 shrink-0 select-none border-r pr-2 text-right ${
                                    part.added
                                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                                      : part.removed
                                      ? 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20'
                                      : 'border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/50'
                                  } text-zinc-500`}
                                >
                                  {!part.removed ? lineNumber : ''}
                                </div>
                                <div className="flex-1 whitespace-pre-wrap break-words px-3 py-0.5">
                                  {part.added && <span className="mr-2 font-semibold">+</span>}
                                  {part.removed && <span className="mr-2 font-semibold">-</span>}
                                  {!part.added && !part.removed && (
                                    <span className="mr-3 opacity-0">·</span>
                                  )}
                                  {line || '\u00A0'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700" style={{ height: '600px' }}>
                <div className="grid h-full grid-cols-2">
                  <div
                    ref={leftPanelRef}
                    onScroll={handleLeftScroll}
                    className="overflow-auto border-r border-zinc-300 dark:border-zinc-600"
                    style={{ backgroundColor: themeColors.bgColor }}
                  >
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-300 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      <span className="font-mono">v{version1}</span>
                      <Chip tone="neutral">Base</Chip>
                    </div>
                    <div className="font-mono text-xs">
                      {(() => {
                        let lineNumber = 0;
                        return diffResult.map((part, index) => {
                          if (part.added) {
                            return (
                              <div key={index}>
                                {part.value
                                  .split('\n')
                                  .slice(0, -1)
                                  .map((_, i) => (
                                    <div
                                      key={i}
                                      className="flex bg-zinc-50/50 dark:bg-zinc-900/30"
                                      style={{ minHeight: '1.5rem' }}
                                    >
                                      <div className="w-12 shrink-0 select-none border-r border-zinc-200 bg-zinc-100/50 pr-2 text-right dark:border-zinc-700 dark:bg-zinc-800/50">
                                        &nbsp;
                                      </div>
                                      <div className="flex-1 px-3 py-0.5">&nbsp;</div>
                                    </div>
                                  ))}
                              </div>
                            );
                          }
                          const lines = part.value.split('\n').slice(0, -1);
                          return (
                            <div key={index}>
                              {lines.map((line, i) => {
                                lineNumber++;
                                const isUnchanged = !part.removed;
                                return (
                                  <div
                                    key={i}
                                    className={`flex ${
                                      part.removed
                                        ? 'bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200'
                                        : ''
                                    }`}
                                    style={
                                      isUnchanged
                                        ? { backgroundColor: themeColors.bgColor, color: themeColors.textColor }
                                        : undefined
                                    }
                                  >
                                    <div
                                      className={`w-12 shrink-0 select-none border-r pr-2 text-right ${
                                        part.removed
                                          ? 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20'
                                          : 'border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/50'
                                      } text-zinc-500`}
                                    >
                                      {lineNumber}
                                    </div>
                                    <div className="flex-1 whitespace-pre-wrap break-words px-3 py-0.5">
                                      {part.removed && (
                                        <span className="mr-2 font-semibold text-rose-600 dark:text-rose-400">-</span>
                                      )}
                                      {!part.removed && <span className="mr-3 opacity-0">·</span>}
                                      {line || '\u00A0'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                  <div
                    ref={rightPanelRef}
                    onScroll={handleRightScroll}
                    className="overflow-auto"
                    style={{ backgroundColor: themeColors.bgColor }}
                  >
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-300 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      <span className="font-mono">v{version2}</span>
                      <Chip tone="success">Compare</Chip>
                    </div>
                    <div className="font-mono text-xs">
                      {(() => {
                        let lineNumber = 0;
                        return diffResult.map((part, index) => {
                          if (part.removed) {
                            return (
                              <div key={index}>
                                {part.value
                                  .split('\n')
                                  .slice(0, -1)
                                  .map((_, i) => (
                                    <div
                                      key={i}
                                      className="flex bg-zinc-50/50 dark:bg-zinc-900/30"
                                      style={{ minHeight: '1.5rem' }}
                                    >
                                      <div className="w-12 shrink-0 select-none border-r border-zinc-200 bg-zinc-100/50 pr-2 text-right dark:border-zinc-700 dark:bg-zinc-800/50">
                                        &nbsp;
                                      </div>
                                      <div className="flex-1 px-3 py-0.5">&nbsp;</div>
                                    </div>
                                  ))}
                              </div>
                            );
                          }
                          const lines = part.value.split('\n').slice(0, -1);
                          return (
                            <div key={index}>
                              {lines.map((line, i) => {
                                lineNumber++;
                                const isUnchanged = !part.added;
                                return (
                                  <div
                                    key={i}
                                    className={`flex ${
                                      part.added
                                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
                                        : ''
                                    }`}
                                    style={
                                      isUnchanged
                                        ? { backgroundColor: themeColors.bgColor, color: themeColors.textColor }
                                        : undefined
                                    }
                                  >
                                    <div
                                      className={`w-12 shrink-0 select-none border-r pr-2 text-right ${
                                        part.added
                                          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                                          : 'border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/50'
                                      } text-zinc-500`}
                                    >
                                      {lineNumber}
                                    </div>
                                    <div className="flex-1 whitespace-pre-wrap break-words px-3 py-0.5">
                                      {part.added && (
                                        <span className="mr-2 font-semibold text-emerald-600 dark:text-emerald-400">+</span>
                                      )}
                                      {!part.added && <span className="mr-3 opacity-0">·</span>}
                                      {line || '\u00A0'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-6 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded border border-rose-300 bg-rose-100 dark:border-rose-700 dark:bg-rose-900/30"></div>
                <span>Removed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30"></div>
                <span>Added</span>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex h-8 items-center gap-0.5 rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800/80">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-50'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'success' | 'danger' | 'neutral';
}) {
  const cls =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : tone === 'danger'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums ${cls}`}
    >
      {children}
    </span>
  );
}
