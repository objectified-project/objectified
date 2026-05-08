import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/lib/client.js";
import { redactApiKeyForLogs } from "../src/lib/redact-api-key.js";

describe("createApiClient + generated SDK", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("does not send Authorization when an API key is set (API key wins)", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.headers.get("x-api-key")).toBe("sk_live_abc");
      expect(request.headers.get("authorization")).toBeNull();
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const auth: { apiKey?: string; bearer?: string } = {
      apiKey: "sk_live_abc",
      bearer: "should-not-send",
    };
    const api = createApiClient({
      baseUrl: "http://127.0.0.1:9",
      auth,
    });

    await expect(api.listProjects("acme-corp")).resolves.toEqual([]);
  });

  it("verbose logs redact API keys (#3195)", async () => {
    const lines: string[] = [];
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-request-id": "r1" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({
      baseUrl: "http://127.0.0.1:9",
      auth: { apiKey: "sk_live_secret_suffix" },
      verbose: true,
      stderrWrite: (line) => lines.push(line),
    });

    await api.listProjects("acme-corp");
    const joined = lines.join("\n");
    expect(joined).not.toContain("secret_suffix");
    expect(joined).toContain(`api-key=${redactApiKeyForLogs("sk_live_secret_suffix")}`);
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

  it("accepts projects payloads where enabled is omitted or null", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify([
          { id: "p1", tenant_id: "t1", name: "Alpha", slug: "alpha" },
          { id: "p2", tenant_id: "t1", name: "Beta", slug: "beta", enabled: null },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({
      baseUrl: "http://127.0.0.1:9",
      auth: {},
    });

    await expect(api.listProjects("acme-corp")).resolves.toEqual([
      { id: "p1", tenant_id: "t1", name: "Alpha", slug: "alpha", enabled: true },
      { id: "p2", tenant_id: "t1", name: "Beta", slug: "beta", enabled: true },
    ]);
  });

  it("retries once on 401 after onUnauthorized refresh", async () => {
    const auth: { apiKey?: string } = { apiKey: "old-key" };
    const seenKeys: Array<string | null> = [];
    let calls = 0;
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      seenKeys.push(request.headers.get("x-api-key"));
      calls++;
      if (calls === 1) return new Response("unauthorized", { status: 401 });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const onUnauthorized = vi.fn(async () => {
      auth.apiKey = "new-key";
    });

    const api = createApiClient({
      baseUrl: "http://127.0.0.1:9",
      auth,
      onUnauthorized,
    });

    await expect(api.listProjects("acme-corp")).resolves.toEqual([]);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(seenKeys).toEqual(["old-key", "new-key"]);
  });

  it("retries 429 using Retry-After delay", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const mockFetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "1" },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({
      baseUrl: "http://127.0.0.1:9",
      auth: {},
    });

    const pending = api.listProjects("acme-corp");
    await vi.runAllTicks();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries transient 5xx with exponential backoff", async () => {
    vi.useFakeTimers();

    let calls = 0;
    const mockFetch = vi.fn(async () => {
      calls++;
      if (calls < 3) return new Response("upstream unavailable", { status: 503 });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({
      baseUrl: "http://127.0.0.1:9",
      auth: {},
    });

    const pending = api.listProjects("acme-corp");
    await vi.runAllTicks();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(250);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("listMyTenantsPage performs GET /v1/tenants/me with query", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
      expect(url).toContain("/v1/tenants/me");
      expect(url).toMatch(/limit=25/);
      expect(url).toMatch(/offset=10/);
      return new Response(
        JSON.stringify({
          items: [{ slug: "a", name: "A", role: "member" }],
          total: 1,
          limit: 25,
          offset: 10,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({ baseUrl: "http://127.0.0.1:9", auth: { apiKey: "k" } });
    const page = await api.listMyTenantsPage(25, 10);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });

  it("getTenantInfo performs GET /v1/tenants/{slug}", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
      expect(url).toContain("/v1/tenants/acme-corp");
      return new Response(
        JSON.stringify({
          slug: "acme-corp",
          name: "Acme",
          plan: null,
          created_at: "2024-08-12",
          members_count: 2,
          projects_count: 1,
          versions_count: 5,
          published_versions_count: 1,
          storage_used_bytes: null,
          storage_quota_bytes: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({ baseUrl: "http://127.0.0.1:9", auth: { apiKey: "k" } });
    const info = await api.getTenantInfo("acme-corp");
    expect(info.slug).toBe("acme-corp");
    expect(info.members_count).toBe(2);
  });

  it("verifyTenantAccess performs HEAD /v1/tenants/{slug}", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe("HEAD");
      expect(request.url).toContain("/v1/tenants/acme-corp");
      return new Response(null, { status: 200 });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({ baseUrl: "http://127.0.0.1:9", auth: { apiKey: "k" } });
    await expect(api.verifyTenantAccess("acme-corp")).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalled();
  });

  it("listPublicBrowseTenants performs GET /v1/browse/tenants without requiring credentials", async () => {
    const body = {
      directory_stats: { tenant_count: 1, project_count: 2, version_count: 5 },
      tenants: [
        {
          slug: "demo",
          name: "Demo",
          project_count: 2,
          published_versions: 5,
          latest_version: "1.0.0",
          latest_activity_at: "2026-01-01T00:00:00Z",
        },
      ],
      filtered_count: 1,
    };
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe("GET");
      const u = new URL(request.url);
      expect(u.pathname.endsWith("/v1/browse/tenants")).toBe(true);
      expect(u.searchParams.get("sort")).toBe("latest");
      expect(u.searchParams.get("search")).toBe("demo");
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("x-api-key")).toBeNull();
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({ baseUrl: "http://127.0.0.1:9", auth: {} });
    const out = await api.listPublicBrowseTenants({ search: "demo", sort: "latest" });
    expect(out.directory_stats.tenant_count).toBe(1);
    expect(out.tenants).toHaveLength(1);
    expect(out.tenants[0]?.slug).toBe("demo");
    expect(out.filtered_count).toBe(1);
  });

  it("listPublicBrowseProjects performs GET /v1/browse/tenants/{slug}/projects", async () => {
    const body = {
      tenant_slug: "acme-corp",
      tenant_name: "Acme",
      projects: [
        {
          slug: "payments-api",
          name: "Payments API",
          domain: "finance",
          published_versions: 2,
          latest_version: "1.0.0",
          latest_published_at: null,
        },
      ],
      filtered_count: 1,
    };
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe("GET");
      const u = new URL(request.url);
      expect(u.pathname.endsWith("/v1/browse/tenants/acme-corp/projects")).toBe(true);
      expect(u.searchParams.get("search")).toBe("pay");
      expect(u.searchParams.get("domain")).toBe("finance");
      expect(u.searchParams.get("has_published")).toBe("true");
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({ baseUrl: "http://127.0.0.1:9", auth: { apiKey: "k" } });
    const out = await api.listPublicBrowseProjects({
      tenantSlug: "acme-corp",
      search: "pay",
      domain: "finance",
      hasPublished: true,
    });
    expect(out.tenant_slug).toBe("acme-corp");
    expect(out.projects).toHaveLength(1);
    expect(out.projects[0]?.slug).toBe("payments-api");
    expect(out.filtered_count).toBe(1);
  });

  it("listPublicBrowseVersions performs GET /v1/browse/tenants/{tenant}/projects/{project}/versions", async () => {
    const body = {
      tenant_slug: "acme-corp",
      tenant_name: "Acme",
      project_slug: "payments-api",
      project_name: "Payments API",
      versions: [
        {
          id: "vid-1",
          version_id: "2.1.0",
          published_at: "2026-05-04T12:00:00.000Z",
          tags: ["stable", "latest"],
          changes_summary: "+2 paths vs v2.0.0",
          description: null,
          change_log: null,
        },
      ],
      filtered_count: 1,
    };
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe("GET");
      const u = new URL(request.url);
      expect(u.pathname.endsWith("/v1/browse/tenants/acme-corp/projects/payments-api/versions")).toBe(true);
      expect(u.searchParams.get("since")).toBe("2026-02-01");
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({ baseUrl: "http://127.0.0.1:9", auth: {} });
    const out = await api.listPublicBrowseVersions({
      tenantSlug: "acme-corp",
      projectSlug: "payments-api",
      since: "2026-02-01",
    });
    expect(out.versions).toHaveLength(1);
    expect(out.versions[0]?.version_id).toBe("2.1.0");
    expect(out.versions[0]?.tags).toEqual(["stable", "latest"]);
    expect(out.filtered_count).toBe(1);
  });
});
