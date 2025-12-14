'use client';

import { useState, useEffect } from 'react';

interface SpecViewerProps {
  tenantSlug: string;
  projectSlug: string;
  versionSlug: string;
  restApiBaseUrl: string;
}

type SpecFormat = 'openapi' | 'arazzo' | 'jsonschema';

export function SpecViewer({ tenantSlug, projectSlug, versionSlug, restApiBaseUrl }: SpecViewerProps) {
  const [format, setFormat] = useState<SpecFormat>('openapi');
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSpec();
  }, [format]);

  const loadSpec = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      switch (format) {
        case 'openapi':
          url = `${restApiBaseUrl}/schema/${tenantSlug}/${projectSlug}/${versionSlug}`;
          break;
        case 'arazzo':
          url = `${restApiBaseUrl}/arazzo/${tenantSlug}/${projectSlug}/${versionSlug}`;
          break;
        case 'jsonschema':
          url = `${restApiBaseUrl}/json/${tenantSlug}/${projectSlug}/${versionSlug}`;
          break;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load specification: ${response.statusText}`);
      }

      const data = await response.json();
      setSpec(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadSpec = () => {
    if (!spec) return;

    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectSlug}-${versionSlug}-${format}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (!spec) return;
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
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

        {spec && (
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Copy
            </button>
            <button
              onClick={downloadSpec}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Download
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-zinc-600 dark:text-zinc-400">Loading specification...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && spec && (
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
          <pre className="overflow-x-auto p-6 text-sm">
            <code className="text-zinc-900 dark:text-zinc-50">
              {JSON.stringify(spec, null, 2)}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}

