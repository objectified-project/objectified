'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { diffLines, Change } from 'diff';
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

export function CompareClient({
  project,
  versions,
  tenantSlug,
  projectSlug,
  restApiBaseUrl,
  initialV1,
  initialV2,
}: {
  project: Project;
  versions: Version[];
  tenantSlug: string;
  projectSlug: string;
  restApiBaseUrl: string;
  initialV1?: string;
  initialV2?: string;
}) {
  const router = useRouter();
  const { specTheme } = useTheme();
  const themeColors = specThemes[specTheme];

  const [format, setFormat] = useState<SpecFormat>('openapi');
  const [version1, setVersion1] = useState(initialV1 || (versions[1]?.version_id || ''));
  const [version2, setVersion2] = useState(initialV2 || (versions[0]?.version_id || ''));
  const [spec1, setSpec1] = useState<any>(null);
  const [spec2, setSpec2] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [diffResult, setDiffResult] = useState<Change[]>([]);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleLeftScroll = () => {
    if (isSyncingScroll.current || !leftPanelRef.current || !rightPanelRef.current) return;
    isSyncingScroll.current = true;
    rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;
    requestAnimationFrame(() => { isSyncingScroll.current = false; });
  };

  const handleRightScroll = () => {
    if (isSyncingScroll.current || !leftPanelRef.current || !rightPanelRef.current) return;
    isSyncingScroll.current = true;
    leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
    requestAnimationFrame(() => { isSyncingScroll.current = false; });
  };

  useEffect(() => {
    if (version1 && version2) {
      loadSpecs();
      router.push(`?v1=${version1}&v2=${version2}`, { scroll: false });
    }
  }, [format, version1, version2]);

  const loadSpecs = async () => {
    if (!version1 || !version2) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = format === 'openapi' ? 'schema' : format === 'arazzo' ? 'arazzo' : 'json';
      const [response1, response2] = await Promise.all([
        fetch(`${restApiBaseUrl}/${endpoint}/${tenantSlug}/${projectSlug}/${version1}`),
        fetch(`${restApiBaseUrl}/${endpoint}/${tenantSlug}/${projectSlug}/${version2}`),
      ]);
      if (!response1.ok || !response2.ok) throw new Error('Failed to load specifications');
      const [data1, data2] = await Promise.all([response1.json(), response2.json()]);
      setSpec1(data1);
      setSpec2(data2);
      const content1 = JSON.stringify(data1, null, 2);
      const content2 = JSON.stringify(data2, null, 2);
      const diff = diffLines(content1, content2);
      setDiffResult(diff);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (versions.length < 2) {
    return (
      <div className="py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <Breadcrumb items={[
              { label: project.tenant_name || tenantSlug, href: `/tenant/${tenantSlug}` },
              { label: project.name, href: `/tenant/${tenantSlug}/${projectSlug}` },
              { label: 'Compare' },
            ]} />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Not enough versions</h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">At least two versions are required to compare.</p>
            <Link href={`/tenant/${tenantSlug}/${projectSlug}`} className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Back to project
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <Breadcrumb items={[
            { label: project.tenant_name || tenantSlug, href: `/tenant/${tenantSlug}` },
            { label: project.name, href: `/tenant/${tenantSlug}/${projectSlug}` },
            { label: 'Compare Versions' },
          ]} />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Compare Versions</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">Compare two versions of {project.name} side by side</p>
        </div>

        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Base Version</label>
                <select value={version1} onChange={(e) => setVersion1(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                  {versions.map((v) => (<option key={v.id} value={v.version_id}>v{v.version_id}</option>))}
                </select>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <svg className="h-5 w-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Compare To</label>
                <select value={version2} onChange={(e) => setVersion2(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                  {versions.map((v) => (<option key={v.id} value={v.version_id}>v{v.version_id}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                {(['openapi', 'arazzo', 'jsonschema'] as SpecFormat[]).map((f) => (
                  <button key={f} onClick={() => setFormat(f)} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${format === f ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400'}`}>
                    {f === 'openapi' ? 'OpenAPI' : f === 'arazzo' ? 'Arazzo' : 'JSON Schema'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                <button onClick={() => setViewMode('side-by-side')} className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium ${viewMode === 'side-by-side' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-400'}`}>Side by Side</button>
                <button onClick={() => setViewMode('unified')} className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium ${viewMode === 'unified' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-400'}`}>Unified</button>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-16 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <span className="text-zinc-600 dark:text-zinc-400">Loading specifications...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
            <h3 className="font-semibold text-red-900 dark:text-red-300">Error Loading Specifications</h3>
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && spec1 && spec2 && diffResult.length > 0 && (
          <>
            <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">v{version1} → v{version2}</div>

            {viewMode === 'unified' ? (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden" style={{ height: '600px', backgroundColor: themeColors.bgColor }}>
                <div className="overflow-auto h-full font-mono text-xs">
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
                                className={`flex ${part.added ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 border-l-4 border-green-500' : part.removed ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 border-l-4 border-red-500' : ''}`}
                                style={isUnchanged ? { backgroundColor: themeColors.bgColor, color: themeColors.textColor } : undefined}
                              >
                                <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r ${part.added ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : part.removed ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50'} text-zinc-500`}>{!part.removed ? lineNumber : ''}</div>
                                <div className="flex-1 px-3 py-0.5 whitespace-pre-wrap break-words">{part.added && <span className="font-semibold mr-2">+</span>}{part.removed && <span className="font-semibold mr-2">-</span>}{!part.added && !part.removed && <span className="mr-3 opacity-0">·</span>}{line || '\u00A0'}</div>
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
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden" style={{ height: '600px' }}>
                <div className="grid grid-cols-2 h-full">
                  <div ref={leftPanelRef} onScroll={handleLeftScroll} className="border-r border-zinc-300 dark:border-zinc-600 overflow-auto" style={{ backgroundColor: themeColors.bgColor }}>
                    <div className="sticky top-0 bg-blue-100 dark:bg-blue-900/30 px-3 py-2 text-xs font-semibold border-b border-zinc-300 dark:border-zinc-600 z-10 text-blue-900 dark:text-blue-200">v{version1} (Base)</div>
                    <div className="font-mono text-xs">
                      {(() => {
                        let lineNumber = 0;
                        return diffResult.map((part, index) => {
                          if (part.added) {
                            return (<div key={index}>{part.value.split('\n').slice(0, -1).map((_, i) => (<div key={i} className="flex bg-zinc-50/50 dark:bg-zinc-900/30" style={{ minHeight: '1.5rem' }}><div className="w-12 flex-shrink-0 text-right pr-2 select-none border-r border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50">&nbsp;</div><div className="flex-1 px-3 py-0.5">&nbsp;</div></div>))}</div>);
                          }
                          const lines = part.value.split('\n').slice(0, -1);
                          return (<div key={index}>{lines.map((line, i) => { lineNumber++; const isUnchanged = !part.removed; return (<div key={i} className={`flex ${part.removed ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200' : ''}`} style={isUnchanged ? { backgroundColor: themeColors.bgColor, color: themeColors.textColor } : undefined}><div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r ${part.removed ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50'} text-zinc-500`}>{lineNumber}</div><div className="flex-1 px-3 py-0.5 whitespace-pre-wrap break-words">{part.removed && <span className="font-semibold mr-2 text-red-600 dark:text-red-400">-</span>}{!part.removed && <span className="mr-3 opacity-0">·</span>}{line || '\u00A0'}</div></div>); })}</div>);
                        });
                      })()}
                    </div>
                  </div>
                  <div ref={rightPanelRef} onScroll={handleRightScroll} className="overflow-auto" style={{ backgroundColor: themeColors.bgColor }}>
                    <div className="sticky top-0 bg-green-100 dark:bg-green-900/30 px-3 py-2 text-xs font-semibold border-b border-zinc-300 dark:border-zinc-600 z-10 text-green-900 dark:text-green-200">v{version2} (Compare To)</div>
                    <div className="font-mono text-xs">
                      {(() => {
                        let lineNumber = 0;
                        return diffResult.map((part, index) => {
                          if (part.removed) {
                            return (<div key={index}>{part.value.split('\n').slice(0, -1).map((_, i) => (<div key={i} className="flex bg-zinc-50/50 dark:bg-zinc-900/30" style={{ minHeight: '1.5rem' }}><div className="w-12 flex-shrink-0 text-right pr-2 select-none border-r border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50">&nbsp;</div><div className="flex-1 px-3 py-0.5">&nbsp;</div></div>))}</div>);
                          }
                          const lines = part.value.split('\n').slice(0, -1);
                          return (<div key={index}>{lines.map((line, i) => { lineNumber++; const isUnchanged = !part.added; return (<div key={i} className={`flex ${part.added ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200' : ''}`} style={isUnchanged ? { backgroundColor: themeColors.bgColor, color: themeColors.textColor } : undefined}><div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r ${part.added ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50'} text-zinc-500`}>{lineNumber}</div><div className="flex-1 px-3 py-0.5 whitespace-pre-wrap break-words">{part.added && <span className="font-semibold mr-2 text-green-600 dark:text-green-400">+</span>}{!part.added && <span className="mr-3 opacity-0">·</span>}{line || '\u00A0'}</div></div>); })}</div>);
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"></div><span>Removed</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"></div><span>Added</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
