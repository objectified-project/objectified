/** #3204 acceptance: `^[a-z][a-z0-9-]{1,62}$` → length 2–63 inclusive. */
export const PROJECT_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;

export type SlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; message: string; suggestion?: string };

export function normalizeSlugInput(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Derives a slug suggestion from a display name (does not guarantee pattern match if name is empty).
 */
export function suggestSlugFromName(name: string): string {
  let s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  if (s.length === 0) return "project";

  if (!/^[a-z]/.test(s)) {
    s = `p-${s}`;
  }

  s = s.replace(/_/g, "-");

  if (s.length > 63) {
    s = s.slice(0, 63).replace(/-+$/, "");
    if (s.length < 2) s = "pr";
  }

  if (s.length < 2) {
    s = `${s}x`;
  }

  if (!PROJECT_SLUG_PATTERN.test(s)) {
    return "project";
  }

  return s;
}

export function validateProjectSlug(raw: string): SlugValidationResult {
  const slug = normalizeSlugInput(raw);
  if (slug === "") {
    return { ok: false, message: "Project slug is required.", suggestion: "project" };
  }
  if (PROJECT_SLUG_PATTERN.test(slug)) {
    return { ok: true, slug };
  }

  const suggestion = suggestSlugFromName(slug.replace(/_/g, "-"));
  let hint = `Slug must match ${PROJECT_SLUG_PATTERN.source}.`;
  if (slug.includes("_")) {
    hint += " Underscores are not allowed; use hyphens.";
  }
  return {
    ok: false,
    message: hint,
    suggestion: PROJECT_SLUG_PATTERN.test(suggestion) ? suggestion : undefined,
  };
}
