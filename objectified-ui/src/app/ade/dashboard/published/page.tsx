'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Eye, Lock, Globe, Copy, ExternalLink, Search, FileText } from 'lucide-react';
import { getPublishedVersionsForTenant, updateVersionVisibility } from '../../../../../lib/db/helper';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { useDialog } from '../../../components/providers/DialogProvider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Divider from '@mui/material/Divider';

interface PublishedVersion {
  id: string;
  version_id: string;
  description: string | null;
  visibility: 'public' | 'private';
  published_at: string;
  created_at: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  creator_name: string;
  creator_email: string;
}

const PublishedVersions = () => {
  const { data: session } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [versions, setVersions] = useState<PublishedVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [changingVisibility, setChangingVisibility] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const currentTenantId = (session?.user as any)?.current_tenant_id;

  useEffect(() => {
    loadPublishedVersions();
  }, [currentTenantId]);

  const loadPublishedVersions = async () => {
    if (!currentTenantId) {
      setVersions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await getPublishedVersionsForTenant(currentTenantId);
      const data = JSON.parse(result);
      setVersions(data);
    } catch (error) {
      console.error('Failed to load published versions:', error);
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getAccessUrl = (version: PublishedVersion): string => {
    // Construct URL in the format: tenant-slug/project-slug/version-id
    return `${version.tenant_slug}/${version.project_slug}/${version.version_id}`;
  };

  const getFullAccessUrl = (version: PublishedVersion): string => {
    // Use REST_API_BASE_URL from environment, fallback to localhost
    const restApiBaseUrl = process.env.NEXT_PUBLIC_REST_API_BASE_URL || 'http://localhost:8000/v1';
    return `${restApiBaseUrl}/schema/${getAccessUrl(version)}`;
  };

  const getSwaggerUrl = (version: PublishedVersion): string => {
    // Construct Swagger UI URL
    const restApiBaseUrl = process.env.NEXT_PUBLIC_REST_API_BASE_URL || 'http://localhost:8000/v1';
    return `${restApiBaseUrl}/swagger/${getAccessUrl(version)}`;
  };

  const getArazzoUrl = (version: PublishedVersion): string => {
    // Construct Arazzo workflow URL
    const restApiBaseUrl = process.env.NEXT_PUBLIC_REST_API_BASE_URL || 'http://localhost:8000/v1';
    return `${restApiBaseUrl}/arazzo/${getAccessUrl(version)}`;
  };

  const getJsonUrl = (version: PublishedVersion): string => {
    // Construct Arazzo workflow URL
    const restApiBaseUrl = process.env.NEXT_PUBLIC_REST_API_BASE_URL || 'http://localhost:8000/v1';
    return `${restApiBaseUrl}/json/${getAccessUrl(version)}`;
  };

  const handleCopyUrl = async (version: PublishedVersion) => {
    const fullUrl = getFullAccessUrl(version);
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(version.id);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleOpenUrl = (version: PublishedVersion) => {
    const fullUrl = getFullAccessUrl(version);
    window.open(fullUrl, '_blank');
  };

  const handleOpenSwagger = (version: PublishedVersion) => {
    const swaggerUrl = getSwaggerUrl(version);
    window.open(swaggerUrl, '_blank');
  };

  const handleOpenArazzo = (version: PublishedVersion) => {
    const arazzoUrl = getArazzoUrl(version);
    window.open(arazzoUrl, '_blank');
  };

  const handleOpenJson = (version: PublishedVersion) => {
    const url = getJsonUrl(version);
    window.open(url, '_blank');
  };

  const handleToggleVisibility = async (version: PublishedVersion) => {
    const newVisibility = version.visibility === 'public' ? 'private' : 'public';

    // Show confirmation dialog with appropriate message
    const confirmMessage = newVisibility === 'public'
      ? `Change visibility to PUBLIC?\n\nThis will result in making the OpenAPI Specification public without requiring access via an API Key.`
      : `Change visibility to PRIVATE?\n\nThis will result in restricting access to the specification by requiring an API Key that matches your tenancy.`;

    const confirmed = await confirmDialog({
      title: `Change Visibility to ${newVisibility.toUpperCase()}`,
      message: confirmMessage,
      variant: 'warning',
      confirmLabel: 'Change Visibility',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) {
      return; // User cancelled
    }

    try {
      setChangingVisibility(version.id);
      const result = await updateVersionVisibility(version.id, newVisibility);
      const response = JSON.parse(result);

      if (response.success) {
        // Update local state
        setVersions(versions.map(v =>
          v.id === version.id
            ? { ...v, visibility: newVisibility }
            : v
        ));
      } else {
        await alertDialog({
          message: `Failed to update visibility: ${response.error}`,
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Failed to update visibility:', error);
      await alertDialog({
        message: 'An error occurred while updating visibility',
        variant: 'error',
      });
    } finally {
      setChangingVisibility(null);
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

  // Filter versions based on search query
  const filteredVersions = versions.filter(version => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      version.project_name.toLowerCase().includes(query) ||
      version.version_id.toLowerCase().includes(query) ||
      version.description?.toLowerCase().includes(query) ||
      version.tenant_name.toLowerCase().includes(query)
    );
  });

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
                  Please select a tenant before managing publications. Publications are associated with a specific tenant.
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

  // Row actions dropdown component for each published version
  const RowActions = ({ version }: { version: PublishedVersion }) => {
    const [action, setAction] = useState<string>('');

    const handleChange = async (value: string) => {
      try {
        switch (value) {
          case 'open':
            handleOpenUrl(version);
            break;
          case 'openSwagger':
            handleOpenSwagger(version);
            break;
          case 'openArazzo':
            handleOpenArazzo(version);
            break;
          case 'openJson':
            handleOpenJson(version);
            break;
          case 'copy':
            await handleCopyUrl(version);
            break;
          case 'toggleVisibility':
            await handleToggleVisibility(version);
            break;
        }
      } finally {
        setAction('');
      }
    };

    const toggleLabel = version.visibility === 'public' ? 'Make Private' : 'Make Public';

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
              open: 'View OpenAPI (JSON)',
              openArazzo: 'View Arazzo (JSON)',
              openJson: 'View JSON Schema',
              openSwagger: 'Open Swagger UI',
              copy: 'Copy OpenAPI URL',
              toggleVisibility: toggleLabel,
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
          <MenuItem value="open">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>View OpenAPI (JSON)</span>
            </div>
          </MenuItem>
          <MenuItem value="openArazzo">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span>View Arazzo (JSON)</span>
            </div>
          </MenuItem>
          <MenuItem value="openJson">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span>View JSON Schema</span>
            </div>
          </MenuItem>
          <Divider/>
          <MenuItem value="openSwagger">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Open Swagger UI</span>
            </div>
          </MenuItem>
          <MenuItem value="copy">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Copy OpenAPI URL</span>
            </div>
          </MenuItem>
          <Divider/>
          <MenuItem value="toggleVisibility">
            <div className="flex items-center gap-2">
              {version.visibility === 'public' ? (
                <Lock className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              ) : (
                <Globe className="h-4 w-4 text-green-600 dark:text-green-400" />
              )}
              <span>{toggleLabel}</span>
            </div>
          </MenuItem>
        </Select>
      </FormControl>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Eye className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Published Versions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            View all published and locked versions with their access URLs and visibility settings.
          </p>
        </div>
      </div>

      {/* Search/Filter Field */}
      <div className="mb-6">
        <TextField
          fullWidth
          size="small"
          placeholder="Search by project name, version, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="h-4 w-4 text-gray-400" />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backgroundColor: 'white',
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(99, 102, 241, 0.5)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#6366f1',
              },
            },
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-gray-500 dark:text-gray-400">Loading published versions...</div>
          </div>
        </div>
      ) : versions.length === 0 ? (
        <div className="relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full blur-3xl opacity-60" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-full blur-3xl opacity-60" />

          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-16 text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Eye className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              No Published Versions
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              You don&apos;t have any published versions yet. Publish a version to make it available via API.
            </p>
          </div>
        </div>
      ) : filteredVersions.length === 0 ? (
        <div className="relative">
          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-16 text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center shadow-lg shadow-gray-500/30">
              <Search className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              No Matching Versions
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              No published versions match your search query. Try a different search term.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Project / Version
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Access URL
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Published
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">

                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {filteredVersions.map((version) => (
                  <tr key={version.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {version.project_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">v{version.version_id}</span>
                          <div className="p-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                            <Lock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                        {version.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs truncate">
                            {version.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Tooltip title={`Click to change to ${version.visibility === 'public' ? 'private' : 'public'}`}>
                        <div className="inline-block">
                          {version.visibility === 'public' ? (
                            <Chip
                              icon={<Globe className="h-3 w-3" />}
                              label="Public"
                              size="small"
                              onClick={() => handleToggleVisibility(version)}
                              disabled={changingVisibility === version.id}
                              sx={{
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                },
                                '& .MuiChip-icon': {
                                  color: '#10b981',
                                },
                              }}
                            />
                          ) : (
                            <Chip
                              icon={<Lock className="h-3 w-3" />}
                              label="Private"
                              size="small"
                              onClick={() => handleToggleVisibility(version)}
                              disabled={changingVisibility === version.id}
                              sx={{
                                backgroundColor: 'rgba(100, 116, 139, 0.1)',
                                color: '#475569',
                                border: '1px solid rgba(100, 116, 139, 0.3)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'rgba(100, 116, 139, 0.2)',
                                },
                                '& .MuiChip-icon': {
                                  color: '#64748b',
                                },
                              }}
                            />
                          )}
                        </div>
                      </Tooltip>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-mono max-w-md truncate">
                          schema/{getAccessUrl(version)}
                        </code>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(version.published_at)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        by {version.creator_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end">
                        <RowActions version={version} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {versions.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredVersions.length} of {versions.length} published {versions.length === 1 ? 'version' : 'versions'}
          {searchQuery && filteredVersions.length < versions.length && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              (filtered by search)
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PublishedVersions;

