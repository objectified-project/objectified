import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { tmpdir } from "node:os";
import { unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { EXIT_CODES } from "../src/lib/exit-codes.js";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function runCliCaptureAsync(
  args: string[],
  extraEnv: Record<string, string> = {},
  timeoutMs = 25_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
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

const minimalOpenApi = {
  openapi: "3.1.0",
  info: { title: "T", version: "1.0.0" },
  paths: {},
};

describe("audit CLI", () => {
  it("exits 0 when change-report finds no drift", async () => {
    const tmpName = path.join(
      tmpdir(),
      `objectified-audit-${String(process.pid)}-${String(Math.random()).slice(2)}.json`,
    );
    await writeFile(tmpName, `${JSON.stringify(minimalOpenApi)}\n`, "utf8");

    const emptyReport = {
      schemaVersion: "1.0",
      schemas: { added: [], removed: [], modified: [] },
      properties: [],
      references: [],
      relationships: [],
      documentation: [],
      warnings: [],
      skipped: [],
    };

    const server = http.createServer((req, res) => {
      void (async () => {
        res.setHeader("Connection", "close");
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (req.method === "GET" && url.pathname === "/v1/schema/acme/payments-api/2.1.0") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(minimalOpenApi));
          return;
        }
        if (req.method === "POST" && url.pathname === "/v1/openapi/change-report") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(emptyReport));
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
      const out = await runCliCaptureAsync([
        "--base-url",
        base,
        "--api-key",
        "test-key",
        "audit",
        tmpName,
        "--ref",
        "acme/payments-api/2.1.0",
      ]);
      expect(out.code).toBe(0);
      const parsed = JSON.parse(out.stdout) as { ok?: boolean; ref?: string };
      expect(parsed.ok).toBe(true);
      expect(parsed.ref).toBe("acme/payments-api/2.1.0");
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
      await unlink(tmpName).catch(() => undefined);
    }
  });

  it("exits validation when change-report finds drift", async () => {
    const tmpName = path.join(
      tmpdir(),
      `objectified-audit-bad-${String(process.pid)}-${String(Math.random()).slice(2)}.json`,
    );
    await writeFile(tmpName, `${JSON.stringify(minimalOpenApi)}\n`, "utf8");

    const driftReport = {
      schemaVersion: "1.0",
      schemas: { added: [{ name: "Extra" }], removed: [], modified: [] },
      properties: [],
      references: [],
      relationships: [],
      documentation: [],
      warnings: [],
      skipped: [],
    };

    const server = http.createServer((req, res) => {
      void (async () => {
        res.setHeader("Connection", "close");
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (req.method === "GET" && url.pathname === "/v1/schema/acme/payments-api/2.1.0") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(minimalOpenApi));
          return;
        }
        if (req.method === "POST" && url.pathname === "/v1/openapi/change-report") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(driftReport));
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
      const out = await runCliCaptureAsync([
        "--base-url",
        base,
        "--api-key",
        "test-key",
        "audit",
        tmpName,
        "--ref",
        "acme/payments-api/2.1.0",
      ]);
      expect(out.code).toBe(EXIT_CODES.VALIDATION);
      expect(out.stderr).toMatch(/Audit failed/i);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err !== undefined ? reject(err) : resolve())),
      );
      await unlink(tmpName).catch(() => undefined);
    }
  });
});
