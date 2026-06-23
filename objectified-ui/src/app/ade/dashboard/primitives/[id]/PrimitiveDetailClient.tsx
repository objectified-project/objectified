'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileCode, AlertCircle, Shield } from 'lucide-react';
import { Alert } from '@/app/components/ui/Alert';
import { LoadingState } from '@/app/components/ui/LoadingState';
import { Button } from '@/app/components/ui/Button';
import {
  dashboardMainClass,
  dashboardPanelClass,
  dashboardPanelPaddedClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';

interface PrimitiveDetail {
  id: string;
  name: string;
  description: string | null;
  category: string;
  schema: Record<string, unknown>;
  is_system: boolean;
  namespace?: string | null;
  schema_id?: string | null;
  base_uri?: string | null;
  draft?: string;
  source?: string;
  refs?: Array<{ relative_ref?: string; resolved_target?: string; status?: string }>;
  usage_count: number;
  tags?: string[];
}

export default function PrimitiveDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [primitive, setPrimitive] = useState<PrimitiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPrimitive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/primitives/${params.id}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to load primitive');
        setPrimitive(null);
        return;
      }
      setPrimitive(data.primitive as PrimitiveDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load primitive');
      setPrimitive(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      void loadPrimitive();
    }
  }, [params.id, loadPrimitive]);

  return (
    <>
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="secondary" size="sm" onClick={() => router.push('/ade/dashboard/primitives')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileCode className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            {loading ? 'Loading type…' : primitive?.name ?? 'Type detail'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Registry type detail · schema, references, and metadata
          </p>
        </div>
      </header>

      <main className={dashboardMainClass}>
        {loading ? (
          <LoadingState minHeightClassName="min-h-[240px]" message="Loading type detail…" />
        ) : error ? (
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </Alert>
        ) : primitive ? (
          <div className="space-y-6">
            <section className={`${dashboardPanelClass} ${dashboardPanelPaddedClass}`}>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {primitive.is_system ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    <Shield className="w-3 h-3 mr-1" />
                    System
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    Tenant
                  </span>
                )}
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  {primitive.namespace ?? 'no namespace'}
                </span>
                {primitive.schema_id ? (
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{primitive.schema_id}</span>
                ) : null}
              </div>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Category</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{primitive.category}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Draft</dt>
                  <dd className="font-mono text-gray-900 dark:text-white">{primitive.draft ?? '2020-12'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Source</dt>
                  <dd className="text-gray-900 dark:text-white">{primitive.source ?? 'human'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Usage</dt>
                  <dd className="text-gray-900 dark:text-white">{primitive.usage_count}</dd>
                </div>
                {primitive.description ? (
                  <div className="md:col-span-2">
                    <dt className="text-gray-500 dark:text-gray-400">Description</dt>
                    <dd className="text-gray-900 dark:text-white">{primitive.description}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {(primitive.refs?.length ?? 0) > 0 ? (
              <section className={`${dashboardPanelClass} overflow-hidden`}>
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Reference resolution</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-5 py-2 text-left text-xs uppercase text-gray-500">$ref</th>
                        <th className="px-5 py-2 text-left text-xs uppercase text-gray-500">Target</th>
                        <th className="px-5 py-2 text-right text-xs uppercase text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {primitive.refs?.map((edge, index) => (
                        <tr key={`${edge.relative_ref}-${index}`}>
                          <td className="px-5 py-3 font-mono text-xs">{edge.relative_ref ?? '—'}</td>
                          <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                            {edge.resolved_target ?? '—'}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                edge.status === 'unresolved'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              }`}
                            >
                              {edge.status ?? 'unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className={`${dashboardPanelClass} overflow-hidden`}>
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">JSON Schema</h3>
                <Link
                  href={`/ade/dashboard/primitives?edit=${primitive.id}`}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Edit in overview →
                </Link>
              </div>
              <pre className="p-5 text-xs font-mono overflow-x-auto text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/40">
                {JSON.stringify(primitive.schema, null, 2)}
              </pre>
            </section>
          </div>
        ) : null}
      </main>
    </>
  );
}
