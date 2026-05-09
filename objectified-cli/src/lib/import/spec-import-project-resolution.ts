import type { ProjectCreateRequest, ProjectSchema, SpecImportProjectTarget } from "../client.js";

import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";
import type { Visibility } from "../projects/project-create-body.js";
import { buildProjectCreateRequest } from "../projects/project-create-body.js";
import { PROJECT_DOMAIN_CATEGORY_NONE } from "../projects/domain-categories.js";
import { normalizeSlugInput, validateProjectSlug } from "../projects/project-slug.js";

export type SpecImportProjectResolutionApi = {
  getProjectBySlug(tenantSlug: string, projectSlug: string): Promise<ProjectSchema>;
  createProject(tenantSlug: string, body: ProjectCreateRequest): Promise<ProjectSchema>;
  fetchProjectDomainsAllowlist(tenantSlug: string): Promise<string[]>;
};

export type ResolvedSpecImportProject = {
  existingProjectId: string | null;
  project: SpecImportProjectTarget;
};

export type ImportProjectFieldHints = {
  descriptionProvided: boolean;
  domainProvided: boolean;
  visibilityProvided: boolean;
};

function normalizeDomainCategory(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (t === "" || t === PROJECT_DOMAIN_CATEGORY_NONE) return undefined;
  return t;
}

function normName(s: string): string {
  return s.trim();
}

function normDesc(s: string | null | undefined): string | null {
  if (s === undefined || s === null) return null;
  const t = s.trim();
  return t === "" ? null : t;
}

function domainFromProjectMetadata(p: ProjectSchema): string | null {
  const m = p.metadata;
  if (!m || typeof m !== "object") return null;
  const raw = (m as Record<string, unknown>).domainCategory ?? (m as Record<string, unknown>).domain;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

function visibilityFromProjectMetadata(p: ProjectSchema): Visibility | null {
  const m = p.metadata;
  if (!m || typeof m !== "object") return null;
  const v = (m as Record<string, unknown>).visibility;
  if (v === "private" || v === "public") return v;
  return null;
}

async function tryGetProjectBySlug(
  api: SpecImportProjectResolutionApi,
  tenant: string,
  slug: string,
): Promise<ProjectSchema | null> {
  try {
    return await api.getProjectBySlug(tenant, slug);
  } catch (e) {
    if (e instanceof ObjectifiedCliError && e.exitCode === EXIT_CODES.NOT_FOUND) {
      return null;
    }
    throw e;
  }
}

function projectTargetFromSchema(p: ProjectSchema): SpecImportProjectTarget {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
  };
}

export function throwIfConflictingImportProjectFlags(opts: {
  mapProjectRaw: string | undefined;
  createProject: boolean;
  createOrMapProject: boolean;
  existingProjectId: string | undefined;
}): void {
  const mapTrim =
    typeof opts.mapProjectRaw === "string" ? opts.mapProjectRaw.trim() : "";
  const hasMap = mapTrim !== "";
  const n = [hasMap, opts.createProject, opts.createOrMapProject].filter(Boolean).length;
  if (n > 1) {
    throw new ObjectifiedCliError({
      message:
        "Choose at most one project strategy: --map-project, --create-project, or --create-or-map-project.",
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "See `objectified import spec --help` for mutually exclusive flags.",
    });
  }
  const existingTrim =
    typeof opts.existingProjectId === "string" ? opts.existingProjectId.trim() : "";
  if (existingTrim !== "" && (hasMap || opts.createProject || opts.createOrMapProject)) {
    throw new ObjectifiedCliError({
      message:
        "--existing-project-id cannot be combined with --map-project, --create-project, or --create-or-map-project.",
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
    });
  }
}

export function validateDomainAgainstAllowlist(domain: string | undefined, allowlist: Set<string>): void {
  const domainNorm = normalizeDomainCategory(domain);
  if (domainNorm !== undefined && !allowlist.has(domainNorm)) {
    throw new ObjectifiedCliError({
      message: `Unknown domain category '${domainNorm}'.`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: `Choose one of: ${Array.from(allowlist).sort().join(", ")}`,
    });
  }
}

