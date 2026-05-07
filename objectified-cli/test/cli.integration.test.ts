import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(args: string[]): string {
  return execFileSync("node", [path.join(pkgRoot, "bin/run.js"), ...args], {
    cwd: pkgRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
}

describe("objectified CLI", () => {
  it("prints version", () => {
    const out = run(["--version"]);
    expect(out.trim()).toMatch(/\d+\.\d+\.\d+/);
  });

  it("prints top-level help", () => {
    const out = run(["--help"]);
    expect(out).toContain("VERSION");
    expect(out).toContain("COMMANDS");
  });

  it("runs hello smoke command", () => {
    const out = run(["hello"]);
    expect(out).toContain("Hello world from Objectified CLI");
  });

  it("runs hello with a name argument", () => {
    const out = run(["hello", "Ada"]);
    expect(out).toContain("Hello Ada from Objectified CLI");
  });

  it("cold-starts --version within 200 ms on developer machines", () => {
    const iterations = process.env.CI ? 2 : 5;
    let fastest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      run(["--version"]);
      fastest = Math.min(fastest, performance.now() - start);
    }
    const budgetMs = process.env.CI ? 600 : 200;
    expect(fastest).toBeLessThan(budgetMs);
  });
});
