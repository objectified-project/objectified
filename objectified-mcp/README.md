# objectified-mcp

Model Context Protocol server for Objectified. Ships the three primitive tools (`mcp.search`, `mcp.describe`, `mcp.execute`) on top of `@modelcontextprotocol/sdk`, with **stdio** (desktop clients) and **Streamable HTTP** at `/mcp` (hosted clients).

## Requirements

- Node.js 18+
- Yarn 4 (monorepo root)

## Build

From the repository root:

```bash
yarn workspace objectified-mcp build
```

Equivalent with pnpm:

```bash
pnpm --filter objectified-mcp build
```

## Run locally

Choose transport with **`--transport`** or **`OBJECTIFIED_MCP_TRANSPORT`** (`stdio` or `http`). CLI wins when both are set.

### stdio (local clients)

After a build:

```bash
node objectified-mcp/bin/objectified-mcp.js --transport stdio
```

Or via the workspace script:

```bash
yarn workspace objectified-mcp start
```

The process speaks MCP over stdin/stdout; pair it with an MCP-aware client (Cursor, Claude Desktop, etc.) using a config that launches this command.

### Streamable HTTP (hosted clients)

```bash
node objectified-mcp/bin/objectified-mcp.js --transport http
```

Listens on **`OBJECTIFIED_MCP_HOST`** (default `0.0.0.0`) and **`OBJECTIFIED_MCP_PORT`** (default **4040**). MCP requests use **`POST`/`GET`/`DELETE`** on **`/mcp`** per the MCP Streamable HTTP spec (`application/json` + SSE). Responses include **`Cache-Control: no-store`**.

Stop with **SIGINT** / **SIGTERM**.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OBJECTIFIED_REST_URL` | Base URL for `objectified-rest` (default `http://127.0.0.1:8000`). All HTTP calls must go through `src/upstream/client.ts` — do not use raw `fetch` elsewhere. |
| `OBJECTIFIED_MCP_KEY` | API key for upstream auth (wired fully in MCP-1.3 / MCP-1.4). |
| `OBJECTIFIED_MCP_TRANSPORT` | `stdio` or `http` when `--transport` is omitted. |
| `OBJECTIFIED_MCP_PORT` | HTTP listen port (default `4040`). |
| `OBJECTIFIED_MCP_HOST` | HTTP bind address (default `0.0.0.0`). |
| `OBJECTIFIED_MCP_STDIO_IDLE_MS` | Optional override for the stdio idle shutdown timer (default **5 minutes**). Intended for tests; production uses the default unless you set this. |

## Primitive tools (one-line examples)

- **mcp.search** — `{"q":"list tenants","category":"discovery"}` → returns matching actions from the in-process registry (empty until Epic 3 actions land).
- **mcp.describe** — `{"actionId":"tenant.list"}` → returns JSON Schemas for inputs/outputs when the action exists; otherwise an error payload.
- **mcp.execute** — `{"actionId":"tenant.list","arguments":{}}` → dispatches the action (bootstrap registry returns a stub until actions are registered).

## Tests

```bash
yarn workspace objectified-mcp test
```

## Layout

See issue MCP-1.1 / `docs/PLANNED_FEATURE_ROADMAP_MCP.md` for the full package tree (`registry/`, `upstream/`, `audit/`, `ratelimit/`, etc.).
