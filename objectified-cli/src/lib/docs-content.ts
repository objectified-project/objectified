/** Long-form prose for `objectified docs <topic>` (single source with command classes). */

export const docsTopicOutput = `
OUTPUT FORMATTING

Human vs machine
  When stdout is a terminal, commands print tables, hints, and optional color (unless NO_COLOR or --no-color applies). When stdout is not a TTY, JSON mode is chosen automatically unless you pass --no-json.

Stable JSON
  With --json (or non-TTY stdout), emitted JSON is sorted by key where applicable and avoids decorative fields. Pipe output to jq or similar tools.

Quiet and verbose
  --quiet (-q) hides non-error stdout such as banners and spinners while keeping errors on stderr. --verbose adds diagnostic detail on stderr without changing stdout payloads.

Color
  Color follows --color / --no-color, NO_COLOR, TTY detection, and terminal capability. Help output uses the same rules.

YAML and tables
  Some commands may offer YAML for debugging; tables use cli-table3 with ASCII-friendly borders when LANG suggests C/POSIX locales.
`.trim();

export const docsTopicProfiles = `
CONFIG PROFILES

config.toml
  The CLI reads ~/.config/objectified/config.toml by default (or OBJECTIFIED_CONFIG / --config). Profiles live under [profile.NAME] with defaults under [default].

default_profile
  default_profile selects which profile is active when --profile is omitted. Use objectified config get default_profile or objectified config set default_profile staging.

Resolution order
  Base URL and tenant slug resolve per profile: explicit flags and env vars override profile values, which override [default]. API keys are never read from the file (#3188); use --api-key or OBJECTIFIED_API_KEY.

Switching profiles
  Pass --profile <name> for a single invocation or change default_profile for every command.
`.trim();

export const docsTopicCompletions = `
SHELL COMPLETIONS

Status
  Interactive completion installers are tracked in roadmap ticket #3193 (bash, zsh, fish, PowerShell). This topic reserves the docs slot until that work lands.

Today
  Use objectified --help and objectified docs <topic> for discoverability, or generate completion scripts from oclif once the completion command ships.
`.trim();

export const docsTopicPlugins = `
PLUGINS

Status
  An oclif plugin ecosystem for Objectified is planned for post-MVP releases. This CLI currently ships core commands only.

Extensibility
  Future builds may expose objectified plugins:* commands for third-party commands alongside versioned API compatibility guarantees.
`.trim();

export const docsTopicTelemetry = `
TELEMETRY

Default posture
  The open-source CLI does not phone home by default. Any future telemetry would be opt-in, documented per release, and scoped to aggregate usage without secrets.

Verbose diagnostics
  Use --verbose or OBJECTIFIED_VERBOSE=1 for stderr diagnostics. OBJECTIFIED_DEBUG=1 may include stack traces for unexpected failures—avoid enabling in CI logs that are world-readable.
`.trim();
