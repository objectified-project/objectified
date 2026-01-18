'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Fab from '@mui/material/Fab';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { Add, Edit, Delete } from '@mui/icons-material';
import * as Dialog from '@radix-ui/react-dialog';
import { useStudio } from '../../StudioContext';
import { useDialog } from '../../../../components/providers/DialogProvider';
import {
  getClassesWithPropertiesAndTags,
  getPropertiesForProject,
} from '../../../../../../lib/db/helper';
import {
  getPathsForVersion,
  createPath,
  updatePath,
  deletePath,
} from '../../../../../../lib/db/helper-paths';
import { createOperation } from '../../../../../../lib/db/helper-path-operations';
import { useDarkMode } from '../../../../hooks/useDarkMode';

interface ClassItem {
  id: string;
  name: string;
}

interface PropertyItem {
  id: string;
  name: string;
  description?: string;
  data?: Record<string, any>; // Contains type, constraints, format, enum values, etc.
}

interface PathItem {
  id: string;
  version_id: string;
  pathname: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

// Available HTTP operations for OpenAPI
const AVAILABLE_OPERATIONS = [
  { id: 'GET', label: 'GET', color: '#10b981' },      // green
  { id: 'POST', label: 'POST', color: '#3b82f6' },    // blue
  { id: 'PUT', label: 'PUT', color: '#f59e0b' },      // amber
  { id: 'PATCH', label: 'PATCH', color: '#8b5cf6' },  // purple
  { id: 'DELETE', label: 'DELETE', color: '#ef4444' }, // red
  { id: 'HEAD', label: 'HEAD', color: '#6b7280' },    // gray
  { id: 'OPTIONS', label: 'OPTIONS', color: '#64748b' }, // slate
];

export default function PathsSidebar({
  activeTab,
  onTabChange,
  selectedPathId,
  onPathSelect,
}: {
  activeTab: 'paths' | 'classes' | 'properties';
  onTabChange: (tab: 'paths' | 'classes' | 'properties') => void;
  selectedPathId: string | null;
  onPathSelect: (pathId: string | null, pathname?: string) => void;
}) {
  const { selectedVersionId, selectedProjectId } = useStudio();
  const { confirm: confirmDialog } = useDialog();
  const isDark = useDarkMode();
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');

  // Dialog state for adding/editing paths
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<PathItem | null>(null);
  const [pathNameInput, setPathNameInput] = useState('');
  const [autoCreateCrud, setAutoCreateCrud] = useState(false);

  // Load paths
  useEffect(() => {
    if (!selectedVersionId) {
      setPaths([]);
      return;
    }

    const loadPaths = async () => {
      setIsLoading(true);
      try {
        const pathsResponse = await getPathsForVersion(selectedVersionId);
        const pathsData: PathItem[] = JSON.parse(pathsResponse);
        setPaths(pathsData);
      } catch (error) {
        console.error('Error loading paths:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPaths();
  }, [selectedVersionId]);

  // Load classes and properties
  useEffect(() => {
    if (!selectedVersionId) {
      setClasses([]);
      return;
    }

    const loadClasses = async () => {
      setIsLoading(true);
      try {
        const classesResponse = await getClassesWithPropertiesAndTags(selectedVersionId);
        const classesData: any[] = JSON.parse(classesResponse as string);

        // Extract unique classes
        const uniqueClasses = classesData.reduce((acc: ClassItem[], cls: any) => {
          if (!acc.find((c) => c.id === cls.id)) {
            acc.push({ id: cls.id, name: cls.name });
          }
          return acc;
        }, []);

        setClasses(uniqueClasses);
      } catch (error) {
        console.error('Error loading classes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadClasses();
  }, [selectedVersionId]);

  // Load properties separately using the same approach as Canvas editor
  useEffect(() => {
    if (!selectedProjectId) {
      setProperties([]);
      return;
    }

    const loadProperties = async () => {
      setIsLoading(true);
      try {
        // Use getPropertiesForProject - same as Canvas editor
        const result = await getPropertiesForProject(selectedProjectId);
        const data = JSON.parse(result);

        // Transform to PropertyItem format
        const transformedProperties: PropertyItem[] = data.map((prop: any) => {
          // Parse data if it's a string
          let propData = prop.data;
          if (typeof propData === 'string') {
            try {
              propData = JSON.parse(propData);
            } catch {
              propData = { type: 'string' };
            }
          }

          return {
            id: prop.id,
            name: prop.name,
            description: prop.description || undefined,
            data: propData || { type: 'string' },
          };
        });

        // Sort properties A-Z by name
        const sortedProperties = transformedProperties.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        setProperties(sortedProperties);
      } catch (error) {
        console.error('Error loading properties:', error);
        setProperties([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadProperties();
  }, [selectedProjectId]);

  // Handle opening add path dialog
  const handleAddPath = () => {
    setEditingPath(null);
    setPathNameInput('');
    setAutoCreateCrud(false);
    setPathDialogOpen(true);
  };

  // Handle opening edit path dialog
  const handleEditPath = (path: PathItem) => {
    setEditingPath(path);
    setPathNameInput(path.pathname);
    setPathDialogOpen(true);
  };

  // Handle saving path (create or update)
  const handleSavePath = async () => {
    if (!selectedVersionId || !pathNameInput.trim()) return;

    try {
      if (editingPath) {
        // Update existing path
        const result = await updatePath(editingPath.id, pathNameInput.trim());
        const updatedPath: PathItem = JSON.parse(result);
        setPaths(prevPaths =>
          prevPaths.map(p => p.id === updatedPath.id ? updatedPath : p)
        );
      } else {
        // Create new path
        const result = await createPath(selectedVersionId, pathNameInput.trim());
        const newPath: PathItem = JSON.parse(result);
        setPaths(prevPaths => [...prevPaths, newPath].sort((a, b) => a.pathname.localeCompare(b.pathname)));

        // Auto-create CRUD operations if checkbox is selected
        if (autoCreateCrud) {
          const crudOperations = ['GET', 'POST', 'PUT', 'DELETE'];
          for (const operation of crudOperations) {
            try {
              await createOperation(newPath.id, operation);
            } catch (opError) {
              console.error(`Error creating ${operation} operation:`, opError);
            }
          }
        }
      }
      setPathDialogOpen(false);
      setPathNameInput('');
      setEditingPath(null);
      setAutoCreateCrud(false);
    } catch (error) {
      console.error('Error saving path:', error);
      alert('Error saving path. Please try again.');
    }
  };

  // Handle deleting a path
  const handleDeletePath = async (path: PathItem) => {
    const confirmed = await confirmDialog({
      title: 'Delete Path',
      message: `Deleting a path will also delete all of the associated actions and all of the associated schemas for responses and requests. Are you sure you want to delete "${path.pathname}"?`,
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deletePath(path.id);
      setPaths(prevPaths => prevPaths.filter(p => p.id !== path.id));
    } catch (error) {
      console.error('Error deleting path:', error);
      alert('Error deleting path. Please try again.');
    }
  };

  // Handle dragging an operation to the canvas
  const handleOperationDragStart = (event: React.DragEvent, operation: typeof AVAILABLE_OPERATIONS[0]) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify({
      type: 'operation',
      operation: operation.id,
      color: operation.color,
      label: operation.label,
    }));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: 'paths' | 'classes' | 'properties') => {
    onTabChange(newValue);
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
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
          background: isDark
            ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          position: 'relative',
        }}
      >
        {/* Tabs Navigation */}
        <Tabs
          value={activeTab}
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
            '& .MuiTabs-flexContainer': {
              height: 44,
            },
          }}
        >
          <Tab
            label="Paths"
            value="paths"
            sx={{
              minHeight: 44,
              padding: 0,
              textTransform: 'none',
              fontWeight: activeTab === 'paths' ? 700 : 500,
              fontSize: '0.75rem',
              color: activeTab === 'paths'
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
            label="Classes"
            value="classes"
            sx={{
              minHeight: 44,
              padding: 0,
              textTransform: 'none',
              fontWeight: activeTab === 'classes' ? 700 : 500,
              fontSize: '0.75rem',
              color: activeTab === 'classes'
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
              padding: 0,
              textTransform: 'none',
              fontWeight: activeTab === 'properties' ? 700 : 500,
              fontSize: '0.75rem',
              color: activeTab === 'properties'
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

        {/* Content Area */}
        <Box sx={{
          flex: 1,
          overflow: activeTab === 'properties' ? 'hidden' : 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
            </Box>
          ) : (
            <>
              {/* Paths Tab Content */}
              {activeTab === 'paths' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Available Operations Section */}
                  <Box>
                    <Box sx={{ mb: 1, px: 0.5 }}>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Available Operations
                      </span>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {AVAILABLE_OPERATIONS.map((operation) => (
                        <Box
                          key={operation.id}
                          draggable
                          onDragStart={(e) => handleOperationDragStart(e, operation)}
                          sx={{
                            px: 1.5,
                            py: 1,
                            borderRadius: 1,
                            border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                            backgroundColor: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 1)',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              backgroundColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 1)',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            },
                            '&:active': {
                              cursor: 'grabbing',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: operation.color,
                                flexShrink: 0,
                              }}
                            />
                            <span className="text-sm font-medium" style={{ color: operation.color }}>
                              {operation.label}
                            </span>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Paths List Section */}
                  <Box>
                    <Box sx={{ mb: 1, px: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Paths
                      </span>
                    </Box>
                    {paths.length === 0 ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                        No paths yet. Use the + button below to create one.
                      </span>
                    ) : (
                    paths.map((path) => (
                      <Box
                        key={path.id}
                        onClick={() => onPathSelect(path.id, path.pathname)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.5,
                          py: 1,
                          borderRadius: 1,
                          border: selectedPathId === path.id
                            ? (isDark ? '2px solid #6366f1' : '2px solid #6366f1')
                            : (isDark ? '1px solid #374151' : '1px solid #e5e7eb'),
                          backgroundColor: selectedPathId === path.id
                            ? (isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)')
                            : (isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 1)'),
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            backgroundColor: selectedPathId === path.id
                              ? (isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.15)')
                              : (isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 1)'),
                          },
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <span className={`text-sm truncate block ${
                            selectedPathId === path.id 
                              ? 'text-indigo-600 dark:text-indigo-400 font-semibold' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {path.pathname}
                          </span>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPath(path);
                            }}
                            sx={{
                              padding: '4px',
                              color: isDark ? '#94a3b8' : '#64748b',
                              '&:hover': {
                                color: '#6366f1',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              },
                            }}
                          >
                            <Edit sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePath(path);
                            }}
                            sx={{
                              padding: '4px',
                              color: isDark ? '#94a3b8' : '#64748b',
                              '&:hover': {
                                color: '#ef4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              },
                            }}
                          >
                            <Delete sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ))
                  )}
                  </Box>
                </Box>
              )}

              {/* Classes Tab Content */}
              {activeTab === 'classes' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {classes.length === 0 ? (
                    <Box
                      sx={{
                        py: 3,
                        px: 2,
                        textAlign: 'center',
                        border: isDark ? '1px dashed #334155' : '1px dashed #e2e8f0',
                        borderRadius: 1,
                      }}
                    >
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        No classes found. Create classes in the main Studio editor.
                      </span>
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ px: 0.5, mb: 0.5 }}>
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Drag to Canvas
                        </span>
                      </Box>
                      {classes.map((cls) => {
                        const handleClassDragStart = (e: React.DragEvent) => {
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'class',
                            classId: cls.id,
                            className: cls.name,
                          }));
                        };

                        return (
                          <Box
                            key={cls.id}
                            draggable
                            onDragStart={handleClassDragStart}
                            sx={{
                              px: 2,
                              py: 1.5,
                              borderRadius: 1.5,
                              border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                              background: isDark
                                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%)'
                                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)',
                              fontSize: '0.875rem',
                              color: isDark ? '#e2e8f0' : '#1e293b',
                              cursor: 'grab',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              boxShadow: isDark
                                ? '0 1px 3px rgba(0, 0, 0, 0.3)'
                                : '0 1px 3px rgba(0, 0, 0, 0.1)',
                              '&:hover': {
                                backgroundColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(241, 245, 249, 1)',
                                transform: 'translateY(-1px)',
                                boxShadow: isDark
                                  ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                                  : '0 4px 12px rgba(0, 0, 0, 0.15)',
                                borderColor: isDark ? '#6366f1' : '#818cf8',
                              },
                              '&:active': {
                                cursor: 'grabbing',
                                transform: 'translateY(0)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                  flexShrink: 0,
                                  boxShadow: '0 0 8px rgba(99, 102, 241, 0.4)',
                                }}
                              />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <div className="font-semibold text-sm truncate">{cls.name}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                  Class Schema
                                </div>
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </>
                  )}
                </Box>
              )}

              {/* Properties Tab Content */}
              {activeTab === 'properties' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
                  {/* Search Input - Fixed at top */}
                  <Box sx={{ flexShrink: 0, mb: 1.5 }}>
                    <input
                      type="text"
                      placeholder="Search properties..."
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isDark
                          ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </Box>

                  {/* Scrollable properties list */}
                  <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {properties.length === 0 ? (
                      <Box
                        sx={{
                          py: 3,
                          px: 2,
                          textAlign: 'center',
                          border: isDark ? '1px dashed #334155' : '1px dashed #e2e8f0',
                          borderRadius: 1,
                        }}
                      >
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          No properties found. Create properties in the main Studio editor.
                        </span>
                      </Box>
                    ) : (
                      <>
                        <Box sx={{ px: 0.5, mb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Drag to Canvas
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {properties.filter(p =>
                              p.name.toLowerCase().includes(propertySearch.toLowerCase()) ||
                              (p.data?.type && p.data.type.toLowerCase().includes(propertySearch.toLowerCase()))
                            ).length} / {properties.length}
                          </span>
                        </Box>
                        {properties
                          .filter(prop =>
                            prop.name.toLowerCase().includes(propertySearch.toLowerCase()) ||
                            (prop.data?.type && prop.data.type.toLowerCase().includes(propertySearch.toLowerCase()))
                          )
                          .map((prop) => {
                        const handlePropertyDragStart = (e: React.DragEvent) => {
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'property',
                            propertyId: prop.id,
                            propertyName: prop.name,
                            description: prop.description,
                            data: prop.data || { type: 'string' },
                          }));
                        };

                        // Get a display-friendly type name from the property data
                        const getTypeDisplay = () => {
                          if (!prop.data) return 'string';
                          const { type, format, enum: enumValues, items } = prop.data;

                          if (enumValues && Array.isArray(enumValues) && enumValues.length > 0) {
                            return `enum (${enumValues.length})`;
                          }
                          if (type === 'array' && items) {
                            const itemType = items.type || 'any';
                            return `${itemType}[]`;
                          }
                          if (format) {
                            return `${type} (${format})`;
                          }
                          return type || 'string';
                        };

                        const typeDisplay = getTypeDisplay();

                        return (
                          <Box
                            key={prop.id}
                            draggable
                            onDragStart={handlePropertyDragStart}
                            sx={{
                              px: 2,
                              py: 1.5,
                              borderRadius: 1.5,
                              border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                              background: isDark
                                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%)'
                                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)',
                              fontSize: '0.875rem',
                              color: isDark ? '#e2e8f0' : '#1e293b',
                              cursor: 'grab',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              boxShadow: isDark
                                ? '0 1px 3px rgba(0, 0, 0, 0.3)'
                                : '0 1px 3px rgba(0, 0, 0, 0.1)',
                              '&:hover': {
                                backgroundColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(241, 245, 249, 1)',
                                transform: 'translateY(-1px)',
                                boxShadow: isDark
                                  ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                                  : '0 4px 12px rgba(0, 0, 0, 0.15)',
                                borderColor: isDark ? '#8b5cf6' : '#a78bfa',
                              },
                              '&:active': {
                                cursor: 'grabbing',
                                transform: 'translateY(0)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '2px',
                                  background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                                  flexShrink: 0,
                                  boxShadow: '0 0 6px rgba(139, 92, 246, 0.4)',
                                }}
                              />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <div className="font-medium text-sm truncate">{prop.name}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                                  {typeDisplay}
                                </div>
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </>
                  )}
                </Box>
              </Box>
            )}
            </>
          )}
        </Box>

        {/* Add Button (Paths Tab Only) - Bottom Right */}
        {activeTab === 'paths' && (
          <Fab
            color="primary"
            size="small"
            onClick={handleAddPath}
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              },
            }}
          >
            <Add />
          </Fab>
        )}
      </Box>

      {/* Add/Edit Path Dialog */}
      <Dialog.Root open={pathDialogOpen} onOpenChange={setPathDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
          <Dialog.Content
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] w-full max-w-md rounded-lg shadow-lg ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            <Dialog.Title
              className={`px-6 py-4 text-lg font-semibold border-b ${
                isDark
                  ? 'text-gray-100 border-gray-700'
                  : 'text-gray-900 border-gray-200'
              }`}
            >
              {editingPath ? 'Edit Path' : 'Add New Path'}
            </Dialog.Title>

            <div className="px-6 py-4">
              <label
                htmlFor="pathname"
                className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Path Name
              </label>
              <input
                id="pathname"
                type="text"
                autoFocus
                placeholder="/api/users"
                value={pathNameInput}
                onChange={(e) => setPathNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pathNameInput.trim()) {
                    handleSavePath();
                  }
                }}
                className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark
                    ? 'bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <p
                className={`mt-2 text-xs ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Enter the path (e.g., /api/users, /v1/products/{'{'}id{'}'})
              </p>

              {/* Auto-create CRUD operations checkbox - only shown when adding new path */}
              {!editingPath && (
                <label className="flex items-center gap-3 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateCrud}
                    onChange={(e) => setAutoCreateCrud(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                  />
                  <span
                    className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Auto-create CRUD operations (GET, POST, PUT, DELETE)
                  </span>
                </label>
              )}
            </div>

            <div
              className={`px-6 py-4 flex justify-end gap-3 border-t ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              }`}
            >
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isDark
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleSavePath}
                disabled={!pathNameInput.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  pathNameInput.trim()
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {editingPath ? 'Save' : 'Add'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Drawer>
  );
}

