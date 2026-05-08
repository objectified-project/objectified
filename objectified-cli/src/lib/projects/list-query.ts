import type { ProjectSchema } from "../client.js";

export const DEFAULT_PROJECT_COLUMNS = ["slug", "name", "domain", "versions", "latest"] as const;

export type ProjectColumnKey = (typeof DEFAULT_PROJECT_COLUMNS)[number] | (string & {});

/** Maps user-facing column names (and aliases) to internal keys. */
const COLUMN_ALIASES: Record<string, string> = {
  latest_published_at: "latest",
};

export const KNOWN_PROJECT_COLUMN_KEYS = new Set<string>([
  ...DEFAULT_PROJECT_COLUMNS,
  "latest_published_at",
  "description",
  "id",
  "updated_at",
  "enabled",
  "creator_email",
  "creator_name",
  "published_at",
]);

export function normalizeColumnKey(key: string): string {
  const t = key.trim();
  return COLUMN_ALIASES[t] ?? t;
}

export function parseColumnKeys(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") return [...DEFAULT_PROJECT_COLUMNS];
  const keys = raw
    .split(",")
    .map((s) => normalizeColumnKey(s))
    .filter((s) => s !== "");
  return keys.length > 0 ? keys : [...DEFAULT_PROJECT_COLUMNS];
}

export function validateProjectColumns(keys: string[]): void {
  for (const k of keys) {
    if (!KNOWN_PROJECT_COLUMN_KEYS.has(k)) {
      throw new Error(`Unknown column: ${k}`);
    }
  }
}

export type ProjectSortField = "name" | "slug" | "updated_at" | "published_at";

export function parseSortField(raw: string | undefined): ProjectSortField {
  const s = raw?.trim();
  if (s === undefined || s === "") return "slug";
  if (s === "name" || s === "slug" || s === "updated_at" || s === "published_at") return s;
  throw new Error(
    `Invalid --sort field ${JSON.stringify(s)}; use name, slug, updated_at, or published_at.`,
  );
}

export type SortDirection = "asc" | "desc";

/** Parses `--sort name` or `--sort -updated_at` */
export function parseSortFlag(raw: string | undefined): {
  field: ProjectSortField;
  dir: SortDirection;
} {
  const s = raw?.trim();
  if (s === undefined || s === "") return { field: "slug", dir: "asc" };
  if (s.startsWith("-")) {
    return { field: parseSortField(s.slice(1)), dir: "desc" };
  }
  return { field: parseSortField(s), dir: "asc" };
}

export type FilterClause = { key: string; value: string };

export function parseFilterFlags(flags: string[] | undefined): FilterClause[] {
  if (flags === undefined) return [];
  const out: FilterClause[] = [];
  for (const raw of flags) {
    const eq = raw.indexOf("=");
    if (eq <= 0) {
      throw new Error(`Invalid --filter ${JSON.stringify(raw)}; expected key=value.`);
    }
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (key === "") throw new Error(`Invalid --filter ${JSON.stringify(raw)}; missing key.`);
    out.push({ key, value });
  }
  return out;
}

function recordStr(p: ProjectSchema, key: string): string | undefined {
  if (key === "slug") return p.slug;
  if (key === "name") return p.name;
  if (key === "description") return p.description ?? undefined;
  if (key === "domain") {
    const fromMeta = readMetaString(p.metadata, "domain");
    if (fromMeta !== undefined) return fromMeta;
    const top = (p as Record<string, unknown>).domain;
    return typeof top === "string" ? top : undefined;
  }
  const top = (p as Record<string, unknown>)[key];
  return typeof top === "string" ? top : undefined;
}

function readMetaString(metadata: ProjectSchema["metadata"], key: string): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const v = (metadata as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

export function projectMatchesFilters(p: ProjectSchema, clauses: FilterClause[]): boolean {
  for (const { key, value } of clauses) {
    const hay = recordStr(p, key);
    if (hay === undefined) return false;
    if (hay.toLowerCase() !== value.toLowerCase()) return false;
  }
  return true;
}

export function projectMatchesSearch(p: ProjectSchema, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === "") return true;
  const blob = [p.slug, p.name, p.description ?? ""].join("\u0000").toLowerCase();
  return blob.includes(needle);
}

function updatedAtMs(p: ProjectSchema): number {
  const u = p.updated_at;
  if (!u) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(u);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

function publishedAtMs(p: ProjectSchema): number {
  const top = (p as Record<string, unknown>).latest_published_at;
  const fromTop = typeof top === "string" ? Date.parse(top) : Number.NaN;
  if (!Number.isNaN(fromTop)) return fromTop;
  const meta = readMetaString(p.metadata, "latest_published_at");
  if (!meta) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(meta);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

export function sortProjects(
  rows: ProjectSchema[],
  field: ProjectSortField,
  dir: SortDirection,
): ProjectSchema[] {
  const mul = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    let cmp = 0;
    if (field === "slug") cmp = a.slug.localeCompare(b.slug);
    else if (field === "name") cmp = a.name.localeCompare(b.name);
    else if (field === "updated_at") cmp = updatedAtMs(a) - updatedAtMs(b);
    else cmp = publishedAtMs(a) - publishedAtMs(b);
    if (cmp !== 0) return cmp * mul;
    return a.slug.localeCompare(b.slug) * mul;
  });
  return copy;
}

export function applyProjectListQuery(
  projects: ProjectSchema[],
  opts: {
    filters: FilterClause[];
    search: string;
    sortField: ProjectSortField;
    sortDir: SortDirection;
  },
): ProjectSchema[] {
  let rows = projects;
  if (opts.filters.length > 0) {
    rows = rows.filter((p) => projectMatchesFilters(p, opts.filters));
  }
  rows = rows.filter((p) => projectMatchesSearch(p, opts.search));
  return sortProjects(rows, opts.sortField, opts.sortDir);
}
