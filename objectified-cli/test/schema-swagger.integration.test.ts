import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { tmpdir } from "node:os";
import { readFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { EXIT_CODES } from "../src/lib/exit-codes.js";

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

describe("schema swagger CLI (#3248)", () => {
  const publishedSpec = {
    openapi: "3.1.0",
    info: { title: "Payments", version: "2.1.0" },
    paths: {},
  };

  it("writes OpenAPI bundle to --output via GET /v1/schema/…", async () => {
    await new Promise<void>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (req.method === "GET" && url.pathname === "/v1/schema/acme/payments-api/2.1.0") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(publishedSpec));
          return;
        }
        res.writeHead(404);
        res.end();
      });
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr === null || typeof addr === "string") {
          server.close();
          reject(new Error("Could not bind ephemeral port"));
          return;
        }
        const baseUrl = `http://127.0.0.1:${String(addr.port)}`;
        const tmpName = `objectified-schema-swagger-${String(process.pid)}-${String(Math.random()).slice(2)}.json`;
        const outFile = path.join(tmpdir(), tmpName);

        void (async () => {
          try {
            const { code } = await runCliCaptureAsync([
              "--base-url",
              baseUrl,
              "--no-json",
              "schema",
              "swagger",
              "acme/payments-api/2.1.0",
              "--output",
              outFile,
            ]);
            expect(code).toBe(0);
            const raw = await readFile(outFile, "utf8");
            expect(JSON.parse(raw)).toEqual(publishedSpec);
            await unlink(outFile).catch(() => {});
          } finally {
            server.close(() => resolve());
          }
        })().catch((err) => {
          server.close(() => reject(err));
        });
      });
    });
  });

  it("errors with misuse exit code on invalid ref", async () => {
    const { code } = await runCliCaptureAsync([
      "--no-json",
      "schema",
      "swagger",
      "acme/payments-api",
    ]);
    expect(code).toBe(EXIT_CODES.MISUSE);
  });
});
