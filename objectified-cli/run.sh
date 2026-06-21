#!/usr/bin/env bash
# Run the objectified CLI from this package with a local venv and optional .env.
#
# Usage:
#   ./run.sh [global flags] <command> ...   Run one command (same as objectified)
#   ./run.sh                                 Interactive prompt (TTY) or read
#                                            one command per line from stdin
#
# Environment:
#   OBJECTIFIED_LOAD_DOTENV=0     Skip loading .env (tests)
#   OBJECTIFIED_CLI_COMMAND       Override path to the objectified executable

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

load_env_file() {
  local f="$1"
  if [[ -f "$f" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
  fi
}

if [[ "${OBJECTIFIED_LOAD_DOTENV:-1}" != "0" ]]; then
  load_env_file "$ROOT/.env"
fi

if [[ ! -x "$ROOT/.venv/bin/objectified" ]]; then
  uv sync
fi

CLI="${OBJECTIFIED_CLI_COMMAND:-$ROOT/.venv/bin/objectified}"

if [[ $# -gt 0 ]]; then
  exec "$CLI" "$@"
fi

exec uv run python -m objectified_cli.run_interactive
