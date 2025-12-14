'use client';

import Link from 'next/link';
import { DataTable } from '../../../components/DataTable';
import { Breadcrumb } from '../../../components/Breadcrumb';

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  tenant_name?: string;
}

interface Version {
  id: string;
  version_id: string;
  description?: string;
  change_log?: string;
  published: boolean;
  published_at?: string;
  created_at?: string;
}

export function ProjectClient({
  project,
  versions,
  tenantSlug,
  projectSlug
}: {
  project: Project;
  versions: Version[];
  tenantSlug: string;
  projectSlug: string;
}) {
  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb items={[
            { label: project.tenant_name || tenantSlug, href: `/tenant/${tenantSlug}` },
            { label: project.name },
          ]} />
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    {project.description}
                  </p>
                )}
                <p className="mt-1 text-sm text-zinc-500">/{project.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {versions.length > 1 && (
                <Link
                  href={`/tenant/${tenantSlug}/${projectSlug}/compare`}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Compare Versions
                </Link>
              )}
              <div className="rounded-lg bg-green-50 px-4 py-2 dark:bg-green-900/20">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{versions.length}</div>
                <div className="text-xs text-green-600/70 dark:text-green-400/70">Versions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Versions Table */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Published Versions
          </h2>
        </div>

        <DataTable
          data={versions}
          keyField="id"
          getRowHref={(version) => `/tenant/${tenantSlug}/${projectSlug}/${version.version_id}`}
          searchable={versions.length > 5}
          searchPlaceholder="Search versions..."
          searchFields={['version_id', 'description', 'change_log']}
          emptyMessage="No published versions available."
          columns={[
            {
              key: 'version_id',
              header: 'Version',
              width: 'w-32',
              sortable: true,
              render: (version) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 text-white text-xs font-bold">
                    v
                  </div>
                  <span className="font-mono font-medium text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                    {version.version_id}
                  </span>
                </div>
              ),
            },
            {
              key: 'description',
              header: 'Description',
              sortable: false,
              render: (version) => (
                <span className="text-zinc-600 dark:text-zinc-400 line-clamp-2">
                  {version.description || '—'}
                </span>
              ),
            },
            {
              key: 'published',
              header: 'Status',
              width: 'w-28',
              render: () => (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                  Published
                </span>
              ),
            },
            {
              key: 'published_at',
              header: 'Published',
              width: 'w-32',
              sortable: true,
              render: (version) => (
                <span className="text-zinc-500 dark:text-zinc-400">
                  {version.published_at ? new Date(version.published_at).toLocaleDateString() : '—'}
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
      </div>
    </div>
  );
}
