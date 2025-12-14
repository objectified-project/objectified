import Link from "next/link";
import { getPublicTenants } from "../../lib/db/helper";
import { Search } from "./components/Search";

export default async function Home() {
  const tenants = await getPublicTenants();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Objectified Browse
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Explore published OpenAPI specifications
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Search />

        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
            Organizations ({tenants.length})
          </h2>

          {tenants.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-zinc-600 dark:text-zinc-400">
                No published specifications available yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tenants.map((tenant: any) => (
                <Link
                  key={tenant.id}
                  href={`/tenant/${tenant.slug}`}
                  className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
                >
                  <h3 className="text-xl font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                    {tenant.name}
                  </h3>
                  {tenant.description && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {tenant.description}
                    </p>
                  )}
                  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                    /{tenant.slug}
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

