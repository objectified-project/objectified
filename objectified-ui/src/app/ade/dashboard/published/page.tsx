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
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Lock className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                No Tenant Selected
              </h2>
              <p className="text-yellow-800 dark:text-yellow-200 mb-3">
                Please select a tenant before managing publications. Publications are associated with a specific tenant.
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
              open: 'Open URL',
              openSwagger: 'Open Swagger',
              copy: 'Copy URL',
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
              <span>Open URL</span>
            </div>
          </MenuItem>
          <MenuItem value="openSwagger">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Open Swagger</span>
            </div>
          </MenuItem>
          <MenuItem value="copy">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Copy URL</span>
            </div>
          </MenuItem>
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Published Versions
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          View all published and locked versions with their access URLs and visibility settings.
        </p>
      </div>

      {/* Search/Filter Field */}
      <div className="mb-4">
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
                  <Search className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </InputAdornment>
              ),
            },
          }}
          className="bg-white dark:bg-gray-800"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500 dark:text-gray-400">Loading published versions...</div>
        </div>
      ) : versions.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
          <Eye className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Published Versions
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have any published versions yet. Publish a version to make it available via API.
          </p>
        </div>
      ) : filteredVersions.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
          <Search className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Matching Versions
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No published versions match your search query. Try a different search term.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Project / Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Access URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Published
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">

                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredVersions.map((version) => (
                  <tr key={version.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {version.project_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <span className="font-mono">{version.version_id}</span>
                          <Lock className="h-3 w-3" />
                        </div>
                        {version.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs truncate">
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
                              className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 cursor-pointer hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
                              sx={{
                                border: (theme) =>
                                  theme.palette.mode === 'light'
                                    ? '1px solid rgb(22, 101, 52)'
                                    : 'none',
                              }}
                            />
                          ) : (
                            <Chip
                              icon={<Lock className="h-3 w-3" />}
                              label="Private"
                              size="small"
                              onClick={() => handleToggleVisibility(version)}
                              disabled={changingVisibility === version.id}
                              className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              sx={{
                                border: (theme) =>
                                  theme.palette.mode === 'light'
                                    ? '1px solid rgb(31, 41, 55)'
                                    : 'none',
                              }}
                            />
                          )}
                        </div>
                      </Tooltip>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 font-mono max-w-md truncate">
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

