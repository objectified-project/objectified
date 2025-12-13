// SideNav.tsx
'use client';

import React, { useState } from 'react';
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
import { Search, Add, Edit, Delete } from '@mui/icons-material';
import { getPropertiesForClass } from '../../../../../lib/db/helper';

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

  // Properties callbacks
  onPropertyAdd?: () => void;
  onPropertyEdit?: (propertyItem: PropertyItem) => void;
  onPropertyDelete?: (propertyId: string) => void;
  onPropertySelect?: (propertyItem: PropertyItem) => void;
}

interface StudioSideNavProps {
  classes?: ClassItem[];
  properties?: PropertyItem[];
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
  callbacks = {},
  refreshKey = 0,
  selectedProjectId = null,
  selectedVersionId = null,
  isReadOnly = false,
}) => {
  const [currentTab, setCurrentTab] = useState<'classes' | 'properties'>('classes');
  const [classesSearchQuery, setClassesSearchQuery] = useState('');
  const [propertiesSearchQuery, setPropertiesSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [classWarnings, setClassWarnings] = useState<Record<string, boolean>>({});

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

  const handleTabChange = (event: React.SyntheticEvent, newValue: 'classes' | 'properties') => {
    setCurrentTab(newValue);
  };

  // Filter classes based on search query
  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(classesSearchQuery.toLowerCase()) ||
    (cls.description?.toLowerCase().includes(classesSearchQuery.toLowerCase()) ?? false)
  );

  // Filter properties based on search query
  const filteredProperties = properties.filter(prop =>
    prop.name.toLowerCase().includes(propertiesSearchQuery.toLowerCase()) ||
    (prop.type?.toLowerCase().includes(propertiesSearchQuery.toLowerCase()) ?? false) ||
    (prop.description?.toLowerCase().includes(propertiesSearchQuery.toLowerCase()) ?? false)
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
          top: 48, // Offset for top header
          height: 'calc(100vh - 48px)',
          borderRight: 'none',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.06)',
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
            borderBottom: '1px solid #e2e8f0',
            minHeight: 52,
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
              minHeight: 52,
              fontWeight: currentTab === 'classes' ? 700 : 500,
              fontSize: '0.875rem',
              color: currentTab === 'classes' ? '#6366f1' : '#64748b',
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
              minHeight: 52,
              fontWeight: currentTab === 'properties' ? 700 : 500,
              fontSize: '0.875rem',
              color: currentTab === 'properties' ? '#6366f1' : '#64748b',
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
          {currentTab === 'classes' ? (
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
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: '#f1f5f9',
                      },
                      '&.Mui-focused': {
                        backgroundColor: '#ffffff',
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
                      sx={{ color: '#64748b', fontWeight: 500, mb: 0.5 }}
                    >
                      {classes.length === 0
                        ? 'No classes yet'
                        : 'No classes match your search'}
                    </Typography>
                    {classes.length === 0 && (
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
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

              {/* Add Button */}
              <Box sx={{ position: 'absolute', bottom: 20, right: 20 }}>
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
                      background: '#e2e8f0',
                      boxShadow: 'none',
                    },
                  }}
                >
                  <Add />
                </Fab>
              </Box>
            </Box>
          ) : (
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
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: '#f1f5f9',
                      },
                      '&.Mui-focused': {
                        backgroundColor: '#ffffff',
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
                      sx={{ color: '#64748b', fontWeight: 500, mb: 0.5 }}
                    >
                      {properties.length === 0
                        ? 'No properties yet'
                        : 'No properties match your search'}
                    </Typography>
                    {properties.length === 0 && (
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Click the + button to add one
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ py: 0.5 }}>
                    {filteredProperties.map((propertyItem) => (
                      <Box
                        key={propertyItem.id}
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
                          gap: 1.5,
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
                              color: propertyItem.deprecated ? '#94a3b8' : '#334155',
                            }}
                            title={propertyItem.deprecated ? ((propertyItem as any).deprecationMessage || 'Deprecated') : undefined}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>{propertyItem.name}</span>
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
                              color: '#64748b',
                              mt: 0.25,
                            }}
                          >
                            {propertyItem.type || propertyItem.description}
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
                    ))}
                  </Box>
                )}
              </Box>

              {/* Add Button */}
              <Box sx={{ position: 'absolute', bottom: 20, right: 20 }}>
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
                      background: '#e2e8f0',
                      boxShadow: 'none',
                    },
                  }}
                >
                  <Add />
                </Fab>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default StudioSideNav;
