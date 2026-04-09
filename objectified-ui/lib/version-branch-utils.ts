/** Validation for git-like version branch names (no "use server" — sync helpers for UI and server). */

const VERSION_BRANCH_NAME_RE = /^[a-zA-Z][a-zA-Z0-9._\-/]{0,254}$/;

export function isValidVersionBranchName(name: string): boolean {
  return VERSION_BRANCH_NAME_RE.test(name.trim());
}
