/**
 * Browser-local bookmarks for Git-based OpenAPI import (account + repo + ref + optional spec path).
 */

export type GitImportRefKind = 'branch' | 'tag';

export type GitImportSavedRepo = {
  id: string;
  accountId: string;
  provider: string;
  repoFullName: string;
  refKind: GitImportRefKind;
  refName: string;
  /** Normalized path without leading slashes; empty if none */
  specPath: string;
  savedAt: number;
};

const STORAGE_PREFIX = 'objectified:git-import-saved-repos:';
export const MAX_GIT_IMPORT_SAVED_REPOS = 50;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function gitImportSavedReposStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function normalizeGitImportSpecPath(raw: string): string {
  return raw.trim().replace(/^\/+/, '');
}

export function dedupeKeyGitImportSaved(
  e: Pick<GitImportSavedRepo, 'accountId' | 'provider' | 'repoFullName' | 'refKind' | 'refName' | 'specPath'>
): string {
  return `${e.accountId}|${e.provider.toLowerCase()}|${e.repoFullName.toLowerCase()}|${e.refKind}|${e.refName}|${e.specPath}`;
}

export function isGitImportSavedRepo(v: unknown): v is GitImportSavedRepo {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.accountId === 'string' &&
    typeof v.provider === 'string' &&
    typeof v.repoFullName === 'string' &&
    (v.refKind === 'branch' || v.refKind === 'tag') &&
    typeof v.refName === 'string' &&
    typeof v.specPath === 'string' &&
    typeof v.savedAt === 'number' &&
    Number.isFinite(v.savedAt)
  );
}

export function loadGitImportSavedRepos(userId: string): GitImportSavedRepo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(gitImportSavedReposStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isGitImportSavedRepo)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveGitImportSavedRepos(userId: string, items: GitImportSavedRepo[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(gitImportSavedReposStorageKey(userId), JSON.stringify(items));
  } catch {
    // quota or private mode
  }
}

function newSavedId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `git-import-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function addGitImportSavedRepo(
  userId: string,
  entry: Omit<GitImportSavedRepo, 'id' | 'savedAt'>
): GitImportSavedRepo[] {
  const existing = loadGitImportSavedRepos(userId);
  const key = dedupeKeyGitImportSaved(entry);
  const filtered = existing.filter((e) => dedupeKeyGitImportSaved(e) !== key);
  const newEntry: GitImportSavedRepo = {
    ...entry,
    id: newSavedId(),
    savedAt: Date.now(),
  };
  const next = [newEntry, ...filtered].slice(0, MAX_GIT_IMPORT_SAVED_REPOS);
  saveGitImportSavedRepos(userId, next);
  return next;
}

export function removeGitImportSavedRepo(userId: string, id: string): GitImportSavedRepo[] {
  const existing = loadGitImportSavedRepos(userId);
  const next = existing.filter((e) => e.id !== id);
  saveGitImportSavedRepos(userId, next);
  return next;
}
