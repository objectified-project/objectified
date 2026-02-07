// Path Parameter Node Component for React Flow Canvas
// Plan 2.4: Small chips/tags color-coded by parameter location (PLANNED_FEATURE_ROADMAP_PATHS.md)
'use client';

import React from 'react';
import { Trash2, Braces } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';

/** Serialization style for the parameter (OpenAPI 3.0; default "form") */
export type ParamSerializationStyle = 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';

export interface PathParameterData {
  name: string;
  inLocation: 'path' | 'query' | 'header' | 'cookie';
  summary?: string;
  description?: string;
  required?: boolean;
  type?: string;
  format?: string;
  defaultValue?: string | number | boolean;
  /** Serialization style (default form) */
  style?: ParamSerializationStyle;
  /** Explode arrays/objects (OpenAPI 3.0) */
  explode?: boolean;
  dbParameterId?: string;
  operationId?: string;
  onDelete?: () => void;
}

// Plan 2.4: Color and icon per location (Query=Blue/? , Path=Green/{} , Header=Purple/H , Cookie=Orange/🍪)
const LOCATION_CONFIG = {
  path: {
    color: '#22c55e',
    bgClass: 'bg-green-50 dark:bg-green-950/40 border-green-500/60',
    textClass: 'text-green-700 dark:text-green-300',
    icon: 'braces' as const,
  },
  query: {
    color: '#3b82f6',
    bgClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/60',
    textClass: 'text-blue-700 dark:text-blue-300',
    icon: 'query' as const,
  },
  header: {
    color: '#a855f7',
    bgClass: 'bg-purple-50 dark:bg-purple-950/40 border-purple-500/60',
    textClass: 'text-purple-700 dark:text-purple-300',
    icon: 'header' as const,
  },
  cookie: {
    color: '#f97316',
    bgClass: 'bg-orange-50 dark:bg-orange-950/40 border-orange-500/60',
    textClass: 'text-orange-700 dark:text-orange-300',
    icon: 'cookie' as const,
  },
};

function LocationIcon({ location }: { location: keyof typeof LOCATION_CONFIG }) {
  const config = LOCATION_CONFIG[location];
  if (config.icon === 'braces') {
    return <Braces className={`w-3.5 h-3.5 shrink-0 ${config.textClass}`} strokeWidth={2.5} />;
  }
  if (config.icon === 'query') {
    return <span className={`font-mono font-bold text-sm ${config.textClass}`}>?</span>;
  }
  if (config.icon === 'header') {
    return <span className={`font-sans font-bold text-xs uppercase ${config.textClass}`}>H</span>;
  }
  return <span className={`text-sm ${config.textClass}`} aria-hidden>🍪</span>;
}

export default function PathParameterNode({ data }: { data: PathParameterData }) {
  const config = LOCATION_CONFIG[data.inLocation] || LOCATION_CONFIG.query;

  const typeString = data.format
    ? `${data.type || 'string'} (${data.format})`
    : (data.type || 'string');
  const requiredString = data.required ? 'required' : 'optional';
  const hasDefault = data.defaultValue !== undefined && data.defaultValue !== null && data.defaultValue !== '';

  const tooltipLines = [
    `${data.name} · ${typeString} · ${requiredString}`,
    data.inLocation !== 'path' && `in: ${data.inLocation}`,
    hasDefault && `default: ${String(data.defaultValue)}`,
    data.style && data.style !== 'form' && `style: ${data.style}`,
    data.explode && 'explode',
    data.description?.trim(),
  ].filter(Boolean);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        id="parameter-input"
        className="!w-2.5 !h-1.5 !rounded-t !rounded-b-none"
        style={{ backgroundColor: config.color }}
      />

      <div
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm min-w-0 max-w-[200px] cursor-pointer relative ${config.bgClass}`}
        title={tooltipLines.join('\n')}
      >
        <LocationIcon location={data.inLocation} />
        <span className={`font-medium text-xs truncate ${config.textClass}`}>
          {data.name}
        </span>
        {data.required && (
          <span className="shrink-0 text-[10px] text-red-500 dark:text-red-400 font-medium" title="required">*</span>
        )}
        {data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
            className="ml-0.5 rounded p-0.5 opacity-70 hover:opacity-100 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 z-10"
            title="Delete parameter"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="parameter-output"
        className="!w-2.5 !h-1.5 !rounded-b !rounded-t-none"
        style={{ backgroundColor: config.color }}
      />
    </>
  );
}

