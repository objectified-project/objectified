'use client';

import * as React from 'react';
import { BarChart3, ChevronDown, ChevronUp, X, Link2, Unlink, GitBranch, RefreshCw } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { SchemaMetricsResult } from '@/app/utils/schema-metrics';

interface SchemaMetricsPanelProps {
  metrics: SchemaMetricsResult | null;
  onClose?: () => void;
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

export default function SchemaMetricsPanel({
  metrics,
  onClose,
  isMinimized = false,
  onMinimizeToggle,
}: SchemaMetricsPanelProps) {
  if (!metrics) {
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80 dark:border-gray-700/80 w-72 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Schema Metrics</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Close">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Load a version to see metrics.</p>
      </div>
    );
  }

  const {
    classCount,
    totalProperties,
    averagePropertiesPerClass,
    relationshipCount,
    hubNames,
    isolatedNames,
    deepestChainLength,
    circularDependencyCount,
    circularSampleNames,
  } = metrics;

  const hasHubs = hubNames.length > 0;
  const hasIsolated = isolatedNames.length > 0;
  const hasCircular = circularDependencyCount > 0;

  if (isMinimized) {
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/80 dark:border-gray-700/80 p-2">
        <button
          onClick={onMinimizeToggle}
          className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <BarChart3 className="w-4 h-4" />
          <span>{classCount} classes</span>
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <Tooltip.Provider>
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80 dark:border-gray-700/80 w-80 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Schema Metrics</span>
          </div>
          <div className="flex items-center gap-1">
            {onMinimizeToggle && (
              <button
                onClick={onMinimizeToggle}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                title="Minimize"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="p-3 space-y-4 overflow-y-auto">
          {/* Average properties per class */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              <BarChart3 className="w-3 h-3" />
              Average properties per class
            </div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {averagePropertiesPerClass.toFixed(1)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {totalProperties} properties across {classCount} classes
            </p>
          </div>

          {/* Most connected (hubs) */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              <Link2 className="w-3 h-3" />
              Most connected classes (hubs)
            </div>
            {hasHubs ? (
              <>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {hubNames.length} class{hubNames.length !== 1 ? 'es' : ''} with relationships
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">
                  {hubNames.slice(0, 10).map((name, i) => (
                    <li key={i} className="truncate" title={name}>
                      {name}
                    </li>
                  ))}
                  {hubNames.length > 10 && (
                    <li className="text-gray-500 dark:text-gray-500">+{hubNames.length - 10} more</li>
                  )}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No relationships in this schema.</p>
            )}
          </div>

          {/* Isolated classes */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              <Unlink className="w-3 h-3" />
              Isolated classes (no relationships)
            </div>
            {hasIsolated ? (
              <>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {isolatedNames.length} class{isolatedNames.length !== 1 ? 'es' : ''}
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">
                  {isolatedNames.slice(0, 10).map((name, i) => (
                    <li key={i} className="truncate" title={name}>
                      {name}
                    </li>
                  ))}
                  {isolatedNames.length > 10 && (
                    <li className="text-gray-500 dark:text-gray-500">+{isolatedNames.length - 10} more</li>
                  )}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">All classes have at least one relationship.</p>
            )}
          </div>

          {/* Deepest dependency chain */}
          <div>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    <GitBranch className="w-3 h-3" />
                    Deepest dependency chain
                  </div>
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {deepestChainLength} step{deepestChainLength !== 1 ? 's' : ''}
                  </div>
                </div>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg max-w-xs"
                  sideOffset={4}
                >
                  Longest path of class-to-class references (number of edges).
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>

          {/* Circular dependencies */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              <RefreshCw className="w-3 h-3" />
              Circular dependencies
            </div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {circularDependencyCount} cycle{circularDependencyCount !== 1 ? 's' : ''}
            </div>
            {hasCircular && circularSampleNames.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                e.g. {circularSampleNames.slice(0, 3).join(', ')}
                {circularSampleNames.length > 3 ? '…' : ''}
              </p>
            )}
          </div>

          {/* Summary line */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            {classCount} classes · {relationshipCount} relationships
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
