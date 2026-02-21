// SideNav.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Fab from '@mui/material/Fab';
import { Search, Add, Edit, Delete, DeleteSweep, Upload, LibraryBooks, ExpandMore, ExpandLess } from '@mui/icons-material';
import { getPropertiesForClass } from '../../../../../lib/db/helper';
import { useDarkMode } from '@/app/hooks/useDarkMode';

export interface ClassItem {
  id: string;
  name: string;
  description?: string;
  schema?: any; // JSON Schema object stored in database
}

export interface PropertyItem {
  id: string;
  name: string;
  type?: string;
  $ref?: string; // Reference to another class schema
  title?: string;
  description?: string;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number; // OpenAPI 3.1: numeric value, not boolean
  exclusiveMaximum?: number; // OpenAPI 3.1: numeric value, not boolean
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  enum?: string[];
  default?: any;
  required?: boolean;
  // Metadata fields
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  deprecationMessage?: string;
  example?: any;
  additionalProperties?: boolean | any;
  // Tuple mode (OpenAPI 3.1)
  tupleMode?: boolean;
  prefixItems?: any[]; // OpenAPI 3.1: Array of schemas for specific positions
  items?: any; // Schema for items beyond prefix positions
}

export interface StudioSideNavCallbacks {
  // Classes callbacks
  onClassAdd?: () => void;
  onClassEdit?: (classItem: ClassItem) => void;
  onClassDelete?: (classId: string) => void;
  onClassSelect?: (classItem: ClassItem) => void;
  onClassImport?: () => void;
  onClassTemplates?: () => void;

  // Properties callbacks
  onPropertyAdd?: () => void;
  onPropertyEdit?: (propertyItem: PropertyItem) => void;
  onPropertyDelete?: (propertyId: string) => void;
  onPropertySelect?: (propertyItem: PropertyItem) => void;
  onPropertyTemplates?: () => void;

  // Groups callbacks
  onGroupAdd?: () => void;
  onGroupSelect?: (groupId: string) => void;
  onGroupDelete?: (groupId: string) => void;
  onGroupDeleteAllClasses?: (groupId: string) => void;
}

export interface GroupItem {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
}

interface StudioSideNavProps {
  classes?: ClassItem[];
  properties?: PropertyItem[];
  groups?: GroupItem[];
  callbacks?: StudioSideNavCallbacks;
  refreshKey?: number; // Used to trigger refresh from parent
  selectedProjectId?: string | null; // Currently selected project from canvas
  selectedVersionId?: string | null; // Currently selected version from canvas
  isReadOnly?: boolean; // Whether the current version is published (read-only)
  // classWarnings?: Record<string, boolean>; // removed, computed locally
  [key: string]: any; // allow future, non-breaking props from parent
}

