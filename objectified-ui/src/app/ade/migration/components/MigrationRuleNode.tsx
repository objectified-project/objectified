'use client';

import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { openRuleDialogRef } from '../openRuleDialogRef';

export interface MigrationRuleNodeData {
  ruleKey: string;
  ruleName: string;
  sourceProp: string;
  outputProperties: string[];
}

function MigrationRuleNode(props: NodeProps) {
  const data = props.data as unknown as MigrationRuleNodeData;
  const { ruleKey, ruleName, sourceProp, outputProperties } = data;
  const outputCount = Math.max(1, outputProperties.length);

  const handleEdit = React.useCallback(() => {
    const fn = openRuleDialogRef.current;
    if (fn) fn(ruleKey, sourceProp, outputProperties[0] ?? sourceProp);
  }, [ruleKey, sourceProp, outputProperties]);

  return (
    <div
      className="rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 shadow h-5 min-w-[120px] overflow-hidden relative z-10"
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!w-2.5 !h-2.5 !border-2 !border-white !rounded-full !min-w-0 !min-h-0"
        style={{
          background: 'rgb(99, 102, 241)',
          left: -10,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        isConnectable={false}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleEdit();
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-0 flex items-center justify-center px-2 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer nodrag nopan pointer-events-auto"
        title="Edit rule"
      >
        <span className="truncate block w-full text-center">{ruleName || 'Rule'}</span>
      </button>
      {outputProperties.map((propName, i) => {
        const topPct = outputCount === 1 ? 50 : (100 * (i + 1)) / (outputCount + 1);
        return (
          <Handle
            key={propName}
            type="source"
            position={Position.Right}
            id={`out-${propName}`}
            className="!w-2.5 !h-2.5 !border-2 !border-white !rounded-full !min-w-0 !min-h-0"
            style={{
              background: 'rgb(16, 185, 129)',
              right: -10,
              top: `${topPct}%`,
              transform: 'translateY(-50%)',
            }}
            isConnectable={false}
          />
        );
      })}
    </div>
  );
}

export default MigrationRuleNode;
