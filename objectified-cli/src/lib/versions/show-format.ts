import type {
  ClassSchema,
  CompatibilityCheckResponse,
  VersionSchema,
  VersionTagSchema,
} from "../client.js";

import { ellipsizeEnd } from "../projects/format.js";

import { formatVersionLabel } from "./list-format.js";
import { versionIsArchived } from "./list-query.js";
import type { VersionShowResolution } from "./show-resolve.js";

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export type PublishedSpecUrls = {
  openapi: string;
  swagger_ui: string;
  arazzo: string;
  json_schema: string;
};

export function buildPublishedSpecUrls(opts: {
  baseUrl: string;
  tenantSlug: string;
  projectSlug: string;
  versionSlug: string;
}): PublishedSpecUrls {
  const root = trimTrailingSlash(opts.baseUrl);
  const t = encodeURIComponent(opts.tenantSlug);
  const p = encodeURIComponent(opts.projectSlug);
  const v = encodeURIComponent(opts.versionSlug);
  return {
    openapi: `${root}/v1/schema/${t}/${p}/${v}`,
    swagger_ui: `${root}/v1/swagger/${t}/${p}/${v}`,
    arazzo: `${root}/v1/arazzo/${t}/${p}/${v}`,
    json_schema: `${root}/v1/json/${t}/${p}/${v}`,
  };
}

function primaryStateWord(v: VersionSchema): string {
  if (versionIsArchived(v)) return "archived";
  if (v.published === true) return "published";
  return "draft";
}

function publishedAtDisplay(iso: string | null | undefined): string {
  if (!iso || iso.trim() === "") return "—";
  const s = iso.trim();
  if (s.length >= 16) return `${s.slice(0, 10)} ${s.slice(11, 16)}`;
  return s;
}

function authorDisplay(v: VersionSchema): string {
  const a = v.author?.trim();
  if (a !== undefined && a !== "") return a;
  const email = v.creator_email?.trim();
  if (email !== undefined && email !== "") return email;
  const name = v.creator_name?.trim();
  if (name !== undefined && name !== "") return name;
  return "—";
}

function notesDisplay(v: VersionSchema): string {
  const sm = v.shortMessage?.trim();
  if (sm !== undefined && sm !== "") return sm;
  const cl = v.changelog?.trim();
  if (cl !== undefined && cl !== "") return cl.split("\n")[0]?.trim() ?? "—";
  return "—";
}

