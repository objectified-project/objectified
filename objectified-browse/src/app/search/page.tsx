import Link from "next/link";
import { searchPublicTenantsAndProjects } from "../../../lib/db/helper";
import { Search } from "../components/Search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q || '';
  const results = query ? await searchPublicTenantsAndProjects(query) : [];

  // Group results by tenant
  const groupedResults = results.reduce((acc: any, curr: any) => {
    const tenantKey = curr.tenant_slug;
    if (!acc[tenantKey]) {
      acc[tenantKey] = {
        tenant_id: curr.tenant_id,
        tenant_name: curr.tenant_name,
        tenant_slug: curr.tenant_slug,
        tenant_description: curr.tenant_description,
        projects: [],
      };
    }
    acc[tenantKey].projects.push({
      project_id: curr.project_id,
      project_name: curr.project_name,
      project_slug: curr.project_slug,
      project_description: curr.project_description,
      version_count: curr.version_count,
    });
    return acc;
  }, {});

  const tenants = Object.values(groupedResults);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="text-3xl font-bold text-zinc-900 hover:text-blue-600 dark:text-zinc-50 dark:hover:text-blue-400">
            Objectified Browse
          </Link>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Search results for &quot;{query}&quot;
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Search />

        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
            {tenants.length > 0 ? `Found ${tenants.length} organization(s)` : 'No results found'}
          </h2>

          {tenants.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-zinc-600 dark:text-zinc-400">
                No organizations or projects match your search.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ← Back to all organizations
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {tenants.map((tenant: any) => (
                <div
                  key={tenant.tenant_id}
                  className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <Link
                    href={`/tenant/${tenant.tenant_slug}`}
                    className="group inline-block"
                  >
                    <h3 className="text-xl font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                      {tenant.tenant_name}
                    </h3>
                  </Link>
                  {tenant.tenant_description && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {tenant.tenant_description}
                    </p>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tenant.projects.map((project: any) => (
                      <Link
                        key={project.project_id}
                        href={`/tenant/${tenant.tenant_slug}/${project.project_slug}`}
                        className="group rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
                      >
                        <h4 className="font-medium text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                          {project.project_name}
                        </h4>
                        {project.project_description && (
                          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                            {project.project_description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-zinc-500">
                          {project.version_count} version{project.version_count !== 1 ? 's' : ''}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

