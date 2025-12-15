import { searchPublicTenantsAndProjects } from "../../../lib/db/helper";
import { SearchClient } from "./SearchClient";
import { sanitizeSearchInput } from "../utils/searchValidation";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  // Sanitize the query parameter to prevent injection attacks
  const query = sanitizeSearchInput(q || "");
  const results = query ? await searchPublicTenantsAndProjects(query) : [];

  return <SearchClient initialQuery={query} initialResults={results} />;
}
