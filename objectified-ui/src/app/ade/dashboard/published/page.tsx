'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Eye, Lock, Globe, Copy, ExternalLink, Info, Search } from 'lucide-react';
import { getPublishedVersionsForTenant, updateVersionVisibility } from '../../../../../lib/db/helper';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

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
    // Get the current origin (protocol + host)
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/${getAccessUrl(version)}`;
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

  const handleToggleVisibility = async (version: PublishedVersion) => {
    const newVisibility = version.visibility === 'public' ? 'private' : 'public';

    // Show confirmation dialog with appropriate message
    const confirmMessage = newVisibility === 'public'
      ? `Change visibility to PUBLIC?\n\nThis will result in making the OpenAPI Specification public without requiring access via an API Key.`
      : `Change visibility to PRIVATE?\n\nThis will result in restricting access to the specification by requiring an API Key that matches your tenancy.`;

    if (!confirm(confirmMessage)) {
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
        alert(`Failed to update visibility: ${response.error}`);
      }
    } catch (error) {
      console.error('Failed to update visibility:', error);
      alert('An error occurred while updating visibility');
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Published Versions
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          View all published and locked versions with their access URLs and visibility settings.
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-900 dark:text-blue-100 font-medium mb-1">
                Visibility Settings
              </p>
              <p className="text-blue-800 dark:text-blue-200">
                <span className="font-semibold">Public versions</span> are globally visible and can be accessed without authentication.
                <span className="font-semibold ml-2">Private versions</span> require an API Key to view.
              </p>
            </div>
          </div>
        </div>
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
        <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <Eye className="h-16 w-16 text-gray-400 dark:text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Published Versions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
            You don't have any published versions yet. Publish a version to make it available via API.
          </p>
        </div>
      ) : filteredVersions.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <Search className="h-16 w-16 text-gray-400 dark:text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Matching Versions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
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
                    Actions
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
                            />
                          ) : (
                            <Chip
                              icon={<Lock className="h-3 w-3" />}
                              label="Private"
                              size="small"
                              onClick={() => handleToggleVisibility(version)}
                              disabled={changingVisibility === version.id}
                              className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            />
                          )}
                        </div>
                      </Tooltip>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 font-mono max-w-md truncate">
                          {getAccessUrl(version)}
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
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip title={copiedUrl === version.id ? 'Copied!' : 'Copy full URL'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyUrl(version)}
                            className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <Copy className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Open in new tab">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenUrl(version)}
                            className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
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

