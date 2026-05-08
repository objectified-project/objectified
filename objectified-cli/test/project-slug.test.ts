import { describe, expect, it } from "vitest";

import {
  PROJECT_SLUG_PATTERN,
  suggestSlugFromName,
  validateProjectSlug,
} from "../src/lib/projects/project-slug.js";

describe("project slug helpers (#3204)", () => {
  it("accepts slugs matching the ticket regex", () => {
    expect(PROJECT_SLUG_PATTERN.test("ab")).toBe(true);
    expect(PROJECT_SLUG_PATTERN.test("payments-api")).toBe(true);
    expect(PROJECT_SLUG_PATTERN.test(`a${"b".repeat(61)}`)).toBe(true);
  });

  it("rejects underscore and lowercases input", () => {
    expect(validateProjectSlug("pay_api").ok).toBe(false);
    const r = validateProjectSlug("Pay-api");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("pay-api");
  });

  it("suggestSlugFromName produces a valid slug for typical titles", () => {
    const s = suggestSlugFromName("Payments API");
    expect(PROJECT_SLUG_PATTERN.test(s)).toBe(true);
    expect(s).toBe("payments-api");
  });
});
