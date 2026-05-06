/**
 * Context-aware Studio AI best-practice tips (#615, #616).
 *
 * Combines the project metadata `domainCategory` (see project-domain-categories)
 * with light heuristics on class names so e-commerce, multi-tenant, and auth-heavy
 * workspaces get targeted guidance without calling a model. Each known domain emits
 * several industry-specific modeling patterns (not a single generic hint).
 */

import {
  PROJECT_DOMAIN_CATEGORY_NONE,
  getProjectDomainCategory,
  getProjectDomainCategoryLabel,
} from '@/app/utils/project-domain-categories';

export type StudioAiTipSignalContext = {
  domainCategory?: string | null;
  classNames: readonly string[];
};

/** Several actionable patterns per industry; order is stable for tests and UX. */
const DOMAIN_INDUSTRY_PATTERNS_BY_ID: Readonly<Record<string, readonly string[]>> = {
  ecommerce: [
    'Model inventory tracking with explicit stock levels, reservations, or holds so concurrent checkouts cannot oversell.',
    'Attach tax jurisdiction and breakdown to orders and refunds, not only to catalog SKUs.',
    'Require idempotency keys on checkout and capture mutations so network retries cannot double-charge.',
  ],
  saas: [
    'Add tenant isolation fields: carry tenant or workspace identifiers on every tenant-owned entity and enforce them at the API boundary.',
    'Model subscription lifecycle (trial, active, past_due, canceled) as explicit states with valid transitions.',
    'Persist metered usage counters or event streams separately from billing invoices for reconciliation.',
  ],
  iot: [
    'Model stable device identity, firmware revision, and last-seen timestamps alongside telemetry payloads.',
    'Version device configuration separately from telemetry readings so rollbacks do not erase history.',
    'Prefer UTC timestamps and optional quality flags on sensor samples for downstream aggregation.',
  ],
  social: [
    'Separate public profile fields from private account data; model follow and block relationships explicitly.',
    'Store moderation decisions and appeal state on content entities for audit and safety workflows.',
    'Model notification preferences per channel so email, push, and in-app opt-outs stay independent.',
  ],
  gaming: [
    'Persist authoritative server timestamps for match outcomes and anti-cheat audit fields.',
    'Isolate player economy balances from cosmetic inventory to limit exploit blast radius.',
    'Record session and match identifiers on progression events for replay and dispute handling.',
  ],
  travel: [
    'Capture cancellations, no-shows, and rebooking lineage on reservations.',
    'Use locale-aware currency and explicit exchange-rate snapshots on cross-border charges.',
    'Model guest counts, room types, and special requests as first-class fields on booking objects.',
  ],
  media: [
    'Track rights windows, territory, and entitlement identifiers on catalog entities.',
    'Distinguish editorial metadata from distribution manifests so syndication cannot drift silently.',
    'Model series or season grouping explicitly when episodes share contracts or blackout rules.',
  ],
  healthcare: [
    'Prefer coded values (code system + code + display) where interoperability or regulation expects them.',
    'Scope clinical narrative and PHI-bearing fields to access-controlled surfaces and provenance metadata.',
    'Reference patients, practitioners, and organizations with stable identifiers suitable for FHIR-style linking.',
  ],
  finance: [
    'Model money movement as append-only ledger entries; correct mistakes with reversing entries, not in-place edits.',
    'Require idempotency keys on payment instructions and payouts.',
    'Separate authorized, captured, and settled amounts on card or ACH flows.',
  ],
  education: [
    'Version course content separately from enrollments so curriculum updates do not rewrite student history.',
    'Record graded artifacts with grader identity and timestamp when outcomes must be auditable.',
    'Model cohort or section membership apart from the user account for roster and permission boundaries.',
  ],
  realestate: [
    'Model offer contingencies and earnest-money deadlines explicitly on transaction objects.',
    'Track listing status transitions (active, pending, closed) with effective dates for MLS-style workflows.',
    'Represent agency relationships and dual-agency disclosure flags where brokerage rules apply.',
  ],
  logistics: [
    'Track shipment status transitions with actor and timestamp metadata for exception handling and SLA evidence.',
    'Model stops or legs explicitly when one consignment spans multiple carriers or hubs.',
    'Capture proof-of-delivery signatures or scan events as immutable milestone records.',
  ],
};

function industryPatternsForDomain(domainId: string): readonly string[] {
  const explicit = DOMAIN_INDUSTRY_PATTERNS_BY_ID[domainId];
  if (explicit?.length) return explicit;
  const cat = getProjectDomainCategory(domainId);
  return cat ? [cat.hint] : [];
}

/**
 * Split a CamelCase or snake_case class name into its constituent words so that
 * word-boundary anchors work on compound names.
 *
 * Examples:
 *   OAuthSession      → "OAuthSession O Auth Session"
 *   OrganizationMember → "OrganizationMember Organization Member"
 *   refresh_token      → "refresh_token refresh token"
 */
function tokenizeClassName(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')    // fooBar → foo Bar
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // XMLParser → XML Parser
    .replace(/_/g, ' ');
}

const AUTH_CLASS_SIGNAL =
  /\b(Session|Sessions|Token|Tokens|OAuth|Refresh|JWT|Jwt|Mfa|Credential|Credentials|Identity|Login|Auth|Password|Otp|Oidc|Saml)\b/i;

const TENANT_CLASS_SIGNAL = /\b(Tenant|Tenants|Organization|Organizations|Workspace|Workspaces|OrgMembership)\b/i;

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
  const haystack = classNames
    .map((c) => `${c} ${tokenizeClassName(c)}`)
    .join(' ');

  const lines: string[] = [];

  if (domainId) {
    for (const pattern of industryPatternsForDomain(domainId)) {
      lines.push(asBullet(pattern));
    }
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
