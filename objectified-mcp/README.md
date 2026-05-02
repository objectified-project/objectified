# objectified-mcp

Python **FastMCP** service for exposing Objectified OpenAPI specifications over the Model Context Protocol.

Local development uses **[uv](https://docs.astral.sh/uv/)**:

```bash
cd objectified-mcp
uv sync
uv run objectified-mcp --help
```

## Configuration

Copy [.env.example](.env.example) to `.env` and set at least **`OBJECTIFIED_MCP_DATABASE_URL`** and **`OBJECTIFIED_MCP_INTERNAL_SECRET`** (minimum 16 characters). Running **`uv run objectified-mcp serve`** loads and validates these variables immediately (stdio / HTTP transports are added in later roadmap tickets).
