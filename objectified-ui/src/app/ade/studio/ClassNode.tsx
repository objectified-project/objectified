import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

// Define custom node data type for classes
type ClassProperty = {
  id: string;
  name: string;
  type?: string;
  description?: string;
};

type ClassNodeData = {
  id: string;
  name: string;
  description?: string;
  properties?: ClassProperty[];
  onPropertyDrop?: (classId: string, propertyData: any) => void;
  onPropertyDelete?: (classId: string, classPropertyId: string) => void;
};

function ClassNode({ data, selected }: NodeProps) {
  const typedData = data as ClassNodeData;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const dropData = JSON.parse(data);
        if (dropData.type === 'property' && typedData.onPropertyDrop) {
          typedData.onPropertyDrop(typedData.id, dropData.property);
        }
      }
    } catch (error) {
      console.error('Error handling property drop:', error);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: `2px solid ${isDragOver ? '#10b981' : selected ? '#3b82f6' : '#e5e7eb'}`,
        background: isDragOver ? '#ecfdf5' : 'white',
        minWidth: '200px',
        maxWidth: '350px',
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

      {/* Properties list */}
      {typedData.properties && typedData.properties.length > 0 && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#6b7280',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Properties ({typedData.properties.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {typedData.properties.map((prop) => (
              <div
                key={prop.id}
                style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  background: '#f9fafb',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 500,
                    color: '#111827',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {prop.name}
                  </div>
                  {prop.type && (
                    <div style={{
                      fontSize: '10px',
                      color: '#6b7280',
                      marginTop: '2px'
                    }}>
                      {prop.type}
                    </div>
                  )}
                </div>
                {typedData.onPropertyDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove "${prop.name}" from this class?`)) {
                        typedData.onPropertyDelete!(typedData.id, prop.id);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      color: '#6b7280',
                      fontSize: '14px',
                      lineHeight: 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fee2e2';
                      e.currentTarget.style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#6b7280';
                    }}
                    title="Remove property from class"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop zone hint when dragging */}
      {isDragOver && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: '#d1fae5',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#065f46',
          textAlign: 'center',
          fontWeight: 500
        }}>
          Drop property here
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

