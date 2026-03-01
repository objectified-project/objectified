'use client';

import * as React from 'react';
import { useMigration, type MigrationTableRow } from '../MigrationContext';

/** Normalize object for comparison by sorting keys (so key order doesn't affect equality). */
function normalizeForCompare(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = normalizeForCompare(obj[k]);
  }
  return sorted;
}

function schemaEquals(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}

export default function MigrationSidebar() {
  const { selectedProjectId, fromVersionId, toVersionId, fromTables, toTables, setFromTables, setToTables, selectedClassName, setSelectedClassName, ruleCountsVersion } = useMigration();
  const [loading, setLoading] = React.useState(false);
  const [ruleCounts, setRuleCounts] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!fromVersionId || !toVersionId || fromVersionId === toVersionId) {
      setFromTables([]);
      setToTables([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/database/versions/${fromVersionId}/tables`).then((r) => r.json()),
      fetch(`/api/database/versions/${toVersionId}/tables`).then((r) => r.json()),
    ])
      .then(([fromRes, toRes]) => {
        if (cancelled) return;
        setFromTables(fromRes.success && fromRes.tables ? fromRes.tables : []);
        setToTables(toRes.success && toRes.tables ? toRes.tables : []);
      })
      .catch(() => {
        if (!cancelled) {
          setFromTables([]);
          setToTables([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fromVersionId, toVersionId, setFromTables, setToTables]);

  React.useEffect(() => {
    if (!selectedProjectId || !fromVersionId || !toVersionId || fromVersionId === toVersionId) {
      setRuleCounts({});
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      projectId: selectedProjectId,
      fromVersionId,
      toVersionId,
    });
    fetch(`/api/migration-plans/counts?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success && data.counts && typeof data.counts === 'object') {
          setRuleCounts(data.counts as Record<string, number>);
        } else if (!cancelled) {
          setRuleCounts({});
        }
      })
      .catch(() => {
        if (!cancelled) setRuleCounts({});
      });
    return () => { cancelled = true; };
  }, [selectedProjectId, fromVersionId, toVersionId, ruleCountsVersion]);

  const combinedList = React.useMemo(() => {
    const byName = new Map<string, { fromSchema?: Record<string, unknown>; toSchema?: Record<string, unknown>; hasDifference: boolean }>();
    for (const row of fromTables) {
      const existing = byName.get(row.class_name) ?? { hasDifference: false };
      existing.fromSchema = row.schema;
      byName.set(row.class_name, existing);
    }
    for (const row of toTables) {
      const existing = byName.get(row.class_name) ?? { hasDifference: false };
      existing.toSchema = row.schema;
      byName.set(row.class_name, existing);
    }
    for (const [name, entry] of byName) {
      const inFrom = entry.fromSchema !== undefined;
      const inTo = entry.toSchema !== undefined;
      if (!inFrom || !inTo) {
        entry.hasDifference = true;
      } else {
        entry.hasDifference = !schemaEquals(entry.fromSchema!, entry.toSchema!);
      }
    }
    return Array.from(byName.entries())
      .map(([class_name, { hasDifference }]) => ({ class_name, hasDifference }))
      .sort((a, b) => a.class_name.localeCompare(b.class_name));
  }, [fromTables, toTables]);

  return (
    <aside
      className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden"
      style={{ width: 280, minWidth: 280 }}
    >
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Classes</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          From and to versions combined. Different color = schema differs.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading classes...</div>
        ) : combinedList.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">No classes in either version.</div>
        ) : (
          <ul className="space-y-1">
            {combinedList.map(({ class_name, hasDifference }) => {
              const isSelected = selectedClassName === class_name;
              const count = ruleCounts[class_name] ?? 0;
              return (
                <li key={class_name}>
                  <button
                    type="button"
                    onClick={() => setSelectedClassName(class_name)}
                    className={`flex items-center w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-700/50'
                        : hasDifference
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200/60 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="font-medium truncate flex-1 min-w-0">{class_name}</span>
                    {count > 0 && (
                      <span
                        className="shrink-0 ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                        title={`${count} rule${count === 1 ? '' : 's'} for this class`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
