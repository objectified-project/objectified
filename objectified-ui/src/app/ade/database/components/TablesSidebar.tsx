'use client';

import * as React from 'react';
import { FileCode } from 'lucide-react';
import { useDatabase } from '../DatabaseContext';
import SchemaViewModal from './SchemaViewModal';

interface TableRow {
  class_schema_id: string;
  class_id: string;
  class_name: string;
  schema: Record<string, unknown>;
}

export default function TablesSidebar() {
  const { selectedVersionId, selectedTable, setSelectedTable, isReadOnly, refreshTableCountRef } = useDatabase();
  const [tables, setTables] = React.useState<TableRow[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(false);
  const [countsLoading, setCountsLoading] = React.useState(false);
  const [schemaModalRow, setSchemaModalRow] = React.useState<TableRow | null>(null);

  const refreshCountForClass = React.useCallback((classSchemaId: string) => {
    fetch(`/api/database/snapshot/count?classSchemaId=${encodeURIComponent(classSchemaId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && typeof data.count === 'number') {
          setCounts((prev) => ({ ...prev, [classSchemaId]: data.count }));
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refreshTableCountRef.current = refreshCountForClass;
    return () => {
      refreshTableCountRef.current = null;
    };
  }, [refreshTableCountRef, refreshCountForClass]);

  React.useEffect(() => {
    if (!selectedVersionId) {
      setTables([]);
      setCounts({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/database/versions/${selectedVersionId}/tables`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.tables) {
          setTables(data.tables);
          const ids = (data.tables as TableRow[]).map((t) => t.class_schema_id);
          if (ids.length > 0) {
            setCountsLoading(true);
            fetch(`/api/database/snapshot/counts?classSchemaIds=${ids.map(encodeURIComponent).join(',')}`)
              .then((r2) => r2.json())
              .then((data2) => {
                if (cancelled) return;
                if (data2.success && data2.counts) setCounts(data2.counts);
              })
              .catch(() => { if (!cancelled) setCounts({}); })
              .finally(() => { if (!cancelled) setCountsLoading(false); });
          } else {
            setCounts({});
          }
        } else {
          setTables([]);
          setCounts({});
        }
      })
      .catch(() => { if (!cancelled) setTables([]); setCounts({}); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedVersionId]);

  const handleTableClick = (row: TableRow) => {
    setSelectedTable({ classSchemaId: row.class_schema_id, className: row.class_name });
  };

  const openSchemaModal = (e: React.MouseEvent, row: TableRow) => {
    e.stopPropagation();
    setSchemaModalRow(row);
  };

  const closeSchemaModal = () => setSchemaModalRow(null);

  return (
    <aside
      className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden"
      style={{ width: 280, minWidth: 280 }}
    >
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tables</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading tables...</div>
        ) : tables.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">No tables. Publish a version to see class schemas.</div>
        ) : (
          <ul className="space-y-1">
            {tables.map((row) => {
              const isSelected = selectedTable?.classSchemaId === row.class_schema_id;
              const count = counts[row.class_schema_id];
              const showCount = typeof count === 'number';
              return (
                <li key={row.class_schema_id}>
                  <div
                    className={`flex items-center gap-1 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleTableClick(row)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className="font-medium">{row.class_name}</span>
                      {countsLoading && !showCount && <span className="ml-2 text-xs text-gray-400">...</span>}
                      {showCount && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({count})</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => openSchemaModal(e, row)}
                      className="shrink-0 p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                      title="View JSON Schema"
                      aria-label={`View JSON Schema for ${row.class_name}`}
                    >
                      <FileCode className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <SchemaViewModal
        open={schemaModalRow != null}
        onClose={closeSchemaModal}
        className={schemaModalRow?.class_name ?? ''}
        schema={schemaModalRow?.schema ?? null}
      />
    </aside>
  );
}
