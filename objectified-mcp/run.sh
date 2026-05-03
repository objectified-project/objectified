#!/usr/bin/env bash
#
# Run script for MCP server
# Starts in streaming-http mode

source .venv/bin/activate
uv run objectified-mcp serve --transport http

