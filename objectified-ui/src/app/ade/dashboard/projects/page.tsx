'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {Plus, Edit2, Trash2, FolderOpen, AlertCircle, Lock} from 'lucide-react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import { getProjectsForTenant, createProject, updateProject, deleteProject } from '../../../../../lib/db/helper';
import OpenAPIImportDialog from '../../../components/ade/dashboard/OpenAPIImportDialog';
import { useDialog } from '../../../components/providers/DialogProvider';
import { filterSlugInput } from '../../../utils/slug';

interface Project {
  id: string;
  tenant_id: string;
  creator_id: string;
  name: string;
  description: string;
  enabled: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  creator_name: string;
  creator_email: string;
}

const Projects = () => {
  const { data: session } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [createTabValue, setCreateTabValue] = useState(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectEnabled, setProjectEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const currentUserId = (session?.user as any)?.user_id;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  useEffect(() => {
    if (currentTenantId) {
      loadProjects();
    }
  }, [currentTenantId]);

  const loadProjects = async () => {
    if (!currentTenantId) return;

    try {
      const result = await getProjectsForTenant(currentTenantId);
      setProjects(JSON.parse(result));
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleCreateClick = () => {
    setProjectName('');
    setProjectDescription('');
    setProjectSlug('');
    setProjectEnabled(true);
    setErrorMessage('');
    setCreateTabValue(0);
    setShowCreateDialog(true);
  };

  const handleImportClick = () => {
    setShowImportDialog(true);
  };

  const handleImportSuccess = async () => {
    await loadProjects();
  };

  const handleCreateSubmit = async () => {
    if (!projectName.trim()) {
      setErrorMessage('Project name is required');
      return;
    }

    if (!projectSlug.trim()) {
      setErrorMessage('Project slug is required');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await createProject(
        currentTenantId,
        currentUserId,
        projectName,
        projectDescription,
        projectSlug
      );
      const response = JSON.parse(result);

      if (response.success) {
        setShowCreateDialog(false);
        await loadProjects();
      } else {
        setErrorMessage(response.error || 'Failed to create project');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setProjectName(project.name);
    setProjectDescription(project.description || '');
    setProjectSlug((project as any).slug || '');
    setProjectEnabled(project.enabled);
    setErrorMessage('');
    setShowEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!projectName.trim()) {
      setErrorMessage('Project name is required');
      return;
    }

    if (!projectSlug.trim()) {
      setErrorMessage('Project slug is required');
      return;
    }

    if (!selectedProject) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await updateProject(
        selectedProject.id,
        projectName,
        projectDescription,
        projectSlug,
        projectEnabled
      );
      const response = JSON.parse(result);

      if (response.success) {
        setShowEditDialog(false);
        await loadProjects();
      } else {
        setErrorMessage(response.error || 'Failed to update project');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project? This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteProject(projectId);
      const response = JSON.parse(result);

      if (response.success) {
        await loadProjects();
      } else {
        await alertDialog({
          message: response.error || 'Failed to delete project',
          variant: 'error',
        });
      }
    } catch (error: any) {
      await alertDialog({
        message: error.message || 'An error occurred',
        variant: 'error',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!session) {
    return (
      <div className="p-6">
        <p>Loading...</p>
      </div>
    );
  }

  if (!currentTenantId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Lock className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                No Tenant Selected
              </h2>
              <p className="text-yellow-800 dark:text-yellow-200 mb-3">
                Please select a tenant before managing projects. Projects are associated with a specific tenant.
              </p>
              <a
                href="/ade/dashboard/tenants"
                className="inline-block px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Tenants
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Row actions dropdown component for each project
  const RowActions = ({ project }: { project: Project }) => {
    const [action, setAction] = useState<string>('');

    const handleChange = async (value: string) => {
      try {
        switch (value) {
          case 'edit':
            handleEditClick(project);
            break;
          case 'delete':
            await handleDelete(project.id);
            break;
        }
      } finally {
        setAction('');
      }
    };

    return (
      <FormControl
        size="small"
        sx={{
          minWidth: 140,
          '& .MuiOutlinedInput-root': {
            color: 'var(--foreground)',
            backgroundColor: 'var(--background)',
            '& fieldset': {
              borderColor: 'rgba(128, 128, 128, 0.5)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(128, 128, 128, 0.7)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#3b82f6',
            },
          },
          '& .MuiSvgIcon-root': {
            color: 'var(--foreground)',
          },
        }}
      >
        <Select
          value={action}
          onChange={(e) => handleChange(e.target.value as string)}
          displayEmpty
          renderValue={(selected) => {
            if (!selected) {
              return <span className="text-gray-600 dark:text-gray-300">Actions</span>;
            }
            const labels: Record<string, string> = {
              edit: 'Edit',
              delete: 'Delete',
            };
            return labels[selected as string] || 'Actions';
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: 'var(--background)',
                color: 'var(--foreground)',
                '& .MuiMenuItem-root': {
                  '&:hover': {
                    backgroundColor: 'rgba(128, 128, 128, 0.2)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    '&:hover': {
                      backgroundColor: 'rgba(59, 130, 246, 0.3)',
                    },
                  },
                },
              },
            },
          }}
        >
          <MenuItem value="" disabled>
            <span className="text-gray-500">Select action</span>
          </MenuItem>
          <MenuItem value="edit">
            <div className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Edit</span>
            </div>
          </MenuItem>
          <MenuItem value="delete" sx={{ color: 'error.main' }}>
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span>Delete</span>
            </div>
          </MenuItem>
        </Select>
      </FormControl>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Projects</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage projects for the current tenant
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
          <FolderOpen className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Projects Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Get started by creating your first project using the "New Project" button above
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Project Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created By
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {project.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {(project as any).slug}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {project.description || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {project.creator_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {project.creator_email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(project.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end">
                      <RowActions project={project} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => !isLoading && setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={createTabValue} onChange={(e, newValue) => setCreateTabValue(newValue)}>
              <Tab label="From Scratch" />
              <Tab label="From OpenAPI Import" />
            </Tabs>
          </Box>

          {createTabValue === 0 && (
            <Box>
              {errorMessage && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errorMessage}
                </Alert>
              )}
              <TextField
                autoFocus
                margin="dense"
                label="Project Name"
                type="text"
                fullWidth
                variant="outlined"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  // Auto-generate slug from name if slug is empty or matches previous auto-generated value
                  if (!projectSlug || projectSlug === generateSlug(projectName)) {
                    setProjectSlug(generateSlug(e.target.value));
                  }
                }}
                disabled={isLoading}
                required
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                label="Slug"
                type="text"
                fullWidth
                variant="outlined"
                value={projectSlug}
                onChange={(e) => setProjectSlug(filterSlugInput(e.target.value))}
                disabled={isLoading}
                required
                helperText="URL-friendly identifier (lowercase letters, numbers, and dashes only)"
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                label="Description"
                type="text"
                fullWidth
                variant="outlined"
                multiline
                rows={4}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                disabled={isLoading}
              />
            </Box>
          )}

          {createTabValue === 1 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AlertCircle size={48} style={{ margin: '0 auto 16px', color: '#3b82f6' }} />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Import a project from an OpenAPI specification file. This will create a new project with classes and properties automatically.
              </p>
              <Button
                variant="contained"
                onClick={() => {
                  setShowCreateDialog(false);
                  handleImportClick();
                }}
              >
                Start Import
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)} disabled={isLoading}>
            Cancel
          </Button>
          {createTabValue === 0 && (
            <Button onClick={handleCreateSubmit} variant="contained" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* OpenAPI Import Dialog */}
      <OpenAPIImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSuccess={handleImportSuccess}
        tenantId={currentTenantId}
        userId={currentUserId}
      />

      {/* Edit Project Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => !isLoading && setShowEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            type="text"
            fullWidth
            variant="outlined"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={isLoading}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Slug"
            type="text"
            fullWidth
            variant="outlined"
            value={projectSlug}
            onChange={(e) => setProjectSlug(filterSlugInput(e.target.value))}
            disabled={isLoading}
            required
            helperText="URL-friendly identifier (lowercase letters, numbers, and dashes only)"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            disabled={isLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleEditSubmit} variant="contained" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Projects;
