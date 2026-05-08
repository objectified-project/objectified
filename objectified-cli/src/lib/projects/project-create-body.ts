import type { ProjectCreateRequest } from "../client.js";

import { PROJECT_DOMAIN_CATEGORY_NONE } from "./domain-categories.js";

export type Visibility = "private" | "public";

export type NormalizedProjectCreateFields = {
  name: string;
  slug: string;
  description?: string | null;
  /** Empty / none → omit domainCategory in metadata. */
  domainCategory?: string | null;
  visibility: Visibility;
  /** Merged into metadata after domain + visibility (caller strips conflicting keys if needed). */
  baseMetadata?: Record<string, unknown> | null;
};

export function buildProjectCreateRequest(
  input: NormalizedProjectCreateFields,
): ProjectCreateRequest {
  const description =
    typeof input.description === "string" && input.description.trim() !== ""
      ? input.description.trim()
      : null;

  const meta: Record<string, unknown> = {};
  if (input.baseMetadata && typeof input.baseMetadata === "object") {
    for (const [k, v] of Object.entries(input.baseMetadata)) {
      meta[k] = v;
    }
  }

  const domainRaw = input.domainCategory?.trim() ?? "";
  const domain =
    domainRaw === "" || domainRaw === PROJECT_DOMAIN_CATEGORY_NONE ? undefined : domainRaw;

  if (domain !== undefined) {
    meta.domainCategory = domain;
  }

  meta.visibility = input.visibility;

  return {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    description,
    metadata: Object.keys(meta).length > 0 ? meta : null,
  };
}
