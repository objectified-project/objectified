import fs from "node:fs";

import TOML from "@iarna/toml";

export type ProfileValues = {
  baseUrl?: string;
  apiKey?: string;
};

export type ParsedTomlConfig = {
  default: ProfileValues;
  profiles: Record<string, ProfileValues>;
};

function readProfileTable(raw: unknown): ProfileValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const baseUrl = typeof o.base_url === "string" ? o.base_url : undefined;
  const apiKey = typeof o.api_key === "string" ? o.api_key : undefined;
  return { baseUrl, apiKey };
}

/** Normalize TOML root: `[default]` and `[profile.NAME]` sections per roadmap #3187. */
export function parseTomlConfig(content: string): ParsedTomlConfig {
  const doc = TOML.parse(content) as Record<string, unknown>;
  const def = readProfileTable(doc.default);
  const profiles: Record<string, ProfileValues> = {};
  const profileRoot = doc.profile;
  if (profileRoot && typeof profileRoot === "object" && !Array.isArray(profileRoot)) {
    for (const [name, section] of Object.entries(profileRoot)) {
      profiles[name] = readProfileTable(section);
    }
  }
  return { default: def, profiles };
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
