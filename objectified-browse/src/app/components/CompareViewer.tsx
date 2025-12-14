'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface CompareViewerProps {
  tenantSlug: string;
  projectSlug: string;
  versions: any[];
  restApiBaseUrl: string;
  initialV1?: string;
  initialV2?: string;
}

type SpecFormat = 'openapi' | 'arazzo' | 'jsonschema';

export function CompareViewer({
  tenantSlug,
  projectSlug,
  versions,
  restApiBaseUrl,
  initialV1,
  initialV2,
}: CompareViewerProps) {
  const router = useRouter();
  const [format, setFormat] = useState<SpecFormat>('openapi');
  const [version1, setVersion1] = useState(initialV1 || versions[1]?.version_id || '');
  const [version2, setVersion2] = useState(initialV2 || versions[0]?.version_id || '');
  const [spec1, setSpec1] = useState<any>(null);
  const [spec2, setSpec2] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');

  useEffect(() => {
    if (version1 && version2) {
      loadSpecs();
      // Update URL with selected versions
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

      if (!response1.ok || !response2.ok) {
        throw new Error('Failed to load specifications');
      }

      const [data1, data2] = await Promise.all([
        response1.json(),
        response2.json(),
      ]);

      setSpec1(data1);
      setSpec2(data2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDiff = () => {
    if (!spec1 || !spec2) return [];

    const str1 = JSON.stringify(spec1, null, 2);
    const str2 = JSON.stringify(spec2, null, 2);

    const lines1 = str1.split('\n');
    const lines2 = str2.split('\n');

    const diff: Array<{ type: 'same' | 'removed' | 'added'; line1?: string; line2?: string; lineNum1?: number; lineNum2?: number }> = [];

    let i = 0, j = 0;
    while (i < lines1.length || j < lines2.length) {
      if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
        diff.push({ type: 'same', line1: lines1[i], line2: lines2[j], lineNum1: i + 1, lineNum2: j + 1 });
        i++;
        j++;
      } else if (i < lines1.length && !lines2.slice(j).includes(lines1[i])) {
        diff.push({ type: 'removed', line1: lines1[i], lineNum1: i + 1 });
        i++;
      } else if (j < lines2.length && !lines1.slice(i).includes(lines2[j])) {
        diff.push({ type: 'added', line2: lines2[j], lineNum2: j + 1 });
        j++;
      } else {
        diff.push({ type: 'same', line1: lines1[i], line2: lines2[j], lineNum1: i + 1, lineNum2: j + 1 });
        i++;
        j++;
      }
    }

    return diff;
  };

  const diff = getDiff();

  return (
    <div>
      <div className="mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('openapi')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                format === 'openapi'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              OpenAPI
            </button>
            <button
              onClick={() => setFormat('arazzo')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                format === 'arazzo'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              Arazzo
            </button>
            <button
              onClick={() => setFormat('jsonschema')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                format === 'jsonschema'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              JSON Schema
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              Unified
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Version 1
            </label>
            <select
              value={version1}
              onChange={(e) => setVersion1(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {versions.map((v: any) => (
                <option key={v.id} value={v.version_id}>
                  {v.version_id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Version 2
            </label>
            <select
              value={version2}
              onChange={(e) => setVersion2(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {versions.map((v: any) => (
                <option key={v.id} value={v.version_id}>
                  {v.version_id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-zinc-600 dark:text-zinc-400">Loading specifications...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && spec1 && spec2 && (
        <>
          {viewMode === 'side-by-side' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Version {version1}
                  </h3>
                </div>
                <pre className="overflow-x-auto p-6 text-sm max-h-[800px] overflow-y-auto">
                  <code className="text-zinc-900 dark:text-zinc-50">
                    {JSON.stringify(spec1, null, 2)}
                  </code>
                </pre>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Version {version2}
                  </h3>
                </div>
                <pre className="overflow-x-auto p-6 text-sm max-h-[800px] overflow-y-auto">
                  <code className="text-zinc-900 dark:text-zinc-50">
                    {JSON.stringify(spec2, null, 2)}
                  </code>
                </pre>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Unified Diff (Version {version1} → {version2})
                </h3>
              </div>
              <div className="overflow-x-auto p-4 max-h-[800px] overflow-y-auto">
                <div className="font-mono text-sm">
                  {diff.map((item, idx) => (
                    <div
                      key={idx}
                      className={`whitespace-pre ${
                        item.type === 'removed'
                          ? 'bg-red-100 text-red-900 dark:bg-red-950/30 dark:text-red-400'
                          : item.type === 'added'
                          ? 'bg-green-100 text-green-900 dark:bg-green-950/30 dark:text-green-400'
                          : 'text-zinc-900 dark:text-zinc-50'
                      }`}
                    >
                      {item.type === 'removed' && `- ${item.line1}`}
                      {item.type === 'added' && `+ ${item.line2}`}
                      {item.type === 'same' && `  ${item.line1}`}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

