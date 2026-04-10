/**
 * Client-side helpers for schema revision deprecation (versions.metadata) — #507.
 * Keep in sync with objectified-rest `revision_deprecation.py`.
 */

export const MIGRATION_GUIDE_ISSUE_URL = 'https://github.com/KenSuenobu/objectified/issues/747';

export function isRevisionDeprecated(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as Record<string, unknown>;
  const d = m.deprecated;
  if (d === true) return true;
  if (typeof d === 'string' && ['true', '1', 'yes'].includes(d.toLowerCase())) return true;
  return false;
}

export function revisionDeprecationLines(metadata: unknown): string[] {
  if (!isRevisionDeprecated(metadata)) return [];
  const m = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>;
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
