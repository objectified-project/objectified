#!/usr/bin/env bash
# Helper script to run the Objectified REST API server using uv

# Change to the script directory
cd "$(dirname "$0")"

# Run the app using uv
uv run -m app

