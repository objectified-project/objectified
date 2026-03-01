'use client';

import * as React from 'react';
import {
  BaseEdge,
  EdgeProps,
  getEdgeCenter,
  getSmoothStepPath,
} from '@xyflow/react';
import { Plus } from 'lucide-react';

const BUTTON_SIZE = 20;

export interface MigrationRuleEdgeData {
  /** Display label: rule name when a rule is applied, or null for passthrough (+) */
  ruleName?: string | null;
  ruleKey?: string;
  /** When true, this edge connects a class node to a rule node; do not show a label. */
  isConnector?: boolean;
  onAddRule?: () => void;
}

function MigrationRuleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  data,
}: EdgeProps) {
  const edgeData = data as MigrationRuleEdgeData | undefined;
  const isConnector = edgeData?.isConnector === true;
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: isConnector ? 0 : 8,
    offset: isConnector ? 24 : 20,
  });
  const [centerX, centerY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  const ruleName = edgeData?.ruleName ?? null;
  const onAddRule = edgeData?.onAddRule;
  const isPassthrough = !isConnector && (ruleName === null || ruleName === '');
  const label = isPassthrough ? '+' : ruleName;
  const boxWidth = isPassthrough ? BUTTON_SIZE : Math.min(Math.max((label ?? '').length * 7, 24), 120);
  const halfW = boxWidth / 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={style}
      />
      {!isConnector && (
        <foreignObject
          x={centerX - halfW}
          y={centerY - BUTTON_SIZE / 2}
          width={boxWidth}
          height={BUTTON_SIZE}
          className="nodrag nopan"
          style={{ overflow: 'visible', pointerEvents: 'all' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddRule?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`h-full flex items-center justify-center rounded border min-w-[20px] px-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
              isPassthrough
                ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                : 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
            }`}
            aria-label={isPassthrough ? 'Add migration rule (passthrough)' : `Edit rule: ${label}`}
            title={isPassthrough ? 'Passthrough: no rule applied. Click to add a rule.' : (label ?? '')}
          >
            {isPassthrough ? (
              <Plus className="w-3 h-3 shrink-0" strokeWidth={2.5} />
            ) : (
              <span className="truncate text-xs font-medium">{label}</span>
            )}
          </button>
        </foreignObject>
      )}
    </>
  );
}

export default MigrationRuleEdge;