const StudioSideNav: React.FC<StudioSideNavProps> = ({
  classes = [],
  properties = [],
  groups = [],
  callbacks = {},
  refreshKey = 0,
  selectedProjectId = null,
  selectedVersionId = null,
  isReadOnly = false,
}) => {
  // Dark mode detection using shared hook
  const isDark = useDarkMode();

  const [currentTab, setCurrentTab] = useState<'classes' | 'properties' | 'groups'>('classes');
  const [classesSearchQuery, setClassesSearchQuery] = useState('');
  const [propertiesSearchQuery, setPropertiesSearchQuery] = useState('');
  const [groupsSearchQuery, setGroupsSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [classWarnings, setClassWarnings] = useState<Record<string, boolean>>({});
  const [expandedPropertyIds, setExpandedPropertyIds] = useState<Set<string>>(new Set());

  // Helper to check if a property has inline properties (type: 'object' with properties, or array of objects)
  const hasInlineProperties = (prop: PropertyItem): boolean => {
    // Check for object type with nested properties
    if (prop.type === 'object' && (prop as any).properties && Object.keys((prop as any).properties).length > 0) {
      return true;
    }
    // Check for array type with object items that have properties
    if (prop.type === 'array' && prop.items?.type === 'object' && prop.items?.properties && Object.keys(prop.items.properties).length > 0) {
      return true;
    }
    return false;
  };

  // Helper to extract inline properties from a property
  const getInlineProperties = (prop: PropertyItem): { name: string; type: string; description?: string; required?: boolean }[] => {
    const children: { name: string; type: string; description?: string; required?: boolean }[] = [];

    // Handle object type with nested properties
    if (prop.type === 'object' && (prop as any).properties) {
      const requiredFields = Array.isArray((prop as any).required) ? (prop as any).required : [];
      for (const [name, schema] of Object.entries<any>((prop as any).properties)) {
        children.push({
          name,
          type: schema.type || 'object',
          description: schema.description,
          required: requiredFields.includes(name),
        });
      }
    }

    // Handle array type with object items
    if (prop.type === 'array' && prop.items?.type === 'object' && prop.items?.properties) {
      const requiredFields = Array.isArray(prop.items.required) ? prop.items.required : [];
      for (const [name, schema] of Object.entries<any>(prop.items.properties)) {
        children.push({
          name,
          type: schema.type || 'object',
          description: schema.description,
          required: requiredFields.includes(name),
        });
      }
    }

    return children;
  };

  // Toggle expanded state for a property
  const togglePropertyExpanded = (propertyId: string) => {
    setExpandedPropertyIds((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else {
        next.add(propertyId);
      }
      return next;
    });
  };

  // Compute dangling $ref warnings when classes change
  React.useEffect(() => {
    const computeWarnings = async () => {
      if (!selectedVersionId || classes.length === 0) {
        setClassWarnings({});
        return;
      }
      const nameSet = new Set(classes.map((c) => c.name));
      const warnings: Record<string, boolean> = {};
      for (const cls of classes) {
        try {
          const res = await getPropertiesForClass(cls.id);
          const props = JSON.parse(res);
          let hasDangling = false;
          for (const p of props) {
            const d = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
            if (!d) continue;
            const ref = d.$ref || (d.type === 'array' && d.items?.$ref);
            if (ref) {
              const parts = String(ref).split('/');
              const refName = parts[parts.length - 1] || String(ref);
              if (!nameSet.has(refName)) { hasDangling = true; break; }
            }
          }
          warnings[cls.id] = hasDangling;
        } catch (e) {
          warnings[cls.id] = false;
        }
      }
      setClassWarnings(warnings);
    };
    computeWarnings();
  }, [classes, selectedVersionId, refreshKey]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: 'classes' | 'properties' | 'groups') => {
    setCurrentTab(newValue);
  };

  // Filter classes based on search query
  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(classesSearchQuery.toLowerCase()) ||
    (cls.description?.toLowerCase().includes(classesSearchQuery.toLowerCase()) ?? false)
  );

  // Filter properties based on search query
  const filteredProperties = properties.filter(prop => {
    const searchLower = propertiesSearchQuery.toLowerCase();
    const nameMatch = prop.name.toLowerCase().includes(searchLower);

    // Handle type which could be string, array, or undefined
    let typeMatch = false;
    if (prop.type) {
      const typeStr = typeof prop.type === 'string' ? prop.type : JSON.stringify(prop.type);
      typeMatch = typeStr.toLowerCase().includes(searchLower);
    }

    const descMatch = prop.description?.toLowerCase().includes(searchLower) ?? false;

    return nameMatch || typeMatch || descMatch;
  });

  // Filter groups based on search query
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(groupsSearchQuery.toLowerCase())
  );

  const handleClassSelect = (classItem: ClassItem) => {
    setSelectedClassId(classItem.id);
    callbacks.onClassSelect?.(classItem);
  };

  const handlePropertySelect = (propertyItem: PropertyItem) => {
    setSelectedPropertyId(propertyItem.id);
    callbacks.onPropertySelect?.(propertyItem);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 280,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 280,
          boxSizing: 'border-box',
          top: 102, // TopHeader (48px) + Studio Header (~48px with py-2)
          height: 'calc(100vh - 102px)',
          borderRight: 'none',
          background: isDark
            ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: isDark
            ? '4px 0 24px rgba(0, 0, 0, 0.3)'
            : '4px 0 24px rgba(0, 0, 0, 0.06)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Version/Project Status Indicator */}
        {((currentTab === 'classes' && !selectedVersionId) || (currentTab === 'properties' && !selectedProjectId)) && (
          <Box
            sx={{
              p: 2,
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              color: '#92400e',
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <span style={{ fontSize: '1rem' }}>⚠️</span>
            {currentTab === 'classes'
              ? 'Select a version from the canvas to manage classes'
              : 'Select a project from the canvas to manage properties'}
          </Box>
        )}

        {/* Tabs Navigation */}
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            minHeight: 44,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
            },
          }}
        >
          <Tab
            label="Classes"
            value="classes"
            sx={{
              minHeight: 44,
              fontWeight: currentTab === 'classes' ? 700 : 500,
              fontSize: '0.75rem',
              color: currentTab === 'classes'
                ? '#6366f1'
                : (isDark ? '#94a3b8' : '#64748b'),
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
              },
            }}
          />
          <Tab
            label="Properties"
            value="properties"
            sx={{
              minHeight: 44,
              fontWeight: currentTab === 'properties' ? 700 : 500,
              fontSize: '0.75rem',
              color: currentTab === 'properties'
                ? '#6366f1'
                : (isDark ? '#94a3b8' : '#64748b'),
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
              },
            }}
          />
          <Tab
            label="Groups"
            value="groups"
            sx={{
              minHeight: 44,
              fontWeight: currentTab === 'groups' ? 700 : 500,
              fontSize: '0.75rem',
              color: currentTab === 'groups'
                ? '#6366f1'
                : (isDark ? '#94a3b8' : '#64748b'),
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
              },
            }}
          />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {currentTab === 'classes' && (
            // Classes View
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Search Bar */}
              <Box sx={{ p: 2, pb: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search classes..."
                  value={classesSearchQuery}
                  onChange={(e) => setClassesSearchQuery(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: isDark ? '#334155' : '#f8fafc',
                      transition: 'all 0.2s ease',
                      '& input': {
                        color: isDark ? '#e2e8f0' : 'inherit',
                      },
                      '& input::placeholder': {
                        color: isDark ? '#94a3b8' : 'inherit',
                        opacity: 1,
                      },
                      '& fieldset': {
                        borderColor: isDark ? '#475569' : 'rgba(0, 0, 0, 0.23)',
                      },
                      '&:hover': {
                        backgroundColor: isDark ? '#475569' : '#f1f5f9',
                      },
                      '&.Mui-focused': {
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                      },
                    },
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              {/* Classes List */}
              <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
                {filteredClasses.length === 0 ? (
                  <Box sx={{
                    textAlign: 'center',
                    mt: 6,
                    px: 3,
                  }}>
                    <Box sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'rgba(99, 102, 241, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}>
                      <Add sx={{ color: '#6366f1', fontSize: 24 }} />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500, mb: 0.5 }}
                    >
                      {classes.length === 0
                        ? 'No classes yet'
                        : 'No classes match your search'}
                    </Typography>
                    {classes.length === 0 && (
                      <Typography variant="caption" sx={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                        Click the + button to add one
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <List dense sx={{ py: 0.5 }}>
                    {filteredClasses.map((classItem) => (
                      <ListItem
                        key={classItem.id}
                        disablePadding
                        sx={{ mb: 0.5 }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 0.25 }}>
                            <IconButton
                              edge="end"
                              size="small"
                              disabled={!selectedVersionId || isReadOnly}
                              onClick={(e) => {
                                e.stopPropagation();
                                callbacks.onClassEdit?.(classItem);
                              }}
                              title={!selectedVersionId ? 'Select a version first' : isReadOnly ? 'Cannot edit published version' : 'Edit class'}
                              sx={{
                                opacity: 0.6,
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  opacity: 1,
                                  color: '#6366f1',
                                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                },
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              edge="end"
                              size="small"
                              disabled={!selectedVersionId || isReadOnly}
                              onClick={(e) => {
                                e.stopPropagation();
                                callbacks.onClassDelete?.(classItem.id);
                              }}
                              title={!selectedVersionId ? 'Select a version first' : isReadOnly ? 'Cannot edit published version' : 'Delete class'}
                              sx={{
                                opacity: 0.6,
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  opacity: 1,
                                  color: '#ef4444',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                },
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemButton
                          selected={selectedClassId === classItem.id}
                          onClick={() => handleClassSelect(classItem)}
                          sx={{
                            borderRadius: 2,
                            transition: 'all 0.2s ease',
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              borderLeft: '3px solid #6366f1',
                              '&:hover': {
                                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              },
                            },
                            '&:hover': {
                              backgroundColor: 'rgba(99, 102, 241, 0.05)',
                            },
                          }}
                        >
                          <ListItemText
                            primary={
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  textDecoration: classItem.schema?.deprecated ? 'line-through' : 'none',
                                  color: classItem.schema?.deprecated ? '#9ca3af' : 'inherit'
                                }}>{classItem.name}</span>
                                {classWarnings[classItem.id] && (
                                  <span title="This class has properties referencing missing classes" style={{ color: '#b91c1c', fontSize: 12 }}>⚠️</span>
                                )}
                              </span>
                            }
                            secondary={classItem.description}
                            slotProps={{
                              primary: { noWrap: true },
                              secondary: { noWrap: true },
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>

              {/* Add and Import Buttons */}
              <Box sx={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', gap: 1 }}>
                <Fab
                  color="secondary"
                  size="small"
                  onClick={() => callbacks.onClassImport?.()}
                  disabled={!selectedVersionId || isReadOnly}
                  aria-label="Import classes"
                  title={!selectedVersionId ? 'Select a version first' : isReadOnly ? 'Cannot import to published version' : 'Import classes from file'}
                  sx={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-2px) scale(1.05)',
                      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.5)',
                    },
                    '&:disabled': {
                      background: isDark ? '#475569' : '#e2e8f0',
                      boxShadow: 'none',
                    },
                  }}
                >
                  <Upload />
                </Fab>
                <Fab
                  color="secondary"
                  size="small"
                  onClick={() => callbacks.onClassTemplates?.()}
                  disabled={!selectedVersionId || isReadOnly}
                  aria-label="Class templates"
                  title={!selectedVersionId ? 'Select a version first' : isReadOnly ? 'Cannot edit published version' : 'Browse class templates'}
                  sx={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-2px) scale(1.05)',
                      boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
                    },
                    '&:disabled': {
                      background: isDark ? '#475569' : '#e2e8f0',
                      color: isDark ? '#94a3b8' : '#64748b',
                      boxShadow: 'none',
                    },
                  }}
                >
                  <LibraryBooks />
                </Fab>
                <Fab
                  color="primary"
                  size="small"
                  onClick={() => callbacks.onClassAdd?.()}
                  disabled={!selectedVersionId || isReadOnly}
                  aria-label="Add class"
                  title={!selectedVersionId ? 'Select a version first' : isReadOnly ? 'Cannot edit published version' : 'Add class'}
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-2px) scale(1.05)',
                      boxShadow: '0 6px 20px rgba(99, 102, 241, 0.5)',
                    },
                    '&:disabled': {
                      background: isDark ? '#475569' : '#e2e8f0',
                      boxShadow: 'none',
                    },
                  }}
                >
                  <Add />
                </Fab>
              </Box>
            </Box>
          )}
          {currentTab === 'properties' && (
            // Properties View
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Search Bar */}
              <Box sx={{ p: 2, pb: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search properties..."
                  value={propertiesSearchQuery}
                  onChange={(e) => setPropertiesSearchQuery(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: isDark ? '#334155' : '#f8fafc',
                      transition: 'all 0.2s ease',
                      '& input': {
                        color: isDark ? '#e2e8f0' : 'inherit',
                      },
                      '& input::placeholder': {
                        color: isDark ? '#94a3b8' : 'inherit',
                        opacity: 1,
                      },
                      '& fieldset': {
                        borderColor: isDark ? '#475569' : 'rgba(0, 0, 0, 0.23)',
                      },
                      '&:hover': {
                        backgroundColor: isDark ? '#475569' : '#f1f5f9',
                      },
                      '&.Mui-focused': {
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                      },
                    },
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              {/* New Reference draggable */}
              {!isReadOnly && (
                <Box sx={{ px: 2, pb: 1.5 }}>
                  <Box
                    role="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'new-reference' }));
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      border: '2px dashed',
                      borderColor: 'rgba(34, 197, 94, 0.4)',
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.04) 100%)',
                      cursor: 'grab',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        borderColor: '#22c55e',
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.08) 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                      },
                      '&:active': {
                        cursor: 'grabbing',
                        transform: 'scale(0.98)',
                      },
                    }}
                    title="Drag to create a new reference on a class or inside an object"
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#16a34a' }}>+ New Reference</Typography>
                    <Typography variant="caption" sx={{ color: '#22c55e', fontSize: '0.7rem' }}>drag to class</Typography>
                  </Box>
                </Box>
              )}

              {/* Properties List */}
              <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
                {filteredProperties.length === 0 ? (
                  <Box sx={{
                    textAlign: 'center',
                    mt: 6,
                    px: 3,
                  }}>
                    <Box sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'rgba(99, 102, 241, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}>
                      <Add sx={{ color: '#6366f1', fontSize: 24 }} />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500, mb: 0.5 }}
                    >
                      {properties.length === 0
                        ? 'No properties yet'
                        : 'No properties match your search'}
                    </Typography>
                    {properties.length === 0 && (
                      <Typography variant="caption" sx={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                        Click the + button to add one
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ py: 0.5 }}>
                    {filteredProperties.map((propertyItem) => {
                      const hasChildren = hasInlineProperties(propertyItem);
                      const isExpanded = expandedPropertyIds.has(propertyItem.id);
                      const inlineProps = hasChildren ? getInlineProperties(propertyItem) : [];

                      return (
                        <React.Fragment key={propertyItem.id}>
                          <Box
                            draggable={!isReadOnly}
                            onDragStart={(e) => {
                              // Prevent drag in read-only mode
                              if (isReadOnly) {
                                e.preventDefault();
                                return;
                              }
                              // Set the property data as the drag payload
                              e.dataTransfer.effectAllowed = 'copy';
                              e.dataTransfer.setData('application/json', JSON.stringify({
                                type: 'property',
                                property: propertyItem
                              }));
                            }}
                            onClick={() => handlePropertySelect(propertyItem)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              px: 2,
                              py: 1.5,
                              mb: 0.5,
                              mx: 0.5,
                              cursor: isReadOnly ? 'default' : 'grab',
                              backgroundColor: selectedPropertyId === propertyItem.id
                                ? 'rgba(99, 102, 241, 0.1)'
                                : 'transparent',
                              borderRadius: 2,
                              borderLeft: selectedPropertyId === propertyItem.id ? '3px solid #6366f1' : '3px solid transparent',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                backgroundColor: selectedPropertyId === propertyItem.id
                                  ? 'rgba(99, 102, 241, 0.15)'
                                  : 'rgba(99, 102, 241, 0.05)',
                                transform: isReadOnly ? 'none' : 'translateX(2px)',
                              },
                              '&:active': {
                                cursor: 'grabbing',
                                transform: 'scale(0.98)',
                              },
                            }}
                          >
                            {/* Expand/Collapse button for object types with inline properties */}
                            {hasChildren ? (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePropertyExpanded(propertyItem.id);
                                }}
                                sx={{
                                  p: 0.25,
                                  color: isDark ? '#94a3b8' : '#64748b',
                                  '&:hover': {
                                    color: '#6366f1',
                                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                  },
                                }}
                                title={isExpanded ? 'Collapse nested properties' : 'Expand nested properties'}
                              >
                                {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                              </IconButton>
                            ) : (
                              <Box sx={{ width: 24 }} /> // Spacer for alignment
                            )}

                            {/* Property content */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  textDecoration: propertyItem.deprecated ? 'line-through' : 'none',
                                  color: propertyItem.deprecated
                                    ? '#94a3b8'
                                    : (isDark ? '#e2e8f0' : '#334155'),
                                }}
                                title={propertyItem.deprecated ? ((propertyItem as any).deprecationMessage || 'Deprecated') : undefined}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}>{propertyItem.name}</span>
                                  {hasChildren && (
                                    <span
                                      style={{
                                        background: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                                        color: '#6366f1',
                                        fontSize: 9,
                                        fontWeight: 600,
                                        padding: '2px 6px',
                                        borderRadius: '6px',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {inlineProps.length}
                                    </span>
                                  )}
                                  {propertyItem.enum && Array.isArray(propertyItem.enum) && propertyItem.enum.length > 0 && (
                                    <span
                                      title={`Enumeration: ${propertyItem.enum.join(', ')}`}
                                      style={{
                                        background: 'linear-gradient(135deg, #dbeafe 0%, #c7d2fe 100%)',
                                        color: '#4338ca',
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '6px',
                                        flexShrink: 0,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}
                                    >
                                      ENUM
                                    </span>
                                  )}
                                </span>
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'block',
                                  color: isDark ? '#94a3b8' : '#64748b',
                                  mt: 0.25,
                                }}
                              >
                                {propertyItem.type && (Array.isArray(propertyItem.type) ? (
                                  <>
                                    {propertyItem.type[0]}{propertyItem.type[1] === 'null' && ' [nullable]'}
                                  </>
                                ) : (
                                  <>
                                    {propertyItem.type}
                                  </>
                                )) || propertyItem.description}
                              </Typography>
                            </Box>

                            {/* Action buttons */}
                            <Box sx={{ display: 'flex', gap: 0.25 }}>
                              <IconButton
                                size="small"
                                disabled={!selectedProjectId || isReadOnly}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  callbacks.onPropertyEdit?.(propertyItem);
                                }}
                                title={!selectedProjectId ? 'Select a project first' : isReadOnly ? 'Cannot edit published version' : 'Edit property'}
                                sx={{
                                  opacity: 0.6,
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    opacity: 1,
                                    color: '#6366f1',
                                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                  },
                                }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                disabled={!selectedProjectId || isReadOnly}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  callbacks.onPropertyDelete?.(propertyItem.id);
                                }}
                                title={!selectedProjectId ? 'Select a project first' : isReadOnly ? 'Cannot edit published version' : 'Delete property'}
                                sx={{
                                  opacity: 0.6,
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    opacity: 1,
                                    color: '#ef4444',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  },
                                }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Nested Properties (shown when expanded) */}
                          {hasChildren && isExpanded && (
                            <Box
                              sx={{
                                ml: 4,
                                mr: 1,
                                mb: 1,
                                pl: 2,
                                borderLeft: '2px solid',
                                borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)',
                                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.03)',
                                borderRadius: '0 8px 8px 0',
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  color: isDark ? '#818cf8' : '#6366f1',
                                  fontWeight: 600,
                                  fontSize: 10,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  py: 0.75,
                                  px: 1,
                                }}
                              >
                                Nested Properties
                              </Typography>
                              {inlineProps.map((child, idx) => (
                                <Box
                                  key={`${propertyItem.id}-${child.name}-${idx}`}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    py: 0.75,
                                    px: 1,
                                    borderRadius: 1,
                                    '&:hover': {
                                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                    },
                                  }}
                                >
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        color: isDark ? '#e2e8f0' : '#334155',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                      }}
                                    >
                                      {child.required && (
                                        <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>
                                      )}
                                      {child.name}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        fontSize: 10,
                                        color: isDark ? '#94a3b8' : '#64748b',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {child.type}{child.description ? ` — ${child.description}` : ''}
                                    </Typography>
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </Box>
                )}
              </Box>

              {/* Action Buttons */}
              <Box sx={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', gap: 1 }}>
                <Fab
                  size="small"
                  onClick={() => callbacks.onPropertyTemplates?.()}
                  disabled={!selectedProjectId || isReadOnly}
                  aria-label="Browse property templates"
                  title={!selectedProjectId ? 'Select a project first' : isReadOnly ? 'Cannot edit published version' : 'Browse property templates'}
                  sx={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: isDark ? '#0f172a' : '#ffffff',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-2px) scale(1.05)',
                      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.5)',
                    },
                    '&:disabled': {
                      background: isDark ? '#475569' : '#e2e8f0',
                      color: isDark ? '#94a3b8' : '#64748b',
                      boxShadow: 'none',
                    },
                  }}
                >
                  <LibraryBooks />
                </Fab>
                <Fab
                  color="primary"
                  size="small"
                  onClick={() => callbacks.onPropertyAdd?.()}
                  disabled={!selectedProjectId || isReadOnly}
                  aria-label="Add property"
                  title={!selectedProjectId ? 'Select a project first' : isReadOnly ? 'Cannot edit published version' : 'Add property'}
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-2px) scale(1.05)',
                      boxShadow: '0 6px 20px rgba(99, 102, 241, 0.5)',
                    },
                    '&:disabled': {
                      background: isDark ? '#475569' : '#e2e8f0',
                      boxShadow: 'none',
                    },
                  }}
                >
                  <Add />
                </Fab>
              </Box>
            </Box>
          )}
          {currentTab === 'groups' && (
            // Groups View
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Search Bar */}
              <Box sx={{ p: 2, pb: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search groups..."
                  value={groupsSearchQuery}
                  onChange={(e) => setGroupsSearchQuery(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: isDark ? '#334155' : '#f8fafc',
                      transition: 'all 0.2s ease',
                      '& input': {
                        color: isDark ? '#e2e8f0' : 'inherit',
                      },
                      '& input::placeholder': {
                        color: isDark ? '#94a3b8' : 'inherit',
                        opacity: 1,
                      },
                      '& fieldset': {
                        borderColor: isDark ? '#475569' : 'rgba(0, 0, 0, 0.23)',
                      },
                      '&:hover': {
                        backgroundColor: isDark ? '#475569' : '#f1f5f9',
                      },
                      '&.Mui-focused': {
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                      },
                    },
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              {/* New Group draggable */}
              {!isReadOnly && selectedVersionId && (
                <Box sx={{ px: 2, pb: 1.5 }}>
                  <Box
                    role="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'new-group' }));
                      e.dataTransfer.setData('application/x-objectified-drag-type', 'new-group');
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      border: '2px dashed',
                      borderColor: 'rgba(139, 92, 246, 0.4)',
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
                      cursor: 'grab',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        borderColor: '#8b5cf6',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)',
                      },
                      '&:active': {
                        cursor: 'grabbing',
                        transform: 'scale(0.98)',
                      },
                    }}
                    title="Drag to create a new group on the canvas"
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#8b5cf6' }}>+ New Group</Typography>
                    <Typography variant="caption" sx={{ color: '#a78bfa', fontSize: '0.7rem' }}>drag to canvas</Typography>
                  </Box>
                </Box>
              )}

              {/* Groups List */}
              <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
                {filteredGroups.length === 0 ? (
                  <Box sx={{
                    textAlign: 'center',
                    mt: 4,
                    px: 3,
                  }}>
                    <Typography
                      variant="body2"
                      sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500, mb: 0.5 }}
                    >
                      {groups.length === 0
                        ? 'No groups yet'
                        : 'No groups match your search'}
                    </Typography>
                    {groups.length === 0 && (
                      <Typography variant="caption" sx={{ color: isDark ? '#64748b' : '#94a3b8', display: 'block' }}>
                        Drag &quot;+ New Group&quot; above onto the canvas to create one
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <List dense sx={{ py: 0.5 }}>
                    {filteredGroups.map((group) => (
                      <ListItem
                        key={group.id}
                        disablePadding
                        sx={{ mb: 0.5 }}
                        secondaryAction={
                          !isReadOnly && (
                            <Box sx={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                              {(group.nodeIds?.length ?? 0) > 0 && (
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    callbacks.onGroupDeleteAllClasses?.(group.id);
                                  }}
                                  sx={{
                                    color: isDark ? '#94a3b8' : '#64748b',
                                    '&:hover': { color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)' },
                                  }}
                                  title="Delete all classes in group"
                                >
                                  <DeleteSweep fontSize="small" />
                                </IconButton>
                              )}
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  callbacks.onGroupDelete?.(group.id);
                                }}
                                sx={{
                                  color: isDark ? '#94a3b8' : '#64748b',
                                  '&:hover': { color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
                                }}
                                title="Delete group"
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                          )
                        }
                      >
                        <ListItemButton
                          onClick={() => callbacks.onGroupSelect?.(group.id)}
                          sx={{
                            borderRadius: 2,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(139, 92, 246, 0.05)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '3px',
                              backgroundColor: group.color || '#8b5cf6',
                              mr: 1.5,
                              flexShrink: 0,
                            }}
                          />
                          <ListItemText
                            primary={group.name}
                            secondary={`${group.nodeIds?.length || 0} classes`}
                            slotProps={{
                              primary: {
                                noWrap: true,
                                sx: { fontWeight: 500, fontSize: '0.875rem' }
                              },
                              secondary: {
                                noWrap: true,
                                sx: { fontSize: '0.75rem' }
                              },
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default StudioSideNav;
