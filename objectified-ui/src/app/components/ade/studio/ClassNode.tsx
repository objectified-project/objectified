import React, { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

// Define custom node data type for classes
type ClassProperty = {
  id: string;
  name: string;
  type?: string;
  description?: string;
  data?: any; // JSONB data containing the property schema
  parent_id?: string | null; // Parent property ID for nested properties
};

type ClassNodeData = {
  id: string;
  name: string;
  description?: string;
  properties?: ClassProperty[];
  schema?: any; // Schema containing allOf/anyOf/oneOf
  onPropertyDrop?: (classId: string, propertyData: any, parentId?: string | null) => void;
  onPropertyEdit?: (classId: string, classProperty: ClassProperty) => void;
  onPropertyDelete?: (classId: string, classPropertyId: string) => void;
  onClassEdit?: (classData: any) => void;
  onClassDelete?: (classId: string, className: string) => void;
  isReadOnly?: boolean;
};

function ClassNode({ data, selected }: NodeProps) {
  const typedData = data as ClassNodeData;
  const [dragTarget, setDragTarget] = useState<'node' | 'property' | null>(null);
  const [dragOverPropertyId, setDragOverPropertyId] = useState<string | null>(null);
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over for node if we're not already over a property
    if (dragTarget !== 'property') {
      setDragTarget('node');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only clear drag state if we're actually leaving the node completely
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;

    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragTarget(null);
      setDragOverPropertyId(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);
    setDragOverPropertyId(null);

    // Don't allow drops in read-only mode
    if (typedData.isReadOnly) {
      return;
    }

    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const dropData = JSON.parse(data);
        if (dropData.type === 'property' && typedData.onPropertyDrop) {
          typedData.onPropertyDrop(typedData.id, dropData.property, null);
        }
      }
    } catch (error) {
      console.error('Error handling property drop:', error);
    }
  };

  const handlePropertyDragOver = (e: React.DragEvent, propertyId: string, isObject: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (isObject) {
      // Only set property-specific state for object types that can accept drops
      setDragTarget('property');
      setDragOverPropertyId(propertyId);
    } else {
      // For non-object properties, maintain node-level drag state
      setDragTarget('node');
      setDragOverPropertyId(null);
    }
  };

  const handlePropertyDragLeave = (e: React.DragEvent, propertyId: string, isObject: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    if (isObject) {
      // Only clear the drag over state if we're leaving the specific property
      const relatedTarget = e.relatedTarget as HTMLElement;
      const currentTarget = e.currentTarget as HTMLElement;

      // If we're moving to another element within the node, don't clear completely
      if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
        setDragOverPropertyId(null);
        // Reset to node-level drag if still within the node
        setDragTarget('node');
      }
    }
    // For non-object properties, do nothing - maintain parent state
  };

  const handlePropertyDrop = (e: React.DragEvent, parentPropertyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);
    setDragOverPropertyId(null);

    // Don't allow drops in read-only mode
    if (typedData.isReadOnly) {
      return;
    }

    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const dropData = JSON.parse(data);
        if (dropData.type === 'property' && typedData.onPropertyDrop) {
          typedData.onPropertyDrop(typedData.id, dropData.property, parentPropertyId);
        }
      }
    } catch (error) {
      console.error('Error handling nested property drop:', error);
    }
  };

  const togglePropertyExpansion = (propertyId: string) => {
    const newExpanded = new Set(expandedProperties);
    if (newExpanded.has(propertyId)) {
      newExpanded.delete(propertyId);
    } else {
      newExpanded.add(propertyId);
    }
    setExpandedProperties(newExpanded);
  };

  // Check if a property is a descendant of the dragged-over property
  const isDescendantOfDraggedProperty = (propertyId: string, draggedParentId: string | null): boolean => {
    if (!draggedParentId || !typedData.properties) return false;

    let currentProp = typedData.properties.find(p => p.id === propertyId);
    while (currentProp && currentProp.parent_id) {
      if (currentProp.parent_id === draggedParentId) {
        return true;
      }
      currentProp = typedData.properties.find(p => p.id === currentProp!.parent_id);
    }
    return false;
  };

  // Extract type from property data
  const getPropertyType = (prop: ClassProperty): string => {
    if (!prop.data) return prop.type || 'object';

    const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : prop.data;

    if (propData.type === 'array') {
      if (propData.items?.$ref) {
        const refName = propData.items.$ref.split('/').pop();
        return `${refName}[]`;
      }
      return `${propData.items?.type || 'any'}[]`;
    }

    if (propData.$ref) {
      return '$ref';
    }

    return propData.type || 'object';
  };

  // Check if property has $ref
  const hasRef = (prop: ClassProperty): boolean => {
    if (!prop.data) return false;
    const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : prop.data;
    return !!(propData?.$ref || (propData?.type === 'array' && propData?.items?.$ref));
  };

  // Check if property is of type object (can have nested properties)
  const isObjectType = (prop: ClassProperty): boolean => {
    if (!prop.data) return false;
    const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : prop.data;
    return propData.type === 'object' && !propData.$ref;
  };

  // Build hierarchical property structure
  const buildPropertyHierarchy = (): { topLevel: ClassProperty[], childMap: Map<string, ClassProperty[]> } => {
    if (!typedData.properties) {
      return { topLevel: [], childMap: new Map() };
    }

    const topLevel = typedData.properties.filter(p => !p.parent_id);
    const childMap = new Map<string, ClassProperty[]>();

    typedData.properties.forEach(prop => {
      if (prop.parent_id) {
        if (!childMap.has(prop.parent_id)) {
          childMap.set(prop.parent_id, []);
        }
        childMap.get(prop.parent_id)!.push(prop);
      }
    });

    return { topLevel, childMap };
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Allow viewing in read-only mode by opening the edit dialog
    // The dialog itself will handle read-only restrictions
    if (typedData.onClassEdit) {
      typedData.onClassEdit({
        id: typedData.id,
        name: typedData.name,
        description: typedData.description,
        schema: typedData.schema,
        properties: typedData.properties
      });
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDoubleClick={handleDoubleClick}
      style={{
        borderRadius: '4px',
        border: `1px solid ${dragTarget === 'node' ? '#10b981' : selected ? '#5b68ea' : '#d1d5db'}`,
        background: 'white',
        minWidth: '240px',
        maxWidth: '380px',
        boxShadow: selected
          ? '0 2px 8px rgba(91, 104, 234, 0.2)'
          : '0 1px 3px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
        cursor: 'pointer'
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
          border: '2px solid white',
          borderRadius: '50%'
        }}
        isConnectable={true}
      />

      {/* Header with class name and delete button */}
      <div style={{
        background: 'linear-gradient(135deg, #5b68ea 0%, #4751c4 100%)',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: dragTarget === 'node' ? '2px solid #10b981' : 'none'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'white',
          wordBreak: 'break-word',
          flex: 1
        }}>
          {typedData.name}
        </div>
        {!typedData.isReadOnly && (
          <button
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '3px',
              padding: '4px 6px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '14px',
              lineHeight: 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => {
              e.stopPropagation(); // Prevent node selection
              if (typedData.onClassDelete) {
                typedData.onClassDelete(typedData.id, typedData.name);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            title="Delete class"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Description / Drop zone area - fixed height with ellipsis overflow */}
      <div style={{
        padding: '8px 12px',
        fontSize: '11px',
        color: dragTarget === 'node' ? '#065f46' : '#9ca3af',
        lineHeight: '1.4',
        background: dragTarget === 'node' ? '#d1fae5' : '#fafafa',
        borderBottom: dragTarget === 'node' ? '1px solid #10b981' : '1px solid #e5e7eb',
        textAlign: dragTarget === 'node' ? 'center' : 'left',
        fontWeight: dragTarget === 'node' ? 500 : 'normal',
        height: '31.2px', // Fixed height: 11px font × 1.4 line-height + 16px padding
        display: 'flex',
        alignItems: 'center',
        justifyContent: dragTarget === 'node' ? 'center' : 'flex-start',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease'
      }}>
        {dragTarget === 'node' ? 'Drop property here' : (typedData.description || '\u00A0')}
      </div>

      {/* Properties list */}
      <div style={{ padding: '0' }}>
        {typedData.properties && typedData.properties.length > 0 ? (
          (() => {
            const { topLevel, childMap } = buildPropertyHierarchy();
            let globalIndex = 0;

            const renderProperty = (prop: ClassProperty, depth: number = 0): React.JSX.Element[] => {
              const propertyHasRef = hasRef(prop);
              const isObject = isObjectType(prop);
              const children = childMap.get(prop.id) || [];
              const hasChildren = children.length > 0;
              const isExpanded = expandedProperties.has(prop.id);
              const isDraggedOver = dragOverPropertyId === prop.id;
              const isChildOfDraggedOver = isDescendantOfDraggedProperty(prop.id, dragOverPropertyId);
              const isInDropZone = isDraggedOver || isChildOfDraggedOver;
              const currentIndex = globalIndex++;

              const elements: React.JSX.Element[] = [];

              // Render the property itself
              elements.push(
                <div
                  key={prop.id}
                  onDragOver={!typedData.isReadOnly ? (e) => handlePropertyDragOver(e, prop.id, isObject) : undefined}
                  onDragLeave={!typedData.isReadOnly ? (e) => handlePropertyDragLeave(e, prop.id, isObject) : undefined}
                  onDrop={isObject && !typedData.isReadOnly ? (e) => handlePropertyDrop(e, prop.id) : undefined}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '20px 1fr auto 50px auto',
                    alignItems: 'center',
                    padding: '6px 4px 6px 12px',
                    paddingLeft: `${12 + depth * 16}px`,
                    borderBottom: '1px solid #e5e7eb',
                    background: isInDropZone ? '#d1fae5' : (currentIndex % 2 === 0 ? 'white' : '#fafafa'),
                    position: 'relative',
                    gap: '4px',
                    transition: 'background 0.2s'
                  }}
                >
                  {/* Expand/collapse chevron for object types */}
                  <div style={{ width: '16px', display: 'flex', alignItems: 'center' }}>
                    {isObject && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePropertyExpansion(prop.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6b7280',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#111827';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>

                  {/* Property name */}
                  <div style={{
                    fontWeight: depth > 0 ? 400 : 500,
                    color: '#111827',
                    fontSize: '12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {prop.name}
                    {hasChildren && <span style={{ color: '#6b7280', marginLeft: '4px' }}>({children.length})</span>}
                  </div>

                  {/* Type */}
                  <div style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap'
                  }}>
                    {getPropertyType(prop)}
                  </div>

                  {/* Action buttons */}
                  {!typedData.isReadOnly && (
                    <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
                      {typedData.onPropertyEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            typedData.onPropertyEdit!(typedData.id, prop);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '2px',
                            color: '#9ca3af',
                            fontSize: '11px',
                            lineHeight: 1,
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#dbeafe';
                            e.currentTarget.style.color = '#2563eb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#9ca3af';
                          }}
                          title="Edit property"
                        >
                          <Edit size={11} />
                        </button>
                      )}
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
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '2px',
                            color: '#9ca3af',
                            fontSize: '13px',
                            lineHeight: 1,
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#dc2626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#9ca3af';
                          }}
                          title="Remove property from class"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Handle for $ref properties */}
                  {propertyHasRef && (
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`prop-${prop.id}`}
                      style={{
                        right: '-6px',
                        background: '#5b68ea',
                        width: '10px',
                        height: '10px',
                        border: '2px solid white',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 1000
                      }}
                      isConnectable={false}
                    />
                  )}
                </div>
              );

              // Render children if expanded
              if (isObject && isExpanded && hasChildren) {
                children.forEach((child: ClassProperty) => {
                  elements.push(...renderProperty(child, depth + 1));
                });
              }

              return elements;
            };

            return topLevel.flatMap((prop: ClassProperty) => renderProperty(prop));
          })()
        ) : (
          <div style={{
            padding: '12px',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '11px',
            fontStyle: 'italic'
          }}>
            No properties
          </div>
        )}
      </div>

      {/* Bottom handle for composition relationships (allOf/anyOf/oneOf) - single unified handle */}
      {typedData.schema && (() => {
        const schema = typeof typedData.schema === 'string' ? JSON.parse(typedData.schema) : typedData.schema;
        const hasComposition =
          (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.some((item: any) => item.$ref)) ||
          (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.some((item: any) => item.$ref)) ||
          (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.some((item: any) => item.$ref));

        // Determine the dominant composition type for handle color
        let handleColor = '#6b7280'; // default gray
        if (schema.allOf && schema.allOf.length > 0) handleColor = '#2563eb'; // blue for allOf
        else if (schema.anyOf && schema.anyOf.length > 0) handleColor = '#ea580c'; // orange for anyOf
        else if (schema.oneOf && schema.oneOf.length > 0) handleColor = '#9333ea'; // purple for oneOf

        // Create single unified handle for all compositions
        return hasComposition ? (
          <Handle
            key="comp-bottom"
            type="source"
            position={Position.Bottom}
            id="comp-bottom"
            style={{
              left: '50%',
              bottom: '-6px',
              transform: 'translateX(-50%)',
              background: handleColor,
              width: '12px',
              height: '12px',
              border: '3px solid white',
              borderRadius: '50%',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            isConnectable={false}
          />
        ) : null;
      })()}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(ClassNode);

