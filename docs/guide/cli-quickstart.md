# CLI quick-start

`objectified` is the command-line client for the Objectified REST API: import documents, inspect
tenant resources, lint, and export specs from the terminal. It follows [clig.dev](https://clig.dev/)
conventions — structured `--help`, sensible exit codes, tables on stdout, diagnostics on stderr.

Full details live in [`objectified-cli/README.md`](../../objectified-cli/README.md); this page is the
30-second start.

---

## Install & run

**Requirements:** Python ≥ 3.14 and [uv](https://docs.astral.sh/uv/).

```bash
cd objectified-cli
uv sync
uv run objectified --version
```

Convenience runner (loads `.env`, ensures the venv):

```bash
./run.sh doctor
./run.sh projects list
./run.sh                 # interactive prompt (TTY) or one-command-per-line (piped)
```

## Configure

Resolution order is **flags > env vars > dotenv > config file > defaults**.

| Setting | Env var | Default |
|---|---|---|
| REST base URL | `OBJECTIFIED_BASE_URL` | `http://localhost:8000` |
| Tenant (slug or UUID) | `OBJECTIFIED_TENANT_ID` | — |
| API key (`X-API-Key`) | `OBJECTIFIED_API_KEY` | — |
| UI session token | `OBJECTIFIED_SESSION_TOKEN` | — |

Persist defaults to `~/.config/objectified/config.toml` via the CLI:

```bash
objectified config set base-url http://localhost:8000
objectified config set tenant   acme-corp
objectified config set api-key  obj_your_key_here
objectified config show          # secrets masked
```

Get an API key from the UI: **Dashboard → API keys** (`/ade/dashboard/api-keys`).

## First commands

```bash
objectified doctor                      # connectivity check (no auth)
objectified health                      # REST health JSON
objectified projects list               # needs tenant + API key
objectified import openapi ./spec.yaml  # import (waits for the job)
objectified lint --project <p> --version <v> --min-grade B
objectified spec export --project <p> --version <v> -o spec.json
```

## Command groups

| Group | What it does |
|---|---|
| `doctor`, `health` | Connectivity / health (no auth) |
| `auth` | Inspect signed-in identity and accessible tenants |
| `config` | Show / set / unset saved defaults |
| `projects`, `properties`, `schemas`, `types` | List & fetch tenant resources |
| `versions`, `paths`, `operations`, `workflows` | Inspect a project version's surface |
| `import` | Import OpenAPI / Swagger / Arazzo / JSON Schema (`auto` detects) |
| `lint` | Server-computed quality score & findings |
| `spec` | Export reconstructed OpenAPI / Arazzo documents |
| `repos` | List & inspect linked Git repositories |

Useful global flags: `--json` (raw JSON for scripting), `--tenant`, `--api-key`, `--base-url`,
`--verbose`, `--timeout`. Run `objectified help` or `objectified <group> --help` for the rest.

## Related

- [import-a-spec.md](import-a-spec.md), [lint-and-quality.md](lint-and-quality.md),
  [export-a-spec.md](export-a-spec.md) — the spine, from the CLI
- [api-reference.md](api-reference.md) — the routes behind these commands
