# Objectified 06-2026

We continue to improve the platform based on your feedback with improvements and new features!

---

## MCP

- New `objectified-mcp` Python package (FastMCP, uv, ruff, mypy) as the foundation for the Model Context Protocol server.
- MCP server loads typed configuration from the environment via pydantic-settings (`objectified-mcp serve`); **`objectified-mcp serve --transport stdio`** runs the FastMCP stdio transport for Claude Desktop and similar hosts; **`objectified-mcp serve --transport http`** exposes streamable HTTP at **`/mcp`** with configurable **`--host`** / **`--port`** (or env defaults); see `objectified-mcp/.env.example`.
- MCP runtime opens a shared async Postgres pool (psycopg 3) at startup, exposes it to tools via lifespan context, runs a health probe (`SELECT 1`), and closes the pool cleanly on shutdown.
- MCP process logs are structured JSON on stderr (structlog): each line includes `timestamp`, `level`, `event`, `request_id`, and `tool_name`; verbosity is controlled with `OBJECTIFIED_MCP_LOG_LEVEL`.

## Importing
- Race condition fixed in 3.0.1 specification imports
- Import supports Swagger 2.0 format
- Adds the ability to import multiple versions of the same project 

## Repositories
- Recent imports from repository metrics are now displayed
- Imports tab now shows the previously imported files from the repository
- Files in the imports tab now leads to the original file that was imported

---

View our YouTube channel [here](https://www.youtube.com/@objectifieddev) for detailed tutorials and walkthroughs!

---

## Feedback

We'd love to hear your thoughts! Your feedback helps us make Objectified better.

---

**Thank you for using Objectified!**

*Last updated: May 2, 2026*

