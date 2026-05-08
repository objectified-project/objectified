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

describe("projects create CLI (#3204)", () => {
  it("dry-run prints POST JSON body", async () => {
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
      res.statusCode = 500;
      res.end("unexpected request");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const { code, stdout } = await runCliCaptureAsync([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--no-json",
        "projects",
        "create",
        "--dry-run",
        "--yes",
        "--name",
        "Payments API",
        "--slug",
        "payments-api",
        "--description",
        "Inbound charges.",
        "--domain",
        "finance",
        "--visibility",
        "private",
      ]);
      expect(code).toBe(0);
      const body = JSON.parse(stdout.trim()) as Record<string, unknown>;
      expect(body.name).toBe("Payments API");
      expect(body.slug).toBe("payments-api");
      expect(body.metadata).toEqual(
        expect.objectContaining({
          domainCategory: "finance",
          visibility: "private",
        }),
      );
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("exits 7 when slug violates regex", async () => {
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
      res.statusCode = 500;
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const { code } = await runCliCaptureAsync([
        "--base-url",
        `http://127.0.0.1:${String(addr.port)}`,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--no-json",
        "projects",
        "create",
        "--yes",
        "--name",
        "X",
        "--slug",
        "bad_slug",
      ]);
      expect(code).toBe(7);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("exits 6 when slug already exists (pre-check)", async () => {
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
      if (req.method === "GET" && url.pathname === "/v1/projects/acme") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify([
            {
              id: "p-existing",
              tenant_id: "t1",
              name: "Existing",
              slug: "taken-slug",
              enabled: true,
            },
          ]),
        );
        return;
      }
      res.statusCode = 500;
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const { code } = await runCliCaptureAsync([
        "--base-url",
        `http://127.0.0.1:${String(addr.port)}`,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--no-json",
        "projects",
        "create",
        "--yes",
        "--name",
        "Dup",
        "--slug",
        "taken-slug",
      ]);
      expect(code).toBe(6);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("POST creates project then DELETE rolls back on mock API", async () => {
    let deleted: string | undefined;
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
      if (req.method === "GET" && url.pathname === "/v1/projects/acme") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify([]));
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/projects/acme") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            tenant_id: "t1",
            name: "Tmp",
            slug: "tmp-create-cli",
            enabled: true,
          }),
        );
        return;
      }
      if (
        req.method === "DELETE" &&
        url.pathname === "/v1/projects/acme/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
      ) {
        deleted = "ok";
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.statusCode = 500;
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const { code, stdout } = await runCliCaptureAsync([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--json",
        "projects",
        "create",
        "--yes",
        "--name",
        "Tmp",
        "--slug",
        "tmp-create-cli",
      ]);
      expect(code).toBe(0);
      const proj = JSON.parse(stdout.trim()) as { id: string; slug: string };
      expect(proj.slug).toBe("tmp-create-cli");

      const deleteStatus = await new Promise<number>((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: addr.port,
            path: `/v1/projects/acme/${encodeURIComponent(proj.id)}`,
            method: "DELETE",
            headers: { "X-API-Key": "k" },
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode ?? 0));
          },
        );
        req.on("error", reject);
        req.end();
      });
      expect(deleteStatus).toBe(200);
      expect(deleted).toBe("ok");
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });
});
