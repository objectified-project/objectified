import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function runCliCapture(
  args: string[],
  extraEnv: Record<string, string> = {},
  timeoutMs = 25_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
    LANG: "C",
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
    const errChunks: Buffer[] = [];
    child.stdout?.on("data", (c: Buffer | string) => {
      outChunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    child.stderr?.on("data", (c: Buffer | string) => {
      errChunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
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
        stderr: Buffer.concat(errChunks).toString("utf8"),
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

describe("spec import CI ergonomics (#3310)", () => {
  it("rejects --ndjson with global --json (exit 6)", async () => {
    const fixture = path.join(pkgRoot, "fixtures", "petstore.yaml");
    const result = await runCliCapture([
      "--json",
      "--tenant",
      "acme",
      "--base-url",
      "http://127.0.0.1:9",
      "--api-key",
      "k",
      "spec",
      "import",
      fixture,
      "--project",
      "petstore",
      "--ndjson",
    ]);
    expect(result.code).toBe(6);
    expect(result.stderr).toMatch(/ndjson/i);
  });

  it("POST includes dryRun when --dry-run", async () => {
    const projId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const jobId = "99999999-9999-9999-9999-999999999999";
    let posted: Record<string, unknown> | undefined;

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

        if (req.method === "GET" && url.pathname === "/v1/projects/acme/by-slug/petstore") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              id: projId,
              tenant_id: "t1",
              name: "Petstore",
              slug: "petstore",
              enabled: true,
            }),
          );
          return;
        }

        if (req.method === "POST" && url.pathname === "/v1/imports/acme") {
          const raw = await readBody(req);
          posted = JSON.parse(raw) as Record<string, unknown>;
          res.statusCode = 201;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jobId,
              tenantId: "t1",
              projectId: projId,
              state: "completed",
              percent: 100,
              progress: null,
              events: [],
              summary: { classesCreated: 1, warnings: 0, failed: 0, dryRun: true },
              result: { versionId: "1.0.0", projectId: projId },
              error: null,
              createdAt: "2026-05-09T12:00:00.000Z",
              updatedAt: "2026-05-09T12:00:02.000Z",
              finishedAt: "2026-05-09T12:00:02.000Z",
            }),
          );
          return;
        }

        res.statusCode = 500;
        res.end();
      })().catch(() => {
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const fixture = path.join(pkgRoot, "fixtures", "petstore.yaml");
      const result = await runCliCapture([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--json",
        "spec",
        "import",
        fixture,
        "--project",
        "petstore",
        "--dry-run",
      ]);
      expect(result.code).toBe(0);
      const opts = posted?.options as Record<string, unknown> | undefined;
      expect(opts?.dryRun).toBe(true);
      expect(JSON.parse(result.stdout.trim())).toMatchSnapshot();
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("--review prints job id at pending-approval (exit 0)", async () => {
    const projId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const jobId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

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

        if (req.method === "POST" && url.pathname === "/v1/imports/acme") {
          res.statusCode = 201;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jobId,
              tenantId: "t1",
              projectId: projId,
              state: "pending-approval",
              percent: 50,
              progress: { phase: "review", total: 10, completed: 10, currentItem: null },
              events: [{ code: "PENDING_APPROVAL", level: "info", message: "hold" }],
              summary: { classesCreated: 3, warnings: 0, failed: 0 },
              result: null,
              error: null,
              createdAt: "2026-05-09T12:00:00.000Z",
              updatedAt: "2026-05-09T12:00:01.000Z",
              finishedAt: null,
            }),
          );
          return;
        }

        res.statusCode = 500;
        res.end();
      })().catch(() => {
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const swaggerPath = path.join(pkgRoot, "fixtures", "swagger20.json");
      const result = await runCliCapture([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--quiet",
        "--no-json",
        "spec",
        "import",
        swaggerPath,
        "--project",
        "api",
        "--review",
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout).toMatchSnapshot();
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("--review exits 6 when job completes without pending-approval", async () => {
    const projId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const jobId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

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

        if (req.method === "POST" && url.pathname === "/v1/imports/acme") {
          res.statusCode = 201;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jobId,
              tenantId: "t1",
              projectId: projId,
              state: "completed",
              percent: 100,
              progress: null,
              events: [],
              summary: { incrementalMode: true },
              result: { versionId: "1.0.0", projectId: projId },
              error: null,
              createdAt: "2026-05-09T12:00:00.000Z",
              updatedAt: "2026-05-09T12:00:02.000Z",
              finishedAt: "2026-05-09T12:00:02.000Z",
            }),
          );
          return;
        }

        res.statusCode = 500;
        res.end();
      })().catch(() => {
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const swaggerPath = path.join(pkgRoot, "fixtures", "swagger20.json");
      const result = await runCliCapture([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--quiet",
        "--no-json",
        "spec",
        "import",
        swaggerPath,
        "--project",
        "api",
        "--review",
      ]);
      expect(result.code).toBe(6);
      expect(result.stderr).toMatch(/pending-approval/i);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("--report writes NDJSON event/progress/summary lines", async () => {
    const projId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const jobId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    let polls = 0;

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

        if (req.method === "GET" && url.pathname === "/v1/projects/acme/by-slug/petstore") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              id: projId,
              tenant_id: "t1",
              name: "Petstore",
              slug: "petstore",
              enabled: true,
            }),
          );
          return;
        }

        if (req.method === "POST" && url.pathname === "/v1/imports/acme") {
          res.statusCode = 201;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jobId,
              tenantId: "t1",
              projectId: projId,
              state: "running",
              percent: 10,
              progress: { phase: "start", total: 2, completed: 0, currentItem: "A" },
              events: [{ code: "START", level: "info", message: "go" }],
              summary: null,
              result: null,
              error: null,
              createdAt: "2026-05-09T12:00:00.000Z",
              updatedAt: "2026-05-09T12:00:00.000Z",
              finishedAt: null,
            }),
          );
          return;
        }

        if (req.method === "GET" && url.pathname === `/v1/imports/acme/${jobId}`) {
          polls++;
          const done = polls >= 2;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify(
              done
                ? {
                    jobId,
                    tenantId: "t1",
                    projectId: projId,
                    state: "completed",
                    percent: 100,
                    progress: { phase: "done", total: 2, completed: 2, currentItem: null },
                    events: [
                      { code: "START", level: "info", message: "go" },
                      { code: "DONE", level: "info", message: "fin" },
                    ],
                    summary: { classesCreated: 2, warnings: 0, failed: 0 },
                    result: { versionId: "1.0.0", projectId: projId },
                    error: null,
                    createdAt: "2026-05-09T12:00:00.000Z",
                    updatedAt: "2026-05-09T12:00:02.000Z",
                    finishedAt: "2026-05-09T12:00:02.000Z",
                  }
                : {
                    jobId,
                    tenantId: "t1",
                    projectId: projId,
                    state: "running",
                    percent: 50,
                    progress: { phase: "mid", total: 2, completed: 1, currentItem: "B" },
                    events: [{ code: "START", level: "info", message: "go" }],
                    summary: null,
                    result: null,
                    error: null,
                    createdAt: "2026-05-09T12:00:00.000Z",
                    updatedAt: "2026-05-09T12:00:01.000Z",
                    finishedAt: null,
                  },
            ),
          );
          return;
        }

        res.statusCode = 500;
        res.end();
      })().catch(() => {
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    const tmpReport = path.join(os.tmpdir(), `spec-import-report-${String(Date.now())}.ndjson`);

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const fixture = path.join(pkgRoot, "fixtures", "petstore.yaml");
      const result = await runCliCapture([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--quiet",
        "--no-json",
        "spec",
        "import",
        fixture,
        "--project",
        "petstore",
        "--report",
        tmpReport,
      ]);
      expect(result.code).toBe(0);
      const raw = fs.readFileSync(tmpReport, "utf8").trimEnd().split("\n");
      expect(raw.length).toBeGreaterThanOrEqual(3);
      const lastStr = raw[raw.length - 1];
      expect(lastStr).toBeDefined();
      const last = JSON.parse(lastStr as string) as {
        type?: string;
        exitCode?: number;
      };
      expect(last.type).toBe("summary");
      expect(last.exitCode).toBe(0);
      expect(raw.map((line) => JSON.parse(line) as unknown)).toMatchSnapshot();
    } finally {
      try {
        fs.unlinkSync(tmpReport);
      } catch {
        /* ignore */
      }
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });

  it("--ndjson streams progress and final result", async () => {
    const projId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const jobId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    let polls = 0;

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

        if (req.method === "GET" && url.pathname === "/v1/projects/acme/by-slug/petstore") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              id: projId,
              tenant_id: "t1",
              name: "Petstore",
              slug: "petstore",
              enabled: true,
            }),
          );
          return;
        }

        if (req.method === "POST" && url.pathname === "/v1/imports/acme") {
          res.statusCode = 201;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jobId,
              tenantId: "t1",
              projectId: projId,
              state: "running",
              percent: 5,
              progress: { phase: "p0", total: 1, completed: 0, currentItem: null },
              events: [],
              summary: null,
              result: null,
              error: null,
              createdAt: "2026-05-09T12:00:00.000Z",
              updatedAt: "2026-05-09T12:00:00.000Z",
              finishedAt: null,
            }),
          );
          return;
        }

        if (req.method === "GET" && url.pathname === `/v1/imports/acme/${jobId}`) {
          polls++;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jobId,
              tenantId: "t1",
              projectId: projId,
              state: "completed",
              percent: 100,
              progress: { phase: "done", total: 1, completed: 1, currentItem: null },
              events: [],
              summary: { classesCreated: 1, warnings: 0, failed: 0 },
              result: { versionId: "1.0.0", projectId: projId },
              error: null,
              createdAt: "2026-05-09T12:00:00.000Z",
              updatedAt: "2026-05-09T12:00:02.000Z",
              finishedAt: "2026-05-09T12:00:02.000Z",
            }),
          );
          return;
        }

        res.statusCode = 500;
        res.end();
      })().catch(() => {
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");

    try {
      const base = `http://127.0.0.1:${String(addr.port)}`;
      const fixture = path.join(pkgRoot, "fixtures", "petstore.yaml");
      const result = await runCliCapture([
        "--base-url",
        base,
        "--api-key",
        "k",
        "--tenant",
        "acme",
        "--quiet",
        "--no-json",
        "spec",
        "import",
        fixture,
        "--project",
        "petstore",
        "--ndjson",
      ]);
      expect(result.code).toBe(0);
      expect(
        result.stdout
          .trimEnd()
          .split("\n")
          .filter((l) => l !== "")
          .map((line) => JSON.parse(line) as unknown),
      ).toMatchSnapshot();
      expect(polls).toBe(1);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
    }
  });
});
