import YAML from 'yaml';
import type { RepositorySpecFormat } from './repository-file-spec-metadata';

export type RepositorySpecProjectDraft = {
  projectName: string;
  projectSlug: string;
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
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function parseRoot(content: string, path: string): { root: Record<string, unknown> } | { error: string } {
  const t = content.trim();
  if (!t) return { error: 'Empty file' };
  const lowerPath = path.toLowerCase();
  const preferJson = lowerPath.endsWith('.json') || lowerPath.endsWith('.avsc');
  if (preferJson && (t.startsWith('{') || t.startsWith('['))) {
    try {
      const root = JSON.parse(t) as unknown;
      if (root && typeof root === 'object' && !Array.isArray(root)) {
        return { root: root as Record<string, unknown> };
      }
      return { error: 'Expected a JSON object at the root' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const root = JSON.parse(t) as unknown;
      if (root && typeof root === 'object' && !Array.isArray(root)) {
        return { root: root as Record<string, unknown> };
      }
    } catch {
      /* YAML */
    }
  }
  try {
    const root = YAML.parse(t);
    if (root && typeof root === 'object' && !Array.isArray(root)) {
      return { root: root as Record<string, unknown> };
    }
    return { error: 'Expected a YAML mapping at the root' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid YAML' };
  }
}

function detectFormat(root: Record<string, unknown>): RepositorySpecFormat {
  if (root.openapi != null) return 'openapi';
  const sv = root.swagger;
  if (typeof sv === 'string' && sv.trim().startsWith('2.')) return 'swagger2';
  if (typeof sv === 'number' && Number.isFinite(sv) && sv >= 2 && sv < 3) return 'swagger2';
  if (root.asyncapi != null) return 'asyncapi';
  if (root.arazzo != null) return 'arazzo';
  return 'unknown';
}

function licenseFromOpenApi3(lic: unknown): { name: string; identifier: string; url: string } {
  if (!lic || typeof lic !== 'object' || Array.isArray(lic)) {
    return { name: '', identifier: '', url: '' };
  }
  const o = lic as Record<string, unknown>;
  return {
    name: str(o.name),
    identifier: str(o.identifier),
    url: str(o.url),
  };
}

function contactFromInfo(contact: unknown): { name: string; url: string; email: string } {
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return { name: '', url: '', email: '' };
  }
  const o = contact as Record<string, unknown>;
  return {
    name: str(o.name),
    url: str(o.url),
    email: str(o.email),
  };
}

/**
 * Pull OpenAPI-style `info` fields into the same shape as the Create Project manual form.
 * Returns null if the document does not have a usable info block for this flow.
 */
export function projectDraftFromRepositorySpec(
  content: string,
  path: string
): { ok: true; draft: RepositorySpecProjectDraft; format: RepositorySpecFormat } | { ok: false; reason: string } {
  const parsed = parseRoot(content, path);
  if ('error' in parsed) return { ok: false, reason: parsed.error };

  const fmt = detectFormat(parsed.root);
  if (
    fmt !== 'openapi' &&
    fmt !== 'swagger2' &&
    fmt !== 'asyncapi' &&
    fmt !== 'arazzo'
  ) {
    return {
      ok: false,
      reason:
        'This file does not expose an OpenAPI-, Swagger-, AsyncAPI-, or Arazzo-style info block to copy from. Fill the form manually or pick another spec.',
    };
  }

  const info = parsed.root.info && typeof parsed.root.info === 'object' && !Array.isArray(parsed.root.info)
    ? (parsed.root.info as Record<string, unknown>)
    : {};

  const title = str(info.title) || str(info.summary);
  const description = str(info.description);

  let terms = str(info.termsOfService);
  const contact = contactFromInfo(info.contact);

  let licName = '';
  let licId = '';
  let licUrl = '';
  const licRaw = info.license;
  if (fmt === 'swagger2') {
    if (typeof licRaw === 'string') {
      licName = licRaw;
    } else if (licRaw && typeof licRaw === 'object' && !Array.isArray(licRaw)) {
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
  if (!terms && externalDocs && typeof externalDocs === 'object' && !Array.isArray(externalDocs)) {
    const desc = str((externalDocs as Record<string, unknown>).description).toLowerCase();
    if (desc.includes('terms')) {
      terms = str((externalDocs as Record<string, unknown>).url);
    }
  }

  if (!title && !description && !contact.name && !licName && !licId) {
    return {
      ok: false,
      reason: 'No title, description, contact, or license was found in the spec info to copy.',
    };
  }

  const slugBase = title || path.split('/').pop()?.replace(/\.(ya?ml|json)$/i, '') || 'project';
  const slug = slugBase
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const draft: RepositorySpecProjectDraft = {
    projectName: title || 'Imported API',
    projectSlug: slug || 'project',
    projectDescription: description,
    metadataSummary: description ? description.slice(0, 500) : title,
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
