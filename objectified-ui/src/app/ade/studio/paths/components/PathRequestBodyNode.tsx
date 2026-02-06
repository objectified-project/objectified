// Path Request Body Node Component for React Flow Canvas
'use client';

import React, { useState, useEffect } from 'react';
import { Link2, Pencil, Trash2, ChevronRight, ChevronDown, Plus, AlertCircle } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';
import {
  buildPropertyTreeFromInlineSchema,
  type InlineSchema,
  type PropertyTreeNode,
} from '../../../../../../lib/utils/inline-schema-utils';

// =============================================================================
// TYPES
// =============================================================================

/** Single class property for read-only $ref display */
export interface ClassPropertyDisplay {
  id: string;
  name: string;
  data?: { type?: string; $ref?: string; format?: string; [key: string]: unknown };
  description?: string | null;
}

export interface ContentTypeInfo {
  id: string;
  media_type: string;
  class_id?: string | null;
  class_name?: string | null;
  inline_schema?: InlineSchema | null;
  encoding?: Record<string, any> | null;
  examples?: any[] | null;
  /** When class_id is set, properties from the class for read-only $ref display */
  classProperties?: ClassPropertyDisplay[] | null;
}

export interface PathRequestBodyData {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
  contentTypes: ContentTypeInfo[];
  onDelete?: () => void;
  onEdit?: () => void;
  onPropertyDrop?: (contentId: string, propertyData: any, parentId?: string) => void;
  onClassDrop?: (contentId: string, classData: any, action: 'copy' | 'reference') => void;
  onPropertyEdit?: (contentId: string, propertyId: string) => void;
  onPropertyDelete?: (contentId: string, propertyId: string) => void;
  onAddContentType?: () => void;
  onShowClassDropDialog?: (classData: any, onConfirm: (action: 'copy' | 'reference') => void) => void;
  [key: string]: unknown; // Index signature for React Flow compatibility
}

// =============================================================================
// CONTENT TYPE BADGE
// =============================================================================

const MEDIA_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'application/json': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  'application/xml': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  'multipart/form-data': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  'application/x-www-form-urlencoded': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  'text/plain': { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' },
};

