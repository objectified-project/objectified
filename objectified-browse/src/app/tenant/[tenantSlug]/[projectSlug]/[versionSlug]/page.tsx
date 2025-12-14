import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicVersionDetails } from "../../../../../../lib/db/helper";
import { SpecViewer } from "../../../../components/SpecViewer";

export default async function VersionPage({
  params,
}: {
  params: { tenantSlug: string; projectSlug: string; versionSlug: string };
}) {
  const version = await getPublicVersionDetails(
    params.tenantSlug,
    params.projectSlug,
    params.versionSlug
  );

  if (!version) {
    notFound();
  }

  const restApiBaseUrl = process.env.NEXT_PUBLIC_REST_API_BASE_URL || 'http://localhost:8000/v1';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
              Organizations
            </Link>
            <span>/</span>
            <Link href={`/tenant/${params.tenantSlug}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {version.tenant_name}
            </Link>
            <span>/</span>
            <Link href={`/tenant/${params.tenantSlug}/${params.projectSlug}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {version.project_name}
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Version {version.version_id}
          </h1>
          {version.description && (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {version.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-4">
            <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Published
            </span>
            {version.published_at && (
              <span className="text-sm text-zinc-500">
                {new Date(version.published_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {version.change_log && (
          <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Changelog
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {version.change_log}
            </p>
          </div>
        )}

        <SpecViewer
          tenantSlug={params.tenantSlug}
          projectSlug={params.projectSlug}
          versionSlug={params.versionSlug}
          restApiBaseUrl={restApiBaseUrl}
        />
      </main>
    </div>
  );
}

