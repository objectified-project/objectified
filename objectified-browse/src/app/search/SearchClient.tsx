'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../components/AppShell';
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

const SUGGESTED_QUERIES = ['payments', 'auth', 'users', 'webhooks', 'inventory'];

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || name[0]?.toUpperCase() || '?';
}

export function SearchClient({
  initialQuery,
  initialResults,
}: {
  initialQuery: string;
  initialResults: SearchResult[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const groupedResults = initialResults.reduce(
    (acc: Record<string, SearchResult[]>, curr) => {
      const key = curr.tenant_slug;
      if (!acc[key]) acc[key] = [];
      acc[key].push(curr);
      return acc;
    },
    {}
  );

  const tenantCount = Object.keys(groupedResults).length;
  const projectCount = initialResults.length;

  return (
    <AppShell containerSize="wide">
      <div className="space-y-6 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Search specifications
          </h1>
          <p className="text-[14px] text-zinc-600 dark:text-zinc-400">
            Search across every public organization, project, and description.
          </p>
        </header>

        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(sanitizeSearchInput(e.target.value))}
              pattern={SAFE_SEARCH_HTML_PATTERN}
              title="Only letters, numbers, spaces, dashes, and underscores are allowed"
              placeholder="Search by organization, project, or description..."
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-12 pr-4 text-[14px] text-zinc-900 placeholder-zinc-400 shadow-xs transition-colors focus-visible:border-[var(--brand)] focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-lg bg-[var(--brand)] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--brand-hover)]"
          >
            Search
          </button>
        </form>

        {!initialQuery && SUGGESTED_QUERIES.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-zinc-500 dark:text-zinc-400">Try:</span>
            {SUGGESTED_QUERIES.map((suggestion) => (
              <Link
                key={suggestion}
                href={`/search?q=${encodeURIComponent(suggestion)}`}
                className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 shadow-xs transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {suggestion}
              </Link>
            ))}
          </div>
        )}

        {initialQuery && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[13px] text-zinc-600 dark:text-zinc-400">
              {projectCount === 0 ? (
                <span>
                  No results for{' '}
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    &ldquo;{initialQuery}&rdquo;
                  </span>
                </span>
              ) : (
                <span>
                  Found <strong className="text-zinc-900 dark:text-zinc-50">{projectCount}</strong>{' '}
                  {projectCount === 1 ? 'project' : 'projects'} across{' '}
                  <strong className="text-zinc-900 dark:text-zinc-50">{tenantCount}</strong>{' '}
                  {tenantCount === 1 ? 'organization' : 'organizations'} for{' '}
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    &ldquo;{initialQuery}&rdquo;
                  </span>
                </span>
              )}
            </div>

            {projectCount > 0 ? (
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
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 text-[12px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-500/30 dark:text-indigo-300">
                          {monogram(result.tenant_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                            {result.tenant_name}
                          </div>
                          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
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
                        <div className="font-medium text-zinc-900 group-hover:text-[var(--brand)] dark:text-zinc-50">
                          {result.project_name}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          /{result.project_slug}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'description',
                    header: 'Description',
                    render: (result) => (
                      <span className="line-clamp-2 text-zinc-600 dark:text-zinc-400">
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
                      <span className="inline-flex items-center rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-soft-text)]">
                        {result.version_count}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    header: '',
                    width: 'w-12',
                    render: () => (
                      <svg
                        className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-[var(--brand)]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState
                title="No results"
                description={`We couldn't find any organizations or projects matching "${initialQuery}".`}
                icon="search"
              >
                <Link
                  href="/"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand-soft-text)] hover:text-[var(--brand-hover)]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Browse the directory
                </Link>
              </EmptyState>
            )}
          </div>
        )}

        {!initialQuery && (
          <EmptyState
            title="Discover public APIs"
            description="Enter a search term to find specifications across every published organization."
            icon="search"
          />
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: 'search';
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white/40 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {icon === 'search' && (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>
      <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-zinc-600 dark:text-zinc-400">{description}</p>
      {children}
    </div>
  );
}
