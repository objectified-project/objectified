#!/usr/bin/env bash
#
# Wrapper to run the Objectified Web Docker image via start-objectified-docker.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export IMAGE="objectified-web"
export ENV_FILE="/root/.env.web"
export PORT="3002"

exec "$SCRIPT_DIR/start-objectified-docker.sh" "$@"
