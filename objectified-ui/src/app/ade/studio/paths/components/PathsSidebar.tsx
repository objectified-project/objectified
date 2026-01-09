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
} from '../../../../../../lib/db/helper';
import {
  getPathsForVersion,
  createPath,
  updatePath,
  deletePath,
} from '../../../../../../lib/db/helper-paths';
import { useDarkMode } from '../../../../hooks/useDarkMode';

interface ClassItem {
  id: string;
  name: string;
}

interface PropertyItem {
  id: string;
  name: string;
}

interface PathItem {
  id: string;
  version_id: string;
  pathname: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export default function PathsSidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: 'paths' | 'classes' | 'properties';
  onTabChange: (tab: 'paths' | 'classes' | 'properties') => void;
}) {
  const { selectedVersionId } = useStudio();
  const { confirm: confirmDialog } = useDialog();
  const isDark = useDarkMode();
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Dialog state for adding/editing paths
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<PathItem | null>(null);
  const [pathNameInput, setPathNameInput] = useState('');

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
      setProperties([]);
      return;
    }

    const loadData = async () => {
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

        // Extract all unique properties
        const uniqueProperties = new Map<string, PropertyItem>();
        if (Array.isArray(classesData)) {
          classesData.forEach((cls: any) => {
            if (cls.properties && Array.isArray(cls.properties)) {
              cls.properties.forEach((prop: any) => {
                if (!uniqueProperties.has(prop.id)) {
                  uniqueProperties.set(prop.id, {
                    id: prop.id,
                    name: prop.name,
                  });
                }
              });
            }
          });
        }

        setProperties(Array.from(uniqueProperties.values()));
      } catch (error) {
        console.error('Error loading classes and properties:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedVersionId]);

  // Handle opening add path dialog
  const handleAddPath = () => {
    setEditingPath(null);
    setPathNameInput('');
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
      }
      setPathDialogOpen(false);
      setPathNameInput('');
      setEditingPath(null);
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
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
            </Box>
          ) : (
            <>
              {/* Paths Tab Content */}
              {activeTab === 'paths' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {paths.length === 0 ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                      No paths yet. Use the + button below to create one.
                    </span>
                  ) : (
                    paths.map((path) => (
                      <Box
                        key={path.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.5,
                          py: 1,
                          borderRadius: 1,
                          border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                          backgroundColor: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 1)',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            backgroundColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 1)',
                          },
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">
                            {path.pathname}
                          </span>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditPath(path)}
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
                            onClick={() => handleDeletePath(path)}
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
              )}

              {/* Classes Tab Content */}
              {activeTab === 'classes' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {classes.length === 0 ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                      No classes found.
                    </span>
                  ) : (
                    classes.map((cls) => (
                      <Box
                        key={cls.id}
                        sx={{
                          px: 1.5,
                          py: 1,
                          borderRadius: 1,
                          border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                          backgroundColor: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 1)',
                          fontSize: '0.875rem',
                          color: isDark ? '#d1d5db' : '#374151',
                          cursor: 'default',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            backgroundColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 1)',
                          },
                        }}
                      >
                        {cls.name}
                      </Box>
                    ))
                  )}
                </Box>
              )}

              {/* Properties Tab Content */}
              {activeTab === 'properties' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {properties.length === 0 ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                      No properties found.
                    </span>
                  ) : (
                    properties.map((prop) => (
                      <Box
                        key={prop.id}
                        sx={{
                          px: 1.5,
                          py: 1,
                          borderRadius: 1,
                          border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                          backgroundColor: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 1)',
                          fontSize: '0.875rem',
                          color: isDark ? '#d1d5db' : '#374151',
                          cursor: 'default',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            backgroundColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 1)',
                          },
                        }}
                      >
                        {prop.name}
                      </Box>
                    ))
                  )}
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

