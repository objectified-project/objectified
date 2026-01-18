'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { Add, Delete, Link, LinkOff, Edit, Refresh } from '@mui/icons-material';
import { FileJson, Link2, Pencil, Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useDarkMode } from '../../../../hooks/useDarkMode';
import { useDialog } from '../../../../components/providers/DialogProvider';
import { useStudio } from '../../StudioContext';
import {
  getSharedPathRequestBodies,
  getLinkedRequestBodyForOperation,
  createSharedPathRequestBody,
  linkRequestBodyToOperation,
  unlinkRequestBodyFromOperation,
  addRequestBodyContentType,
  updateRequestBodyContentType,
  deleteRequestBodyContentType,
  convertClassToInlineSchema,
  initializeInlineSchema,
  setContentTypeClassReference,
  addPropertyToInlineSchema,
  updateInlineSchemaProperty,
  deleteInlineSchemaProperty,
} from '../../../../../../lib/db/helper-shared-path-request-bodies';
import { getClassesWithPropertiesAndTags } from '../../../../../../lib/db/helper';
import {
  buildPropertyTreeFromInlineSchema,
  type InlineSchema,
  type PropertyTreeNode,
} from '../../../../../../lib/utils/inline-schema-utils';

// =============================================================================
// TYPES
// =============================================================================

interface ContentTypeInfo {
  id: string;
  media_type: string;
  class_id?: string | null;
  class_name?: string | null;
  inline_schema?: InlineSchema | null;
  encoding?: Record<string, unknown> | null;
  examples?: unknown[] | null;
}

interface RequestBodyInfo {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
  content_types: ContentTypeInfo[];
}

interface RequestBodySectionProps {
  operationId: string;
  versionPathId: string;
  onRefresh?: () => void;
}

// =============================================================================
// MEDIA TYPE OPTIONS
// =============================================================================

const MEDIA_TYPE_OPTIONS = [
  { value: 'application/json', label: 'JSON (application/json)' },
  { value: 'application/xml', label: 'XML (application/xml)' },
  { value: 'multipart/form-data', label: 'Multipart (multipart/form-data)' },
  { value: 'application/x-www-form-urlencoded', label: 'Form URL Encoded' },
  { value: 'text/plain', label: 'Plain Text (text/plain)' },
  { value: 'application/octet-stream', label: 'Binary (application/octet-stream)' },
];

// =============================================================================
// INLINE PROPERTY TREE COMPONENT
// =============================================================================

