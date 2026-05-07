import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultConfigDirectory,
  defaultConfigFilePath,
  ensureDefaultConfigFile,
  resolveConfigFilePath,
} from "../src/lib/config.js";

describe("config path resolution (#3188)", () => {
  const homedir = () => "/home/testuser";

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses OBJECTIFIED_CONFIG when set", () => {
    vi.stubEnv("OBJECTIFIED_CONFIG", "/custom/objectified.toml");
    expect(resolveConfigFilePath(undefined, process.env, homedir)).toBe("/custom/objectified.toml");
  });

  it("expands ~/ in OBJECTIFIED_CONFIG", () => {
    vi.stubEnv("OBJECTIFIED_CONFIG", "~/foo/config.toml");
    expect(resolveConfigFilePath(undefined, process.env, homedir)).toBe(
      "/home/testuser/foo/config.toml",
    );
  });

  it("prefers --config flag over OBJECTIFIED_CONFIG", () => {
    vi.stubEnv("OBJECTIFIED_CONFIG", "/env.toml");
    expect(resolveConfigFilePath("/flag.toml", process.env, homedir)).toBe("/flag.toml");
  });

  it("on Linux uses XDG_CONFIG_HOME/objectified (env-paths)", () => {
    vi.stubEnv("XDG_CONFIG_HOME", "/xdg-config");
    const spy = vi.spyOn(process, "platform", "get").mockReturnValue("linux");
    expect(defaultConfigDirectory(process.env, homedir)).toBe("/xdg-config/objectified");
    expect(defaultConfigFilePath(process.env, homedir)).toBe("/xdg-config/objectified/config.toml");
    spy.mockRestore();
  });

  it("on macOS uses ~/.config/objectified when XDG_CONFIG_HOME is unset", () => {
    const spy = vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    expect(defaultConfigDirectory({}, homedir)).toBe("/home/testuser/.config/objectified");
    spy.mockRestore();
  });

  it("on macOS respects XDG_CONFIG_HOME", () => {
    const spy = vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    expect(defaultConfigDirectory({ XDG_CONFIG_HOME: "/xdg" }, homedir)).toBe("/xdg/objectified");
    spy.mockRestore();
  });

  it("on Windows uses APPDATA\\\\Objectified\\\\config.toml", () => {
    const spy = vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    vi.stubEnv("APPDATA", "C:\\Users\\Me\\AppData\\Roaming");
    expect(defaultConfigDirectory(process.env, () => "C:\\Users\\Me")).toBe(
      "C:\\Users\\Me\\AppData\\Roaming\\Objectified",
    );
    expect(resolveConfigFilePath(undefined, process.env, () => "C:\\Users\\Me")).toBe(
      "C:\\Users\\Me\\AppData\\Roaming\\Objectified\\config.toml",
    );
    spy.mockRestore();
  });

  it("creates default config with mode 0600 on Unix", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obj-cli-mode-"));
    const cfg = path.join(dir, "config.toml");
    await ensureDefaultConfigFile(cfg);
    const stat = fs.statSync(cfg);
    if (process.platform !== "win32") {
      expect((stat.mode & 0o777).toString(8)).toBe("600");
    }
  });
});
