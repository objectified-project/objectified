'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { Add, Delete, Edit, Refresh } from '@mui/icons-material';
import { FileJson, Pencil, Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useDarkMode } from '../../../../hooks/useDarkMode';
import { useStudio } from '../../StudioContext';
import {
  getResponseContentTypes,
  addResponseContentType,
  updateResponseContentType,
  deleteResponseContentType,
  convertResponseClassToInlineSchema,
  initializeResponseInlineSchema,
  setResponseContentTypeClassReference,
  addPropertyToResponseInlineSchema,
  updateResponseInlineSchemaProperty,
  deleteResponseInlineSchemaProperty,
} from '../../../../../../lib/db/helper-shared-path-responses-content';
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
  examples?: unknown[] | null;
}

interface ResponseInfo {
  id: string;
  status_code: string;
  description?: string;
  content_types: ContentTypeInfo[];
}

interface ResponseSectionProps {
  response: ResponseInfo;
  onUpdate: () => void;
}

// =============================================================================
// PROPERTY TREE NODE COMPONENT
// =============================================================================

interface PropertyTreeNodeComponentProps {
  node: PropertyTreeNode;
  depth: number;
  isDark: boolean;
  onDeleteProperty: (id: string) => void;
}

function PropertyTreeNodeComponent({
  node,
  depth,
  isDark,
  onDeleteProperty
}: PropertyTreeNodeComponentProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Box key={node.id} sx={{ ml: depth * 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          px: 1,
          borderRadius: 1,
          '&:hover': {
            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          },
        }}
      >
        {node.children.length > 0 && (
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ p: 0.5 }}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </IconButton>
        )}

        <FileJson size={14} />

        <Box sx={{ flex: 1, fontSize: '0.875rem' }}>
          <strong>{node.name}</strong>
          {node.data?.type && (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              {node.data.type}
              {node.data.format && ` (${node.data.format})`}
            </span>
          )}
        </Box>

        <IconButton
          size="small"
          onClick={() => onDeleteProperty(node.id)}
          sx={{ p: 0.5 }}
        >
          <Trash2 size={14} />
        </IconButton>
      </Box>

      {expanded && node.children.map((child) => (
        <PropertyTreeNodeComponent
          key={child.id}
          node={child}
          depth={depth + 1}
          isDark={isDark}
          onDeleteProperty={onDeleteProperty}
        />
      ))}
    </Box>
  );
}

// =============================================================================
// RESPONSE SECTION COMPONENT
// =============================================================================

