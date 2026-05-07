import path from "node:path";

import type { ParsedTomlConfig } from "./config.js";

export const DEFAULT_BASE_URL = "https://api.objectified.dev";

/** Parsed global flags (oclif uses camelCase keys). */
export type GlobalCliFlags = {
  apiKey?: string;
  baseUrl?: string;
  config?: string;
  json?: boolean;
  noColor?: boolean;
  profile?: string;
  quiet?: boolean;
  verbose?: boolean;
  /** Set by BaseCommand after parsing (includes OBJECTIFIED_VERBOSE=1). */
  verboseEffective?: boolean;
};

export type ObjectifiedContext = {
  baseUrl: string;
  profile: string;
  apiKey: string | undefined;
  json: boolean;
  color: boolean;
};

function firstNonEmpty(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function envTruthy(env: NodeJS.ProcessEnv, key: string): boolean {
  const v = env[key];
  return v === "1" || v === "true" || v === "yes";
}

/** Profile-specific values overlay [default] (issue #3187 resolution order for config). */
export function configLayerForProfile(
  doc: ParsedTomlConfig,
  profileName: string,
): { baseUrl?: string; apiKey?: string } {
  const prof = doc.profiles[profileName];
  return {
    baseUrl: firstNonEmpty(prof?.baseUrl, doc.default.baseUrl),
    apiKey: firstNonEmpty(prof?.apiKey, doc.default.apiKey),
  };
}

export function resolveConfigPath(
  flagConfig: string | undefined,
  env: NodeJS.ProcessEnv,
  homedir: () => string,
): string {
  const fromFlag = flagConfig;
  const fromEnv = env.OBJECTIFIED_CONFIG;
  const raw = firstNonEmpty(fromFlag, fromEnv);
  if (raw === undefined) return path.join(homedir(), ".config/objectified/config.toml");
  if (raw.startsWith("~/")) return path.join(homedir(), raw.slice(2));
  return raw;
}

export function resolveProfile(flag: string | undefined, env: NodeJS.ProcessEnv): string {
  return firstNonEmpty(flag, env.OBJECTIFIED_PROFILE) ?? "default";
}

export function resolveBaseUrl(
  flag: string | undefined,
  env: NodeJS.ProcessEnv,
  cfg: { baseUrl?: string },
): string {
  return firstNonEmpty(flag, env.OBJECTIFIED_BASE_URL, cfg.baseUrl) ?? DEFAULT_BASE_URL;
}

export function resolveApiKey(
  flag: string | undefined,
  env: NodeJS.ProcessEnv,
  cfg: { apiKey?: string },
): string | undefined {
  return firstNonEmpty(flag, env.OBJECTIFIED_API_KEY, cfg.apiKey);
}

export function resolveJson(
  flag: boolean | undefined,
  env: NodeJS.ProcessEnv,
  stdoutIsTTY: boolean,
): boolean {
  if (flag === true) return true;
  if (flag === false) return false;
  if (envTruthy(env, "OBJECTIFIED_JSON")) return true;
  return !stdoutIsTTY;
}

export function resolveVerbose(flag: boolean | undefined, env: NodeJS.ProcessEnv): boolean {
  if (flag === true) return true;
  if (flag === false) return false;
  return envTruthy(env, "OBJECTIFIED_VERBOSE");
}

export function resolveAllowColor(
  noColorFlag: boolean | undefined,
  env: NodeJS.ProcessEnv,
  stdoutIsTTY: boolean,
  supportsStdout: boolean,
): boolean {
  if (noColorFlag === true) return false;
  if (noColorFlag === false) return supportsStdout && stdoutIsTTY;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  return supportsStdout && stdoutIsTTY;
}

export function buildObjectifiedContext(opts: {
  flags: GlobalCliFlags;
  env: NodeJS.ProcessEnv;
  stdoutIsTTY: boolean;
  supportsColorStdout: boolean;
  configDoc: ParsedTomlConfig;
  homedir: () => string;
}): { context: ObjectifiedContext; verboseEffective: boolean; configPath: string } {
  const profile = resolveProfile(opts.flags.profile, opts.env);
  const configPath = resolveConfigPath(opts.flags.config, opts.env, opts.homedir);
  const cfgLayer = configLayerForProfile(opts.configDoc, profile);

  const baseUrl = resolveBaseUrl(opts.flags.baseUrl, opts.env, cfgLayer);
  const apiKey = resolveApiKey(opts.flags.apiKey, opts.env, cfgLayer);

  const json = resolveJson(opts.flags.json, opts.env, opts.stdoutIsTTY);
  const color = resolveAllowColor(
    opts.flags.noColor,
    opts.env,
    opts.stdoutIsTTY,
    opts.supportsColorStdout,
  );

  const verboseEffective = resolveVerbose(opts.flags.verbose, opts.env);

  return {
    context: {
      baseUrl,
      profile,
      apiKey,
      json,
      color,
    },
    verboseEffective,
    configPath,
  };
}
