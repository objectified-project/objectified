// Path Class Node Component for React Flow Canvas
'use client';

import React from 'react';
import { Layers, Trash2 } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';

export interface PathClassNodeData {
  className: string;
  classId: string;
  description?: string;
  dbClassId: string;
  onDelete?: () => void;
}

export default function PathClassNode({ data }: { data: PathClassNodeData }) {
  return (
    <>
      {/* Input handle - receives FROM responses */}
      <Handle
        type="target"
        position={Position.Left}
        id="class-input"
        className="w-3 h-3 bg-indigo-500 border-2 border-white dark:border-gray-800"
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-500 shadow-xl min-w-[200px] max-w-[300px] cursor-pointer relative group">
        {/* Delete button */}
        {data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 z-20"
            title="Remove class from canvas"
          >
            <Trash2 size={14} />
          </button>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-3 rounded-t-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium opacity-90">Class Schema</div>
            <div className="font-bold text-sm truncate">{data.className}</div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {data.description ? (
            <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
              {data.description}
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500 italic">
              No description
            </div>
          )}
        </div>
      </div>

      {/* Output handle - can connect TO responses */}
      <Handle
        type="source"
        position={Position.Right}
        id="class-output"
        className="w-3 h-3 bg-indigo-500 border-2 border-white dark:border-gray-800"
      />
    </>
  );
}
