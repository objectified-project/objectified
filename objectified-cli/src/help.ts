import { Help } from "@oclif/core";

/** Same value as `src/lib/constants.ts` — inlined so oclif’s dynamic help import does not pull extra modules. */
const DEFAULT_BASE_URL = "https://api.objectified.dev";

const GLOBAL_FLAGS_BODY = [
  "Global flags apply to every command:",
  "",
  `  --api-key       OBJECTIFIED_API_KEY       Direct API-key auth (not read from config.toml)`,
  `  --base-url      OBJECTIFIED_BASE_URL      Root REST endpoint (built-in default: ${DEFAULT_BASE_URL})`,
  `  --config        OBJECTIFIED_CONFIG        config.toml (default: XDG config dir, or %APPDATA%\\Objectified on Windows)`,
  `  --json          OBJECTIFIED_JSON=1        Machine-readable JSON (auto when stdout is not a TTY)`,
  `  --no-color      NO_COLOR=1                Disable ANSI color (auto when stdout is not a TTY)`,
  `  --profile       OBJECTIFIED_PROFILE       Profile name; falls back to default_profile in config, else "default"`,
  `  --quiet, -q                               Suppress non-error stdout`,
  `  --verbose       OBJECTIFIED_VERBOSE=1     Verbose stderr logging`,
  "",
  "Resolution order for base URL (highest precedence wins):",
  "  1. Command-line flag            (--base-url=…)",
  "  2. Environment variable         (OBJECTIFIED_BASE_URL=…)",
  "  3. Config [profile.NAME]        (base_url=…)",
  "  4. Config [default]              (base_url=…)",
  `  5. Built-in default              (${DEFAULT_BASE_URL})`,
  "",
  "Resolution order for API key: --api-key, then OBJECTIFIED_API_KEY (never from config file; see #3188).",
  "Resolution order for tenant slug: OBJECTIFIED_TENANT, then config profile / [default] (tenant_slug).",
].join("\n");

export default class ObjectifiedHelp extends Help {
  formatRoot(): string {
    return `${super.formatRoot()}\n\n${this.section("GLOBAL FLAGS", this.wrap(GLOBAL_FLAGS_BODY))}`;
  }
}
