import { describe, expect, it } from "vitest";

import { normalizeProjectDomainsApiPayload } from "../src/lib/projects/domains-payload.js";

describe("normalizeProjectDomainsApiPayload (#3204)", () => {
  it("parses string arrays", () => {
    expect(normalizeProjectDomainsApiPayload(["finance", "saas"])).toEqual(["finance", "saas"]);
  });

  it("parses objects with id", () => {
    expect(
      normalizeProjectDomainsApiPayload([{ id: "finance" }, { id: "iot", label: "x" }]),
    ).toEqual(["finance", "iot"]);
  });

  it("parses domains wrapper", () => {
    expect(normalizeProjectDomainsApiPayload({ domains: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("parses items wrapper", () => {
    expect(normalizeProjectDomainsApiPayload({ items: [{ id: "media" }] })).toEqual(["media"]);
  });
});
