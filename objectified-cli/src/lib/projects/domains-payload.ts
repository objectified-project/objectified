/** Normalize GET /v1/projects/…/domains (or similar) JSON into id strings (#3204). */
export function normalizeProjectDomainsApiPayload(data: unknown): string[] {
  if (Array.isArray(data)) {
    if (data.every((x) => typeof x === "string")) {
      return data.filter((s) => s.trim() !== "");
    }
    const ids: string[] = [];
    for (const row of data) {
      if (row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string") {
        const id = (row as { id: string }).id.trim();
        if (id !== "") ids.push(id);
      }
    }
    return ids;
  }

  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const domains = o.domains;
    if (Array.isArray(domains) && domains.every((x) => typeof x === "string")) {
      return domains.map((s) => s.trim()).filter((s) => s !== "");
    }
    const items = o.items;
    if (Array.isArray(items)) {
      return normalizeProjectDomainsApiPayload(items);
    }
  }

  return [];
}
