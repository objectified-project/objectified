'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Package, AlertCircle, Lock, Unlock, CheckCircle, Eye, Copy } from 'lucide-react';
import dynamic from 'next/dynamic';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import {
  getProjectsForTenant,
  getVersionsForProject,
  createVersion,
  updateVersion,
  deleteVersion,
  publishVersion,
  unpublishVersion,
  getClassesForVersion,
  getPropertiesForClass,
  getTenantsAdministratedByUser
} from '../../../../../lib/db/helper';
import { generateOpenApiSpec } from '../../../utils/openapi';
import * as yaml from 'js-yaml';
import { diffLines, Change } from 'diff';

// Dynamically import Monaco Editor with SSR disabled
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading editor...</div>
    </div>
  ),
});

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface Version {
  id: string;
  project_id: string;
  creator_id: string;
  version_id: string;
  description: string | null;
  change_log: string | null;
  enabled: boolean;
  published: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  creator_name: string;
  creator_email: string;
}

const Versions = () => {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [versionId, setVersionId] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [bumpStrategy, setBumpStrategy] = useState<'patch' | 'minor'>('patch');
  const [nextAutoVersion, setNextAutoVersion] = useState<string>('');
  const [description, setDescription] = useState('');
  const [changeLog, setChangeLog] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [sourceVersionId, setSourceVersionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // OpenAPI Viewer state
  const [showOpenApiDialog, setShowOpenApiDialog] = useState(false);
  const [openApiSpec, setOpenApiSpec] = useState<string>('');
  const [openApiFormat, setOpenApiFormat] = useState<'json' | 'yaml'>('json');
  const [viewingVersion, setViewingVersion] = useState<Version | null>(null);
  const [isLoadingSpec, setIsLoadingSpec] = useState(false);

  // Version Comparison state
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareVersion1Id, setCompareVersion1Id] = useState<string>('');
  const [compareVersion2Id, setCompareVersion2Id] = useState<string>('');
  const [compareSpec1, setCompareSpec1] = useState<string>('');
  const [compareSpec2, setCompareSpec2] = useState<string>('');
  const [compareFormat, setCompareFormat] = useState<'json' | 'yaml'>('json');
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [diffResult, setDiffResult] = useState<Change[]>([]);
  const [diffViewMode, setDiffViewMode] = useState<'overlay' | 'side-by-side'>('overlay');

  // Refs for synchronized scrolling
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const currentUserId = (session?.user as any)?.user_id;
  const isAdmin = Boolean((session?.user as any)?.is_tenant_admin);
  const [effectiveIsAdmin, setEffectiveIsAdmin] = useState<boolean>(isAdmin);

  useEffect(() => {
    let cancelled = false;
    const resolveAdmin = async () => {
      try {
        // Prefer session flag if available
        if (isAdmin) {
          if (!cancelled) setEffectiveIsAdmin(true);
          return;
        }
        if (!currentUserId || !currentTenantId) {
          if (!cancelled) setEffectiveIsAdmin(false);
          return;
        }
        const res = await getTenantsAdministratedByUser(currentUserId);
        const rows = JSON.parse(res) as Array<{ tenant_id: string }>;
        const isAdminForTenant = rows.some(r => r.tenant_id === currentTenantId);
        if (!cancelled) setEffectiveIsAdmin(isAdminForTenant);
      } catch {
        if (!cancelled) setEffectiveIsAdmin(false);
      }
    };
    resolveAdmin();
    return () => { cancelled = true; };
  }, [isAdmin, currentUserId, currentTenantId]);

  useEffect(() => {
    if (currentTenantId) {
      loadProjects();
    }
  }, [currentTenantId]);

  useEffect(() => {
    if (selectedProjectId) {
      loadVersions();
    } else {
      setVersions([]);
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    if (!currentTenantId) return;

    try {
      const result = await getProjectsForTenant(currentTenantId);
      const projectsData = JSON.parse(result);
      setProjects(projectsData);

      // Auto-select first project if available
      if (projectsData.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectsData[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadVersions = async () => {
    if (!selectedProjectId) return;

    try {
      const result = await getVersionsForProject(selectedProjectId);
      setVersions(JSON.parse(result));
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  };

  const calculateNextVersion = (strategy: 'patch' | 'minor' = 'patch'): string => {
    if (versions.length === 0) {
      return '0.1.0';
    }

    // Get the latest version (versions are already sorted by created_at DESC)
    const latestVersion = versions[0].version_id;
    const match = latestVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);

    if (!match) {
      return '0.1.0';
    }

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    const patch = parseInt(match[3], 10);

    if (strategy === 'minor') {
      return `${major}.${minor + 1}.0`;
    } else {
      return `${major}.${minor}.${patch + 1}`;
    }
  };

  const handleCreateClick = () => {
    setVersionId('');
    setAutoGenerate(true);
    setBumpStrategy('patch');
    setNextAutoVersion(calculateNextVersion('patch'));
    setDescription('');
    setChangeLog('');
    setEnabled(true);
    setSourceVersionId('');
    setErrorMessage('');
    setShowCreateDialog(true);
  };

  const handleCreateSubmit = async () => {
    if (!autoGenerate && !versionId.trim()) {
      setErrorMessage('Version ID is required when not auto-generating');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Description is required');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await createVersion(
        selectedProjectId,
        currentUserId,
        autoGenerate ? null : versionId,
        description,
        changeLog,
        sourceVersionId || null,
        autoGenerate ? bumpStrategy : undefined
      );
      const response = JSON.parse(result);

      if (response.success) {
        setShowCreateDialog(false);
        await loadVersions();

        // Show success message with copy info if applicable
        if (response.copiedClasses > 0) {
          alert(`Version created successfully! Copied ${response.copiedClasses} class(es) from source version.`);
        } else if (response.copyWarning) {
          alert(`Version created successfully, but encountered an issue copying classes: ${response.copyWarning}`);
        }
      } else {
        setErrorMessage(response.error || 'Failed to create version');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (version: Version) => {
    if (version.published) {
      setErrorMessage('Cannot edit published version');
      return;
    }

    setSelectedVersion(version);
    setVersionId(version.version_id);
    setDescription(version.description || '');
    setChangeLog(version.change_log || '');
    setEnabled(version.enabled);
    setErrorMessage('');
    setShowEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedVersion) return;

    if (!description.trim()) {
      setErrorMessage('Description is required');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await updateVersion(
        selectedVersion.id,
        description,
        changeLog,
        enabled
      );
      const response = JSON.parse(result);

      if (response.success) {
        setShowEditDialog(false);
        await loadVersions();
      } else {
        setErrorMessage(response.error || 'Failed to update version');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (versionRecordId: string) => {
    const ver = versions.find(v => v.id === versionRecordId);
    if (!ver) {
      alert('Version not found');
      return;
    }
    if (ver.creator_id !== currentUserId && !effectiveIsAdmin) {
      alert('Only the version owner or a tenant administrator can publish this version');
      return;
    }

    if (!confirm('Are you sure you want to publish this version? Once published, it cannot be edited (but can be unpublished or deleted).')) {
      return;
    }

    try {
      const result = await publishVersion(versionRecordId, currentUserId);
      const response = JSON.parse(result);

      if (response.success) {
        await loadVersions();
      } else {
        alert(response.error || 'Failed to publish version');
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred');
    }
  };

  const handleUnpublish = async (versionRecordId: string) => {
    const ver = versions.find(v => v.id === versionRecordId);
    if (!ver) {
      alert('Version not found');
      return;
    }
    if (ver.creator_id !== currentUserId && !effectiveIsAdmin) {
      alert('Only the version owner or a tenant administrator can unpublish this version');
      return;
    }

    if (!confirm('Are you sure you want to unpublish this version? It will become editable again.')) {
      return;
    }

    try {
      const result = await unpublishVersion(versionRecordId, currentUserId);
      const response = JSON.parse(result);

      if (response.success) {
        await loadVersions();
      } else {
        alert(response.error || 'Failed to unpublish version');
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred');
    }
  };

  const handleDelete = async (versionRecordId: string) => {
    if (!confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteVersion(versionRecordId);
      const response = JSON.parse(result);

      if (response.success) {
        await loadVersions();
      } else {
        alert(response.error || 'Failed to delete version');
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred');
    }
  };

  const handleViewOpenApi = async (version: Version) => {
    setViewingVersion(version);
    setShowOpenApiDialog(true);
    setIsLoadingSpec(true);
    setOpenApiFormat('json');

    try {
      // Load classes for this version
      const classesResult = await getClassesForVersion(version.id);
      const classesData = JSON.parse(classesResult);

      // Load properties for each class
      const classesWithProperties = await Promise.all(
        classesData.map(async (cls: any) => {
          const propsResult = await getPropertiesForClass(cls.id);
          const properties = JSON.parse(propsResult);
          return { ...cls, properties };
        })
      );

      // Get the project name
      const project = projects.find(p => p.id === version.project_id);

      // Generate OpenAPI spec
      const spec = generateOpenApiSpec(classesWithProperties, {
        projectName: project?.name,
        version: version.version_id,
        description: version.description || undefined
      });

      setOpenApiSpec(spec);
    } catch (error) {
      console.error('Failed to generate OpenAPI spec:', error);
      setOpenApiSpec(JSON.stringify({
        openapi: '3.1.0',
        info: {
          title: 'Error Loading Spec',
          version: version.version_id,
          description: 'Failed to load classes for this version'
        },
        components: {
          schemas: {}
        }
      }, null, 2));
    } finally {
      setIsLoadingSpec(false);
    }
  };

  const loadVersionSpec = async (versionId: string): Promise<string> => {
    const version = versions.find(v => v.id === versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    // Load classes for this version
    const classesResult = await getClassesForVersion(version.id);
    const classesData = JSON.parse(classesResult);

    // Load properties for each class
    const classesWithProperties = await Promise.all(
      classesData.map(async (cls: any) => {
        const propsResult = await getPropertiesForClass(cls.id);
        const properties = JSON.parse(propsResult);
        return { ...cls, properties };
      })
    );

    // Get the project name
    const project = projects.find(p => p.id === version.project_id);

    // Generate OpenAPI spec
    return generateOpenApiSpec(classesWithProperties, {
      projectName: project?.name,
      version: version.version_id,
      description: version.description || undefined
    });
  };

  const handleCompareVersions = async () => {
    if (!compareVersion1Id || !compareVersion2Id) {
      alert('Please select two versions to compare');
      return;
    }

    if (compareVersion1Id === compareVersion2Id) {
      alert('Please select two different versions to compare');
      return;
    }

    setIsLoadingComparison(true);

    try {
      // Load both specs
      const [spec1, spec2] = await Promise.all([
        loadVersionSpec(compareVersion1Id),
        loadVersionSpec(compareVersion2Id)
      ]);

      setCompareSpec1(spec1);
      setCompareSpec2(spec2);

      // Calculate diff
      const content1 = compareFormat === 'json' ? spec1 : yaml.dump(JSON.parse(spec1), { lineWidth: -1, noRefs: true });
      const content2 = compareFormat === 'json' ? spec2 : yaml.dump(JSON.parse(spec2), { lineWidth: -1, noRefs: true });

      const diff = diffLines(content1, content2);
      setDiffResult(diff);
    } catch (error) {
      console.error('Failed to compare versions:', error);
      alert('Failed to load version specifications for comparison');
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const handleCompareDialogOpen = () => {
    setShowCompareDialog(true);
    setCompareVersion1Id('');
    setCompareVersion2Id('');
    setCompareSpec1('');
    setCompareSpec2('');
    setCompareFormat('json');
    setDiffResult([]);
    setDiffViewMode('overlay');
  };

  const handleCompareFormatChange = (newFormat: 'json' | 'yaml') => {
    setCompareFormat(newFormat);

    // Recalculate diff if specs are loaded
    if (compareSpec1 && compareSpec2) {
      const content1 = newFormat === 'json' ? compareSpec1 : yaml.dump(JSON.parse(compareSpec1), { lineWidth: -1, noRefs: true });
      const content2 = newFormat === 'json' ? compareSpec2 : yaml.dump(JSON.parse(compareSpec2), { lineWidth: -1, noRefs: true });

      const diff = diffLines(content1, content2);
      setDiffResult(diff);
    }
  };

  // Synchronized scroll handlers
  const handleLeftScroll = () => {
    if (isSyncingScroll.current || !leftPanelRef.current || !rightPanelRef.current) return;

    isSyncingScroll.current = true;
    rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;

    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleRightScroll = () => {
    if (isSyncingScroll.current || !leftPanelRef.current || !rightPanelRef.current) return;

    isSyncingScroll.current = true;
    leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;

    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
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
                Please select a tenant before managing versions. Versions are associated with projects within a tenant.
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

  if (projects.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                No Versions Available
              </h2>
              <p className="text-yellow-800 dark:text-yellow-200 mb-3">
                Please create a project before managing versions. Versions belong to specific projects.
              </p>
              <a
                href="/ade/dashboard/projects"
                className="inline-block px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Projects
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Versions</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage versions with semantic versioning
          </p>
        </div>
        <div className="flex gap-3">
          <FormControl
            sx={{
              minWidth: 250,
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
              '& .MuiInputLabel-root': {
                color: 'var(--foreground)',
                '&.Mui-focused': {
                  color: '#3b82f6',
                },
              },
              '& .MuiSvgIcon-root': {
                color: 'var(--foreground)',
              },
            }}
          >
            <InputLabel>Select Project</InputLabel>
            <Select
              value={selectedProjectId}
              label="Select Project"
              onChange={(e) => setSelectedProjectId(e.target.value)}
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
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <button
            onClick={handleCompareDialogOpen}
            disabled={!selectedProjectId || versions.length < 2}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed"
            title={versions.length < 2 ? 'Need at least 2 versions to compare' : 'Compare two versions'}
          >
            <Copy className="h-5 w-5" />
            Compare
          </button>
          <button
            onClick={handleCreateClick}
            disabled={!selectedProjectId}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed"
          >
            <Plus className="h-5 w-5" />
            New Version
          </button>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
          <Package className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Versions Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Get started by creating your first version using the "New Version" button above
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Version
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
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
              {versions.map((version) => (
                <tr key={version.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        v{version.version_id}
                      </div>
                      {version.published && (
                        <div title="Published (Frozen)">
                          <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                      {version.description || '—'}
                    </div>
                    {version.change_log && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs truncate">
                        {version.change_log}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      {version.published ? (
                        <Chip
                          label="Published"
                          color="success"
                          size="small"
                          icon={<CheckCircle style={{ fontSize: 16 }} size={16}/>}
                        />
                      ) : (
                        <Chip
                          label="Draft"
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(128, 128, 128, 0.2)',
                            color: 'var(--foreground)',
                            borderColor: 'rgba(128, 128, 128, 0.3)',
                            border: '1px solid',
                          }}
                        />
                      )}
                      {!version.enabled && (
                        <Chip
                          label="Disabled"
                          color="error"
                          size="small"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {version.creator_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {version.creator_email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(version.created_at)}
                    {version.published_at && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        Published: {formatDate(version.published_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <div title="View OpenAPI Spec">
                        <button
                          onClick={() => handleViewOpenApi(version)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors"
                        >
                          <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </button>
                      </div>
                      {!version.published ? (
                        <>
                          <div title="Edit version">
                            <button
                              onClick={() => handleEditClick(version)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors"
                            >
                              <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </button>
                          </div>
                          {(!version.published && (version.creator_id === currentUserId || effectiveIsAdmin)) && (
                            <div title="Publish version (freeze)">
                              <button
                                onClick={() => handlePublish(version.id)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors"
                              >
                                <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div title="Unpublish version">
                          <button
                            onClick={() => handleUnpublish(version.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors"
                          >
                            <Unlock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </button>
                        </div>
                      )}
                      <div title="Delete version">
                        <button
                          onClick={() => handleDelete(version.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Version Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => !isLoading && setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Version</DialogTitle>
        <DialogContent>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          {/* Copy From Version Field */}
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Copy From Version</InputLabel>
            <Select
              value={sourceVersionId}
              label="Copy From Version"
              onChange={(e) => setSourceVersionId(e.target.value)}
              disabled={isLoading || versions.length === 0}
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
              <MenuItem value="">
                <em>{versions.length === 0 ? 'No versions available' : 'Create blank version'}</em>
              </MenuItem>
              {versions.map((version) => (
                <MenuItem key={version.id} value={version.id}>
                  {version.published ? '🔒 ' : ''}v{version.version_id} - {version.description || 'No description'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {sourceVersionId && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Classes and their properties from the selected version will be copied to the new version.
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Version Strategy</InputLabel>
            <Select
              value={autoGenerate ? 'auto' : 'manual'}
              label="Version Strategy"
              onChange={(e) => {
                const isAuto = e.target.value === 'auto';
                setAutoGenerate(isAuto);
                if (isAuto) {
                  setNextAutoVersion(calculateNextVersion(bumpStrategy));
                }
              }}
              disabled={isLoading}
            >
              <MenuItem value="auto">Auto-generate version</MenuItem>
              <MenuItem value="manual">Manual entry</MenuItem>
            </Select>
          </FormControl>
          {autoGenerate ? (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Bump Strategy</InputLabel>
                <Select
                  value={bumpStrategy}
                  label="Bump Strategy"
                  onChange={(e) => {
                    const strategy = e.target.value as 'patch' | 'minor';
                    setBumpStrategy(strategy);
                    setNextAutoVersion(calculateNextVersion(strategy));
                  }}
                  disabled={isLoading}
                >
                  <MenuItem value="patch">
                    Patch version (bug fixes) - {calculateNextVersion('patch')}
                  </MenuItem>
                  <MenuItem value="minor">
                    Minor version (new features) - {calculateNextVersion('minor')}
                  </MenuItem>
                </Select>
              </FormControl>
              <Alert severity="info" sx={{ mb: 2 }}>
                Version <strong>{nextAutoVersion}</strong> will be created
                <div style={{ fontSize: '0.875rem', marginTop: '4px' }}>
                  {bumpStrategy === 'patch'
                    ? 'Patch bump: For bug fixes and small changes'
                    : 'Minor bump: For new features and functionality'}
                </div>
              </Alert>
            </>
          ) : (
            <TextField
              autoFocus={!autoGenerate}
              margin="dense"
              label="Version ID"
              type="text"
              fullWidth
              variant="outlined"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              disabled={isLoading}
              required
              helperText="Semantic version format (e.g., 1.0.0, 2.1.3)"
              sx={{ mb: 2 }}
            />
          )}
          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            variant="outlined"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            required
            helperText="Provide a brief description of this version"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Change Log"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={changeLog}
            onChange={(e) => setChangeLog(e.target.value)}
            disabled={isLoading}
            helperText="Document what's new or changed in this version"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreateSubmit} variant="contained" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Version'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Version Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => !isLoading && setShowEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Version</DialogTitle>
        <DialogContent>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}
          <TextField
            margin="dense"
            label="Version ID"
            type="text"
            fullWidth
            variant="outlined"
            value={versionId}
            disabled
            sx={{ mb: 2 }}
          />
          <TextField
            autoFocus
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            variant="outlined"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Change Log"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={changeLog}
            onChange={(e) => setChangeLog(e.target.value)}
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

      {/* OpenAPI Viewer Dialog */}
      <Dialog
        open={showOpenApiDialog}
        onClose={() => setShowOpenApiDialog(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            maxHeight: '80vh',
          }
        }}
      >
        <DialogTitle>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">OpenAPI 3.1.0 Specification</div>
              {viewingVersion && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {projects.find(p => p.id === viewingVersion.project_id)?.name} - v{viewingVersion.version_id}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                <button
                  onClick={() => setOpenApiFormat('json')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    openApiFormat === 'json'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  JSON
                </button>
                <button
                  onClick={() => setOpenApiFormat('yaml')}
                  className={`px-3 py-1 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    openApiFormat === 'yaml'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  YAML
                </button>
              </div>
            </div>
          </div>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {isLoadingSpec ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500 dark:text-gray-400">Loading specification...</div>
            </div>
          ) : (
            <div className="flex-1">
              <Editor
                height="100%"
                language={openApiFormat}
                value={(() => {
                  if (!openApiSpec) {
                    const emptySpec = {
                      openapi: '3.1.0',
                      info: {
                        title: 'No classes defined',
                        version: viewingVersion?.version_id || '1.0.0'
                      },
                      components: {
                        schemas: {}
                      }
                    };
                    return openApiFormat === 'json'
                      ? JSON.stringify(emptySpec, null, 2)
                      : yaml.dump(emptySpec, { lineWidth: -1, noRefs: true });
                  }

                  return openApiFormat === 'json'
                    ? openApiSpec
                    : yaml.dump(JSON.parse(openApiSpec), { lineWidth: -1, noRefs: true });
                })()}
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                  wrappingStrategy: 'advanced',
                }}
                theme="vs-dark"
              />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOpenApiDialog(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              const content = openApiFormat === 'json'
                ? openApiSpec
                : yaml.dump(JSON.parse(openApiSpec), { lineWidth: -1, noRefs: true });
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `openapi-${viewingVersion?.version_id}.${openApiFormat}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            variant="contained"
            disabled={isLoadingSpec}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version Comparison Dialog */}
      <Dialog
        open={showCompareDialog}
        onClose={() => setShowCompareDialog(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Compare Version Schemas</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                View differences between two version specifications
              </div>
            </div>
            {diffResult.length > 0 && (
              <div className="flex items-center gap-3">
                {/* View Mode Toggle */}
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                  <button
                    onClick={() => setDiffViewMode('overlay')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      diffViewMode === 'overlay'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                    title="Unified diff view"
                  >
                    Overlay
                  </button>
                  <button
                    onClick={() => setDiffViewMode('side-by-side')}
                    className={`px-3 py-1 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                      diffViewMode === 'side-by-side'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                    title="Split view comparison"
                  >
                    Side-by-Side
                  </button>
                </div>
                {/* Format Toggle */}
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                  <button
                    onClick={() => handleCompareFormatChange('json')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      compareFormat === 'json'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => handleCompareFormatChange('yaml')}
                    className={`px-3 py-1 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                      compareFormat === 'yaml'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    YAML
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogTitle>
        <DialogContent>
          {diffResult.length === 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormControl fullWidth>
                  <InputLabel>Version 1 (Base)</InputLabel>
                  <Select
                    value={compareVersion1Id}
                    label="Version 1 (Base)"
                    onChange={(e) => setCompareVersion1Id(e.target.value)}
                    disabled={isLoadingComparison}
                  >
                    <MenuItem value="">
                      <em>Select version...</em>
                    </MenuItem>
                    {versions.map((version) => (
                      <MenuItem key={version.id} value={version.id}>
                        {version.published ? '🔒 ' : ''}v{version.version_id} - {version.description || 'No description'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Version 2 (Compare To)</InputLabel>
                  <Select
                    value={compareVersion2Id}
                    label="Version 2 (Compare To)"
                    onChange={(e) => setCompareVersion2Id(e.target.value)}
                    disabled={isLoadingComparison}
                  >
                    <MenuItem value="">
                      <em>Select version...</em>
                    </MenuItem>
                    {versions.map((version) => (
                      <MenuItem key={version.id} value={version.id}>
                        {version.published ? '🔒 ' : ''}v{version.version_id} - {version.description || 'No description'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div className="flex justify-center py-8">
                <Button
                  onClick={handleCompareVersions}
                  variant="contained"
                  disabled={!compareVersion1Id || !compareVersion2Id || isLoadingComparison}
                  size="large"
                >
                  {isLoadingComparison ? 'Loading...' : 'Compare Versions'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-200 dark:bg-red-900 border border-red-400 dark:border-red-600"></div>
                    <span>Removed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-200 dark:bg-green-900 border border-green-400 dark:border-green-600"></div>
                    <span>Added</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600"></div>
                    <span>Unchanged</span>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  v{versions.find(v => v.id === compareVersion1Id)?.version_id} → v{versions.find(v => v.id === compareVersion2Id)?.version_id}
                </div>
              </div>

              {diffViewMode === 'overlay' ? (
                // Overlay View - Unified Diff
                <div className="border border-gray-300 dark:border-gray-600 rounded overflow-auto" style={{ height: 'calc(90vh - 250px)' }}>
                  <div className="font-mono text-xs">
                    {(() => {
                      let lineNumber = 0;
                      return diffResult.map((part, index) => {
                        const lines = part.value.split('\n').slice(0, -1);
                        return (
                          <div key={index}>
                            {lines.map((line, i) => {
                              if (!part.removed) lineNumber++;
                              return (
                                <div
                                  key={i}
                                  className={`flex ${
                                    part.added
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 border-l-4 border-green-500'
                                      : part.removed
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 border-l-4 border-red-500'
                                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r ${
                                    part.added 
                                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                                      : part.removed
                                      ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                                  }`}>
                                    {!part.removed ? lineNumber : ''}
                                  </div>
                                  <div className="flex-1 px-3 py-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {part.added && <span className="font-semibold mr-2">+</span>}
                                    {part.removed && <span className="font-semibold mr-2">-</span>}
                                    {!part.added && !part.removed && <span className="mr-3 opacity-0">·</span>}
                                    {line || '\u00A0'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                // Side-by-Side View
                <div className="border border-gray-300 dark:border-gray-600 rounded overflow-hidden" style={{ height: 'calc(90vh - 250px)' }}>
                  <div className="grid grid-cols-2 h-full">
                    {/* Left Side - Version 1 (Base) */}
                    <div
                      ref={leftPanelRef}
                      onScroll={handleLeftScroll}
                      className="border-r border-gray-300 dark:border-gray-600 overflow-auto"
                    >
                      <div className="sticky top-0 bg-blue-100 dark:bg-blue-900/30 px-3 py-2 text-xs font-semibold border-b border-gray-300 dark:border-gray-600 z-10">
                        v{versions.find(v => v.id === compareVersion1Id)?.version_id} (Base)
                      </div>
                      <div className="font-mono text-xs">
                        {(() => {
                          let lineNumber = 0;
                          return diffResult.map((part, index) => {
                            if (part.added) {
                              // Show empty placeholder for added lines (they don't exist in version 1)
                              return (
                                <div key={index}>
                                  {part.value.split('\n').slice(0, -1).map((_, i) => (
                                    <div
                                      key={i}
                                      className="flex bg-gray-50 dark:bg-gray-900/30 text-gray-400 dark:text-gray-600"
                                      style={{ minHeight: '1.5rem' }}
                                    >
                                      <div className="w-12 flex-shrink-0 text-right pr-2 select-none border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50">
                                        &nbsp;
                                      </div>
                                      <div className="flex-1 px-3 py-1">&nbsp;</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }

                            const lines = part.value.split('\n').slice(0, -1);
                            return (
                              <div key={index}>
                                {lines.map((line, i) => {
                                  lineNumber++;
                                  return (
                                    <div
                                      key={i}
                                      className={`flex ${
                                        part.removed
                                          ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200'
                                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r ${
                                        part.removed 
                                          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                                      }`}>
                                        {lineNumber}
                                      </div>
                                      <div className="flex-1 px-3 py-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {part.removed && <span className="font-semibold mr-2">-</span>}
                                        {!part.removed && <span className="mr-3 opacity-0">·</span>}
                                        {line || '\u00A0'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Right Side - Version 2 (Compare To) */}
                    <div
                      ref={rightPanelRef}
                      onScroll={handleRightScroll}
                      className="overflow-auto"
                    >
                      <div className="sticky top-0 bg-green-100 dark:bg-green-900/30 px-3 py-2 text-xs font-semibold border-b border-gray-300 dark:border-gray-600 z-10">
                        v{versions.find(v => v.id === compareVersion2Id)?.version_id} (Compare To)
                      </div>
                      <div className="font-mono text-xs">
                        {(() => {
                          let lineNumber = 0;
                          return diffResult.map((part, index) => {
                            if (part.removed) {
                              // Show empty placeholder for removed lines (they don't exist in version 2)
                              return (
                                <div key={index}>
                                  {part.value.split('\n').slice(0, -1).map((_, i) => (
                                    <div
                                      key={i}
                                      className="flex bg-gray-50 dark:bg-gray-900/30 text-gray-400 dark:text-gray-600"
                                      style={{ minHeight: '1.5rem' }}
                                    >
                                      <div className="w-12 flex-shrink-0 text-right pr-2 select-none border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50">
                                        &nbsp;
                                      </div>
                                      <div className="flex-1 px-3 py-1">&nbsp;</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }

                            const lines = part.value.split('\n').slice(0, -1);
                            return (
                              <div key={index}>
                                {lines.map((line, i) => {
                                  lineNumber++;
                                  return (
                                    <div
                                      key={i}
                                      className={`flex ${
                                        part.added
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200'
                                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r ${
                                        part.added 
                                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                                      }`}>
                                        {lineNumber}
                                      </div>
                                      <div className="flex-1 px-3 py-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {part.added && <span className="font-semibold mr-2">+</span>}
                                        {!part.added && <span className="mr-3 opacity-0">·</span>}
                                        {line || '\u00A0'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          {diffResult.length > 0 && (
            <Button
              onClick={() => {
                setDiffResult([]);
                setCompareSpec1('');
                setCompareSpec2('');
              }}
            >
              Compare Different Versions
            </Button>
          )}
          <Button onClick={() => setShowCompareDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Versions;
