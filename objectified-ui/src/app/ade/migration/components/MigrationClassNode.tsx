'use client';

import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface MigrationClassNodeData {
  className: string;
  properties: Array<{ name: string; type?: string }>;
  side: 'from' | 'to';
}

function MigrationClassNode(props: NodeProps) {
  const data = props.data as unknown as MigrationClassNodeData;
  const { className, properties, side } = data;
  const isFrom = side === 'from';

  return (
    <div
      className={`rounded-lg border-2 shadow-md min-w-[200px] max-w-[280px] overflow-hidden ${
        isFrom
          ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/80 dark:bg-indigo-900/20'
          : 'border-emerald-300 dark:border-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/20'
      }`}
    >
      <div
        className={`px-3 py-2 text-sm font-semibold border-b ${
          isFrom
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100 border-indigo-200 dark:border-indigo-800'
            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800'
        }`}
      >
        {isFrom ? 'From' : 'To'}: {className}
      </div>
      <div className="px-3 py-2 overflow-hidden">
        {properties.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">No properties</p>
        ) : (
          <ul className="space-y-2.5 text-xs text-gray-700 dark:text-gray-300">
            {properties.map((p) => (
              <li key={p.name} className="relative flex items-baseline justify-between gap-3 min-h-[1.25rem]">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                {p.type != null && p.type !== '' ? (
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{p.type}</span>
                ) : (
                  <span className="shrink-0" />
                )}
                <Handle
                  type={isFrom ? 'source' : 'target'}
                  position={isFrom ? Position.Right : Position.Left}
                  id={`prop-${p.name}`}
                  className="!w-2 !h-2 !border-2 !border-white !rounded-full !min-w-0 !min-h-0"
                  style={{
                    background: isFrom ? 'rgb(99, 102, 241)' : 'rgb(16, 185, 129)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    [isFrom ? 'right' : 'left']: -16,
                  }}
                  isConnectable={false}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default MigrationClassNode;
