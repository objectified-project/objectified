# objectified-cli

TypeScript CLI for [Objectified](https://objectified.dev), built with [oclif](https://oclif.io/) v4.

## Requirements

- Node.js 20+

## Install (monorepo / local)

From this directory:

```bash
npm install -g .
# or
npm link
```

The `objectified` binary should be on your `PATH`.

## Development

```bash
yarn install   # from repo root
yarn workspace objectified-cli build
yarn workspace objectified-cli dev hello
yarn workspace objectified-cli test
```

The workspace root pins `ansi-regex`, `string-width`, and `strip-ansi` so oclif’s help layout (`widest-line` / `wrap-ansi`) always resolves CommonJS-compatible builds under Yarn’s hoisting.

## Commands

| Command                     | Description                              |
| --------------------------- | ---------------------------------------- |
| `objectified hello`         | Smoke-test greeting                      |
| `objectified projects list` | List projects (stub; JSON with `--json`) |
| `objectified --help`        | Built-in help + global flag docs         |

Global flags apply to every command (see **`objectified --help`**): `--api-key`, `--base-url`, `--config`, `--json`, `--no-color`, `--profile`, `--quiet`/`-q`, `--verbose`, plus env vars `OBJECTIFIED_*` and `NO_COLOR`. Effective API URL and optional API key resolve in order: **CLI flag → environment → `[profile.NAME]` in config → `[default]` in config → built-in default** (`https://api.objectified.dev` for the URL). Config file default path: `~/.config/objectified/config.toml`.

You may place global flags before the subcommand (for example `objectified --json projects list`); the runtime reorders them for oclif.

Ticket **#3188** adds interactive `config` management commands on top of this file format.

## Performance

`objectified --version` and `objectified --help` are sized for sub‑200 ms cold start on typical developer hardware (see integration test budgets).
