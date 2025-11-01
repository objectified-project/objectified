import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

// Define custom node data type for classes
type ClassNodeData = {
  name: string;
  description?: string;
  propertyCount?: number;
};

function ClassNode({ data, selected }: NodeProps) {
  const typedData = data as ClassNodeData;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: `2px solid ${selected ? '#3b82f6' : '#e5e7eb'}`,
        background: 'white',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected
          ? '0 4px 12px rgba(59, 130, 246, 0.2)'
          : '0 2px 4px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Target handle at the top */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#6b7280',
          width: '8px',
          height: '8px',
          border: '2px solid white'
        }}
        isConnectable={true}
      />

      {/* Class name header */}
      <div style={{ marginBottom: typedData.description ? '8px' : '0' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#111827',
          wordBreak: 'break-word'
        }}>
          {typedData.name}
        </div>
      </div>

      {/* Description */}
      {typedData.description && (
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          marginBottom: '8px',
          wordBreak: 'break-word',
          lineHeight: '1.4'
        }}>
          {typedData.description}
        </div>
      )}

      {/* Property count badge */}
      {typedData.propertyCount !== undefined && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: '11px',
          color: '#6b7280',
          background: '#f3f4f6',
          padding: '2px 8px',
          borderRadius: '12px',
          marginTop: '4px'
        }}>
          {typedData.propertyCount} {typedData.propertyCount === 1 ? 'property' : 'properties'}
        </div>
      )}

      {/* Source handle at the bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#6b7280',
          width: '8px',
          height: '8px',
          border: '2px solid white'
        }}
        isConnectable={true}
      />
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(ClassNode);

