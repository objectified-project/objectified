import { searchPublicTenantsAndProjects } from "../../../lib/db/helper";
import { SearchClient } from "./SearchClient";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q || "";
  const results = query ? await searchPublicTenantsAndProjects(query) : [];

  return <SearchClient initialQuery={query} initialResults={results} />;
}
