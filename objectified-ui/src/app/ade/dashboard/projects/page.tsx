'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, FolderOpen, Lock, Upload, AlertTriangle, MoreVertical, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Alert } from '../../../components/ui/Alert';
import { Textarea } from '../../../components/ui/Textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { createProject, updateProject, deleteProject, permanentDeleteProject } from '../../../../../lib/db/helper';
import OpenAPIImportDialog from '../../../components/ade/dashboard/OpenAPIImportDialog';
import ImportDialog from '../../../components/ade/dashboard/ImportDialog';
import LLMImportDialog from '../../../components/ade/dashboard/LLMImportDialog';
import { useDialog } from '../../../components/providers/DialogProvider';
import { filterSlugInput } from '../../../utils/slug';
import { SPDX_LICENSES, getLicenseUrl, SPDXLicense } from '../../../utils/spdx-licenses';

interface ProjectMetadata {
  summary?: string;
  termsOfService?: string;
  contact?: { name?: string; url?: string; email?: string };
  license?: { name?: string; identifier?: string; url?: string };
}

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
  metadata?: ProjectMetadata;
}

const Projects = () => {
  const { data: session } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showNewImportDialog, setShowNewImportDialog] = useState(false);
  const [showAIChatDialog, setShowAIChatDialog] = useState(false);
  const [pendingLLMSpec, setPendingLLMSpec] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectEnabled, setProjectEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editTabValue, setEditTabValue] = useState('basic');

  // Dropdown state
  const [openProjectDropdown, setOpenProjectDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);

  // Metadata state
  const [metadataSummary, setMetadataSummary] = useState('');
  const [metadataTermsOfService, setMetadataTermsOfService] = useState('');
  const [metadataContactName, setMetadataContactName] = useState('');
  const [metadataContactUrl, setMetadataContactUrl] = useState('');
  const [metadataContactEmail, setMetadataContactEmail] = useState('');
  const [metadataLicenseName, setMetadataLicenseName] = useState('');
  const [metadataLicenseIdentifier, setMetadataLicenseIdentifier] = useState('');
  const [metadataLicenseUrl, setMetadataLicenseUrl] = useState('');

  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const currentUserId = (session?.user as any)?.user_id;

  const generateSlug = (name: string) => {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  useEffect(() => {
    if (currentTenantId) loadProjects();
  }, [currentTenantId]);

  const loadProjects = async () => {
    if (!currentTenantId) return;
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.projects) {
        setProjects(data.projects);
      } else {
        throw new Error(data.error || 'Failed to load projects');
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    }
  };

  const handleCreateClick = () => {
    setProjectName('');
    setProjectDescription('');
    setProjectSlug('');
    setProjectEnabled(true);
    setErrorMessage('');
    setMetadataSummary('');
    setMetadataTermsOfService('');
    setMetadataContactName('');
    setMetadataContactUrl('');
    setMetadataContactEmail('');
    setMetadataLicenseName('');
    setMetadataLicenseIdentifier('');
    setMetadataLicenseUrl('');
    setShowCreateDialog(true);
  };

  const handleImportClick = () => setShowImportDialog(true);
  const handleImportSuccess = async () => await loadProjects();

  const handleCreateSubmit = async () => {
    if (!projectName.trim()) { setErrorMessage('Project name is required'); return; }
    if (!projectSlug.trim()) { setErrorMessage('Project slug is required'); return; }
    setIsLoading(true);
    setErrorMessage('');

    try {
      const metadata: ProjectMetadata = {};
      if (metadataSummary.trim()) metadata.summary = metadataSummary.trim();
      if (metadataTermsOfService.trim()) metadata.termsOfService = metadataTermsOfService.trim();
      if (metadataContactName.trim() || metadataContactUrl.trim() || metadataContactEmail.trim()) {
        metadata.contact = {};
        if (metadataContactName.trim()) metadata.contact.name = metadataContactName.trim();
        if (metadataContactUrl.trim()) metadata.contact.url = metadataContactUrl.trim();
        if (metadataContactEmail.trim()) metadata.contact.email = metadataContactEmail.trim();
      }
      if (metadataLicenseName.trim() || metadataLicenseIdentifier.trim() || metadataLicenseUrl.trim()) {
        metadata.license = {};
        if (metadataLicenseName.trim()) metadata.license.name = metadataLicenseName.trim();
        if (metadataLicenseIdentifier.trim()) metadata.license.identifier = metadataLicenseIdentifier.trim();
        if (metadataLicenseUrl.trim()) metadata.license.url = metadataLicenseUrl.trim();
      }

      const result = await createProject(currentTenantId, currentUserId, projectName, projectDescription, projectSlug, metadata);
      const response = JSON.parse(result);
      if (response.success) { setShowCreateDialog(false); await loadProjects(); }
      else setErrorMessage(response.error || 'Failed to create project');
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
    setEditTabValue('basic');
    const metadata = project.metadata || {};
    setMetadataSummary(metadata.summary || '');
    setMetadataTermsOfService(metadata.termsOfService || '');
    setMetadataContactName(metadata.contact?.name || '');
    setMetadataContactUrl(metadata.contact?.url || '');
    setMetadataContactEmail(metadata.contact?.email || '');
    setMetadataLicenseName(metadata.license?.name || '');
    setMetadataLicenseIdentifier(metadata.license?.identifier || '');
    setMetadataLicenseUrl(metadata.license?.url || '');
    setShowEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!projectName.trim()) { setErrorMessage('Project name is required'); return; }
    if (!projectSlug.trim()) { setErrorMessage('Project slug is required'); return; }
    if (!selectedProject) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const metadata: ProjectMetadata = {};
      if (metadataSummary.trim()) metadata.summary = metadataSummary.trim();
      if (metadataTermsOfService.trim()) metadata.termsOfService = metadataTermsOfService.trim();
      if (metadataContactName.trim() || metadataContactUrl.trim() || metadataContactEmail.trim()) {
        metadata.contact = {};
        if (metadataContactName.trim()) metadata.contact.name = metadataContactName.trim();
        if (metadataContactUrl.trim()) metadata.contact.url = metadataContactUrl.trim();
        if (metadataContactEmail.trim()) metadata.contact.email = metadataContactEmail.trim();
      }
      if (metadataLicenseName.trim() || metadataLicenseIdentifier.trim() || metadataLicenseUrl.trim()) {
        metadata.license = {};
        if (metadataLicenseName.trim()) metadata.license.name = metadataLicenseName.trim();
        if (metadataLicenseIdentifier.trim()) metadata.license.identifier = metadataLicenseIdentifier.trim();
        if (metadataLicenseUrl.trim()) metadata.license.url = metadataLicenseUrl.trim();
      }

      const result = await updateProject(selectedProject.id, projectName, projectDescription, projectSlug, projectEnabled, metadata);
      const response = JSON.parse(result);
      if (response.success) { setShowEditDialog(false); await loadProjects(); }
      else setErrorMessage(response.error || 'Failed to update project');
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
    if (!confirmed) return;

    try {
      const result = await deleteProject(projectId);
      const response = JSON.parse(result);
      if (response.success) await loadProjects();
      else await alertDialog({ message: response.error || 'Failed to delete project', variant: 'error' });
    } catch (error: any) {
      await alertDialog({ message: error.message || 'An error occurred', variant: 'error' });
    }
  };

  const handlePermanentDelete = async (project: Project) => {
    const confirmed = await confirmDialog({
      title: 'Permanently Delete Project',
      message: `Are you absolutely sure you want to permanently delete "${project.name}"?\n\nThis will permanently delete:\n• All versions of this project\n• All publications associated with those versions\n• All classes and their properties\n• All properties directly linked to this project\n\nThis action CANNOT be undone and all data will be lost forever.`,
      variant: 'danger',
      confirmLabel: 'Permanently Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    // Double confirmation for safety
    const doubleConfirmed = await confirmDialog({
      title: 'Final Confirmation',
      message: `Type "DELETE" mentally and confirm: You are about to permanently destroy all data for project "${project.name}". This is your last chance to cancel.`,
      variant: 'danger',
      confirmLabel: 'Yes, Delete Everything',
      cancelLabel: 'Cancel',
    });
    if (!doubleConfirmed) return;

    try {
      const result = await permanentDeleteProject(project.id);
      const response = JSON.parse(result);
      if (response.success) {
        await alertDialog({ message: 'Project and all associated data have been permanently deleted.', variant: 'success' });
        await loadProjects();
      } else {
        await alertDialog({ message: response.error || 'Failed to permanently delete project', variant: 'error' });
      }
    } catch (error: any) {
      await alertDialog({ message: error.message || 'An error occurred', variant: 'error' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleLicenseSelect = (identifier: string) => {
    const license = SPDX_LICENSES.find((l: SPDXLicense) => l.identifier === identifier);
    if (license) {
      setMetadataLicenseIdentifier(license.identifier);
      setMetadataLicenseName(license.name);
      const url = getLicenseUrl(license.identifier);
      if (url) setMetadataLicenseUrl(url);
    }
  };

  if (!session) return <div className="p-6"><p>Loading...</p></div>;

  if (!currentTenantId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Lock className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">No Tenant Selected</h2>
              <p className="text-yellow-800 dark:text-yellow-200 mb-3">Please select a tenant before managing projects.</p>
              <Button asChild><a href="/ade/dashboard/tenants">Go to Tenants</a></Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <FolderOpen className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Projects</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage projects for the current tenant</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowNewImportDialog(true)}
            variant="outline"
            className="border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
            disabled={!currentTenantId}
            title={!currentTenantId ? 'Please select a tenant first' : 'Import specification'}
          >
            <Upload className="h-5 w-5" />Import
          </Button>
          <Button
            onClick={() => setShowAIChatDialog(true)}
            variant="outline"
            className="border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30"
            disabled={!currentTenantId}
            title={!currentTenantId ? 'Please select a tenant first' : 'Chat with AI to design API specs'}
          >
            <Sparkles className="h-5 w-5" />Design with AI
          </Button>
          <Button onClick={handleCreateClick} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
            <Plus className="h-5 w-5" />New Project
          </Button>
        </div>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-full blur-3xl opacity-60" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full blur-3xl opacity-60" />
          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-16 text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <FolderOpen className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No Projects Yet</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">Get started by creating your first project</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-64">
                    Project Name
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-56">
                    Created By
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                    Updated
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">

                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all duration-200">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-xs" title={project.name}>
                          {project.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate" title={(project as any).slug}>
                          {(project as any).slug || '—'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-md" title={project.description || ''}>
                        {project.description || <span className="text-gray-400 dark:text-gray-600">No description</span>}
                      </div>
                      {project.metadata?.summary && (
                        <div className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-md mt-1" title={project.metadata.summary}>
                          {project.metadata.summary}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          {project.enabled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                              Disabled
                            </span>
                          )}
                        </div>
                        {project.deleted_at && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            <Trash2 className="w-3 h-3" />
                            Deleted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white truncate" title={project.creator_name}>
                        {project.creator_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={project.creator_email}>
                        {project.creator_email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400" title={new Date(project.created_at).toLocaleString()}>
                        {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(project.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400" title={new Date(project.updated_at).toLocaleString()}>
                        {new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(project.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setDropdownPosition({
                              top: rect.bottom + 4,
                              right: window.innerWidth - rect.right
                            });
                            setOpenProjectDropdown(openProjectDropdown === project.id ? null : project.id);
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-white"
                          title="Actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openProjectDropdown === project.id && dropdownPosition && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenProjectDropdown(null);
                              }}
                            />
                            <div
                              className="fixed w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20"
                              style={{
                                top: `${dropdownPosition.top}px`,
                                right: `${dropdownPosition.right}px`
                              }}>
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenProjectDropdown(null);
                                    handleEditClick(project);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                  <Edit2 className="w-4 h-4 text-indigo-500" />
                                  Edit Project
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenProjectDropdown(null);
                                    handleDelete(project.id);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                  Delete Project
                                </button>
                                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenProjectDropdown(null);
                                    handlePermanentDelete(project);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                  Permanently Delete
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !isLoading && setShowCreateDialog(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30">
                <FolderOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              Create New Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name *</Label>
              <Input id="projectName" value={projectName} onChange={(e) => { setProjectName(e.target.value); if (!projectSlug || projectSlug === generateSlug(projectName)) setProjectSlug(generateSlug(e.target.value)); }} disabled={isLoading} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectSlug">Slug *</Label>
              <Input id="projectSlug" value={projectSlug} onChange={(e) => setProjectSlug(filterSlugInput(e.target.value))} disabled={isLoading} className="font-mono" />
              <p className="text-xs text-gray-500 dark:text-gray-400">URL-friendly identifier (lowercase letters, numbers, and dashes only)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectDescription">Description</Label>
              <Textarea id="projectDescription" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} disabled={isLoading} rows={3} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleCreateSubmit} disabled={isLoading} className="bg-gradient-to-r from-purple-500 to-indigo-600">
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Import Dialog (Step 1 - Source Selection) */}
      {currentTenantId && currentUserId && (
        <ImportDialog
          open={showNewImportDialog}
          onClose={() => setShowNewImportDialog(false)}
          onSuccess={handleImportSuccess}
          tenantId={currentTenantId}
          userId={currentUserId}
          initialLLMSpec={pendingLLMSpec}
          onConsumeInitialLLMSpec={() => setPendingLLMSpec(null)}
        />
      )}

      {/* AI Design Chat - opens as popup to assist with design using an LLM */}
      {currentTenantId && currentUserId && (
        <LLMImportDialog
          open={showAIChatDialog}
          onClose={() => setShowAIChatDialog(false)}
          onImportSpec={(specContent) => {
            setPendingLLMSpec(specContent);
            setShowAIChatDialog(false);
            setShowNewImportDialog(true);
          }}
          tenantId={currentTenantId}
          userId={currentUserId}
        />
      )}

      {/* OpenAPI Import Dialog (Legacy - will be replaced by multi-step flow) */}
      {currentTenantId && currentUserId && (
        <OpenAPIImportDialog open={showImportDialog} onClose={() => setShowImportDialog(false)} onSuccess={handleImportSuccess} tenantId={currentTenantId} userId={currentUserId} />
      )}

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => !isLoading && setShowEditDialog(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          {errorMessage && <Alert variant="error" className="mt-4">{errorMessage}</Alert>}
          <Tabs value={editTabValue} onValueChange={setEditTabValue} className="mt-4">
            <TabsList>
              <TabsTrigger value="basic">Basic Information</TabsTrigger>
              <TabsTrigger value="metadata">API Metadata</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Project Name *</Label>
                <Input id="editName" value={projectName} onChange={(e) => setProjectName(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editSlug">Slug *</Label>
                <Input id="editSlug" value={projectSlug} onChange={(e) => setProjectSlug(filterSlugInput(e.target.value))} disabled={isLoading} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDescription">Description</Label>
                <Textarea id="editDescription" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} disabled={isLoading} rows={4} />
              </div>
            </TabsContent>
            <TabsContent value="metadata" className="space-y-6 mt-4">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">OpenAPI Metadata</h3>
                <div className="space-y-2">
                  <Label htmlFor="summary">API Summary</Label>
                  <Input id="summary" value={metadataSummary} onChange={(e) => setMetadataSummary(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termsOfService">Terms of Service URL</Label>
                  <Input id="termsOfService" type="url" value={metadataTermsOfService} onChange={(e) => setMetadataTermsOfService(e.target.value)} disabled={isLoading} placeholder="https://example.com/terms" />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Name</Label>
                    <Input id="contactName" value={metadataContactName} onChange={(e) => setMetadataContactName(e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactUrl">URL</Label>
                    <Input id="contactUrl" type="url" value={metadataContactUrl} onChange={(e) => setMetadataContactUrl(e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input id="contactEmail" type="email" value={metadataContactEmail} onChange={(e) => setMetadataContactEmail(e.target.value)} disabled={isLoading} />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">License Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="licenseIdentifier">License (SPDX)</Label>
                  <Select value={metadataLicenseIdentifier} onValueChange={handleLicenseSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a license..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {SPDX_LICENSES.slice(0, 50).map((license: SPDXLicense) => (
                        <SelectItem key={license.identifier} value={license.identifier}>{license.name} ({license.identifier})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseName">License Name</Label>
                    <Input id="licenseName" value={metadataLicenseName} onChange={(e) => setMetadataLicenseName(e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="licenseUrl">License URL</Label>
                    <Input id="licenseUrl" type="url" value={metadataLicenseUrl} onChange={(e) => setMetadataLicenseUrl(e.target.value)} disabled={isLoading} />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;

