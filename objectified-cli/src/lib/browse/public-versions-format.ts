import { ellipsizeEnd } from "../projects/format.js";

/** Row shape from GET /v1/browse/tenants/{tenant}/projects/{project}/versions (local type). */
export type BrowseVersionTableRow = {
  version_id: string;
  published_at?: string | null;
  tags: string[];
  changes_summary?: string | null;
};

const verW = 12;
const pubW = 14;
const tagsW = 18;
/** Row is `  VERSION  PUBLISHED  TAGS  CHANGES` — two spaces between columns. */
const changesW = 80 - (2 + verW + 2 + pubW + 2 + tagsW + 2);

function versionCell(slug: string): string {
  const s = slug.trim();
  const withV = s.startsWith("v") || s.startsWith("V") ? s : `v${s}`;
  return ellipsizeEnd(withV, verW).padEnd(verW);
}

function publishedCell(iso?: string | null): string {
  if (typeof iso !== "string" || iso === "") return "—".padEnd(pubW);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ellipsizeEnd(iso, pubW).padEnd(pubW);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return ellipsizeEnd(`${String(y)}-${m}-${day}`, pubW).padEnd(pubW);
}

function tagsCell(tags: string[]): string {
  if (tags.length === 0) return "".padEnd(tagsW);
  const joined = tags.join(", ");
  return ellipsizeEnd(joined, tagsW).padEnd(tagsW);
}

/** Fixed-width human table for `objectified browse versions`. */
export function formatBrowsePublicVersionsHumanLines(opts: {
  versions: BrowseVersionTableRow[];
  tenantSlug: string;
  projectSlug: string;
  truncated: boolean;
  totalAfterQuery: number;
  sinceActive: boolean;
  memberView: boolean;
}): string[] {
  const headers = ["VERSION", "PUBLISHED", "TAGS", "CHANGES"];
  const widths: readonly [number, number, number, number] = [verW, pubW, tagsW, changesW];
  const headerLine = `  ${headers
    .map((h, i) => {
      const w = widths[i] ?? 8;
      return ellipsizeEnd(h, w).padEnd(w);
    })
    .join("  ")}`.slice(0, 80);

  const lines: string[] = [
    headerLine,
    ...opts.versions.map((row) => {
      const ver = versionCell(row.version_id);
      const pub = publishedCell(row.published_at);
      const tg = tagsCell(row.tags);
      const chRaw = row.changes_summary ?? "";
      const ch = ellipsizeEnd(chRaw, changesW).padEnd(changesW);
      return `  ${ver}  ${pub}  ${tg}  ${ch}`.slice(0, 80);
    }),
    "",
  ];

  const ref = `${opts.tenantSlug}/${opts.projectSlug}`;
  lines.push(
    `${String(opts.totalAfterQuery)} published version${opts.totalAfterQuery === 1 ? "" : "s"} for ${JSON.stringify(ref)}${opts.memberView ? " (authenticated)" : ""}.`,
  );

  if (opts.sinceActive) {
    lines.push("Filter active: since.");
  }

  if (opts.truncated) {
    lines.push(
      `Showing ${String(opts.versions.length)} of ${String(opts.totalAfterQuery)}; use --all to list all.`,
    );
  }

  return lines;
}
