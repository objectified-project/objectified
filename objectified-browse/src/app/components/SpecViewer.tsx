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
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Check if REST API is accessible on mount
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const baseUrl = restApiBaseUrl.replace('/v1', '');
        const response = await fetch(baseUrl, { method: 'GET' });
        setApiStatus(response.ok ? 'online' : 'offline');
      } catch {
        setApiStatus('offline');
      }
    };
    checkApiHealth();
  }, [restApiBaseUrl]);

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

      console.log('Requesting URL:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load specification: ${response.statusText}`);
      }

      const data = await response.json();

      console.log('Data', data);
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
      {apiStatus === 'offline' && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/20">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                REST API Connection Issue
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-3">
                Cannot connect to the Objectified REST API at <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">{restApiBaseUrl}</code>
              </p>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-yellow-700 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-200">
                  How to fix this
                </summary>
                <div className="mt-2 space-y-2 text-yellow-800 dark:text-yellow-400">
                  <p><strong>1. Start the REST API server:</strong></p>
                  <pre className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded text-xs overflow-x-auto">
cd ../objectified-rest
python -m uvicorn app.main:app --reload
                  </pre>
                  <p><strong>2. Verify it's running:</strong></p>
                  <pre className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded text-xs">
curl http://localhost:8000/
                  </pre>
                  <p><strong>3. Update .env.local if needed:</strong></p>
                  <pre className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded text-xs">
NEXT_PUBLIC_REST_API_BASE_URL=http://localhost:8000/v1
                  </pre>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

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
          <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">Error Loading Specification</h3>
          <p className="text-sm text-red-800 dark:text-red-400 mb-3">{error}</p>
          <details className="text-xs" open={error.includes('CORS')}>
            <summary className="cursor-pointer text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200 font-medium">
              {error.includes('CORS') ? '🔧 CORS Fix Required' : 'Troubleshooting'}
            </summary>
            <div className="mt-3 space-y-3 text-red-800 dark:text-red-400">
              {error.includes('CORS') ? (
                <>
                  <div>
                    <p className="font-semibold mb-1">The REST API needs to allow requests from this origin:</p>
                    <code className="bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded block">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}</code>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Add this to your REST API (FastAPI example):</p>
                    <pre className="bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-x-auto text-xs">
{`from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)`}</pre>
                  </div>
                  <p>Then restart the REST API server.</p>
                </>
              ) : (
                <>
                  <p>• Check that the REST API is running at: <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">{restApiBaseUrl}</code></p>
                  <p>• Verify the version exists and is published</p>
                  <p>• Check browser console (F12) for detailed error messages</p>
                  <p>• Ensure CORS is configured to allow {typeof window !== 'undefined' ? window.location.origin : 'localhost:3000'}</p>
                </>
              )}
            </div>
          </details>
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

