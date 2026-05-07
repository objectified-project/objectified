import fs from "node:fs";
import path from "node:path";

import TOML from "@iarna/toml";
import envPaths from "env-paths";
import fse from "fs-extra";

import { DEFAULT_BASE_URL } from "./constants.js";
import { CliError } from "./errors.js";

function firstNonEmpty(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

export type ProfileValues = {
  baseUrl?: string;
  tenantSlug?: string;
};

export type ParsedTomlConfig = {
  /** From `default_profile` when unset, commands use profile name `"default"`. */
  defaultProfile?: string;
  /** Values from `[default]` merged under every named profile. */
  default: ProfileValues;
  profiles: Record<string, ProfileValues>;
};

function readProfileTable(raw: unknown): ProfileValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const baseUrl = typeof o.base_url === "string" ? o.base_url : undefined;
  const tenantSlug = typeof o.tenant_slug === "string" ? o.tenant_slug : undefined;
  return { baseUrl, tenantSlug };
}

/** Normalize TOML: `default_profile`, `[default]`, and `[profile.NAME]` (#3188). */
export function parseTomlConfig(content: string): ParsedTomlConfig {
  const doc = TOML.parse(content) as Record<string, unknown>;
  const defaultProfile =
    typeof doc.default_profile === "string" && doc.default_profile !== ""
      ? doc.default_profile
      : undefined;
  const def = readProfileTable(doc.default);
  const profiles: Record<string, ProfileValues> = {};
  const profileRoot = doc.profile;
  if (profileRoot && typeof profileRoot === "object" && !Array.isArray(profileRoot)) {
    for (const [name, section] of Object.entries(profileRoot)) {
      profiles[name] = readProfileTable(section);
    }
  }
  return { defaultProfile, default: def, profiles };
}

export function loadTomlConfigFile(configFilePath: string): ParsedTomlConfig {
  let content: string;
  try {
    content = fs.readFileSync(configFilePath, "utf8");
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : undefined;
    if (code === "ENOENT") return { default: {}, profiles: {} };
    throw err;
  }
  try {
    return parseTomlConfig(content);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to parse config file "${configFilePath}": ${msg}\nHint: Use --config or OBJECTIFIED_CONFIG to point to a valid TOML file.`,
    );
  }
}

/** Linux: `env-paths` (XDG). macOS / other Unix: `$XDG_CONFIG_HOME/objectified` per #3188. Windows: `%APPDATA%\\Objectified`. */
export function defaultConfigDirectory(env: NodeJS.ProcessEnv, homedir: () => string): string {
  if (process.platform === "win32") {
    const appData = env.APPDATA || path.win32.join(homedir(), "AppData", "Roaming");
    return path.win32.join(appData, "Objectified");
  }
  if (process.platform === "linux") {
    return envPaths("objectified", { suffix: "" }).config;
  }
  return path.join(env.XDG_CONFIG_HOME || path.join(homedir(), ".config"), "objectified");
}

export function defaultConfigFilePath(env: NodeJS.ProcessEnv, homedir: () => string): string {
  const dir = defaultConfigDirectory(env, homedir);
  return process.platform === "win32"
    ? path.win32.join(dir, "config.toml")
    : path.join(dir, "config.toml");
}

export function resolveConfigFilePath(
  flagConfig: string | undefined,
  env: NodeJS.ProcessEnv,
  homedir: () => string,
): string {
  const raw = firstNonEmpty(flagConfig, env.OBJECTIFIED_CONFIG);
  if (raw === undefined) return defaultConfigFilePath(env, homedir);
  if (raw.startsWith("~/")) return path.join(homedir(), raw.slice(2));
  return raw;
}

export function defaultConfigToml(): string {
  return [
    `default_profile = "default"`,
    "",
    "[profile.default]",
    `base_url = "${DEFAULT_BASE_URL}"`,
    "",
  ].join("\n");
}

function chmodConfigFile(configPath: string): void {
  if (process.platform === "win32") return;
  try {
    fs.chmodSync(configPath, 0o600);
  } catch {
    /* ignore chmod failures on exotic filesystems */
  }
}

/** Creates parent dirs and a default `config.toml` when missing (permissions `0600` on Unix). */
export async function ensureDefaultConfigFile(configPath: string): Promise<void> {
  const exists = await fse.pathExists(configPath);
  if (exists) return;
  await fse.ensureDir(path.dirname(configPath));
  await fse.writeFile(configPath, defaultConfigToml(), { encoding: "utf8", mode: 0o600 });
  chmodConfigFile(configPath);
}

/** Parsed TOML root document (`@iarna/toml` shape). */
export type RawTomlDoc = ReturnType<typeof TOML.parse>;

export function loadRawTomlDocument(configPath: string): RawTomlDoc {
  let content: string;
  try {
    content = fs.readFileSync(configPath, "utf8");
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : undefined;
    if (code === "ENOENT") {
      const empty: RawTomlDoc = {};
      return empty;
    }
    throw err;
  }
  try {
    return TOML.parse(content);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new CliError(`Invalid TOML in "${configPath}": ${msg}`, 11);
  }
}

export function saveRawTomlDocument(configPath: string, doc: RawTomlDoc): void {
  fse.ensureDirSync(path.dirname(configPath));
  const body = TOML.stringify(doc);
  fs.writeFileSync(configPath, body, { encoding: "utf8", mode: 0o600 });
  chmodConfigFile(configPath);
}

export function splitDottedKey(key: string): string[] {
  const trimmed = key.trim();
  if (trimmed === "") throw new CliError("Config key must not be empty.", 11);
  return trimmed
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function assertWritableConfigKey(dottedKey: string): void {
  const lower = dottedKey.toLowerCase();
  if (lower.includes("api_key") || lower.includes("refresh_token")) {
    throw new CliError(
      "Secrets are not stored in config.toml; use the OS keychain when implemented (see roadmap).",
      11,
    );
  }
}

export function getNestedValue(doc: RawTomlDoc, parts: string[]): unknown {
  let cur: unknown = doc;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as RawTomlDoc)[p];
  }
  return cur;
}

export function setNestedValue(doc: RawTomlDoc, parts: string[], value: string): void {
  if (parts.length === 0) throw new CliError("Config key must include at least one segment.", 11);
  const leaf = parts[parts.length - 1];
  if (leaf === undefined) throw new CliError("Config key must include at least one segment.", 11);

  let cur: RawTomlDoc = doc;
  for (const segment of parts.slice(0, -1)) {
    const next = cur[segment];
    if (next === undefined || typeof next !== "object" || Array.isArray(next)) {
      cur[segment] = {};
    }
    cur = cur[segment] as RawTomlDoc;
  }
  cur[leaf] = value;
}

export function formatConfigScalar(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new CliError("Value is not a scalar; use `objectified config list`.", 11);
}
