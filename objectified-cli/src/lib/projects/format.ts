import type { ProjectSchema } from "../client.js";

import { DEFAULT_PROJECT_COLUMNS } from "./list-query.js";

const slugW = 16;
const nameW = 20;
const domainW = 10;
const versionsW = 9;
const latestW = 78 - (2 + slugW + 1 + nameW + 1 + domainW + 1 + versionsW + 1);

export function ellipsizeMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 3) return ".".repeat(max);
  const keep = max - 3;
  const left = Math.ceil(keep / 2);
  const right = Math.floor(keep / 2);
  return `${text.slice(0, left)}...${text.slice(text.length - right)}`;
}

export function ellipsizeEnd(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 3) return ".".repeat(max);
  return `${text.slice(0, max - 3)}...`;
}

/** Relative time like `2d ago` / `1mo ago` (compact for narrow terminals). */
export function formatRelativeAgo(iso: string, nowMs: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  let sec = Math.floor((nowMs - t) / 1000);
  if (sec < 0) sec = 0;
  if (sec < 60) return `${String(sec)}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${String(min)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${String(hr)}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 60) return `${String(day)}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 24) return `${String(mo)}mo ago`;
  const yr = Math.floor(day / 365);
  return `${String(yr)}y ago`;
}

function readMetaString(metadata: ProjectSchema["metadata"], key: string): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const v = (metadata as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

function readMetaNumber(metadata: ProjectSchema["metadata"], key: string): number | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const v = (metadata as Record<string, unknown>)[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

export function versionsCountDisplay(p: ProjectSchema): string {
  const top = (p as Record<string, unknown>).versions_count;
  if (typeof top === "number" && Number.isFinite(top)) return String(top);
  const meta = readMetaNumber(p.metadata, "versions_count");
  if (meta !== undefined) return String(meta);
  return "—";
}

export function latestPublishedIso(p: ProjectSchema): string | undefined {
  const top = (p as Record<string, unknown>).latest_published_at;
  if (typeof top === "string" && top !== "") return top;
  const meta = readMetaString(p.metadata, "latest_published_at");
  return meta !== undefined && meta !== "" ? meta : undefined;
}

export function latestPublishedVersionLabel(p: ProjectSchema): string | undefined {
  const top = (p as Record<string, unknown>).latest_published_version;
  if (typeof top === "string" && top !== "") return top;
  const meta = readMetaString(p.metadata, "latest_published_version");
  return meta !== undefined && meta !== "" ? meta : undefined;
}

export function latestColumnDisplay(p: ProjectSchema, nowMs: number): string {
  const verRaw = latestPublishedVersionLabel(p);
  const ver = verRaw !== undefined ? (verRaw.startsWith("v") ? verRaw : `v${verRaw}`) : undefined;
  const at = latestPublishedIso(p);
  const rel = at !== undefined ? formatRelativeAgo(at, nowMs) : "";
  if (ver !== undefined && rel !== "") return `${ver}  · ${rel}`;
  if (ver !== undefined) return ver;
  if (at !== undefined) {
    const r = formatRelativeAgo(at, nowMs);
    return r !== "" ? r : "—";
  }
  const vc = versionsCountDisplay(p);
  if (vc === "—" || vc === "0") return "(no published versions)";
  return "—";
}

export function domainDisplay(p: ProjectSchema): string {
  const meta = readMetaString(p.metadata, "domain");
  if (meta !== undefined && meta !== "") return meta;
  const category = readMetaString(p.metadata, "domainCategory");
  if (category !== undefined && category !== "" && category !== "none") return category;
  const top = (p as Record<string, unknown>).domain;
  return typeof top === "string" && top !== "" ? top : "—";
}

export type ProjectColumnSpec = { key: string; header: string; width: number };

function defaultSpecs(): ProjectColumnSpec[] {
  return [
    { key: "slug", header: "SLUG", width: slugW },
    { key: "name", header: "NAME", width: nameW },
    { key: "domain", header: "DOMAIN", width: domainW },
    { key: "versions", header: "VERSIONS", width: versionsW },
    { key: "latest", header: "LATEST PUBLISHED", width: latestW },
  ];
}

const EXTRA_HEADERS: Record<string, string> = {
  description: "DESCRIPTION",
  id: "ID",
  updated_at: "UPDATED_AT",
  enabled: "ENABLED",
  creator_email: "CREATOR_EMAIL",
  creator_name: "CREATOR_NAME",
  published_at: "PUBLISHED_AT",
  latest_published_at: "PUBLISHED_AT",
};

function cellForColumn(key: string, p: ProjectSchema, nowMs: number): string {
  switch (key) {
    case "slug":
      return p.slug;
    case "name":
      return p.name;
    case "domain":
      return domainDisplay(p);
    case "versions":
      return versionsCountDisplay(p);
    case "latest":
      return latestColumnDisplay(p, nowMs);
    case "latest_published_at": {
      const iso = latestPublishedIso(p);
      return iso !== undefined ? iso.slice(0, 19) : ""; // YYYY-MM-DDTHH:MM:SS
    }
    case "description":
      return p.description ?? "";
    case "id":
      return p.id;
    case "updated_at":
      return p.updated_at ?? "";
    case "enabled":
      return String(p.enabled !== false);
    case "creator_email":
      return p.creator_email ?? "";
    case "creator_name":
      return p.creator_name ?? "";
    case "published_at": {
      const iso = latestPublishedIso(p);
      return iso !== undefined ? iso.slice(0, 19) : "";
    }
    default:
      return "";
  }
}

function buildSpecs(keys: string[]): ProjectColumnSpec[] {
  const def = [...DEFAULT_PROJECT_COLUMNS];
  if (keys.length === def.length && keys.every((k, i) => k === def[i])) {
    return defaultSpecs();
  }
  const width = Math.max(
    8,
    Math.min(24, Math.floor((78 - (keys.length - 1)) / Math.max(1, keys.length))),
  );
  return keys.map((key) => ({
    key,
    header: EXTRA_HEADERS[key] ?? key.toUpperCase(),
    width,
  }));
}

export function formatProjectsListHumanLines(opts: {
  projects: ProjectSchema[];
  tenantSlug: string;
  columnKeys: string[];
  /** True when output was capped by --limit (more rows existed). */
  truncated: boolean;
  totalAfterQuery: number;
  now?: Date;
}): string[] {
  const nowMs = (opts.now ?? new Date()).getTime();
  const specs = buildSpecs(opts.columnKeys);
  const header =
    `  ${specs.map((s) => ellipsizeEnd(s.header, s.width).padEnd(s.width)).join(" ")}`.slice(0, 80);

  const lines: string[] = [
    header,
    ...opts.projects.map((p) => {
      const cells = opts.columnKeys.map((key) => cellForColumn(key, p, nowMs));
      const padded = specs.map((s, i) => {
        const raw = cells[i] ?? "";
        const fitted = keyNeedsMiddleEllipsis(opts.columnKeys[i] ?? "")
          ? ellipsizeMiddle(raw, s.width)
          : ellipsizeEnd(raw, s.width);
        return fitted.padEnd(s.width);
      });
      return `  ${padded.join(" ")}`.slice(0, 80);
    }),
    "",
    `${String(opts.totalAfterQuery)} project${opts.totalAfterQuery === 1 ? "" : "s"} in tenant '${opts.tenantSlug}'.`,
  ];
  if (opts.truncated) {
    lines.push(
      `Showing ${String(opts.projects.length)} of ${String(opts.totalAfterQuery)}; use --all to list all.`,
    );
  }
  return lines;
}

function keyNeedsMiddleEllipsis(key: string): boolean {
  return key === "slug" || key === "id";
}
