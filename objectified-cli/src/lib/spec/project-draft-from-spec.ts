import path from "node:path";

import YAML from "yaml";

import { suggestSlugFromName, validateProjectSlug } from "../projects/project-slug.js";

/** Mirrors UI `RepositorySpecFormat` for specs we can derive a project draft from. */
export type SpecRepositoryFormat = "openapi" | "swagger2" | "asyncapi" | "arazzo" | "unknown";

/** Same field mapping as `objectified-ui/lib/project-draft-from-repository-spec.ts`. */
export type SpecProjectDraft = {
  projectName: string;
  projectSlugSuggestion: string;
  projectDescription: string;
  metadataSummary: string;
  metadataTermsOfService: string;
  metadataContactName: string;
  metadataContactUrl: string;
  metadataContactEmail: string;
  metadataLicenseName: string;
  metadataLicenseIdentifier: string;
  metadataLicenseUrl: string;
};

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function parseRoot(
  content: string,
  filePath: string,
): { root: Record<string, unknown> } | { error: string } {
  const t = content.trim();
  if (!t) return { error: "Empty file" };
  const lowerPath = filePath.toLowerCase();
  const preferJson = lowerPath.endsWith(".json") || lowerPath.endsWith(".avsc");
  if (preferJson && (t.startsWith("{") || t.startsWith("["))) {
    try {
      const root = JSON.parse(t) as unknown;
      if (root && typeof root === "object" && !Array.isArray(root)) {
        return { root: root as Record<string, unknown> };
      }
      return { error: "Expected a JSON object at the root" };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const root = JSON.parse(t) as unknown;
      if (root && typeof root === "object" && !Array.isArray(root)) {
        return { root: root as Record<string, unknown> };
      }
    } catch {
      /* YAML */
    }
  }
  try {
    const root: unknown = YAML.parse(t);
    if (root && typeof root === "object" && !Array.isArray(root)) {
      return { root: root as Record<string, unknown> };
    }
    return { error: "Expected a YAML mapping at the root" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid YAML" };
  }
}

function detectFormat(root: Record<string, unknown>): SpecRepositoryFormat {
  if (root.openapi != null) return "openapi";
  const sv = root.swagger;
  if (typeof sv === "string" && sv.trim().startsWith("2.")) return "swagger2";
  if (typeof sv === "number" && Number.isFinite(sv) && sv >= 2 && sv < 3) return "swagger2";
  if (root.asyncapi != null) return "asyncapi";
  if (root.arazzo != null) return "arazzo";
  return "unknown";
}

function licenseFromOpenApi3(lic: unknown): { name: string; identifier: string; url: string } {
  if (!lic || typeof lic !== "object" || Array.isArray(lic)) {
    return { name: "", identifier: "", url: "" };
  }
  const o = lic as Record<string, unknown>;
  return {
    name: str(o.name),
    identifier: str(o.identifier),
    url: str(o.url),
  };
}

function contactFromInfo(contact: unknown): { name: string; url: string; email: string } {
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
    return { name: "", url: "", email: "" };
  }
  const o = contact as Record<string, unknown>;
  return {
    name: str(o.name),
    url: str(o.url),
    email: str(o.email),
  };
}

function basenameStem(filePath: string): string {
  const base = path.basename(filePath).replace(/\.(ya?ml|json|avsc)$/i, "");
  return base.trim() !== "" ? base : "project";
}

/** Derives a CLI-valid slug from `info.title` (and path fallback), matching Map & Import behavior. */
export function suggestProjectSlugFromSpec(displayName: string, filePath: string): string {
  const nameStem = displayName.trim() !== "" ? displayName.trim() : basenameStem(filePath);
  const candidate = suggestSlugFromName(nameStem);
  const checked = validateProjectSlug(candidate);
  if (checked.ok) {
    return checked.slug;
  }
  if (checked.suggestion !== undefined) {
    const second = validateProjectSlug(checked.suggestion);
    if (second.ok) {
      return second.slug;
    }
  }
  const fallback = validateProjectSlug("project");
  if (fallback.ok) {
    return fallback.slug;
  }
  return "project";
}

