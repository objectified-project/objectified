function padLine(label: string, value: string): string {
  const withColon = `${label}:`;
  return `  ${withColon.padEnd(13)} ${value}`;
}

export type TenantMembershipRow = {
  slug: string;
  name: string;
  role: string;
};

export type TenantInfoForDisplay = {
  slug: string;
  name: string;
  plan?: string | null;
  created_at?: string | null;
  members_count?: number;
  projects_count?: number;
  versions_count?: number;
  published_versions_count?: number;
  storage_used_bytes?: number | null;
  storage_quota_bytes?: number | null;
};

/** Prefer ASCII when locale is C/POSIX (matches table rendering). */
export function activeTenantMark(langAscii: boolean): string {
  return langAscii ? "*" : "★";
}

export function formatTenantsListHumanLines(opts: {
  tenants: TenantMembershipRow[];
  profile: string;
  profileTenantSlug: string | undefined;
  langAscii: boolean;
}): string[] {
  const mark = activeTenantMark(opts.langAscii);
  const activeSlug =
    opts.profileTenantSlug !== undefined && opts.profileTenantSlug !== ""
      ? opts.profileTenantSlug.trim()
      : undefined;

  const lines: string[] = [
    "  SLUG          NAME                  ROLE      ACTIVE",
    ...opts.tenants.map((t) => {
      const slug = t.slug.padEnd(13);
      const name = (t.name.length > 21 ? `${t.name.slice(0, 18)}...` : t.name).padEnd(21);
      const role = t.role.padEnd(8);
      const active = activeSlug !== undefined && t.slug === activeSlug ? mark : "";
      return `  ${slug} ${name} ${role} ${active}`;
    }),
    "",
    `(${mark} = current default for profile '${opts.profile}')`,
  ];
  return lines;
}

function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 0) return "-";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"] as const;
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const digits = u === 0 ? 0 : u === 1 ? 1 : 2;
  const unit = units[u] ?? "B";
  return `${v.toFixed(digits)} ${unit}`;
}

export function formatTenantInfoHumanLines(info: TenantInfoForDisplay): string[] {
  const plan = info.plan !== null && info.plan !== undefined && info.plan !== "" ? info.plan : "-";
  const created =
    info.created_at !== null && info.created_at !== undefined && info.created_at !== ""
      ? info.created_at.slice(0, 10)
      : "-";
  const storage =
    info.storage_used_bytes != null &&
    info.storage_quota_bytes != null &&
    Number.isFinite(info.storage_used_bytes) &&
    Number.isFinite(info.storage_quota_bytes)
      ? `${formatBytes(info.storage_used_bytes)} / ${formatBytes(info.storage_quota_bytes)}`
      : "-";
  const versionsLine = `${String(info.versions_count ?? 0)}  (${String(info.published_versions_count ?? 0)} published)`;
  return [
    padLine("Slug", info.slug),
    padLine("Name", info.name),
    padLine("Plan", plan),
    padLine("Created", created),
    padLine("Members", String(info.members_count ?? 0)),
    padLine("Projects", String(info.projects_count ?? 0)),
    padLine("Versions", versionsLine),
    padLine("Storage", storage),
  ];
}
