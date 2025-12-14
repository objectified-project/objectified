import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProjectBySlug, getPublicVersionsForProject } from "../../../../../../lib/db/helper";
import { CompareViewer } from "../../../../components/CompareViewer";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; projectSlug: string }>;
  searchParams: Promise<{ v1?: string; v2?: string }>;
}) {
  const { tenantSlug, projectSlug } = await params;
  const { v1, v2 } = await searchParams;
  const project = await getPublicProjectBySlug(tenantSlug, projectSlug);

  if (!project) {
    notFound();
  }

  const versions = await getPublicVersionsForProject(tenantSlug, projectSlug);

  if (versions.length < 2) {
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
              <span>/</span>
              <Link href={`/tenant/${tenantSlug}/${projectSlug}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                {project.name}
              </Link>
            </div>
            <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Compare Versions
            </h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-zinc-600 dark:text-zinc-400">
              At least two versions are required to compare.
            </p>
            <Link
              href={`/tenant/${tenantSlug}/${projectSlug}`}
              className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to project
            </Link>
          </div>
        </main>
      </div>
    );
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
            <Link href={`/tenant/${tenantSlug}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {project.tenant_name}
            </Link>
            <span>/</span>
            <Link href={`/tenant/${tenantSlug}/${projectSlug}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {project.name}
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Compare Versions
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <CompareViewer
          tenantSlug={tenantSlug}
          projectSlug={projectSlug}
          versions={versions}
          restApiBaseUrl={restApiBaseUrl}
          initialV1={v1}
          initialV2={v2}
        />
      </main>
    </div>
  );
}

