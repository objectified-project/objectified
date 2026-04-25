/**
 * Browser-local favorites for the Repositories list. Scoped to the device,
 * not the user, so they survive logout/login on the same browser without
 * needing a backend column.
 */

const STORAGE_KEY = 'objectified:repository-favorites';

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    return true;
  } catch {
    return false;
  }
}

export function loadRepositoryFavorites(): Set<string> {
  return readSet();
}

export function isRepositoryFavorite(repositoryId: string): boolean {
  return readSet().has(repositoryId);
}

/** Toggle membership and persist; returns the resulting set. */
export function toggleRepositoryFavorite(repositoryId: string): Set<string> {
  const next = readSet();
  if (next.has(repositoryId)) {
    next.delete(repositoryId);
  } else {
    next.add(repositoryId);
  }
  writeSet(next);
  return next;
}