export async function resolveMapProjectImport(opts: {
  api: SpecImportProjectResolutionApi;
  tenant: string;
  mapSlugRaw: string;
  cliProjectName?: string;
  cliProjectSlug?: string;
}): Promise<ResolvedSpecImportProject> {
  const slugCheck = validateProjectSlug(opts.mapSlugRaw);
  if (!slugCheck.ok) {
    throw new ObjectifiedCliError({
      message: `--map-project: ${slugCheck.message}`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: slugCheck.suggestion !== undefined ? `Try slug ${slugCheck.suggestion}` : undefined,
    });
  }
  const slug = slugCheck.slug;

  if (opts.cliProjectSlug !== undefined) {
    const other = validateProjectSlug(opts.cliProjectSlug);
    if (!other.ok) {
      throw new ObjectifiedCliError({
        message: other.message,
        exitCode: EXIT_CODES.VALIDATION,
        title: "Validation failed",
      });
    }
    if (other.slug !== slug) {
      throw new ObjectifiedCliError({
        message: `--project-slug (${other.slug}) must match --map-project (${slug}), or omit --project-slug.`,
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
      });
    }
  }

  const existing = await opts.api.getProjectBySlug(opts.tenant, slug);

  if (opts.cliProjectName !== undefined && normName(opts.cliProjectName) !== normName(existing.name)) {
    throw new ObjectifiedCliError({
      message: `--project-name does not match the mapped project '${slug}' on the server.`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Omit --project-name when using --map-project, or match the catalog project's display name.",
    });
  }

  return {
    existingProjectId: existing.id,
    project: projectTargetFromSchema(existing),
  };
}

export async function resolveCreateProjectImport(opts: {
  api: SpecImportProjectResolutionApi;
  tenant: string;
  project: SpecImportProjectTarget;
  domain?: string;
  visibility?: Visibility;
}): Promise<ResolvedSpecImportProject> {
  const slug = normalizeSlugInput(opts.project.slug);
  const existing = await tryGetProjectBySlug(opts.api, opts.tenant, slug);
  if (existing !== null) {
    throw new ObjectifiedCliError({
      message: `Project slug '${slug}' already exists for this tenant.`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Use --map-project to target it, or --create-or-map-project for idempotent automation.",
    });
  }

  const allowlistArr = await opts.api.fetchProjectDomainsAllowlist(opts.tenant);
  validateDomainAgainstAllowlist(opts.domain, new Set(allowlistArr));

  const domainNorm = normalizeDomainCategory(opts.domain) ?? null;
  const visibilityResolved: Visibility = opts.visibility ?? "private";

  const body = buildProjectCreateRequest({
    name: opts.project.name,
    slug: opts.project.slug,
    description: opts.project.description ?? null,
    domainCategory: domainNorm,
    visibility: visibilityResolved,
    baseMetadata: null,
  });

  const created = await opts.api.createProject(opts.tenant, body);
  return {
    existingProjectId: created.id,
    project: projectTargetFromSchema(created),
  };
}

function assertCreateOrMapMetadataCompatible(opts: {
  existing: ProjectSchema;
  expectedName: string;
  expectedDescription: string | null;
  hints: ImportProjectFieldHints;
  domain?: string;
  visibility?: Visibility;
}): void {
  const mismatches: string[] = [];
  if (normName(opts.existing.name) !== normName(opts.expectedName)) {
    mismatches.push("name");
  }

  if (opts.hints.descriptionProvided) {
    if (normDesc(opts.existing.description) !== normDesc(opts.expectedDescription)) {
      mismatches.push("description");
    }
  }

  if (opts.hints.domainProvided) {
    const want = normalizeDomainCategory(opts.domain) ?? null;
    const have = domainFromProjectMetadata(opts.existing);
    const wantNorm = want ?? null;
    const haveNorm = have ?? null;
    if (wantNorm !== haveNorm) {
      mismatches.push("domain");
    }
  }

  if (opts.hints.visibilityProvided) {
    if (opts.visibility === undefined) {
      mismatches.push("visibility");
    } else {
      const have = visibilityFromProjectMetadata(opts.existing);
      if (have === null || have !== opts.visibility) {
        mismatches.push("visibility");
      }
    }
  }

  if (mismatches.length > 0) {
    throw new ObjectifiedCliError({
      message: `Project slug '${opts.existing.slug}' already exists but ${mismatches.join(", ")} ${mismatches.length === 1 ? "differs" : "differ"} from what you supplied.`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Project metadata mismatch",
      hint: `Use --map-project ${opts.existing.slug} to attach without matching metadata, or choose another slug.`,
    });
  }
}

export async function resolveCreateOrMapProjectImport(opts: {
  api: SpecImportProjectResolutionApi;
  tenant: string;
  project: SpecImportProjectTarget;
  hints: ImportProjectFieldHints;
  domain?: string;
  visibility?: Visibility;
}): Promise<ResolvedSpecImportProject> {
  const slug = normalizeSlugInput(opts.project.slug);
  const existing = await tryGetProjectBySlug(opts.api, opts.tenant, slug);

  if (existing === null) {
    return resolveCreateProjectImport({
      api: opts.api,
      tenant: opts.tenant,
      project: opts.project,
      domain: opts.domain,
      visibility: opts.visibility,
    });
  }

  assertCreateOrMapMetadataCompatible({
    existing,
    expectedName: opts.project.name,
    expectedDescription: opts.project.description ?? null,
    hints: opts.hints,
    domain: opts.domain,
    visibility: opts.visibility,
  });

  return {
    existingProjectId: existing.id,
    project: projectTargetFromSchema(existing),
  };
}
