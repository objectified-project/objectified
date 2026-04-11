/**
 * Client-side helpers for schema revision deprecation (versions.metadata) — #507.
 * Keep in sync with objectified-rest `revision_deprecation.py`.
 * Accepts either a plain object or a JSON string (matching the backend `coerce_metadata` helper).
 */

export const MIGRATION_GUIDE_ISSUE_URL =
  'https://github.com/KenSuenobu/objectified-commercial/issues/747';

function coerceMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export function isRevisionDeprecated(metadata: unknown): boolean {
  const m = coerceMetadata(metadata);
  const d = m.deprecated;
  if (d === true) return true;
  if (typeof d === 'string' && ['true', '1', 'yes'].includes(d.toLowerCase())) return true;
  return false;
}

export function revisionDeprecationLines(metadata: unknown): string[] {
  if (!isRevisionDeprecated(metadata)) return [];
  const m = coerceMetadata(metadata);
  const lines: string[] = [];
  const msg = m.deprecationMessage ?? m.message;
  if (typeof msg === 'string' && msg.trim()) lines.push(msg.trim());
  const succ = m.successorRevisionId ?? m.successor_revision_id;
  if (typeof succ === 'string' && succ.trim()) {
    lines.push(`Successor revision: ${succ.trim()}.`);
  }
  const sunset = m.sunsetDate ?? m.sunset_date;
  if (typeof sunset === 'string' && sunset.trim()) {
    lines.push(`Sunset: ${sunset.trim()}.`);
  }
  lines.push(`Migration guide: ${MIGRATION_GUIDE_ISSUE_URL}`);
  return lines;
}
