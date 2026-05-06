/**
 * Context-aware Studio AI best-practice tips (#615).
 *
 * Combines the project metadata `domainCategory` (see project-domain-categories)
 * with light heuristics on class names so e-commerce, multi-tenant, and auth-heavy
 * workspaces get targeted guidance without calling a model.
 */

import {
  PROJECT_DOMAIN_CATEGORIES,
  PROJECT_DOMAIN_CATEGORY_NONE,
  getProjectDomainCategoryLabel,
} from '@/app/utils/project-domain-categories';

export type StudioAiTipSignalContext = {
  domainCategory?: string | null;
  classNames: readonly string[];
};

const DOMAIN_TIP_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(
  PROJECT_DOMAIN_CATEGORIES.map((c) => {
    switch (c.id) {
      case 'ecommerce':
        return [c.id, 'Consider adding inventory tracking'];
      case 'saas':
        return [c.id, 'Add tenant isolation fields'];
      case 'iot':
        return [c.id, 'Model device identity, firmware revision, and last-seen timestamps alongside telemetry payloads.'];
      case 'social':
        return [c.id, 'Separate public profile fields from private account data; model follow/block edges explicitly.'];
      case 'gaming':
        return [c.id, 'Persist authoritative server timestamps for match outcomes and anti-cheat audit fields.'];
      case 'travel':
        return [c.id, 'Capture cancellations, no-shows, and locale-aware currency on monetary fields.'];
      case 'media':
        return [c.id, 'Track rights windows, territory, and entitlement identifiers on catalog entities.'];
      case 'healthcare':
        return [c.id, 'Prefer coded values where regulations require them; scope clinical text fields to access-controlled surfaces.'];
      case 'finance':
        return [c.id, 'Model immutable ledger movements and avoid mutating posted transactions in place.'];
      case 'education':
        return [c.id, 'Version course content separately from enrollments so curriculum updates do not rewrite student history.'];
      case 'realestate':
        return [c.id, 'Model offer contingencies and earnest-money deadlines explicitly on transaction objects.'];
      case 'logistics':
        return [c.id, 'Track status transitions with who/when metadata for exception handling and SLA proofs.'];
      default:
        return [c.id, c.hint];
    }
  }),
) as Readonly<Record<string, string>>;

/** Compound names first — e.g. `RefreshToken` has no `\bRefresh\b` match inside the camelCase token. */
const AUTH_CLASS_SIGNAL =
  /RefreshToken|AccessToken|IdToken|DeviceCode|BearerToken|\b(Session|Sessions|Token|Tokens|OAuth|Refresh|JWT|Jwt|Mfa|Credential|Credentials|Identity|Login|Auth|Password|Otp|Oidc|Saml)\b/i;

const TENANT_CLASS_SIGNAL = /\b(Tenant|Tenants|Organization|Organizations|Workspace|Workspaces|OrgMembership|TenantId)\b/i;

function asBullet(line: string): string {
  const t = line.trim();
  if (t.startsWith('-')) return t;
  return `- ${t}`;
}

function dedupeBullets(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = asBullet(raw);
    const key = line.slice(1).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function collectStudioAiBestPracticeTipLines(signals: StudioAiTipSignalContext): string[] {
  const rawDomain = signals.domainCategory?.trim() || '';
  const domainId = rawDomain === PROJECT_DOMAIN_CATEGORY_NONE ? '' : rawDomain;
  const classNames = signals.classNames.filter(Boolean);
  const haystack = classNames.join(' ');

  const lines: string[] = [];

  if (domainId && DOMAIN_TIP_BY_ID[domainId]) {
    lines.push(asBullet(DOMAIN_TIP_BY_ID[domainId]));
  }

  if (AUTH_CLASS_SIGNAL.test(haystack)) {
    lines.push(asBullet('Implement refresh token pattern'));
  }

  if (domainId !== 'saas' && TENANT_CLASS_SIGNAL.test(haystack)) {
    lines.push(asBullet('Add tenant isolation fields'));
  }

  return dedupeBullets(lines);
}

export function collectStudioAiBestPracticeLinesFromStudio(ctx: {
  project?: { domainCategory?: string | null } | null;
  classes: Array<{ name: string }>;
} | null | undefined): string[] {
  if (!ctx) return [];
  return collectStudioAiBestPracticeTipLines({
    domainCategory: ctx.project?.domainCategory,
    classNames: ctx.classes.map((c) => c.name),
  });
}

/** Human label for UI / preamble headings; null when unknown or unset. */
export function studioAiBestPracticeDomainHeadingFromStudio(
  project: { domainCategory?: string | null } | null | undefined,
): string | null {
  const id = project?.domainCategory?.trim();
  if (!id || id === PROJECT_DOMAIN_CATEGORY_NONE) return null;
  return getProjectDomainCategoryLabel(id) ?? id;
}
