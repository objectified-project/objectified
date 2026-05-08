import { ellipsizeEnd, formatRelativeAgo } from "../projects/format.js";

/** Row shape from GET /v1/browse/tenants (kept local to avoid importing generated types here). */
export type BrowseTenantTableRow = {
  slug: string;
  name: string;
  project_count: number;
  published_versions: number;
  latest_version?: string | null;
  latest_activity_at?: string | null;
};

const slugW = 14;
const nameW = 22;
const projectsW = 10;
const pubVerW = 12;
const latestW = 78 - (2 + slugW + 1 + nameW + 1 + projectsW + 1 + pubVerW + 1);

function latestCell(row: BrowseTenantTableRow, nowMs: number): string {
  const verRaw = row.latest_version ?? undefined;
  const ver =
    verRaw !== undefined && verRaw !== ""
      ? verRaw.startsWith("v")
        ? verRaw
        : `v${verRaw}`
      : undefined;
  const at = row.latest_activity_at ?? undefined;
  const rel =
    at !== undefined && at !== "" ? formatRelativeAgo(at, nowMs) : "";
  if (ver !== undefined && rel !== "") return `${ver}  · ${rel}`;
  if (ver !== undefined) return ver;
  if (rel !== "") return rel;
  return "—";
}

/** Fixed-width human table for `objectified browse tenants`. */
export function formatBrowsePublicTenantsHumanLines(opts: {
  tenants: BrowseTenantTableRow[];
  /** Total public tenants in directory (not necessarily rows shown). */
  directoryTenantTotal: number;
  truncated: boolean;
  totalAfterQuery: number;
  searchActive: boolean;
  now?: Date;
}): string[] {
  const nowMs = (opts.now ?? new Date()).getTime();
  const headers = ["SLUG", "NAME", "PROJECTS", "PUBL. VERSIONS", "LATEST"];
  const widths: readonly [number, number, number, number, number] = [
    slugW,
    nameW,
    projectsW,
    pubVerW,
    latestW,
  ];
  const headerLine = `  ${headers
    .map((h, i) => {
      const w = widths[i] ?? 8;
      return ellipsizeEnd(h, w).padEnd(w);
    })
    .join(" ")}`.slice(0, 80);

  const lines: string[] = [
    headerLine,
    ...opts.tenants.map((row) => {
      const slug = ellipsizeEnd(row.slug, slugW).padEnd(slugW);
      const name = ellipsizeEnd(row.name, nameW).padEnd(nameW);
      const pc = ellipsizeEnd(String(row.project_count), projectsW).padEnd(projectsW);
      const pv = ellipsizeEnd(String(row.published_versions), pubVerW).padEnd(pubVerW);
      const lat = ellipsizeEnd(latestCell(row, nowMs), latestW).padEnd(latestW);
      return `  ${slug} ${name} ${pc} ${pv} ${lat}`.slice(0, 80);
    }),
    "",
  ];

  const total = opts.directoryTenantTotal;
  if (opts.searchActive) {
    lines.push(
      `${String(opts.totalAfterQuery)} tenant${opts.totalAfterQuery === 1 ? "" : "s"} match your search (${String(total)} public tenant${total === 1 ? "" : "s"} total).`,
    );
  } else {
    lines.push(
      `${String(total)} public tenant${total === 1 ? "" : "s"}. Use --search '<q>' to filter.`,
    );
  }

  if (opts.truncated) {
    lines.push(
      `Showing ${String(opts.tenants.length)} of ${String(opts.totalAfterQuery)}; use --all to list all.`,
    );
  }

  return lines;
}
