import { describe, expect, it } from "vitest";

import { parseRetryAfterMs } from "../src/lib/client.js";

describe("parseRetryAfterMs", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfterMs("3")).toBe(3000);
    expect(parseRetryAfterMs("0")).toBe(0);
  });

  it("returns undefined for unusable values", () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs("")).toBeUndefined();
    expect(parseRetryAfterMs("not-a-number")).toBeUndefined();
  });

  it("parses HTTP-date Retry-After", () => {
    const when = new Date(Date.now() + 8000).toUTCString();
    const ms = parseRetryAfterMs(when);
    expect(ms).toBeDefined();
    if (ms === undefined) throw new Error("expected Retry-After delta");
    expect(ms).toBeGreaterThan(1000);
    expect(ms).toBeLessThanOrEqual(120_000);
  });
});