export default function ResponseSection({ response, onUpdate }: ResponseSectionProps) {
  const isDark = useDarkMode();
  const { selectedVersionId } = useStudio();

  const [contentTypes, setContentTypes] = useState<ContentTypeInfo[]>(response.content_types || []);
  const [selectedContentTypeIndex, setSelectedContentTypeIndex] = useState(0);
  const [classes, setClasses] = useState<any[]>([]);
  const [showAddPropertyDialog, setShowAddPropertyDialog] = useState(false);
  const [showAddContentTypeDialog, setShowAddContentTypeDialog] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState('string');
  const [newMediaType, setNewMediaType] = useState('application/json');
  const [schemaMode, setSchemaMode] = useState<'class' | 'inline'>('class');

  // Load content types
  const loadContentTypes = useCallback(async () => {
    if (!response.id) return;

    try {
      const result = await getResponseContentTypes(response.id);
      const data = JSON.parse(result);

      if (data.success && data.contentTypes) {
        setContentTypes(data.contentTypes);
      }
    } catch (error) {
      console.error('Error loading response content types:', error);
    }
  }, [response.id]);

  // Load classes
  const loadClasses = useCallback(async () => {
    if (!selectedVersionId) return;

    try {
      const result = await getClassesWithPropertiesAndTags(selectedVersionId);
      const data = JSON.parse(result);
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }, [selectedVersionId]);

  useEffect(() => {
    loadContentTypes();
    loadClasses();
  }, [loadContentTypes, loadClasses]);

  // Get current content type
  const currentContentType = contentTypes[selectedContentTypeIndex];

  // Determine schema mode based on current content type
  useEffect(() => {
    if (currentContentType) {
      if (currentContentType.class_id) {
        setSchemaMode('class');
      } else if (currentContentType.inline_schema) {
        setSchemaMode('inline');
      }
    }
  }, [currentContentType]);

  // Add content type
  const handleAddContentType = async () => {
    try {
      const result = await addResponseContentType(
        response.id,
        newMediaType,
        undefined,
        { type: 'object', properties: [] },
        undefined
      );

      const data = JSON.parse(result);
      if (data.success) {
        await loadContentTypes();
        setShowAddContentTypeDialog(false);
        setNewMediaType('application/json');
        onUpdate();
      }
    } catch (error) {
      console.error('Error adding content type:', error);
    }
  };

  // Delete content type
  const handleDeleteContentType = async (contentTypeId: string) => {
    if (!window.confirm('Are you sure you want to delete this content type?')) {
      return;
    }

    try {
      await deleteResponseContentType(contentTypeId);
      await loadContentTypes();
      setSelectedContentTypeIndex(0);
      onUpdate();
    } catch (error) {
      console.error('Error deleting content type:', error);
    }
  };

  // Switch schema mode
  const handleSchemaMode = async (mode: 'class' | 'inline') => {
    if (!currentContentType) return;

    if (mode === 'inline' && currentContentType.class_id) {
      // Convert class to inline
      if (!window.confirm('This will copy all properties from the class into an inline schema. Continue?')) {
        return;
      }

      try {
        await convertResponseClassToInlineSchema(currentContentType.id);
        await loadContentTypes();
        onUpdate();
      } catch (error) {
        console.error('Error converting to inline schema:', error);
      }
    } else if (mode === 'class' && currentContentType.inline_schema) {
      // User wants to use class reference - clear inline schema
      setSchemaMode('class');
    }
  };

  // Set class reference
  const handleSetClassReference = async (classId: string) => {
    if (!currentContentType) return;

    try {
      await setResponseContentTypeClassReference(currentContentType.id, classId);
      await loadContentTypes();
      onUpdate();
    } catch (error) {
      console.error('Error setting class reference:', error);
    }
  };

  // Add property to inline schema
  const handleAddProperty = async () => {
    if (!currentContentType || !newPropertyName) return;

    try {
      await addPropertyToResponseInlineSchema(currentContentType.id, {
        name: newPropertyName,
        data: { type: newPropertyType },
        parent_id: null,
      });

      await loadContentTypes();
      setShowAddPropertyDialog(false);
      setNewPropertyName('');
      setNewPropertyType('string');
      onUpdate();
    } catch (error) {
      console.error('Error adding property:', error);
    }
  };

  // Delete property from inline schema
  const handleDeleteProperty = async (propertyId: string) => {
    if (!currentContentType) return;

    if (!window.confirm('Are you sure you want to delete this property?')) {
      return;
    }

    try {
      await deleteResponseInlineSchemaProperty(currentContentType.id, propertyId, true);
      await loadContentTypes();
      onUpdate();
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  // Build property tree
  const propertyTree: PropertyTreeNode[] = currentContentType?.inline_schema
    ? buildPropertyTreeFromInlineSchema(currentContentType.inline_schema)
    : [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileJson size={20} />
          <Box sx={{ fontWeight: 600 }}>Response {response.status_code}</Box>
        </Box>

        <Button
          size="small"
          startIcon={<Add />}
          onClick={() => setShowAddContentTypeDialog(true)}
        >
          Add Content Type
        </Button>
      </Box>

      {/* Content Type Tabs */}
      {contentTypes.length > 0 && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={selectedContentTypeIndex}
            onChange={(_, newValue) => setSelectedContentTypeIndex(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {contentTypes.map((ct, index) => (
              <Tab
                key={ct.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {ct.media_type}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteContentType(ct.id);
                      }}
                      sx={{ p: 0.25 }}
                    >
                      <Trash2 size={12} />
                    </IconButton>
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>
      )}

      {/* Content Type Details */}
      {currentContentType && (
        <Box>
          {/* Schema Mode Toggle */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>Schema Type</Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant={schemaMode === 'class' ? 'contained' : 'outlined'}
                onClick={() => handleSchemaMode('class')}
              >
                Class Reference
              </Button>
              <Button
                size="small"
                variant={schemaMode === 'inline' ? 'contained' : 'outlined'}
                onClick={() => handleSchemaMode('inline')}
              >
                Inline Schema
              </Button>
            </Box>
          </Box>

          {/* Class Reference Mode */}
          {schemaMode === 'class' && (
            <Box>
              <TextField
                select
                fullWidth
                size="small"
                label="Response Class"
                value={currentContentType.class_id || ''}
                onChange={(e) => handleSetClassReference(e.target.value)}
              >
                <MenuItem value="">
                  <em>Select a class</em>
                </MenuItem>
                {classes.map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </MenuItem>
                ))}
              </TextField>

              {currentContentType.class_id && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    size="small"
                    startIcon={<Refresh />}
                    onClick={() => handleSchemaMode('inline')}
                  >
                    Convert to Inline Schema
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Inline Schema Mode */}
          {schemaMode === 'inline' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Properties</Box>
                <Button
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => setShowAddPropertyDialog(true)}
                >
                  Add Property
                </Button>
              </Box>

              {propertyTree.length > 0 ? (
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {propertyTree.map((node) => (
                    <PropertyTreeNodeComponent
                      key={node.id}
                      node={node}
                      depth={0}
                      isDark={isDark}
                      onDeleteProperty={handleDeleteProperty}
                    />
                  ))}
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    borderStyle: 'dashed',
                  }}
                >
                  <Box sx={{ opacity: 0.6, fontSize: '0.875rem' }}>
                    No properties defined. Click "Add Property" to get started.
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* No Content Types */}
      {contentTypes.length === 0 && (
        <Box
          sx={{
            p: 3,
            textAlign: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            borderStyle: 'dashed',
          }}
        >
          <FileJson size={48} style={{ opacity: 0.3, marginBottom: 8 }} />
          <Box sx={{ opacity: 0.6, fontSize: '0.875rem' }}>
            No content types defined for this response.
          </Box>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => setShowAddContentTypeDialog(true)}
            sx={{ mt: 2 }}
          >
            Add Content Type
          </Button>
        </Box>
      )}

      {/* Add Content Type Dialog */}
      <Dialog
        open={showAddContentTypeDialog}
        onClose={() => setShowAddContentTypeDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Content Type</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            size="small"
            label="Media Type"
            value={newMediaType}
            onChange={(e) => setNewMediaType(e.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="application/json">application/json</MenuItem>
            <MenuItem value="application/xml">application/xml</MenuItem>
            <MenuItem value="text/plain">text/plain</MenuItem>
            <MenuItem value="text/html">text/html</MenuItem>
            <MenuItem value="application/pdf">application/pdf</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddContentTypeDialog(false)}>Cancel</Button>
          <Button onClick={handleAddContentType} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Property Dialog */}
      <Dialog
        open={showAddPropertyDialog}
        onClose={() => setShowAddPropertyDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Property</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="Property Name"
            value={newPropertyName}
            onChange={(e) => setNewPropertyName(e.target.value)}
            sx={{ mt: 2 }}
          />

          <TextField
            select
            fullWidth
            size="small"
            label="Type"
            value={newPropertyType}
            onChange={(e) => setNewPropertyType(e.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="string">string</MenuItem>
            <MenuItem value="number">number</MenuItem>
            <MenuItem value="integer">integer</MenuItem>
            <MenuItem value="boolean">boolean</MenuItem>
            <MenuItem value="array">array</MenuItem>
            <MenuItem value="object">object</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddPropertyDialog(false)}>Cancel</Button>
          <Button onClick={handleAddProperty} variant="contained" disabled={!newPropertyName}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