interface PropertyTreeItemProps {
  property: PropertyTreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function PropertyTreeItem({ property, depth, expanded, onToggle, onEdit, onDelete }: PropertyTreeItemProps) {
  const hasChildren = property.children.length > 0;
  const canAcceptChildren = property.data?.type === 'object' || property.data?.type === 'array';

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
        className="flex items-center gap-1 px-2 py-1 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded group"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
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

        <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
          {property.name}
        </span>

        {isRequired && <span className="text-red-500 text-[10px]">*</span>}

        <span className="text-gray-500 dark:text-gray-400 text-[10px] ml-auto">
          {getTypeDisplay()}
        </span>

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

      {expanded && hasChildren && (
        <div>
          {property.children.map((child) => (
            <PropertyTreeItem
              key={child.id}
              property={child}
              depth={depth + 1}
              expanded={false}
              onToggle={() => {}}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INLINE SCHEMA VIEWER
// =============================================================================

interface InlineSchemaViewerProps {
  inlineSchema: InlineSchema | null;
  contentId: string;
  onPropertyEdit?: (propertyId: string) => void;
  onPropertyDelete?: (propertyId: string) => void;
  onAddProperty?: () => void;
}

function InlineSchemaViewer({
  inlineSchema,
  contentId,
  onPropertyEdit,
  onPropertyDelete,
  onAddProperty,
}: InlineSchemaViewerProps) {
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());
  const propertyTree = buildPropertyTreeFromInlineSchema(inlineSchema);

  const toggleExpanded = (propId: string) => {
    setExpandedProps((prev) => {
      const next = new Set(prev);
      if (next.has(propId)) {
        next.delete(propId);
      } else {
        next.add(propId);
      }
      return next;
    });
  };

  if (propertyTree.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-gray-400 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-600 rounded">
        <Plus className="w-4 h-4 mx-auto mb-1 opacity-50" />
        <div>No properties defined</div>
        {onAddProperty && (
          <button
            onClick={onAddProperty}
            className="mt-2 px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Add Property
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded">
      <div className="py-1 max-h-[200px] overflow-y-auto">
        {propertyTree.map((prop) => (
          <PropertyTreeItem
            key={prop.id}
            property={prop}
            depth={0}
            expanded={expandedProps.has(prop.id)}
            onToggle={() => toggleExpanded(prop.id)}
            onEdit={onPropertyEdit ? () => onPropertyEdit(prop.id) : undefined}
            onDelete={onPropertyDelete ? () => onPropertyDelete(prop.id) : undefined}
          />
        ))}
      </div>
      {onAddProperty && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onAddProperty}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600"
          >
            <Plus className="w-3 h-3" />
            Add Property
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CONTENT TYPE EDITOR
// =============================================================================

interface ContentTypeEditorProps {
  content: ContentTypeInfo;
  classes: Array<{ id: string; name: string }>;
  onSchemaTypeChange: (type: 'reference' | 'inline') => void;
  onClassChange: (classId: string) => void;
  onConvertToInline: () => void;
  onPropertyEdit?: (propertyId: string) => void;
  onPropertyDelete?: (propertyId: string) => void;
  onAddProperty?: () => void;
  onDelete: () => void;
}

function ContentTypeEditor({
  content,
  classes,
  onSchemaTypeChange,
  onClassChange,
  onConvertToInline,
  onPropertyEdit,
  onPropertyDelete,
  onAddProperty,
  onDelete,
}: ContentTypeEditorProps) {
  const isDark = useDarkMode();
  const isReference = !!content.class_id;
  const isInline = !content.class_id && !!content.inline_schema;

  return (
    <Box sx={{ p: 2, border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <code className="text-xs font-mono px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
          {content.media_type}
        </code>
        <IconButton size="small" onClick={onDelete} sx={{ color: '#ef4444' }}>
          <Delete sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Schema Type Selector */}
      <Box sx={{ mb: 2 }}>
        <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
          Schema Type
        </label>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant={isReference ? 'contained' : 'outlined'}
            onClick={() => onSchemaTypeChange('reference')}
            startIcon={<Link2 className="w-3 h-3" />}
            sx={{
              flex: 1,
              fontSize: '0.65rem',
              textTransform: 'none',
              ...(isReference && {
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              }),
            }}
          >
            Class Reference
          </Button>
          <Button
            size="small"
            variant={isInline ? 'contained' : 'outlined'}
            onClick={() => onSchemaTypeChange('inline')}
            startIcon={<Pencil className="w-3 h-3" />}
            sx={{
              flex: 1,
              fontSize: '0.65rem',
              textTransform: 'none',
              ...(isInline && {
                background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
              }),
            }}
          >
            Inline Schema
          </Button>
        </Box>
      </Box>

      {/* Reference Mode: Class Selector */}
      {isReference && (
        <Box>
          <TextField
            select
            fullWidth
            size="small"
            label="Select Class"
            value={content.class_id || ''}
            onChange={(e) => onClassChange(e.target.value)}
            sx={{
              '& .MuiInputBase-input': { fontSize: '0.75rem' },
              '& .MuiInputLabel-root': { fontSize: '0.75rem' },
            }}
          >
            {classes.map((cls) => (
              <MenuItem key={cls.id} value={cls.id} sx={{ fontSize: '0.75rem' }}>
                {cls.name}
              </MenuItem>
            ))}
          </TextField>
          {content.class_id && (
            <Button
              size="small"
              onClick={onConvertToInline}
              sx={{ mt: 1, fontSize: '0.65rem', textTransform: 'none' }}
            >
              Convert to Inline (copy properties)
            </Button>
          )}
        </Box>
      )}

      {/* Inline Mode: Property Tree */}
      {isInline && (
        <InlineSchemaViewer
          inlineSchema={content.inline_schema || null}
          contentId={content.id}
          onPropertyEdit={onPropertyEdit}
          onPropertyDelete={onPropertyDelete}
          onAddProperty={onAddProperty}
        />
      )}

      {/* Neither mode: Empty state */}
      {!isReference && !isInline && (
        <div className="p-3 text-center text-xs text-gray-400 dark:text-gray-500">
          Select a schema type above
        </div>
      )}
    </Box>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RequestBodySection({
  operationId,
  versionPathId,
  onRefresh,
}: RequestBodySectionProps) {
  const isDark = useDarkMode();
  const { alert: alertDialog, confirm: confirmDialog } = useDialog();
  const { selectedVersionId } = useStudio();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [linkedRequestBody, setLinkedRequestBody] = useState<RequestBodyInfo | null>(null);
  const [availableRequestBodies, setAvailableRequestBodies] = useState<RequestBodyInfo[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedContentTab, setSelectedContentTab] = useState(0);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRequired, setNewRequired] = useState(true);
  const [addContentDialogOpen, setAddContentDialogOpen] = useState(false);
  const [newMediaType, setNewMediaType] = useState('application/json');
  const [addPropertyDialogOpen, setAddPropertyDialogOpen] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState('string');
  const [currentContentId, setCurrentContentId] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load linked request body
      const linkedResult = await getLinkedRequestBodyForOperation(operationId);
      const linkedData = JSON.parse(linkedResult);
      if (linkedData.success && linkedData.requestBody) {
        // Parse content types
        const contentTypes = (linkedData.requestBody.content_types || []).map((ct: ContentTypeInfo) => ({
          ...ct,
          inline_schema: typeof ct.inline_schema === 'string' ? JSON.parse(ct.inline_schema) : ct.inline_schema,
          encoding: typeof ct.encoding === 'string' ? JSON.parse(ct.encoding) : ct.encoding,
          examples: typeof ct.examples === 'string' ? JSON.parse(ct.examples) : ct.examples,
        }));
        setLinkedRequestBody({
          ...linkedData.requestBody,
          content_types: contentTypes,
        });
      } else {
        setLinkedRequestBody(null);
      }

      // Load available request bodies for this path
      const availableResult = await getSharedPathRequestBodies(versionPathId);
      const availableData = JSON.parse(availableResult);
      if (availableData.success) {
        setAvailableRequestBodies(availableData.requestBodies || []);
      }

      // Load classes for reference selection
      if (selectedVersionId) {
        const classesResult = await getClassesWithPropertiesAndTags(selectedVersionId);
        const classesData = JSON.parse(classesResult as string);
        const uniqueClasses = classesData.reduce((acc: Array<{ id: string; name: string }>, cls: { id: string; name: string }) => {
          if (!acc.find((c) => c.id === cls.id)) {
            acc.push({ id: cls.id, name: cls.name });
          }
          return acc;
        }, []);
        setClasses(uniqueClasses);
      }
    } catch (error) {
      console.error('Error loading request body data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [operationId, versionPathId, selectedVersionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleCreateRequestBody = async () => {
    if (!newName.trim()) {
      await alertDialog({
        title: 'Error',
        message: 'Please enter a name for the request body',
        variant: 'error',
      });
      return;
    }

    try {
      const result = await createSharedPathRequestBody(
        versionPathId,
        newName.trim(),
        newDescription.trim() || undefined,
        newRequired
      );
      const data = JSON.parse(result);

      if (data.success) {
        // Link to operation
        await linkRequestBodyToOperation(operationId, data.requestBody.id);

        // Add default content type
        await addRequestBodyContentType(
          data.requestBody.id,
          'application/json',
          undefined,
          { type: 'object', properties: [] }
        );

        setCreateDialogOpen(false);
        setNewName('');
        setNewDescription('');
        setNewRequired(true);
        await loadData();
        onRefresh?.();
      } else {
        await alertDialog({
          title: 'Error',
          message: data.error || 'Failed to create request body',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error creating request body:', error);
      await alertDialog({
        title: 'Error',
        message: 'Failed to create request body',
        variant: 'error',
      });
    }
  };

  const handleLinkRequestBody = async (requestBodyId: string) => {
    try {
      const result = await linkRequestBodyToOperation(operationId, requestBodyId);
      const data = JSON.parse(result);

      if (data.success) {
        await loadData();
        onRefresh?.();
      } else {
        await alertDialog({
          title: 'Error',
          message: data.error || 'Failed to link request body',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error linking request body:', error);
    }
  };

  const handleUnlinkRequestBody = async () => {
    const confirmed = await confirmDialog({
      title: 'Unlink Request Body',
      message: 'Are you sure you want to unlink this request body from the operation?',
      variant: 'warning',
      confirmLabel: 'Unlink',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const result = await unlinkRequestBodyFromOperation(operationId);
      const data = JSON.parse(result);

      if (data.success) {
        setLinkedRequestBody(null);
        await loadData();
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error unlinking request body:', error);
    }
  };

  const handleSchemaTypeChange = async (contentId: string, type: 'reference' | 'inline') => {
    try {
      if (type === 'inline') {
        await initializeInlineSchema(contentId);
      } else {
        // For reference, we'll need to select a class first
        if (classes.length > 0) {
          await setContentTypeClassReference(contentId, classes[0].id);
        }
      }
      await loadData();
    } catch (error) {
      console.error('Error changing schema type:', error);
    }
  };

  const handleClassChange = async (contentId: string, classId: string) => {
    try {
      await setContentTypeClassReference(contentId, classId);
      await loadData();
    } catch (error) {
      console.error('Error changing class reference:', error);
    }
  };

  const handleConvertToInline = async (contentId: string) => {
    const confirmed = await confirmDialog({
      title: 'Convert to Inline Schema',
      message: 'This will copy all properties from the referenced class into an inline schema. Continue?',
      variant: 'info',
      confirmLabel: 'Convert',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const result = await convertClassToInlineSchema(contentId);
      const data = JSON.parse(result);

      if (data.success) {
        await loadData();
        onRefresh?.();
      } else {
        await alertDialog({
          title: 'Error',
          message: data.error || 'Failed to convert to inline schema',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error converting to inline:', error);
    }
  };

  const handleAddContentType = async () => {
    if (!linkedRequestBody) return;

    try {
      const result = await addRequestBodyContentType(
        linkedRequestBody.id,
        newMediaType,
        undefined,
        { type: 'object', properties: [] }
      );
      const data = JSON.parse(result);

      if (data.success) {
        setAddContentDialogOpen(false);
        setNewMediaType('application/json');
        await loadData();
      } else {
        await alertDialog({
          title: 'Error',
          message: data.error || 'Failed to add content type',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error adding content type:', error);
    }
  };

  const handleDeleteContentType = async (contentId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Content Type',
      message: 'Are you sure you want to delete this content type?',
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const result = await deleteRequestBodyContentType(contentId);
      const data = JSON.parse(result);

      if (data.success) {
        await loadData();
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error deleting content type:', error);
    }
  };

  const handleAddProperty = async () => {
    if (!currentContentId || !newPropertyName.trim()) return;

    try {
      const result = await addPropertyToInlineSchema(
        currentContentId,
        {
          name: newPropertyName.trim(),
          data: { type: newPropertyType },
        }
      );
      const data = JSON.parse(result);

      if (data.success) {
        setAddPropertyDialogOpen(false);
        setNewPropertyName('');
        setNewPropertyType('string');
        setCurrentContentId(null);
        await loadData();
      } else {
        await alertDialog({
          title: 'Error',
          message: data.error || 'Failed to add property',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error adding property:', error);
    }
  };

  const handleDeleteProperty = async (contentId: string, propertyId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Property',
      message: 'Are you sure you want to delete this property?',
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const result = await deleteInlineSchemaProperty(contentId, propertyId, true);
      const data = JSON.parse(result);

      if (data.success) {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
      </Box>
    );
  }

  // Render linked request body
  if (linkedRequestBody) {
    const contentTypes = linkedRequestBody.content_types || [];

    return (
      <Box>
        {/* Header with unlink button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileJson className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {linkedRequestBody.name}
            </span>
            {linkedRequestBody.required && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                Required
              </span>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={loadData} title="Refresh">
              <Refresh sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" onClick={handleUnlinkRequestBody} title="Unlink" sx={{ color: '#f59e0b' }}>
              <LinkOff sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Description */}
        {linkedRequestBody.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {linkedRequestBody.description}
          </div>
        )}

        {/* Content Types Tabs */}
        {contentTypes.length > 0 ? (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Tabs
                value={Math.min(selectedContentTab, contentTypes.length - 1)}
                onChange={(_, newValue) => setSelectedContentTab(newValue)}
                sx={{
                  minHeight: 32,
                  '& .MuiTab-root': {
                    minHeight: 32,
                    fontSize: '0.65rem',
                    textTransform: 'none',
                    py: 0.5,
                  },
                }}
              >
                {contentTypes.map((ct, index) => (
                  <Tab key={ct.id} label={ct.media_type.replace('application/', '')} />
                ))}
              </Tabs>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={() => setAddContentDialogOpen(true)}
                sx={{ fontSize: '0.65rem', textTransform: 'none' }}
              >
                Add
              </Button>
            </Box>

            {/* Selected Content Type Editor */}
            {contentTypes[selectedContentTab] && (
              <ContentTypeEditor
                content={contentTypes[selectedContentTab]}
                classes={classes}
                onSchemaTypeChange={(type) =>
                  handleSchemaTypeChange(contentTypes[selectedContentTab].id, type)
                }
                onClassChange={(classId) =>
                  handleClassChange(contentTypes[selectedContentTab].id, classId)
                }
                onConvertToInline={() =>
                  handleConvertToInline(contentTypes[selectedContentTab].id)
                }
                onPropertyEdit={(propId) => {
                  // TODO: Open property edit dialog
                  console.log('Edit property:', propId);
                }}
                onPropertyDelete={(propId) =>
                  handleDeleteProperty(contentTypes[selectedContentTab].id, propId)
                }
                onAddProperty={() => {
                  setCurrentContentId(contentTypes[selectedContentTab].id);
                  setAddPropertyDialogOpen(true);
                }}
                onDelete={() => handleDeleteContentType(contentTypes[selectedContentTab].id)}
              />
            )}
          </Box>
        ) : (
          <Box
            sx={{
              py: 3,
              px: 2,
              textAlign: 'center',
              border: isDark ? '1px dashed #334155' : '1px dashed #e2e8f0',
              borderRadius: 1,
            }}
          >
            <span className="text-xs text-gray-500 dark:text-gray-400">No content types defined</span>
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() => setAddContentDialogOpen(true)}
              sx={{ mt: 1, fontSize: '0.65rem', textTransform: 'none' }}
            >
              Add Content Type
            </Button>
          </Box>
        )}

        {/* Add Content Type Dialog */}
        <Dialog open={addContentDialogOpen} onClose={() => setAddContentDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: '0.875rem' }}>Add Content Type</DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              size="small"
              label="Media Type"
              value={newMediaType}
              onChange={(e) => setNewMediaType(e.target.value)}
              sx={{ mt: 1 }}
            >
              {MEDIA_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddContentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddContentType} variant="contained">
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Property Dialog */}
        <Dialog open={addPropertyDialogOpen} onClose={() => setAddPropertyDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: '0.875rem' }}>Add Property</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              size="small"
              label="Property Name"
              value={newPropertyName}
              onChange={(e) => setNewPropertyName(e.target.value)}
              sx={{ mt: 1, mb: 2 }}
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Type"
              value={newPropertyType}
              onChange={(e) => setNewPropertyType(e.target.value)}
            >
              <MenuItem value="string">string</MenuItem>
              <MenuItem value="number">number</MenuItem>
              <MenuItem value="integer">integer</MenuItem>
              <MenuItem value="boolean">boolean</MenuItem>
              <MenuItem value="object">object</MenuItem>
              <MenuItem value="array">array</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddPropertyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProperty} variant="contained" disabled={!newPropertyName.trim()}>
              Add
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Render no linked request body - show link options
  return (
    <Box>
      <Box
        sx={{
          py: 3,
          px: 2,
          textAlign: 'center',
          border: isDark ? '1px dashed #334155' : '1px dashed #e2e8f0',
          borderRadius: 1,
        }}
      >
        <FileJson className="w-6 h-6 mx-auto mb-2 text-gray-400" />
        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-3">
          No request body linked
        </span>

        {/* Available request bodies to link */}
        {availableRequestBodies.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
              Link Existing
            </label>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {availableRequestBodies.map((rb) => (
                <Button
                  key={rb.id}
                  size="small"
                  variant="outlined"
                  startIcon={<Link />}
                  onClick={() => handleLinkRequestBody(rb.id)}
                  sx={{ fontSize: '0.65rem', textTransform: 'none', justifyContent: 'flex-start' }}
                >
                  {rb.name}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        <Button
          size="small"
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            fontSize: '0.7rem',
            textTransform: 'none',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          }}
        >
          Create New Request Body
        </Button>
      </Box>

      {/* Create Request Body Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.875rem' }}>Create Request Body</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., CreateUserRequest"
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                size="small"
              />
            }
            label={<span className="text-xs">Required</span>}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRequestBody} variant="contained" disabled={!newName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
