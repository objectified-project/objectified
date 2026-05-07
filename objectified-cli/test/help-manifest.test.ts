import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

type ManifestCommand = {
  examples?: unknown;
};

describe("CLI manifest help metadata", () => {
  it("lists at least two examples for every command", () => {
    const raw = readFileSync(path.join(pkgRoot, "oclif.manifest.json"), "utf8");
    const manifest = JSON.parse(raw) as { commands: Record<string, ManifestCommand> };
    const ids = Object.keys(manifest.commands).sort();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const ex = manifest.commands[id]?.examples;
      expect(Array.isArray(ex), `${id} missing examples[]`).toBe(true);
      expect((ex as unknown[]).length, `${id} must have ≥2 examples`).toBeGreaterThanOrEqual(2);
    }
  });

  it("ships a root man page and one page per core command id", () => {
    const raw = readFileSync(path.join(pkgRoot, "oclif.manifest.json"), "utf8");
    const manifest = JSON.parse(raw) as {
      commands: Record<string, { hidden?: boolean; pluginType?: string }>;
    };
    const pkg = JSON.parse(readFileSync(path.join(pkgRoot, "package.json"), "utf8")) as {
      man?: string[];
    };

    const coreIds = Object.entries(manifest.commands)
      .filter(([, c]) => !c.hidden && c.pluginType === "core")
      .map(([id]) => id)
      .sort();

    expect(pkg.man?.includes("./man/man1/objectified.1")).toBe(true);
    expect(pkg.man?.includes("./man/man1/objectified-help.1")).toBe(true);
    expect(pkg.man?.includes("./man/man1/objectified-version.1")).toBe(true);

    for (const id of coreIds) {
      const slug = `objectified-${id.replace(/:/g, "-")}.1`;
      expect(pkg.man?.includes(`./man/man1/${slug}`), `missing man entry for ${id}`).toBe(true);
      const manPath = path.join(pkgRoot, "man", "man1", slug);
      const body = readFileSync(manPath, "utf8");
      expect(body.startsWith(".TH ")).toBe(true);
      expect(body).toContain(".SH NAME");
      expect(body).toContain(".SH DESCRIPTION");
    }
  });
});
