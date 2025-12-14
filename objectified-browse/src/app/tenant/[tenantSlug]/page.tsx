import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenantBySlug, getPublicProjectsForTenant } from "../../../../lib/db/helper";

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getPublicTenantBySlug(tenantSlug);

  if (!tenant) {
    notFound();
  }

  const projects = await getPublicProjectsForTenant(tenantSlug);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
            ← Back to all organizations
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {tenant.name}
          </h1>
          {tenant.description && (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {tenant.description}
            </p>
          )}
          <p className="mt-1 text-sm text-zinc-500">/{tenant.slug}</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
            Projects ({projects.length})
          </h2>

          {projects.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-zinc-600 dark:text-zinc-400">
                No published projects available yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project: any) => (
                <Link
                  key={project.id}
                  href={`/tenant/${tenantSlug}/${project.slug}`}
                  className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
                >
                  <h3 className="text-xl font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
                      {project.description}
                    </p>
                  )}
                  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                    /{project.slug}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

