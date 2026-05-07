const DEFAULT_BASE_URL = "https://api.objectified.dev";

export type CliConfig = {
  baseUrl: string;
};

/** Effective CLI configuration (env-only until TOML profiles land). */
export function resolveConfig(): CliConfig {
  const baseUrl = process.env.OBJECTIFIED_BASE_URL ?? DEFAULT_BASE_URL;
  return { baseUrl };
}
