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

export function loadTomlConfigFile(path: string): ParsedTomlConfig {
  try {
    const content = fs.readFileSync(path, "utf8");
    return parseTomlConfig(content);
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : undefined;
    if (code === "ENOENT") return { default: {}, profiles: {} };
    throw err;
  }
}
