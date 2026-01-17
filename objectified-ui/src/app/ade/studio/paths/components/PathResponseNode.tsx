// Path Response Node Component for React Flow Canvas
'use client';

import React from 'react';
import { CheckCircle, ArrowRight, AlertCircle, XCircle, Trash2, Layers } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';

export interface PathResponseData {
  statusCode: string;
  description?: string;
  dbResponseId?: string;
  operationId?: string;
  onDelete?: () => void;
  onClassDrop?: (responseId: string, classData: any) => void;
  attachedClassId?: string;
  attachedClassName?: string;
}

// Get color and icon based on status code
const getStatusConfig = (statusCode: string) => {
  const firstChar = statusCode.charAt(0);

  switch (firstChar) {
    case '2':
      return {
        color: '#10b981',
        bgClass: 'bg-emerald-500',
        borderClass: 'border-emerald-500',
        icon: CheckCircle,
        label: 'Success',
      };
    case '3':
      return {
        color: '#3b82f6',
        bgClass: 'bg-blue-500',
        borderClass: 'border-blue-500',
        icon: ArrowRight,
        label: 'Redirect',
      };
    case '4':
      return {
        color: '#f59e0b',
        bgClass: 'bg-amber-500',
        borderClass: 'border-amber-500',
        icon: AlertCircle,
        label: 'Client Error',
      };
    case '5':
      return {
        color: '#ef4444',
        bgClass: 'bg-red-500',
        borderClass: 'border-red-500',
        icon: XCircle,
        label: 'Server Error',
      };
    default:
      return {
        color: '#6b7280',
        bgClass: 'bg-gray-500',
        borderClass: 'border-gray-500',
        icon: AlertCircle,
        label: 'Response',
      };
  }
};

export default function PathResponseNode({ data }: { data: PathResponseData }) {
  const config = getStatusConfig(data.statusCode);
  const Icon = config.icon;
  const [dragOver, setDragOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr || !data.dbResponseId || !data.onClassDrop) return;

    try {
      const dropData = JSON.parse(dataStr);
      if (dropData.type === 'class') {
        data.onClassDrop(data.dbResponseId, dropData);
      }
    } catch (error) {
      console.error('PathResponseNode: Error parsing drop data:', error);
    }
  };

  return (
    <>
      {/* Connection handle - receives FROM operations */}
      <Handle
        type="target"
        position={Position.Left}
        id="response-input"
        className="w-3 h-3 bg-gray-400 dark:bg-gray-600"
      />

      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg border-2 ${config.borderClass} shadow-lg min-w-[180px] max-w-[280px] cursor-pointer relative group ${
          dragOver ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
        }`}
        onDragOver={(e) => {
          e.stopPropagation(); // Prevent React Flow from handling
          handleDragOver(e);
        }}
        onDragLeave={(e) => {
          e.stopPropagation(); // Prevent React Flow from handling
          handleDragLeave(e);
        }}
        onDrop={(e) => {
          e.stopPropagation(); // Prevent React Flow from handling
          handleDrop(e);
        }}
      >
        {/* Delete button */}
        {data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 z-10"
            title="Delete response"
          >
            <Trash2 size={12} />
          </button>
        )}

        {/* Header */}
        <div className={`${config.bgClass} text-white px-3 py-2 rounded-t-md flex items-center gap-2`}>
          <div className="w-6 h-6 rounded flex items-center justify-center bg-white/20">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium opacity-90">{config.label}</div>
            <div className="font-bold text-sm">{data.statusCode}</div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {data.description ? (
            <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">
              {data.description}
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500 italic mb-2">
              No description
            </div>
          )}
          
          {/* Attached Class Indicator */}
          {data.attachedClassName ? (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-indigo-500" />
                <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 truncate">
                  {data.attachedClassName}
                </span>
              </div>
            </div>
          ) : (
            dragOver && (
              <div className="mt-2 pt-2 border-t border-dashed border-indigo-300 dark:border-indigo-600">
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium text-center">
                  Drop class here
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Output handle - connects TO class nodes (always present and connectable) */}
      <Handle
        type="source"
        position={Position.Right}
        id="response-class-output"
        className={`w-3 h-3 border-2 ${
          data.attachedClassId
            ? 'bg-indigo-500 border-white dark:border-gray-800'
            : 'bg-indigo-400/50 border-indigo-300 dark:border-indigo-600'
        }`}
        style={{
          opacity: data.attachedClassId ? 1 : 0.6,
          pointerEvents: 'auto', // Always allow connections
        }}
      />
    </>
  );
}

