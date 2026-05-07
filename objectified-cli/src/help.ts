import { Help } from "@oclif/core";

/** Duplicated from cli-context DEFAULT_BASE_URL so this module stays standalone for oclif help loading. */
const DEFAULT_BASE_URL = "https://api.objectified.dev";

const GLOBAL_FLAGS_BODY = [
  "Global flags apply to every command:",
  "",
  `  --api-key       OBJECTIFIED_API_KEY       Direct API-key auth`,
  `  --base-url      OBJECTIFIED_BASE_URL      Root REST endpoint (built-in default: ${DEFAULT_BASE_URL})`,
  `  --config        OBJECTIFIED_CONFIG        Config file (~/.config/objectified/config.toml)`,
  `  --json          OBJECTIFIED_JSON=1        Machine-readable JSON (auto when stdout is not a TTY)`,
  `  --no-color      NO_COLOR=1                Disable ANSI color (auto when stdout is not a TTY)`,
  `  --profile       OBJECTIFIED_PROFILE       Named profile (default: default)`,
  `  --quiet, -q                               Suppress non-error stdout`,
  `  --verbose       OBJECTIFIED_VERBOSE=1     Verbose stderr logging`,
  "",
  "Resolution order for URL and API key (highest precedence wins):",
  "  1. Command-line flag",
  "  2. Environment variable",
  "  3. Config [profile.NAME] section",
  "  4. Config [default] section",
  `  5. Built-in default (base URL only: ${DEFAULT_BASE_URL})`,
].join("\n");

export default class ObjectifiedHelp extends Help {
  formatRoot(): string {
    return `${super.formatRoot()}\n\n${this.section("GLOBAL FLAGS", this.wrap(GLOBAL_FLAGS_BODY))}`;
  }
}
