'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

export interface PathNodeData {
  label: string;
  nodeType: 'path' | 'method' | 'parameter' | 'response';
  color?: string;
  // Database IDs
  dbPathId?: string; // ID in odb.api_paths
  dbOperationId?: string; // ID in odb.path_operations
  connectedPathId?: string; // For method nodes: which path they're connected to
  pendingDbSave?: boolean; // Flag for nodes that need to be saved to DB
  // Path-specific data
  path?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  pathVariables?: PathVariable[];
  externalDocs?: ExternalDocs;
  // Method-specific data
  method?: string;
  operationId?: string;
  parameters?: any[];
  responses?: any[];
  requestBody?: string; // Schema name for request body
  security?: string; // Security scheme name
  // Allow additional properties
  [key: string]: unknown;
}

export interface ExternalDocs {
  url: string;
  description?: string;
}

export interface PathVariable {
  name: string;
  description: string;
  type: string;
  required: boolean;
  example?: string;
}

// Helper function to extract path variables from a path pattern
export function extractPathVariables(path: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(path)) !== null) {
    variables.push(match[1]);
  }
  return variables;
}

// Method color mapping - Updated to match section 9.3.1 specification
const METHOD_COLORS: Record<string, string> = {
  GET: '#48BB78',
  POST: '#4299E1',
  PUT: '#ED8936',
  DELETE: '#F56565',
  PATCH: '#9F7AEA',
  HEAD: '#718096',
  OPTIONS: '#718096',
};

const PathNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as PathNodeData;
  const { nodeType, label, color, path, method } = nodeData;

  // Determine the background color based on node type
  const getBackgroundStyle = () => {
    if (nodeType === 'method' && method) {
      return { background: METHOD_COLORS[method] || '#6b7280' };
    }
    if (nodeType === 'path') {
      return { background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' };
    }
    if (color) {
      // Parse Tailwind color class to actual color
      const colorMap: Record<string, string> = {
        'bg-green-500': '#22c55e',
        'bg-blue-500': '#3b82f6',
        'bg-orange-500': '#f97316',
        'bg-red-500': '#ef4444',
        'bg-purple-500': '#a855f7',
        'bg-gray-500': '#6b7280',
        'bg-yellow-500': '#eab308',
      };
      return { background: colorMap[color] || '#6366f1' };
    }
    return { background: '#6366f1' };
  };

  // Extract path variables for display
  const pathVars = path ? extractPathVariables(path) : [];

  // Method nodes have a completely different structure - colored header only
  if (nodeType === 'method') {
    const methodColor = METHOD_COLORS[method || ''] || '#6b7280';
    const needsRequestBody = method && ['POST', 'PUT', 'PATCH'].includes(method);

    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-2 !rounded-t-md !rounded-b-none"
          style={{ backgroundColor: methodColor }}
        />

        <div
          className={`bg-white dark:bg-gray-800 rounded-xl border-2 shadow-xl min-w-[220px] max-w-[280px] cursor-pointer ${
            selected ? 'ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900' : ''
          }`}
          style={{ borderColor: methodColor }}
        >
          {/* Header - Only this part has color */}
          <div
            className="text-white px-4 py-3 rounded-t-xl"
            style={{ backgroundColor: methodColor }}
          >
            <div className="text-xs font-medium opacity-90">HTTP Method</div>
            <div className="font-bold text-lg">{method || label}</div>
            {nodeData.operationId && (
              <div className="text-xs opacity-80 font-mono mt-1">{nodeData.operationId}</div>
            )}
          </div>

          {/* Content - White/dark background */}
          <div className="p-3 space-y-3">
            {/* Request Section (for POST/PUT/PATCH) */}
            {needsRequestBody && (
              <div>
                <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Request</div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-md px-2 py-2 min-h-[32px]">
                  {nodeData.requestBody ? (
                    <div className="text-[10px] text-gray-700 dark:text-gray-300">{nodeData.requestBody}</div>
                  ) : (
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 italic">(No request body)</div>
                  )}
                </div>
              </div>
            )}

            {/* Parameters Section */}
            <div>
              <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Parameters</div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-md px-2 py-2 min-h-[32px] space-y-1">
                {nodeData.parameters && Array.isArray(nodeData.parameters) && nodeData.parameters.length > 0 ? (
                  nodeData.parameters.map((param: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-gray-400 dark:text-gray-500 text-[10px] font-mono">
                        {param.in === 'path' ? ':' : param.in === 'query' ? '?' : param.in === 'header' ? 'H' : '🍪'}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 text-[10px] font-mono">{param.name}</span>
                      {param.required && <span className="text-red-500 text-[8px]">*</span>}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 italic">(No parameters)</div>
                )}
              </div>
            </div>

            {/* Responses Section */}
            <div>
              <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Responses</div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-md px-2 py-2 min-h-[32px] space-y-1">
                {nodeData.responses && Array.isArray(nodeData.responses) && nodeData.responses.length > 0 ? (
                  nodeData.responses.map((response: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px] min-w-[28px]">{response.status || response.statusCode}</span>
                      <span className="text-gray-700 dark:text-gray-300 text-[10px]">{response.schema || response.description || 'Response'}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 italic">(No responses)</div>
                )}
              </div>
            </div>

            {/* Security Footer */}
            {nodeData.security && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span>🔐</span>
                  <span className="text-[10px]">{nodeData.security}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-2 !rounded-b-md !rounded-t-none"
          style={{ backgroundColor: methodColor }}
        />
      </>
    );
  }

  // For other node types (path, parameter, response) - use original design
  return (
    <div
      className={`rounded-lg shadow-lg transition-all ${
        selected ? 'ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900' : ''
      } ${nodeData.deprecated ? 'opacity-75' : ''}`}
      style={{
        ...getBackgroundStyle(),
        minWidth: 150,
        padding: '10px 14px',
      }}
    >
      {/* Input handle - top (for parameter, response nodes) */}
      {(nodeType === 'parameter' || nodeType === 'response') && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-white !border-2 !border-gray-400 !w-3 !h-3"
        />
      )}

      {/* Node content */}
      <div className="text-white">
        {nodeType === 'path' && (
          <>
            <div className="text-xs font-medium opacity-80 mb-1 flex items-center gap-2">
              PATH
              {nodeData.deprecated && (
                <span className="px-1.5 py-0.5 bg-red-500/80 text-white text-[10px] font-bold rounded uppercase">
                  Deprecated
                </span>
              )}
            </div>
            <div className={`font-mono text-sm font-semibold truncate max-w-[200px] ${nodeData.deprecated ? 'line-through decoration-2' : ''}`}>
              {path || label}
            </div>
            {pathVars.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {pathVars.map((v) => (
                  <span
                    key={v}
                    className={`px-1.5 py-0.5 bg-white/20 rounded text-xs font-mono ${nodeData.deprecated ? 'line-through' : ''}`}
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {nodeType === 'parameter' && (
          <>
            <div className="text-xs font-medium opacity-80 mb-1">PARAM</div>
            <div className="font-medium text-sm">{label}</div>
          </>
        )}

        {nodeType === 'response' && (
          <>
            <div className="text-xs font-medium opacity-80 mb-1">RESPONSE</div>
            <div className="font-bold text-sm">{label}</div>
          </>
        )}
      </div>

      {/* Output handle - bottom (for path, parameter nodes) */}
      {(nodeType === 'path' || nodeType === 'parameter') && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-white !border-2 !border-gray-400 !w-3 !h-3"
        />
      )}
    </div>
  );
};

export default memo(PathNode);

