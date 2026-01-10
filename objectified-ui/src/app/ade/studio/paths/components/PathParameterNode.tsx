// Path Parameter Node Component for React Flow Canvas
'use client';

import React from 'react';
import { Hash, HelpCircle, Trash2 } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';

export interface PathParameterData {
  name: string;
  inLocation: 'path' | 'query' | 'header' | 'cookie';
  summary?: string;
  description?: string;
  required?: boolean;
  dbParameterId?: string;
  operationId?: string;
  onDelete?: () => void;
}

const LOCATION_CONFIG = {
  path: {
    color: '#8b5cf6',
    label: 'Path',
    icon: '/',
    bgClass: 'bg-purple-500',
    borderClass: 'border-purple-500',
  },
  query: {
    color: '#3b82f6',
    label: 'Query',
    icon: '?',
    bgClass: 'bg-blue-500',
    borderClass: 'border-blue-500',
  },
  header: {
    color: '#f59e0b',
    label: 'Header',
    icon: 'H',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-500',
  },
  cookie: {
    color: '#10b981',
    label: 'Cookie',
    icon: 'C',
    bgClass: 'bg-emerald-500',
    borderClass: 'border-emerald-500',
  },
};

export default function PathParameterNode({ data }: { data: PathParameterData }) {
  const config = LOCATION_CONFIG[data.inLocation] || LOCATION_CONFIG.path;

  return (
    <>
      {/* Connection handle - receives FROM operations */}
      <Handle
        type="target"
        position={Position.Left}
        id="parameter-input"
        className="w-3 h-3 bg-gray-400 dark:bg-gray-600"
      />

      <div className={`bg-white dark:bg-gray-800 rounded-lg border-2 ${config.borderClass} shadow-lg min-w-[180px] max-w-[280px] cursor-pointer relative group`}>
        {/* Delete button */}
        {data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 z-10"
            title="Delete parameter"
          >
            <Trash2 size={12} />
          </button>
        )}

        {/* Header */}
        <div className={`${config.bgClass} text-white px-3 py-2 rounded-t-md flex items-center gap-2`}>
          <div className="w-6 h-6 rounded flex items-center justify-center bg-white/20 font-mono text-xs font-bold">
            {config.icon}
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium opacity-90">{config.label} Parameter</div>
            <div className="font-bold text-sm truncate">{data.name}</div>
          </div>
          {data.required && (
            <div className="px-1.5 py-0.5 bg-red-500 rounded text-[10px] font-bold">
              REQ
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {data.summary && (
            <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
              {data.summary}
            </div>
          )}

          {!data.summary && !data.description && (
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <HelpCircle className="w-3 h-3" />
              <span>No description</span>
            </div>
          )}

          {/* Parameter badge */}
          <div className="flex items-center gap-1 pt-1">
            <Hash className="w-3 h-3 text-gray-400" />
            <code className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-mono">
              {data.inLocation}
            </code>
          </div>
        </div>
      </div>
    </>
  );
}

