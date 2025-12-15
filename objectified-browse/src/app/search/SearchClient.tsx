'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { DataTable } from '../components/DataTable';
import { sanitizeSearchInput, SAFE_SEARCH_HTML_PATTERN } from '../utils/searchValidation';

interface SearchResult {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_description?: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  project_description?: string;
  version_count: number;
}

export function SearchClient({
  initialQuery,
  initialResults,
}: {
  initialQuery: string;
  initialResults: SearchResult[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Group results by tenant
  const groupedResults = initialResults.reduce((acc: Record<string, SearchResult[]>, curr) => {
    const key = curr.tenant_slug;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(curr);
    return acc;
  }, {});

  const tenantCount = Object.keys(groupedResults).length;
  const projectCount = initialResults.length;

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Search APIs
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Search across all organizations and projects
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(sanitizeSearchInput(e.target.value))}
                pattern={SAFE_SEARCH_HTML_PATTERN}
                title="Only letters, numbers, spaces, dashes, and underscores are allowed"
                placeholder="Search by organization name, project name, or description..."
                className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-12 pr-4 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              Search
            </button>
          </div>
        </form>

        {/* Results */}
        {initialQuery && (
          <div className="space-y-6">
            {/* Results Summary */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {projectCount === 0 ? (
                  <span>No results found for "{initialQuery}"</span>
                ) : (
                  <span>
                    Found <strong>{projectCount}</strong> {projectCount === 1 ? 'project' : 'projects'} in{' '}
                    <strong>{tenantCount}</strong> {tenantCount === 1 ? 'organization' : 'organizations'} for "{initialQuery}"
                  </span>
                )}
              </div>
            </div>

            {/* Results Table */}
            {projectCount > 0 && (
              <DataTable
                data={initialResults}
                keyField="project_id"
                getRowHref={(result) => `/tenant/${result.tenant_slug}/${result.project_slug}`}
                emptyMessage="No results found"
                columns={[
                  {
                    key: 'organization',
                    header: 'Organization',
                    sortable: true,
                    render: (result) => (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-sm">
                          {result.tenant_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-50">
                            {result.tenant_name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            /{result.tenant_slug}
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'project',
                    header: 'Project',
                    sortable: true,
                    render: (result) => (
                      <div>
                        <div className="font-medium text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                          {result.project_name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          /{result.project_slug}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'description',
                    header: 'Description',
                    render: (result) => (
                      <span className="text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {result.project_description || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'version_count',
                    header: 'Versions',
                    width: 'w-24',
                    sortable: true,
                    render: (result) => (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {result.version_count} {result.version_count === 1 ? 'version' : 'versions'}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    header: '',
                    width: 'w-12',
                    render: () => (
                      <svg className="h-5 w-5 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    ),
                  },
                ]}
              />
            )}

            {/* No Results */}
            {projectCount === 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
                <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">No results found</h3>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                  Try adjusting your search terms or browse all organizations.
                </p>
                <Link
                  href="/"
                  className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Browse all organizations
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Empty State (No Query) */}
        {!initialQuery && (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Search for APIs</h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Enter a search term above to find organizations and projects.
            </p>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Quick Links</h3>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              All Organizations
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

