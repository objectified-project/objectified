import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function runCliCaptureAsync(
  args: string[],
  extraEnv: Record<string, string> = {},
  timeoutMs = 25_000,
): Promise<{ code: number; stdout: string }> {
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
    OBJECTIFIED_CLI_CREDENTIAL_BACKEND: "memory",
    ...extraEnv,
  };
  delete env.NODE_OPTIONS;

  return await new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(pkgRoot, "bin/run.js"), ...args], {
      cwd: pkgRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const outChunks: Buffer[] = [];
    child.stdout?.on("data", (c: Buffer | string) => {
      outChunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out after ${String(timeoutMs)}ms: ${args.join(" ")}`));
    }, timeoutMs);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(outChunks).toString("utf8"),
      });
    });
  });
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

describe("versions publish CLI (#3212)", () => {
  it("publishes a draft and GET /v1/schema returns OpenAPI for the semver", async () => {
    const projId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const publishedId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const draftId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

    let publishHits = 0;

    const server = http.createServer((req, res) => {
      void (async () => {
        res.setHeader("Connection", "close");
        const url = new URL(req.url ?? "/", "http://127.0.0.1");

        if (
          req.method === "GET" &&
          (url.pathname === "/v1/projects/acme/domains" || url.pathname === "/v1/projects/domains")
        ) {
          res.statusCode = 404;
          res.end();
          return;
        }

        if (req.method === "GET" && url.pathname === "/v1/projects/acme/by-slug/payments-api") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              id: projId,
              tenant_id: "t1",
              name: "Payments",
              slug: "payments-api",
              enabled: true,
            }),
          );
          return;
        }

        if (req.method === "GET" && url.pathname === `/v1/versions/acme/${projId}`) {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify([
              {
                id: publishedId,
                project_id: projId,
                version_id: "1.0.0",
                published: true,
                created_at: "2026-01-01T12:00:00Z",
              },
              {
                id: draftId,
                project_id: projId,
                version_id: "2.1.0",
                published: false,
                created_at: "2026-05-08T10:00:00Z",
              },
            ]),
          );
          return;
        }

        if (req.method === "GET" && url.pathname === `/v1/version-tags/acme/${projId}`) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify([]));
          return;
        }

        if (
          req.method === "GET" &&
          url.pathname === `/v1/versions/acme/${projId}/by-version/2.1.0`
        ) {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              id: draftId,
              project_id: projId,
              version_id: "2.1.0",
              published: false,
              created_at: "2026-05-08T10:00:00Z",
            }),
          );
          return;
        }

        if (
          req.method === "GET" &&
          url.pathname === `/v1/classes/acme` &&
          url.searchParams.get("version_id") === draftId
        ) {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify([
              {
                id: "class-1",
                version_id: draftId,
                name: "Charge",
                description: "A charge resource.",
              },
            ]),
          );
          return;
        }

        if (
          req.method === "POST" &&
          url.pathname === `/v1/versions/acme/${projId}/${draftId}/change-report/publish-preview`
        ) {
          await readBody(req);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              headerSnapshot: "",
              renderedBody: "",
              footnoteSnapshot: "",
              changeModelJson: {},
              baselineRevisionId: publishedId,
              templateVersionId: null,
              fromVersionLabel: "1.0.0",
              toVersionLabel: "2.1.0",
              initialPublication: false,
            }),
          );
          return;
        }

        if (req.method === "POST" && url.pathname === `/v1/versions/acme/${projId}/compatibility`) {
          await readBody(req);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              overall: "safe",
              baseRevisionId: publishedId,
              headRevisionId: draftId,
              findings: [],
              reportFingerprint: "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
            }),
          );
          return;
        }

        if (
          req.method === "POST" &&
          url.pathname === `/v1/versions/acme/${projId}/${draftId}/publish`
        ) {
          publishHits++;
          await readBody(req);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              id: draftId,
              project_id: projId,
              version_id: "2.1.0",
              published: true,
              published_at: "2026-05-08T12:00:00Z",
              created_at: "2026-05-08T10:00:00Z",
            }),
          );
          return;
        }

        if (
          req.method === "GET" &&
          url.pathname === "/v1/schema/acme/payments-api/2.1.0"
        ) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ openapi: "3.1.0", info: { title: "X", version: "2.1.0" }, paths: {} }));
          return;
        }

        res.statusCode = 500;
        res.end(`unexpected ${req.method ?? "?"} ${url.pathname}`);
      })().catch(() => {
        if (!res.headersSent) res.statusCode = 500;
        res.end("handler error");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const pub = await runCliCaptureAsync([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--json",
        "versions",
        "publish",
        "payments-api",
        "2.1.0",
      ]);
      expect(pub.code).toBe(0);
      expect(publishHits).toBe(1);
      const body = JSON.parse(pub.stdout.trim()) as {
        version: { published?: boolean; version_id: string };
        spec_urls: { openapi: string };
      };
      expect(body.version.published).toBe(true);
      expect(body.version.version_id).toBe("2.1.0");
      expect(body.spec_urls.openapi).toContain("/v1/schema/acme/payments-api/2.1.0");

      const specRes = await fetch(body.spec_urls.openapi, {
        headers: { "X-API-Key": "k" },
      });
      expect(specRes.ok).toBe(true);
      const specJson = (await specRes.json()) as { openapi?: string };
      expect(specJson.openapi).toBe("3.1.0");
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("exits 6 when compatibility is breaking without --allow-breaking", async () => {
    const projId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const publishedId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const draftId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

    let publishHits = 0;

    const server = http.createServer((req, res) => {
      void (async () => {
        res.setHeader("Connection", "close");
        const url = new URL(req.url ?? "/", "http://127.0.0.1");

        if (
          req.method === "GET" &&
          (url.pathname === "/v1/projects/acme/domains" || url.pathname === "/v1/projects/domains")
        ) {
          res.statusCode = 404;
          res.end();
          return;
        }

        if (req.method === "GET" && url.pathname === "/v1/projects/acme/by-slug/payments-api") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              id: projId,
              tenant_id: "t1",
              name: "Payments",
              slug: "payments-api",
              enabled: true,
            }),
          );
          return;
        }

        if (req.method === "GET" && url.pathname === `/v1/versions/acme/${projId}`) {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify([
              {
                id: publishedId,
                project_id: projId,
                version_id: "1.0.0",
                published: true,
                created_at: "2026-01-01T12:00:00Z",
              },
              {
                id: draftId,
                project_id: projId,
                version_id: "2.1.0",
                published: false,
                created_at: "2026-05-08T10:00:00Z",
              },
            ]),
          );
          return;
        }

        if (req.method === "GET" && url.pathname === `/v1/version-tags/acme/${projId}`) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify([]));
          return;
        }

        if (
          req.method === "GET" &&
          url.pathname === `/v1/versions/acme/${projId}/by-version/2.1.0`
        ) {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              id: draftId,
              project_id: projId,
              version_id: "2.1.0",
              published: false,
              created_at: "2026-05-08T10:00:00Z",
            }),
          );
          return;
        }

        if (
          req.method === "GET" &&
          url.pathname === `/v1/classes/acme` &&
          url.searchParams.get("version_id") === draftId
        ) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify([{ id: "c1", version_id: draftId, name: "X", description: "d" }]));
          return;
        }

        if (
          req.method === "POST" &&
          url.pathname === `/v1/versions/acme/${projId}/${draftId}/change-report/publish-preview`
        ) {
          await readBody(req);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              headerSnapshot: "",
              renderedBody: "",
              footnoteSnapshot: "",
              changeModelJson: {},
              baselineRevisionId: publishedId,
              fromVersionLabel: "1.0.0",
              toVersionLabel: "2.1.0",
              initialPublication: false,
            }),
          );
          return;
        }

        if (req.method === "POST" && url.pathname === `/v1/versions/acme/${projId}/compatibility`) {
          await readBody(req);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              overall: "breaking",
              baseRevisionId: publishedId,
              headRevisionId: draftId,
              findings: [{ id: "1", path: "/x", category: "breaking", rule: "r", message: "m" }],
              reportFingerprint: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            }),
          );
          return;
        }

        if (
          req.method === "POST" &&
          url.pathname === `/v1/versions/acme/${projId}/${draftId}/publish`
        ) {
          publishHits++;
          res.statusCode = 500;
          res.end();
          return;
        }

        res.statusCode = 500;
        res.end(`unexpected ${req.method ?? "?"} ${url.pathname}`);
      })().catch(() => {
        if (!res.headersSent) res.statusCode = 500;
        res.end("handler error");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const pub = await runCliCaptureAsync([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "versions",
        "publish",
        "payments-api",
        "2.1.0",
      ]);
      expect(pub.code).toBe(6);
      expect(publishHits).toBe(0);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("requires --yes with --skip-checks", async () => {
    const result = await runCliCaptureAsync([
      "--base-url",
      "http://127.0.0.1:9",
      "--api-key",
      "k",
      "--tenant",
      "acme",
      "versions",
      "publish",
      "payments-api",
      "2.1.0",
      "--skip-checks",
    ]);
    expect(result.code).toBe(2);
  });
});
