/**
 * REST list/detail payloads use `shortMessage` for the revision note; legacy/UI code often used `description`.
 */
export function getVersionRevisionNote(version: {
  description?: string | null;
  shortMessage?: string | null;
}): string {
  const d = typeof version.description === 'string' ? version.description.trim() : '';
  if (d) return d;
  const s = typeof version.shortMessage === 'string' ? version.shortMessage.trim() : '';
  return s;
}

/** Label for project/version dropdowns: semver + revision note when present. */
export function formatVersionSelectorLabel(version: {
  version_id: string;
  description?: string | null;
  shortMessage?: string | null;
  published?: boolean;
}): string {
  const lock = version.published ? '🔒 ' : '';
  const note = getVersionRevisionNote(version);
  if (note) return `${lock}${version.version_id} - ${note}`;
  return `${lock}${version.version_id}`;
}
