# Objectified 05-2026

We continue to improve the platform based on your feedback with improvements and new features!

---

## MCP (preview)
- New `objectified-mcp` workspace package bootstraps the MCP server with stdio and the `mcp.search` / `mcp.describe` / `mcp.execute` tools.
- MCP-1.2: Streamable HTTP transport at `/mcp` (`--transport http`, port from `OBJECTIFIED_MCP_PORT`) alongside stdio; HTTP responses use `Cache-Control: no-store`.
- MCP-1.3: MCP sessions authenticate via API keys (`Authorization: Bearer …` on HTTP, `OBJECTIFIED_MCP_KEY` on stdio), resolved through `objectified-rest` with optional Redis `mcp.key.revoked` cache eviction; database adds key `purpose` / `scopes` for REST vs MCP separation.

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

*Last updated: May 1, 2026*