/** OpenAPI-style metadata block for `ProjectCreateRequest.metadata` (UI parity). */
export function metadataRecordFromSpecDraft(draft: SpecProjectDraft): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (draft.metadataSummary.trim() !== "") {
    meta.summary = draft.metadataSummary.trim();
  }
  if (draft.metadataTermsOfService.trim() !== "") {
    meta.termsOfService = draft.metadataTermsOfService.trim();
  }
  if (
    draft.metadataContactName.trim() !== "" ||
    draft.metadataContactUrl.trim() !== "" ||
    draft.metadataContactEmail.trim() !== ""
  ) {
    meta.contact = {};
    if (draft.metadataContactName.trim() !== "") {
      (meta.contact as Record<string, string>).name = draft.metadataContactName.trim();
    }
    if (draft.metadataContactUrl.trim() !== "") {
      (meta.contact as Record<string, string>).url = draft.metadataContactUrl.trim();
    }
    if (draft.metadataContactEmail.trim() !== "") {
      (meta.contact as Record<string, string>).email = draft.metadataContactEmail.trim();
    }
  }
  if (
    draft.metadataLicenseName.trim() !== "" ||
    draft.metadataLicenseIdentifier.trim() !== "" ||
    draft.metadataLicenseUrl.trim() !== ""
  ) {
    meta.license = {};
    if (draft.metadataLicenseName.trim() !== "") {
      (meta.license as Record<string, string>).name = draft.metadataLicenseName.trim();
    }
    if (draft.metadataLicenseIdentifier.trim() !== "") {
      (meta.license as Record<string, string>).identifier = draft.metadataLicenseIdentifier.trim();
    }
    if (draft.metadataLicenseUrl.trim() !== "") {
      (meta.license as Record<string, string>).url = draft.metadataLicenseUrl.trim();
    }
  }
  return meta;
}

/**
 * Port of `projectDraftFromRepositorySpec` (UI): same parser and `info.*` mapping.
 * Slug suggestion uses `suggestSlugFromName` + `validateProjectSlug` for CLI constraints.
 */
export function projectDraftFromSpecContent(
  content: string,
  filePath: string,
):
  | { ok: true; draft: SpecProjectDraft; format: SpecRepositoryFormat }
  | { ok: false; reason: string } {
  const parsed = parseRoot(content, filePath);
  if ("error" in parsed) {
    return { ok: false, reason: parsed.error };
  }

  const fmt = detectFormat(parsed.root);
  if (fmt !== "openapi" && fmt !== "swagger2" && fmt !== "asyncapi" && fmt !== "arazzo") {
    return {
      ok: false,
      reason:
        "This file does not expose an OpenAPI-, Swagger-, AsyncAPI-, or Arazzo-style info block to copy from. Use --project with an existing project or pick another spec.",
    };
  }

  const info =
    parsed.root.info !== undefined &&
    parsed.root.info !== null &&
    typeof parsed.root.info === "object" &&
    !Array.isArray(parsed.root.info)
      ? (parsed.root.info as Record<string, unknown>)
      : {};

  const title = str(info.title) || str(info.summary);
  const description = str(info.description);

  let terms = str(info.termsOfService);
  const contact = contactFromInfo(info.contact);

  let licName = "";
  let licId = "";
  let licUrl = "";
  const licRaw = info.license;
  if (fmt === "swagger2") {
    if (typeof licRaw === "string") {
      licName = licRaw;
    } else if (licRaw && typeof licRaw === "object" && !Array.isArray(licRaw)) {
      const o = licRaw as Record<string, unknown>;
      licName = str(o.name);
      licUrl = str(o.url);
    }
  } else {
    const L = licenseFromOpenApi3(licRaw);
    licName = L.name;
    licId = L.identifier;
    licUrl = L.url;
  }

  const externalDocs = parsed.root.externalDocs;
  if (
    !terms &&
    externalDocs !== undefined &&
    externalDocs !== null &&
    typeof externalDocs === "object" &&
    !Array.isArray(externalDocs)
  ) {
    const desc = str((externalDocs as Record<string, unknown>).description).toLowerCase();
    if (desc.includes("terms")) {
      terms = str((externalDocs as Record<string, unknown>).url);
    }
  }

  if (!title && !description && !contact.name && !licName && !licId) {
    return {
      ok: false,
      reason: "No title, description, contact, or license was found in the spec info to copy.",
    };
  }

  const projectName = title !== "" ? title : "Imported API";
  const slugSuggestion = suggestProjectSlugFromSpec(projectName, filePath);

  const draft: SpecProjectDraft = {
    projectName,
    projectSlugSuggestion: slugSuggestion,
    projectDescription: description,
    metadataSummary: description !== "" ? description.slice(0, 500) : title,
    metadataTermsOfService: terms,
    metadataContactName: contact.name,
    metadataContactUrl: contact.url,
    metadataContactEmail: contact.email,
    metadataLicenseName: licName,
    metadataLicenseIdentifier: licId,
    metadataLicenseUrl: licUrl,
  };

  return { ok: true, draft, format: fmt };
}
