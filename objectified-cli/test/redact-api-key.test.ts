import { describe, expect, it } from "vitest";

import { redactApiKeyForLogs } from "../src/lib/redact-api-key.js";

describe("redactApiKeyForLogs", () => {
  it("redacts sk_ and pk_ prefixes", () => {
    expect(redactApiKeyForLogs("sk_live_abcdef")).toBe("sk_***");
    expect(redactApiKeyForLogs("pk_test_xyz")).toBe("pk_***");
  });

  it("redacts unknown shapes", () => {
    expect(redactApiKeyForLogs("opaque")).toBe("***");
  });
});
