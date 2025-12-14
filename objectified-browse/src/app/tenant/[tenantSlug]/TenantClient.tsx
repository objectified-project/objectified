'use client';

import { DataTable } from '../../components/DataTable';
import { Breadcrumb } from '../../components/Breadcrumb';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at?: string;
}

export function TenantClient({
  tenant,
  projects,
  tenantSlug
}: {
  tenant: Tenant;
  projects: Project[];
  tenantSlug: string;
}) {
  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb items={[{ label: tenant.name }]} />
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white text-2xl font-bold shadow-lg">
                {tenant.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {tenant.name}
                </h1>
                {tenant.description && (
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    {tenant.description}
                  </p>
                )}
                <p className="mt-1 text-sm text-zinc-500">/{tenant.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 px-4 py-2 dark:bg-blue-900/20">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{projects.length}</div>
                <div className="text-xs text-blue-600/70 dark:text-blue-400/70">Projects</div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Table */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Projects
          </h2>
        </div>

        <DataTable
          data={projects}
          keyField="id"
          getRowHref={(project) => `/tenant/${tenantSlug}/${project.slug}`}
          searchable={true}
          searchPlaceholder="Search projects..."
          searchFields={['name', 'slug', 'description']}
          emptyMessage="No projects with published versions available."
          columns={[
            {
              key: 'name',
              header: 'Project',
              sortable: true,
              render: (project) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                      {project.name}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      /{project.slug}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'description',
              header: 'Description',
              sortable: false,
              render: (project) => (
                <span className="text-zinc-600 dark:text-zinc-400 line-clamp-2">
                  {project.description || '—'}
                </span>
              ),
            },
            {
              key: 'created_at',
              header: 'Created',
              width: 'w-32',
              sortable: true,
              render: (project) => (
                <span className="text-zinc-500 dark:text-zinc-400">
                  {project.created_at ? new Date(project.created_at).toLocaleDateString() : '—'}
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
