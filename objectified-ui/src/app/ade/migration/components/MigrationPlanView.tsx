'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useMigration } from '../MigrationContext';
import {
  ClipboardList,
  Search,
  FileJson,
  ChevronLeft,
  ChevronRight,
  List,
  Play,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const PAGE_SIZE = 20;

type SnapshotRow = {
  record_id: string;
  data: Record<string, unknown>;
  updated_at: string;
  created_at?: string;
  record_sequence?: number;
  last_action?: string;
};

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/** Confidence level for data quality based on rules coverage. */
function getConfidenceLevel(rulesAppliedCount: number, totalProperties: number): 'high' | 'medium' | 'low' {
  if (rulesAppliedCount === 0) return 'low';
  const coverage = totalProperties > 0 ? rulesAppliedCount / totalProperties : 0;
  if (coverage >= 0.5 || rulesAppliedCount >= 3) return 'high';
  if (rulesAppliedCount >= 1) return 'medium';
  return 'low';
}

export default function MigrationPlanView() {
  const { selectedClassName, fromTables, migrationRules } = useMigration();
  const [rows, setRows] = React.useState<SnapshotRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [searchQ, setSearchQ] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'none' | 'viewAll' | 'search'>('none');
  const [selectedRecord, setSelectedRecord] = React.useState<SnapshotRow | null>(null);
  const [transformedData, setTransformedData] = React.useState<Record<string, unknown> | null>(null);
  const [evaluateLoading, setEvaluateLoading] = React.useState(false);
  const [evaluateError, setEvaluateError] = React.useState<string | null>(null);

  const fromRow = selectedClassName
    ? fromTables.find((r) => r.class_name === selectedClassName)
    : null;
  const classSchemaId = fromRow?.class_schema_id ?? null;

  const runQuery = React.useCallback(
    (pageNum: number, searchQuery?: string) => {
      if (!classSchemaId) return;
      setLoading(true);
      const params = new URLSearchParams({
        classSchemaId,
        page: String(pageNum),
        pageSize: String(PAGE_SIZE),
        orderBy: 'updated_at',
        orderDir: 'desc',
      });
      const url = searchQuery
        ? `/api/database/snapshot/search?${params.toString()}&q=${encodeURIComponent(searchQuery)}`
        : `/api/database/snapshot?${params.toString()}`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.rows) {
            setRows(data.rows);
            setTotal(data.total ?? 0);
            setPage(data.page ?? pageNum);
          }
        })
        .finally(() => setLoading(false));
    },
    [classSchemaId]
  );

  React.useEffect(() => {
    if (!classSchemaId) {
      setRows([]);
      setTotal(0);
      setPage(1);
      setViewMode('none');
      setSelectedRecord(null);
      setTransformedData(null);
      setEvaluateError(null);
      return;
    }
    setViewMode('viewAll');
    setSelectedRecord(null);
    setTransformedData(null);
    setEvaluateError(null);
    runQuery(1, undefined);
  }, [classSchemaId]); // eslint-disable-line react-hooks/exhaustive-deps -- only reset when class changes

  const handleViewAll = () => {
    setViewMode('viewAll');
    if (classSchemaId) runQuery(1, undefined);
  };

  const handleSearch = () => {
    setViewMode('search');
    if (classSchemaId) runQuery(1, searchQ);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentIndex = selectedRecord ? rows.findIndex((r) => r.record_id === selectedRecord.record_id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < rows.length - 1;

  const goPrev = () => {
    if (!hasPrev || currentIndex <= 0) return;
    const prev = rows[currentIndex - 1];
    setSelectedRecord(prev);
    setTransformedData(null);
    setEvaluateError(null);
  };

  const goNext = () => {
    if (!hasNext || currentIndex >= rows.length - 1) return;
    const next = rows[currentIndex + 1];
    setSelectedRecord(next);
    setTransformedData(null);
    setEvaluateError(null);
  };

  const handlePageChange = (newPage: number) => {
    if (!classSchemaId) return;
    if (viewMode === 'search') runQuery(newPage, searchQ);
    else runQuery(newPage, undefined);
    setSelectedRecord(null);
    setTransformedData(null);
    setEvaluateError(null);
  };

  const handleEvaluate = React.useCallback(() => {
    if (!selectedRecord || !migrationRules) return;
    setEvaluateLoading(true);
    setEvaluateError(null);
    fetch('/api/migration-plans/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordData: selectedRecord.data, rules: migrationRules }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.transformedData !== undefined) {
          setTransformedData(data.transformedData as Record<string, unknown>);
        } else {
          setEvaluateError(data.error ?? 'Evaluate failed');
        }
      })
      .catch(() => setEvaluateError('Request failed'))
      .finally(() => setEvaluateLoading(false));
  }, [selectedRecord, migrationRules]);

  const rulesAppliedCount = React.useMemo(() => {
    if (!migrationRules || typeof migrationRules !== 'object') return 0;
    return Object.values(migrationRules).filter(
      (r) => r && typeof r === 'object' && (r.ruleContent?.trim?.()?.length ?? 0) > 0
    ).length;
  }, [migrationRules]);

  const totalProperties = React.useMemo(() => {
    const fromSchema = fromRow?.schema;
    if (!fromSchema || typeof fromSchema !== 'object') return 0;
    const props = (fromSchema as { properties?: Record<string, unknown> }).properties;
    return props && typeof props === 'object' ? Object.keys(props).length : 0;
  }, [fromRow]);

  const confidenceLevel = getConfidenceLevel(rulesAppliedCount, totalProperties);

  if (!selectedClassName) {
    return (
      <div className="h-full flex flex-col min-h-0 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Explorer</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Explore datasets and preview before/after transformation for the selected schema.
            </p>
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-center p-6">
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
            Select a class in the sidebar to explore records and see before/after data with rules applied.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Top 30%: Stats only */}
      <div className="flex-[0_0_30%] min-h-0 flex flex-col overflow-hidden border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4 px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rules applied</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{rulesAppliedCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          <div
            className={`p-2 rounded-md ${
              confidenceLevel === 'high'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : confidenceLevel === 'medium'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Data quality confidence</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 capitalize">{confidenceLevel}</p>
          </div>
        </div>
        </div>
      </div>

      {/* Bottom 70%: search/paging, record list, before/after transform */}
      <div className="flex-[0_0_70%] min-h-0 flex flex-col overflow-hidden">
      {/* Record search and paging with next/prev */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input
            type="text"
            placeholder="Search records..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 min-w-0 max-w-xs px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="shrink-0 p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleViewAll}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <List className="w-4 h-4" />
            View all
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="px-2.5 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:hover:bg-transparent"
          >
            Page prev
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-2.5 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:hover:bg-transparent"
          >
            Page next
          </button>
        </div>
        <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={!hasPrev}
            className="p-2 rounded-md border border-gray-200 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:hover:bg-transparent"
            title="Previous record"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[6rem] text-center">
            {selectedRecord ? `Record ${currentIndex + 1} of ${rows.length}` : 'Select a record'}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={!hasNext}
            className="p-2 rounded-md border border-gray-200 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:hover:bg-transparent"
            title="Next record"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Record list (compact) for selection + metadata + panels */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: record list (narrow) */}
        <div className="shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 w-52 min-w-0">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
            Records
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {viewMode === 'none' ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">View all or search to load.</div>
            ) : loading ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No records.</div>
            ) : (
              <ul className="p-1 space-y-0.5">
                {rows.map((row, idx) => {
                  const isSelected = selectedRecord?.record_id === row.record_id;
                  return (
                    <li key={row.record_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecord(row);
                          setTransformedData(null);
                          setEvaluateError(null);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors border ${
                          isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100'
                            : 'border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 block truncate">
                          {row.record_id}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{idx + 1}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Center + Right: metadata and Old | New */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Metadata for current record */}
          <div className="shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            {selectedRecord ? (
              <>
                <span className="text-gray-500 dark:text-gray-400">
                  <strong className="text-gray-700 dark:text-gray-300">ID:</strong>{' '}
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{selectedRecord.record_id}</code>
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  <strong className="text-gray-700 dark:text-gray-300">Updated:</strong> {formatDateTime(selectedRecord.updated_at)}
                </span>
                {selectedRecord.created_at != null && (
                  <span className="text-gray-500 dark:text-gray-400">
                    <strong className="text-gray-700 dark:text-gray-300">Created:</strong> {formatDateTime(selectedRecord.created_at)}
                  </span>
                )}
                {selectedRecord.record_sequence != null && (
                  <span className="text-gray-500 dark:text-gray-400">
                    <strong className="text-gray-700 dark:text-gray-300">Sequence:</strong> {selectedRecord.record_sequence}
                  </span>
                )}
                {selectedRecord.last_action && (
                  <span className="text-gray-500 dark:text-gray-400">
                    <strong className="text-gray-700 dark:text-gray-300">Last action:</strong> {selectedRecord.last_action}
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">Select a record to see metadata.</span>
            )}
          </div>

          {/* Old Record | New Record */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Old (left) */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 shrink-0">
                <FileJson className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Original record</span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {selectedRecord ? (
                  <MonacoEditor
                    height="100%"
                    language="json"
                    theme="vs-dark"
                    value={JSON.stringify(selectedRecord.data, null, 2)}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      wordWrap: 'on',
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 p-4">
                    <FileJson className="w-10 h-10" />
                    <p className="text-sm text-center">Select a record to see original data.</p>
                  </div>
                )}
              </div>
            </div>

            {/* New (right) */}
            <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileJson className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">After transform</span>
                </div>
                <button
                  type="button"
                  onClick={handleEvaluate}
                  disabled={!selectedRecord || evaluateLoading}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:pointer-events-none text-sm font-medium"
                >
                  <Play className="w-4 h-4" />
                  {evaluateLoading ? 'Applying…' : 'Apply rules'}
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {!selectedRecord ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 p-4">
                    <FileJson className="w-10 h-10" />
                    <p className="text-sm text-center">Select a record, then click Apply rules to see transformed data.</p>
                  </div>
                ) : evaluateError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-amber-600 dark:text-amber-400 p-4">
                    <p className="text-sm text-center">{evaluateError}</p>
                    <button
                      type="button"
                      onClick={handleEvaluate}
                      className="text-sm underline hover:no-underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : transformedData !== null ? (
                  <MonacoEditor
                    height="100%"
                    language="json"
                    theme="vs-dark"
                    value={JSON.stringify(transformedData, null, 2)}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      wordWrap: 'on',
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 p-4">
                    <Play className="w-10 h-10" />
                    <p className="text-sm text-center">
                      Click <strong>Apply rules</strong> to run the migration plan on this record and see the result.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