function ContentTypeBadge({ content }: { content: ContentTypeInfo }) {
  const colors = MEDIA_TYPE_COLORS[content.media_type] || {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-700 dark:text-gray-300'
  };

  const isReference = !!content.class_id;
  const propertyCount = content.inline_schema?.properties?.length || 0;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text}`}>
      {isReference ? (
        <>
          <Link2 className="w-3 h-3" />
          <span className="truncate max-w-[100px]">{content.class_name || 'Unknown'}</span>
        </>
      ) : (
        <>
          <Pencil className="w-3 h-3" />
          <span>{propertyCount} props</span>
        </>
      )}
      <span className="opacity-60 ml-1">{content.media_type.replace('application/', '')}</span>
    </div>
  );
}

// =============================================================================
// PROPERTY TREE ITEM
// =============================================================================

interface PropertyTreeItemProps {
  property: PropertyTreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDrop?: (propertyData: any, parentId: string) => void;
}

function PropertyTreeItem({
  property,
  depth,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onDrop,
}: PropertyTreeItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = React.useRef(0);
  const hasChildren = property.children.length > 0;
  const canAcceptChildren = property.data?.type === 'object' ||
    (property.data?.type === 'array' && !property.data?.items?.$ref);

  const handleDragEnter = (e: React.DragEvent) => {
    if (!canAcceptChildren) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canAcceptChildren) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!canAcceptChildren) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    if (!canAcceptChildren || !onDrop) return;

    const dataStr = e.dataTransfer.getData('application/json');
    if (dataStr) {
      try {
        const dropData = JSON.parse(dataStr);
        if (dropData.type === 'property') {
          onDrop(dropData, property.id);
        }
      } catch (err) {
        console.error('Failed to parse drop data:', err);
      }
    }
  };

  // Get type display
  const getTypeDisplay = () => {
    const data = property.data || {};
    if (data.$ref) {
      const parts = data.$ref.split('/');
      return parts[parts.length - 1];
    }
    if (Array.isArray(data.type)) {
      return data.type.filter((t: string) => t !== 'null').join(' | ') + '?';
    }
    let typeStr = data.type || 'any';
    if (data.format) {
      typeStr += `:${data.format}`;
    }
    return typeStr;
  };

  const isRequired = property.data?.required === true;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded group ${
          isDragOver ? 'bg-green-100 dark:bg-green-900/30 ring-1 ring-green-400' : ''
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 ${
            !hasChildren && !canAcceptChildren ? 'invisible' : ''
          }`}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-gray-500" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500" />
          )}
        </button>

        {/* Property name */}
        <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
          {property.name}
        </span>

        {/* Required indicator */}
        {isRequired && (
          <span className="text-red-500 text-[10px]">*</span>
        )}

        {/* Type */}
        <span className="text-gray-500 dark:text-gray-400 text-[10px] ml-auto">
          {getTypeDisplay()}
        </span>

        {/* Action buttons - visible on hover */}
        <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="Edit property"
            >
              <Pencil className="w-3 h-3 text-gray-500" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
              title="Delete property"
            >
              <Trash2 className="w-3 h-3 text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Render children if expanded */}
      {expanded && hasChildren && (
        <div>
          {property.children.map((child) => (
            <PropertyTreeItem
              key={child.id}
              property={child}
              depth={depth + 1}
              expanded={false}
              onToggle={() => {}}
              onEdit={onEdit ? () => onEdit() : undefined}
              onDelete={onDelete ? () => onDelete() : undefined}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// REQUEST BODY CONTENT TYPE PANEL (matches response body: $ref vs inline drop zones)
// =============================================================================

interface RequestBodyContentTypePanelProps {
  content: ContentTypeInfo;
  onPropertyDrop?: (propertyData: any, parentId?: string) => void;
  onClassDrop?: (classData: any, action: 'copy' | 'reference') => void;
  onShowClassDropDialog?: (classData: any, onConfirm: (action: 'copy' | 'reference') => void) => void;
  onPropertyEdit?: (propertyId: string) => void;
  onPropertyDelete?: (propertyId: string) => void;
}

function RequestBodyContentTypePanel({
  content,
  onPropertyDrop,
  onClassDrop,
  onShowClassDropDialog,
  onPropertyEdit,
  onPropertyDelete,
}: RequestBodyContentTypePanelProps) {
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [refDragOver, setRefDragOver] = useState(false);
  const dragCounterRef = React.useRef(0);
  const refDragCounterRef = React.useRef(0);

  const propertyTree = buildPropertyTreeFromInlineSchema(content.inline_schema || null);

  const toggleExpanded = (propId: string) => {
    setExpandedProps((prev) => {
      const next = new Set(prev);
      if (next.has(propId)) next.delete(propId);
      else next.add(propId);
      return next;
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (content.class_id) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragOver(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (content.class_id) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (content.class_id) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (content.class_id) return;
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    try {
      const dropData = JSON.parse(dataStr);
      if (dropData.type === 'property' && onPropertyDrop) {
        onPropertyDrop(dropData, undefined);
      } else if (dropData.type === 'class') {
        if (onShowClassDropDialog) {
          onShowClassDropDialog(dropData, (action: 'copy' | 'reference') => {
            if (onClassDrop) onClassDrop(dropData, action);
          });
        } else if (onClassDrop) {
          onClassDrop(dropData, 'copy');
        }
      }
    } catch (err) {
      console.error('Failed to parse drop data:', err);
    }
  };

  const handleNestedDrop = (propertyData: any, parentId?: string) => {
    if (onPropertyDrop) onPropertyDrop(propertyData, parentId);
  };

  // $ref: show read-only class + drop zone "Drop a class or property to replace this $ref"
  if (content.class_id) {
    const handleRefDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      refDragCounterRef.current++;
      setRefDragOver(true);
    };
    const handleRefDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setRefDragOver(true);
      e.dataTransfer.dropEffect = 'copy';
    };
    const handleRefDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      refDragCounterRef.current--;
      if (refDragCounterRef.current === 0) setRefDragOver(false);
    };
    const handleRefDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      refDragCounterRef.current = 0;
      setRefDragOver(false);
      try {
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        const dropData = JSON.parse(dataStr);
        if (dropData.type === 'property' && onPropertyDrop) {
          onPropertyDrop(dropData);
        } else if (dropData.type === 'class') {
          if (onShowClassDropDialog) {
            onShowClassDropDialog(dropData, (action: 'copy' | 'reference') => {
              if (onClassDrop) onClassDrop(dropData, action);
            });
          } else if (onClassDrop) {
            onClassDrop(dropData, 'copy');
          }
        }
      } catch (err) {
        console.error('Error parsing dropped data:', err);
      }
    };
    const classProps = content.classProperties || [];
    const getTypeLabel = (p: ClassPropertyDisplay) => {
      const d = p.data as { type?: string; $ref?: string; items?: { $ref?: string } } | undefined;
      if (!d) return 'any';
      if (d.$ref) return d.$ref.split('/').pop() || 'ref';
      if (d.type === 'array' && d.items?.$ref) return `${d.items.$ref.split('/').pop()}[]`;
      return d.type || 'any';
    };
    // Same design as PathResponseBodyNode $ref block: one blue box (header + properties list), then draggable section below
    return (
      <div className="space-y-2" data-drop-zone="request-body-content-type">
        <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Link2 className="w-4 h-4" />
            <span className="font-medium">$ref: {content.class_name || 'Unknown'}</span>
          </div>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
            Read-only; changes to the class will update this request body.
          </p>
          {classProps.length > 0 && (
            <div className="mt-2 rounded border border-blue-200/60 dark:border-blue-700/60 bg-white/50 dark:bg-gray-800/50 p-2 max-h-[200px] overflow-y-auto">
              <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-1.5">Properties (read-only)</div>
              <ul className="space-y-1">
                {classProps.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <span className="font-mono truncate">{p.name}</span>
                    <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px] shrink-0">{getTypeLabel(p)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div
          onDragEnter={handleRefDragEnter}
          onDragOver={handleRefDragOver}
          onDragLeave={handleRefDragLeave}
          onDrop={handleRefDrop}
          className={`p-3 rounded-lg border-2 border-dashed text-center transition-colors text-xs ${
            refDragOver
              ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'
          }`}
        >
          <Plus className="w-4 h-4 mx-auto mb-1 opacity-70" />
          Drop a class or property to replace this $ref
        </div>
      </div>
    );
  }

  // Inline schema: "Drop class or property to add properties to this schema"
  if (propertyTree.length === 0) {
    return (
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-4 rounded-lg border-2 border-dashed text-center transition-all ${
          isDragOver
            ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50'
        }`}
      >
        <Plus className="w-6 h-6 mx-auto mb-2 text-gray-400" />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Drop class or property to add properties to this schema
        </p>
      </div>
    );
  }

  // Inline schema with properties: same layout as response – properties list first, then draggable section below
  return (
    <div className="space-y-2" data-drop-zone="request-body-content-type">
      <div
        className={`rounded-lg border transition-all ${
          isDragOver
            ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }`}
      >
        <div
          className="p-2 space-y-0.5 max-h-[300px] overflow-y-auto min-h-[60px]"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {propertyTree.map((prop) => (
            <PropertyTreeItem
              key={prop.id}
              property={prop}
              depth={0}
              expanded={expandedProps.has(prop.id)}
              onToggle={() => toggleExpanded(prop.id)}
              onEdit={onPropertyEdit ? () => onPropertyEdit(prop.id) : undefined}
              onDelete={onPropertyDelete ? () => onPropertyDelete(prop.id) : undefined}
              onDrop={handleNestedDrop}
            />
          ))}
        </div>
      </div>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-3 rounded-lg border-2 border-dashed text-center transition-colors text-xs ${
          isDragOver
            ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'
        }`}
      >
        <Plus className="w-4 h-4 mx-auto mb-1 opacity-70" />
        Drop class or property to add to this schema
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PathRequestBodyNode({ data }: { data: PathRequestBodyData }) {
  const [selectedContentIndex, setSelectedContentIndex] = useState(0);

  useEffect(() => {
    if (selectedContentIndex >= data.contentTypes.length) {
      setSelectedContentIndex(0);
    }
  }, [data.contentTypes.length, selectedContentIndex]);

  const selectedContent = data.contentTypes[selectedContentIndex];

  // Schema summary for header (match response body: "$ref: ClassName" or "N props")
  const schemaLabel = selectedContent
    ? (selectedContent.class_id
        ? `$ref: ${selectedContent.class_name || 'Unknown'}`
        : (selectedContent.inline_schema?.properties?.length ?? 0) > 0
          ? `${selectedContent.inline_schema!.properties!.length} props`
          : 'Object')
    : null;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        id="request-body-input"
        isConnectable={false}
        className="!w-3 !h-2 !rounded-t-md !rounded-b-none bg-indigo-500 !cursor-not-allowed opacity-50"
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-indigo-500 dark:border-indigo-600 min-w-[320px] max-w-[400px]">
        {/* Header: Request + schema summary (same layout as response body node) */}
        <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {data.required && (
                <div className="px-2 py-0.5 rounded text-white text-xs font-bold bg-red-500/90">
                  REQ
                </div>
              )}
              <span className="text-white font-semibold text-sm">Request</span>
              {schemaLabel && (
                <span className="text-indigo-100 text-xs font-medium truncate max-w-[140px]" title={`Schema: ${schemaLabel}`}>
                  → {schemaLabel}
                </span>
              )}
            </div>
            {data.onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onDelete?.();
                }}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="Delete request body"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
          {data.description && (
            <p className="text-xs text-indigo-50 mt-1 truncate">{data.description}</p>
          )}
        </div>

        {/* Content type tabs (same as response body: show when more than one) */}
        {data.contentTypes.length > 1 && (
          <div className="px-3 pt-2 flex gap-1 overflow-x-auto">
            {data.contentTypes.map((ct, index) => (
              <button
                key={ct.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedContentIndex(index);
                }}
                className={`
                  px-2 py-1 text-[10px] rounded-t transition-colors whitespace-nowrap
                  ${selectedContentIndex === index
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
              >
                {ct.media_type}
              </button>
            ))}
          </div>
        )}

        {/* Content: badge (e.g. $ref: BlogPost json) + panel with drop zone */}
        <div className="p-3 space-y-2">
          {data.contentTypes.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 py-4">
              <AlertCircle className="w-4 h-4" />
              <span>No content types defined</span>
            </div>
          ) : selectedContent ? (
            <>
              <ContentTypeBadge content={selectedContent} />
              <RequestBodyContentTypePanel
                content={selectedContent}
                onPropertyDrop={
                  data.onPropertyDrop && selectedContent.id
                    ? (propData, parentId) => data.onPropertyDrop!(selectedContent.id, propData, parentId)
                    : undefined
                }
                onClassDrop={
                  data.onClassDrop && selectedContent.id
                    ? (classData, action) => data.onClassDrop!(selectedContent.id, classData, action)
                    : undefined
                }
                onShowClassDropDialog={data.onShowClassDropDialog}
                onPropertyEdit={
                  data.onPropertyEdit
                    ? (propId) => data.onPropertyEdit?.(selectedContent.id, propId)
                    : undefined
                }
                onPropertyDelete={
                  data.onPropertyDelete
                    ? (propId) => data.onPropertyDelete?.(selectedContent.id, propId)
                    : undefined
                }
              />
            </>
          ) : null}
        </div>

        {/* Footer (same as response body) */}
        <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
          <span>{data.contentTypes.length} content type(s)</span>
          {data.onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onEdit?.();
              }}
              className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="request-body-output"
        className="!w-3 !h-2 !rounded-b-md !rounded-t-none bg-indigo-500"
      />
    </>
  );
}
