import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/lib/client.js";

describe("spec import REST client (stubbed fetch)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("POST start (202), GET poll, POST commit (200), GET completed", async () => {
    const tenant = "acme";
    let statusCalls = 0;
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const req = input instanceof Request ? input : new Request(input);
      const url = req.url;
      if (
        req.method === "POST" &&
        url.endsWith(`/v1/tenants/${tenant}/imports`) &&
        !url.includes("/upload")
      ) {
        const body = await req.clone().json();
        expect(body.document_base64).toBeDefined();
        expect(body.metadata.source_kind).toBe("openapi-3");
        return new Response(
          JSON.stringify({
            job_id: "job-1",
            status_path: `/v1/tenants/${tenant}/imports/job-1`,
          }),
          { status: 202, headers: { "Content-Type": "application/json", "x-request-id": "r0" } },
        );
      }
      if (req.method === "GET" && url.includes(`/imports/job-1`) && !url.includes("/stream")) {
        statusCalls++;
        const payload =
          statusCalls === 1
            ? { job_id: "job-1", state: "running", percent: 40 }
            : statusCalls === 2
              ? { job_id: "job-1", state: "pending-approval", percent: 100 }
              : {
                  job_id: "job-1",
                  state: "completed",
                  percent: 100,
                  result: {
                    project_slug: "pay",
                    project_id: "p1",
                    version_id: "1.0.0",
                    version_record_id: "vr1",
                  },
                };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (req.method === "POST" && url.includes(`/imports/job-1/commit`)) {
        return new Response(
          JSON.stringify({
            job_id: "job-1",
            state: "completed",
            project_id: "p1",
            project_slug: "pay",
            version_id: "1.0.0",
            version_record_id: "vr1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("unexpected", { status: 500 });
    });

    globalThis.fetch = mockFetch as typeof fetch;

    const api = createApiClient({ baseUrl: "http://127.0.0.1:9", auth: { apiKey: "sk_test" } });

    const started = await api.startSpecImportJson(tenant, {
      metadata: {
        source_kind: "openapi-3",
        project: { name: "Pay", slug: "pay" },
        version: { version_id: "1.0.0" },
      },
      document_base64: Buffer.from("openapi: 3.0.0\n").toString("base64"),
      filename: "spec.yaml",
    });
    expect(started.job_id).toBe("job-1");

    let st = await api.getSpecImportStatus(tenant, "job-1");
    expect(st.state).toBe("running");
    st = await api.getSpecImportStatus(tenant, "job-1");
    expect(st.state).toBe("pending-approval");

    const committed = await api.commitSpecImportJob(tenant, "job-1");
    expect(committed.project_slug).toBe("pay");

    st = await api.getSpecImportStatus(tenant, "job-1");
    expect(st.state).toBe("completed");
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
