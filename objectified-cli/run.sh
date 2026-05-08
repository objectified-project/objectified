#!/usr/bin/env bash
set -euo pipefail

CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CLI_DIR"

if [[ "${OBJECTIFIED_CLI_DEV:-}" == "1" ]]; then
  exec node bin/dev.js "$@"
fi

if [[ ! -f dist/lib/normalize-argv.js ]]; then
  yarn build
fi

exec node bin/run.js "$@"
