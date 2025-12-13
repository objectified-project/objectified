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
import { useDialog } from '../../../components/providers/DialogProvider';
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
import YAML from 'yaml';
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
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
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
          await alertDialog({
            message: `Version created successfully! Copied ${response.copiedClasses} class(es) from source version.`,
            variant: 'success',
          });
        } else if (response.copyWarning) {
          await alertDialog({
            message: `Version created successfully, but encountered an issue copying classes: ${response.copyWarning}`,
            variant: 'warning',
          });
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
      await alertDialog({
        message: 'Version not found',
        variant: 'error',
      });
      return;
    }
    if (ver.creator_id !== currentUserId && !effectiveIsAdmin) {
      await alertDialog({
        message: 'Only the version owner or a tenant administrator can publish this version',
        variant: 'warning',
      });
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Publish Version',
      message: 'Are you sure you want to publish this version?\n\nOnce published, it cannot be edited (but can be unpublished or deleted).',
      variant: 'info',
      confirmLabel: 'Publish',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await publishVersion(versionRecordId, currentUserId);
      const response = JSON.parse(result);

      if (response.success) {
        await loadVersions();
      } else {
        await alertDialog({
          message: response.error || 'Failed to publish version',
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

  const handleUnpublish = async (versionRecordId: string) => {
    const ver = versions.find(v => v.id === versionRecordId);
    if (!ver) {
      await alertDialog({
        message: 'Version not found',
        variant: 'error',
      });
      return;
    }
    if (ver.creator_id !== currentUserId && !effectiveIsAdmin) {
      await alertDialog({
        message: 'Only the version owner or a tenant administrator can unpublish this version',
        variant: 'warning',
      });
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Unpublish Version',
      message: `Are you sure you want to unpublish this version?\n\nPlease note, it's best practice to keep it published to avoid breaking any integrations depending on it. If you really wish to unpublish, we recommend creating a new version to replace it, but we provide this ability if absolutely necessary.`,
      variant: 'danger',
      confirmLabel: 'Unpublish',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await unpublishVersion(versionRecordId, currentUserId);
      const response = JSON.parse(result);

      if (response.success) {
        await loadVersions();
      } else {
        await alertDialog({
          message: response.error || 'Failed to unpublish version',
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

  const handleDelete = async (versionRecordId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Version',
      message: 'Are you sure you want to delete this version? This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteVersion(versionRecordId);
      const response = JSON.parse(result);

      if (response.success) {
        await loadVersions();
      } else {
        await alertDialog({
          message: response.error || 'Failed to delete version',
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
      const spec = await generateOpenApiSpec(classesWithProperties, {
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
      await alertDialog({
        message: 'Please select two versions to compare',
        variant: 'warning',
      });
      return;
    }

    if (compareVersion1Id === compareVersion2Id) {
      await alertDialog({
        message: 'Please select two different versions to compare',
        variant: 'warning',
      });
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
      const content1 = compareFormat === 'json' ? spec1 : YAML.stringify(JSON.parse(spec1));
      const content2 = compareFormat === 'json' ? spec2 : YAML.stringify(JSON.parse(spec2));

      const diff = diffLines(content1, content2);
      setDiffResult(diff);
    } catch (error) {
      console.error('Failed to compare versions:', error);
      await alertDialog({
        message: 'Failed to load version specifications for comparison',
        variant: 'error',
      });
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
      const content1 = newFormat === 'json' ? compareSpec1 : YAML.stringify(JSON.parse(compareSpec1));
      const content2 = newFormat === 'json' ? compareSpec2 : YAML.stringify(JSON.parse(compareSpec2));

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
      <div className="p-6 max-w-5xl mx-auto">
        <div className="relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-full blur-3xl opacity-60" />

          <div className="relative bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">
                  No Tenant Selected
                </h2>
                <p className="text-amber-800 dark:text-amber-200 mb-4">
                  Please select a tenant before managing versions. Versions are associated with projects within a tenant.
                </p>
                <a
                  href="/ade/dashboard/tenants"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                >
                  Go to Tenants
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-full blur-3xl opacity-60" />

          <div className="relative bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">
                  No Projects Available
                </h2>
                <p className="text-amber-800 dark:text-amber-200 mb-4">
                  Please create a project before managing versions. Versions belong to specific projects.
                </p>
                <a
                  href="/ade/dashboard/projects"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                >
                  Go to Projects
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper to determine permissions
  const canModify = (version: Version) => version.creator_id === currentUserId || !!effectiveIsAdmin;

  // Row actions dropdown component
  const RowActions = ({ version }: { version: Version }) => {
    const [action, setAction] = useState<string>('');
    const isPublished = !!version.published;
    const canPublish = !isPublished && canModify(version);
    const canUnpublish = isPublished && canModify(version);
    const canEdit = !isPublished; // match previous behavior (editing a published version not allowed)

    const handleChange = async (value: string) => {
      try {
        switch (value) {
          case 'view':
            await handleViewOpenApi(version);
            break;
          case 'edit':
            if (!canEdit) {
              setErrorMessage('Cannot edit published version');
              break;
            }
            handleEditClick(version);
            break;
          case 'publish':
            if (canPublish) {
              await handlePublish(version.id);
            } else {
              await alertDialog({
                message: 'Only the version owner or a tenant administrator can publish this version',
                variant: 'warning',
              });
            }
            break;
          case 'unpublish':
            if (canUnpublish) {
              await handleUnpublish(version.id);
            } else {
              await alertDialog({
                message: 'Only the version owner or a tenant administrator can unpublish this version',
                variant: 'warning',
              });
            }
            break;
          case 'delete':
            await handleDelete(version.id);
            break;
        }
      } finally {
        // reset selection back to placeholder
        setAction('');
      }
    };

    return (
      <FormControl
        size="small"
        sx={{
          minWidth: 160,
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
              view: 'View Spec',
              edit: 'Edit',
              publish: 'Publish',
              unpublish: 'Unpublish',
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
          <MenuItem value="view">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>View Spec</span>
            </div>
          </MenuItem>
          <MenuItem value="edit" disabled={!canEdit}>
            <div className="flex items-center gap-2">
              <Edit2 className={`h-4 w-4 ${canEdit ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
              <span>Edit</span>
            </div>
          </MenuItem>
          {!isPublished ? (
            <MenuItem value="publish" disabled={!canPublish}>
              <div className="flex items-center gap-2">
                <Lock className={`h-4 w-4 ${canPublish ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                <span>Publish</span>
              </div>
            </MenuItem>
          ) : (
            <MenuItem value="unpublish" disabled={!canUnpublish}>
              <div className="flex items-center gap-2">
                <Unlock className={`h-4 w-4 ${canUnpublish ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`} />
                <span>Unpublish</span>
              </div>
            </MenuItem>
          )}
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Package className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Versions</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage versions with semantic versioning
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <FormControl
            size="small"
            sx={{
              minWidth: 220,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                color: 'var(--foreground)',
                backgroundColor: 'var(--background)',
                '& fieldset': {
                  borderColor: 'rgba(128, 128, 128, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(16, 185, 129, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#10b981',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'var(--foreground)',
                '&.Mui-focused': {
                  color: '#10b981',
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
                    borderRadius: 2,
                    '& .MuiMenuItem-root': {
                      '&:hover': {
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        '&:hover': {
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-2.5 px-5 rounded-xl cursor-pointer transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:shadow-none disabled:cursor-not-allowed"
            title={versions.length < 2 ? 'Need at least 2 versions to compare' : 'Compare two versions'}
          >
            <Copy className="h-5 w-5" />
            Compare
          </button>
          <button
            onClick={handleCreateClick}
            disabled={!selectedProjectId}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-2.5 px-5 rounded-xl cursor-pointer transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:shadow-none disabled:cursor-not-allowed"
          >
            <Plus className="h-5 w-5" />
            New Version
          </button>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-full blur-3xl opacity-60" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-full blur-3xl opacity-60" />

          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-16 text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Package className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              No Versions Yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Get started by creating your first version using the &quot;New Version&quot; button above
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-gray-800">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Version
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created By
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">

                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {versions.map((version) => (
                <tr key={version.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                        v{version.version_id}
                      </div>
                      {version.published && (
                        <div title="Published (Frozen)" className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                          <Lock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="h-3 w-3" />
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                          Draft
                        </span>
                      )}
                      {!version.enabled && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200">
                          Disabled
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {version.creator_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {version.creator_email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(version.created_at)}
                    {version.published_at && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Published: {formatDate(version.published_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end">
                      <RowActions version={version} />
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
                        version: '1.0.0'
                      },
                      components: {
                        schemas: {}
                      }
                    };
                    return openApiFormat === 'json'
                      ? JSON.stringify(emptySpec, null, 2)
                      : YAML.stringify(emptySpec);
                  }

                  return openApiFormat === 'json'
                    ? openApiSpec
                    : YAML.stringify(JSON.parse(openApiSpec));
                })()}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: 'on',
                  renderWhitespace: 'selection',
                  automaticLayout: true,
                  wordWrap: 'on',
                  folding: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  contextmenu: true,
                  selectOnLineNumbers: true,
                }}
              />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOpenApiDialog(false)}>
            Close
          </Button>
          <Button
            onClick={async () => {
              const content = openApiFormat === 'json'
                ? openApiSpec
                : YAML.stringify(JSON.parse(openApiSpec));
              navigator.clipboard.writeText(content);
              await alertDialog({
                message: `OpenAPI specification (${openApiFormat.toUpperCase()}) copied to clipboard!`,
                variant: 'success',
              });
            }}
            variant="contained"
            disabled={isLoadingSpec}
          >
            Copy to Clipboard
          </Button>
          <Button
            onClick={() => {
              const content = openApiFormat === 'json'
                ? openApiSpec
                : YAML.stringify(JSON.parse(openApiSpec));
              const mimeType = openApiFormat === 'json' ? 'application/json' : 'text/yaml';
              const extension = openApiFormat === 'json' ? 'json' : 'yaml';

              // Create a blob from the OpenAPI spec
              const blob = new Blob([content], { type: mimeType });
              const url = URL.createObjectURL(blob);

              // Create a temporary download link
              const link = document.createElement('a');
              link.href = url;

              // Generate filename from project and version
              const projectForViewing = viewingVersion ? projects.find(p => p.id === viewingVersion.project_id) : null;
              const projectSlug = projectForViewing?.slug || projectForViewing?.name?.toLowerCase().replace(/\s+/g, '-') || 'api';
              const versionSlug = viewingVersion?.version_id?.replace(/\./g, '-') || '1-0-0';
              link.download = `${projectSlug}-${versionSlug}-openapi.${extension}`;

              // Trigger download
              document.body.appendChild(link);
              link.click();

              // Cleanup
              document.body.removeChild(link);
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
