# objectified-mcp

Python **FastMCP** service for exposing Objectified OpenAPI specifications over the Model Context Protocol.

Local development uses **[uv](https://docs.astral.sh/uv/)**:

```bash
cd objectified-mcp
uv sync
uv run objectified-mcp --help
```

## Configuration

Copy [.env.example](.env.example) to `.env` and set at least **`OBJECTIFIED_MCP_DATABASE_URL`** and **`OBJECTIFIED_MCP_INTERNAL_SECRET`** (minimum 16 characters). **`uv run objectified-mcp serve`** validates configuration and exits; **`uv run objectified-mcp serve --transport stdio`** runs the FastMCP stdio transport for local hosts (Claude Desktop, mcp-inspector). **`uv run objectified-mcp serve --transport http`** runs streamable HTTP (MCP endpoint **`/mcp`**); bind address and port come from **`OBJECTIFIED_MCP_HTTP_HOST`** / **`OBJECTIFIED_MCP_HTTP_PORT`** or **`--host`** / **`--port`**. Stop with Ctrl+C or **`SIGTERM`** for graceful uvicorn shutdown.

When the MCP runtime starts, it opens a shared **`psycopg_pool.AsyncConnectionPool`**, runs **`SELECT 1`** against it, exposes the pool on FastMCP lifespan context under **`db_pool`**, and **`await pool.close()`** in **`finally`** so shutdown (including EOF on stdio or task cancellation) tears down connections cleanly. Pool sizing is controlled with **`OBJECTIFIED_MCP_DATABASE_POOL_MIN_SIZE`**, **`OBJECTIFIED_MCP_DATABASE_POOL_MAX_SIZE`**, and **`OBJECTIFIED_MCP_DATABASE_POOL_TIMEOUT`** (seconds to wait for a connection).

## Logging

Logs go to **stderr** as **JSON** (via **structlog**), one object per line. Each line includes **`timestamp`** (UTC ISO-8601), **`level`**, **`event`**, **`request_id`**, and **`tool_name`** (use **`structlog.contextvars.bound_contextvars`** around MCP tool handlers so tool calls carry the RPC id and tool name). Root verbosity is set with **`OBJECTIFIED_MCP_LOG_LEVEL`** (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`).
