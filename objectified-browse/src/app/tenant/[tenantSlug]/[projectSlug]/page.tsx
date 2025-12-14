import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProjectBySlug, getPublicVersionsForProject } from "../../../../../lib/db/helper";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectSlug: string }>;
}) {
  const { tenantSlug, projectSlug } = await params;
  const project = await getPublicProjectBySlug(tenantSlug, projectSlug);

  if (!project) {
    notFound();
  }

  const versions = await getPublicVersionsForProject(tenantSlug, projectSlug);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
              Organizations
            </Link>
            <span>/</span>
            <Link href={`/tenant/${tenantSlug}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {project.tenant_name}
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {project.description}
            </p>
          )}
          <p className="mt-1 text-sm text-zinc-500">/{project.slug}</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Versions ({versions.length})
          </h2>
          {versions.length > 1 && (
            <Link
              href={`/tenant/${tenantSlug}/${projectSlug}/compare`}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Compare versions →
            </Link>
          )}
        </div>

        {versions.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-zinc-600 dark:text-zinc-400">
              No published versions available yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((version: any) => (
              <Link
                key={version.id}
                href={`/tenant/${tenantSlug}/${projectSlug}/${version.version_id}`}
                className="group block rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                      Version {version.version_id}
                    </h3>
                    {version.description && (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {version.description}
                      </p>
                    )}
                    {version.change_log && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
                          Changelog
                        </summary>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                          {version.change_log}
                        </p>
                      </details>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Published
                    </span>
                    {version.published_at && (
                      <p className="mt-2 text-xs text-zinc-500">
                        {new Date(version.published_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