/** Prefer stable → latest → next, then remaining tags in lexicographic order. */
export function orderedStarTags(names: string[]): string[] {
  if (names.length === 0) return [];
  const preferred = ["stable", "latest", "next"];
  const lowerToOriginal = new Map<string, string>();
  for (const n of names) {
    lowerToOriginal.set(n.toLowerCase(), n);
  }
  const out: string[] = [];
  for (const p of preferred) {
    const hit = lowerToOriginal.get(p);
    if (hit !== undefined) out.push(hit);
  }
  const rest = [...names]
    .filter((n) => !preferred.includes(n.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  out.push(...rest);
  return out;
}

export function revisionToDisplayVersionMap(versions: VersionSchema[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const v of versions) {
    m.set(v.id, formatVersionLabel(v.version_id));
  }
  return m;
}

export type ClassDeltaSummary = {
  totalHead: number;
  added: number;
  removed: number;
  modified: number;
};

export function summarizeClassDelta(base: ClassSchema[], head: ClassSchema[]): ClassDeltaSummary {
  const baseByName = new Map(base.map((c) => [c.name, c]));
  const headByName = new Map(head.map((c) => [c.name, c]));
  let added = 0;
  let removed = 0;
  let modified = 0;
  for (const [name, h] of headByName) {
    const b = baseByName.get(name);
    if (b === undefined) added++;
    else if (JSON.stringify(b.schema) !== JSON.stringify(h.schema)) modified++;
  }
  for (const name of baseByName.keys()) {
    if (!headByName.has(name)) removed++;
  }
  return { totalHead: head.length, added, removed, modified };
}

/** Optional OpenAPI paths delta if `changeModelJson` exposes a paths section like schemas. */
export function extractPathsDeltaFromChangeModel(
  changeModelJson: Record<string, unknown> | undefined,
): { added: number; removed: number; modified: number } | undefined {
  if (changeModelJson === undefined) return undefined;
  const paths = changeModelJson.paths;
  if (!paths || typeof paths !== "object") return undefined;
  const o = paths as Record<string, unknown>;
  const len = (k: string): number => (Array.isArray(o[k]) ? o[k].length : 0);
  if (!("added" in o || "removed" in o || "modified" in o)) return undefined;
  return { added: len("added"), removed: len("removed"), modified: len("modified") };
}

export type VersionsShowHumanOpts = {
  projectName: string;
  version: VersionSchema;
  tagsOnRevision: string[];
  resolution: VersionShowResolution;
  predecessorLabel: string | undefined;
  compatibility: CompatibilityCheckResponse | null;
  classDelta: ClassDeltaSummary | undefined;
  pathsDelta: { added: number; removed: number; modified: number } | undefined;
  forkedFromDisplay: string;
  specUrls: PublishedSpecUrls;
  separator: string;
  titleBold: (s: string) => string;
  starGlyph: string;
};

function kvRow(label: string, value: string, labelW: number): string {
  const l = ellipsizeEnd(label, labelW).padEnd(labelW);
  return `  ${l}  ${value}`;
}

export function formatVersionsShowHumanLines(opts: VersionsShowHumanOpts): string[] {
  const verLabel = formatVersionLabel(opts.version.version_id);
  const stars = orderedStarTags(opts.tagsOnRevision);
  const starSuffix = stars.length > 0 ? `  ${opts.starGlyph} ${stars.join(", ")}` : "";

  let title = `${opts.projectName} ${verLabel}${starSuffix}`;
  if (opts.resolution.kind === "tag") {
    title += `  (tag ${opts.resolution.tagName} → ${formatVersionLabel(opts.resolution.resolvedVersionId)})`;
  }

  const lines: string[] = [];
  lines.push("");
  lines.push(`  ${opts.titleBold(title)}`);
  lines.push(`  ${opts.separator}`);

  lines.push(kvRow("State:", primaryStateWord(opts.version), 14));

  const pubLine =
    opts.version.published === true
      ? `${publishedAtDisplay(opts.version.published_at)} by ${authorDisplay(opts.version)}`
      : "—";
  lines.push(kvRow("Published:", pubLine, 14));

  const frozen =
    opts.version.published === true && opts.version.publishedImmutable === true ? "yes" : "no";
  lines.push(kvRow("Frozen:", frozen, 14));

  lines.push(kvRow("Forked from:", opts.forkedFromDisplay, 14));

  lines.push(kvRow("Notes:", notesDisplay(opts.version), 14));
  lines.push("");

  if (opts.classDelta !== undefined && opts.predecessorLabel !== undefined) {
    const d = opts.classDelta;
    lines.push(
      kvRow(
        "Classes:",
        `${String(d.totalHead)}    (${String(d.added)} added, ${String(d.removed)} removed, ${String(d.modified)} modified vs ${opts.predecessorLabel})`,
        14,
      ),
    );
  } else if (opts.classDelta !== undefined) {
    const d = opts.classDelta;
    lines.push(kvRow("Classes:", String(d.totalHead), 14));
  }

  if (opts.pathsDelta !== undefined && opts.predecessorLabel !== undefined) {
    const p = opts.pathsDelta;
    lines.push(
      kvRow(
        "Paths:",
        `(${String(p.added)} added, ${String(p.removed)} removed, ${String(p.modified)} modified vs ${opts.predecessorLabel})`,
        14,
      ),
    );
  }

  if (opts.compatibility !== null && opts.predecessorLabel !== undefined) {
    const c = opts.compatibility;
    lines.push(
      kvRow(
        "Compatibility:",
        `${c.overall} (${String(c.findings.length)} finding(s) vs ${opts.predecessorLabel})`,
        14,
      ),
    );
  }

  lines.push("");
  lines.push("  Specs:");
  lines.push(`    OpenAPI 3.1   →  ${opts.specUrls.openapi}`);
  lines.push(`    Swagger UI    →  ${opts.specUrls.swagger_ui}`);
  lines.push(`    Arazzo        →  ${opts.specUrls.arazzo}`);
  lines.push(`    JSON Schema   →  ${opts.specUrls.json_schema}`);
  lines.push("");

  return lines;
}

export function tagsOnRevisionFromIndex(tags: VersionTagSchema[], revisionId: string): string[] {
  const names: string[] = [];
  for (const t of tags) {
    if (t.version_id === revisionId) names.push(t.name);
  }
  return names;
}
