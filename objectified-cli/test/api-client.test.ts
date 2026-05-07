import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/lib/client.js";

describe("createApiClient + generated SDK", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("listProjects performs GET /v1/projects/{tenant_slug}", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
      expect(url).toContain("/v1/projects/acme-corp");
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "unit-test-req",
        },
      });
    });

    globalThis.fetch = mockFetch as typeof fetch;

    const auth = {};
    const api = createApiClient({
      baseUrl: "http://127.0.0.1:9",
      auth,
    });

    await expect(api.listProjects("acme-corp")).resolves.toEqual([]);
    expect(mockFetch).toHaveBeenCalled();
    expect(api.lastRequestId).toBe("unit-test-req");
  });
});
