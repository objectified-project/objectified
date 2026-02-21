#!/usr/bin/env bash
#
# Wrapper to run the Objectified Browse Docker image via start-objectified-docker.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export IMAGE="objectified-browse"
export ENV_FILE="/root/.env.browse"
export PORT="3003"

exec "$SCRIPT_DIR/start-objectified-docker.sh" "$@"
