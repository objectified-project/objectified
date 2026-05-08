import { ellipsizeEnd, formatRelativeAgo } from "../projects/format.js";

/** Row shape from GET /v1/browse/tenants/{slug}/projects (local type). */
export type BrowseProjectTableRow = {
  slug: string;
  name: string;
  domain: string;
  published_versions: number;
  latest_version?: string | null;
  latest_published_at?: string | null;
};

const slugW = 14;
const nameW = 18;
const domainW = 10;
const pubW = 12;
/** Row is `  slug  name  domain  pub  latest` — two spaces between columns. */
const latestW = 80 - (2 + slugW + 2 + nameW + 2 + domainW + 2 + pubW + 2);

function latestCell(row: BrowseProjectTableRow, nowMs: number): string {
  const verRaw = row.latest_version ?? undefined;
  const ver =
    verRaw !== undefined && verRaw !== ""
      ? verRaw.startsWith("v")
        ? verRaw
        : `v${verRaw}`
      : undefined;
  const at = row.latest_published_at ?? undefined;
  const rel =
    typeof at === "string" && at !== "" ? formatRelativeAgo(at, nowMs) : "";
  if (ver !== undefined && rel !== "") return `${ver}  · ${rel}`;
  if (ver !== undefined) return ver;
  if (rel !== "") return rel;
  return "—";
}

/** Fixed-width human table for `objectified browse projects`. */
export function formatBrowsePublicProjectsHumanLines(opts: {
  projects: BrowseProjectTableRow[];
  tenantSlug: string;
  truncated: boolean;
  totalAfterQuery: number;
  searchActive: boolean;
  domainActive: boolean;
  hasPublishedActive: boolean;
  /** True when the CLI forwarded credentials (member directory vs public-only). */
  memberView: boolean;
  now?: Date;
}): string[] {
  const nowMs = (opts.now ?? new Date()).getTime();
  const headers = ["SLUG", "NAME", "DOMAIN", "PUBL. VERS.", "LATEST"];
  const widths: readonly [number, number, number, number, number] = [
    slugW,
    nameW,
    domainW,
    pubW,
    latestW,
  ];
  const headerLine = `  ${headers
    .map((h, i) => {
      const w = widths[i] ?? 8;
      return ellipsizeEnd(h, w).padEnd(w);
    })
    .join("  ")}`.slice(0, 80);

  const lines: string[] = [
    headerLine,
    ...opts.projects.map((row) => {
      const slug = ellipsizeEnd(row.slug, slugW).padEnd(slugW);
      const name = ellipsizeEnd(row.name, nameW).padEnd(nameW);
      const dom = ellipsizeEnd(row.domain, domainW).padEnd(domainW);
      const pv = ellipsizeEnd(String(row.published_versions), pubW).padEnd(pubW);
      const lat = ellipsizeEnd(latestCell(row, nowMs), latestW).padEnd(latestW);
      return `  ${slug}  ${name}  ${dom}  ${pv}  ${lat}`.slice(0, 80);
    }),
    "",
  ];

  const slugJson = JSON.stringify(opts.tenantSlug);
  const noun = opts.memberView ? "project" : "public project";
  const suffix = opts.memberView ? " (authenticated; includes private projects)." : ".";
  lines.push(
    `${String(opts.totalAfterQuery)} ${noun}${opts.totalAfterQuery === 1 ? "" : "s"} in tenant ${slugJson}${suffix}`,
  );

  const filters: string[] = [];
  if (opts.searchActive) filters.push("search");
  if (opts.domainActive) filters.push("domain");
  if (opts.hasPublishedActive) filters.push("has-published");
  if (filters.length > 0) {
    lines.push(`Filters active: ${filters.join(", ")}.`);
  }

  if (opts.truncated) {
    lines.push(
      `Showing ${String(opts.projects.length)} of ${String(opts.totalAfterQuery)}; use --all to list all.`,
    );
  }

  return lines;
}
