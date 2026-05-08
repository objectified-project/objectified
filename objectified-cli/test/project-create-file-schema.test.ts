import { describe, expect, it } from "vitest";

import { validateProjectCreateFileJson } from "../src/lib/projects/project-create-file-schema.js";

describe("project create file JSON Schema (#3204)", () => {
  it("accepts minimal valid documents", () => {
    const v = validateProjectCreateFileJson({
      name: "X",
      slug: "x-api",
    });
    expect(v.name).toBe("X");
    expect(v.slug).toBe("x-api");
  });

  it("rejects unknown top-level keys", () => {
    expect(() =>
      validateProjectCreateFileJson({
        name: "X",
        slug: "x-api",
        extra: true,
      }),
    ).toThrow(/additional properties/i);
  });

  it("accepts domain alias and visibility", () => {
    const v = validateProjectCreateFileJson({
      name: "Shop",
      slug: "shop-api",
      domain: "finance",
      visibility: "private",
      metadata: { foo: "bar" },
    });
    expect(v.domain).toBe("finance");
    expect(v.visibility).toBe("private");
    expect(v.metadata).toEqual({ foo: "bar" });
  });
});
