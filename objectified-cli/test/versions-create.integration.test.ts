import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function runCliCaptureAsync(
  args: string[],
  extraEnv: Record<string, string> = {},
  timeoutMs = 20_000,
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

describe("versions create CLI (#3210)", () => {
  it("returns JSON record on success and revision appears in versions list", async () => {
    const projId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const publishedId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    const versionsState: Array<{
      id: string;
      project_id: string;
      version_id: string;
      published: boolean;
      created_at: string;
    }> = [
      {
        id: publishedId,
        project_id: projId,
        version_id: "1.0.0",
        published: true,
        created_at: "2026-01-01T12:00:00Z",
      },
    ];

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
          res.end(JSON.stringify(versionsState));
          return;
        }

        if (req.method === "GET" && url.pathname === `/v1/version-tags/acme/${projId}`) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify([]));
          return;
        }

        if (
          req.method === "GET" &&
          url.pathname === `/v1/versions/acme/${projId}/by-version/2.2.0-rc.1`
        ) {
          res.statusCode = 404;
          res.end(JSON.stringify({ detail: "not found" }));
          return;
        }

        if (req.method === "POST" && url.pathname === `/v1/versions/acme/${projId}`) {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw) as {
            version_id?: string;
            baseRevisionId?: string;
            source_version_id?: string | null;
          };
          expect(parsed.version_id).toBe("2.2.0-rc.1");
          expect(parsed.baseRevisionId).toBe(publishedId);
          expect(parsed.source_version_id).toBe(publishedId);

          const newRow = {
            id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            project_id: projId,
            version_id: "2.2.0-rc.1",
            published: false,
            created_at: "2026-05-08T10:00:00Z",
          };
          versionsState.push(newRow);

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(newRow));
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
      const createArgs = [
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--json",
        "versions",
        "create",
        "payments-api",
        "--version",
        "2.2.0-rc.1",
        "--notes",
        "Adds idempotency keys",
      ];
      const created = await runCliCaptureAsync(createArgs);
      expect(created.code).toBe(0);
      const row = JSON.parse(created.stdout.trim()) as { version_id: string; id: string };
      expect(row.version_id).toBe("2.2.0-rc.1");

      const listed = await runCliCaptureAsync([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--json",
        "versions",
        "list",
        "payments-api",
        "--all",
      ]);
      expect(listed.code).toBe(0);
      const listRows = JSON.parse(listed.stdout.trim()) as Array<{ version_id: string }>;
      expect(listRows.some((r) => r.version_id === "2.2.0-rc.1")).toBe(true);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("exits 7 when version is not valid semver", async () => {
    const server = http.createServer((req, res) => {
      res.setHeader("Connection", "close");
      res.statusCode = 500;
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const code = (
        await runCliCaptureAsync([
          "--base-url",
          `http://127.0.0.1:${String(addr.port)}`,
          "--api-key",
          "k",
          "--tenant",
          "acme",
          "versions",
          "create",
          "payments-api",
          "--version",
          "notsemver",
          "--notes",
          "x",
        ])
      ).code;
      expect(code).toBe(7);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("exits 6 when semver collides with an existing version line", async () => {
    const projId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const server = http.createServer((req, res) => {
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

      if (req.method === "GET" && url.pathname === "/v1/projects/acme/by-slug/api") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            id: projId,
            tenant_id: "t1",
            name: "Api",
            slug: "api",
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
              id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
              project_id: projId,
              version_id: "v3.0.0",
              published: true,
              created_at: "2026-01-01T00:00:00Z",
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

      res.statusCode = 500;
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const code = (
        await runCliCaptureAsync([
          "--base-url",
          `http://127.0.0.1:${String(addr.port)}`,
          "--api-key",
          "k",
          "--tenant",
          "acme",
          "versions",
          "create",
          "api",
          "--version",
          "3.0.0",
          "--notes",
          "dup",
        ])
      ).code;
      expect(code).toBe(6);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("fails fast when no head revision exists", async () => {
    const projId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    let postCalled = false;
    const server = http.createServer((req, res) => {
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

      if (req.method === "GET" && url.pathname === "/v1/projects/acme/by-slug/api") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            id: projId,
            tenant_id: "t1",
            name: "Api",
            slug: "api",
            enabled: true,
          }),
        );
        return;
      }

      if (req.method === "GET" && url.pathname === `/v1/versions/acme/${projId}`) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify([]));
        return;
      }

      if (req.method === "GET" && url.pathname === `/v1/version-tags/acme/${projId}`) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify([]));
        return;
      }

      if (req.method === "POST" && url.pathname === `/v1/versions/acme/${projId}`) {
        postCalled = true;
        res.statusCode = 500;
        res.end("should not post");
        return;
      }

      res.statusCode = 500;
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const out = await runCliCaptureAsync([
        "--base-url",
        `http://127.0.0.1:${String(addr.port)}`,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "versions",
        "create",
        "api",
        "--version",
        "1.0.0",
        "--notes",
        "init",
      ]);
      expect(out.code).toBe(5);
      expect(postCalled).toBe(false);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });
});
