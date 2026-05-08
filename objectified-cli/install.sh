#!/usr/bin/env bash
set -euo pipefail

CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CLI_DIR"

yarn install
yarn build

npm link

echo "Linked the objectified CLI globally. Try: objectified --help"
