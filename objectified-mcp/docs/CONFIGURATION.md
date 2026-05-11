# objectified-mcp configuration

Runtime configuration is loaded from the environment by [`Settings`](../src/objectified_mcp/settings.py) (pydantic-settings). All variables use the prefix **`OBJECTIFIED_MCP_`**. An optional **`.env`** file in the current working directory is read when present (`env_file=".env"`).

## Variable reference

| Environment variable | Required | Default | Valid range / notes |
|---------------------|----------|---------|---------------------|
| **`OBJECTIFIED_MCP_DATABASE_URL`** | Yes | — | PostgreSQL URL (`postgres://` or `postgresql://`). Field: `database_url`. |
| **`OBJECTIFIED_MCP_INTERNAL_SECRET`** | Yes | — | Minimum **16** characters. Used for internal signing material (e.g. HMAC). Field: `internal_secret` (secret value). |
| **`OBJECTIFIED_MCP_LOG_LEVEL`** | No | `INFO` | One of: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` (case-insensitive; normalized to uppercase). |
| **`OBJECTIFIED_MCP_TRANSPORT`** | No | `stdio` | `stdio` or `http`. Stored on `Settings`; **`objectified-mcp serve` still requires `--transport stdio` or `--transport http` to run a transport**—without those flags the CLI validates configuration and exits. |
| **`OBJECTIFIED_MCP_HTTP_HOST`** | No | `127.0.0.1` | Non-empty bind address when using HTTP transport (CLI `--host` overrides). |
| **`OBJECTIFIED_MCP_HTTP_PORT`** | No | `8765` | Integer **1–65535** (CLI `--port` overrides). |
| **`OBJECTIFIED_MCP_DATABASE_POOL_MIN_SIZE`** | No | `1` | Integer **1–256**. |
| **`OBJECTIFIED_MCP_DATABASE_POOL_MAX_SIZE`** | No | `10` | Integer **1–256**; must be **≥** `DATABASE_POOL_MIN_SIZE`. |
| **`OBJECTIFIED_MCP_DATABASE_POOL_TIMEOUT`** | No | `30` | Seconds to wait for a pool connection; **> 0** and **≤ 600**. |
| **`OBJECTIFIED_MCP_OPENAPI_MAX_JSON_BYTES`** | No | `2097152` | Max UTF-8 size for exported OpenAPI JSON/YAML payloads (**1024–100_000_000**). |
| **`OBJECTIFIED_MCP_OPENAI_API_KEY`** | No | — | Secret for **`spec.search_semantic`** query embeddings (`Bearer` to **`OBJECTIFIED_MCP_OPENAI_EMBEDDING_URL`**). When unset, calling **`spec.search_semantic`** fails fast. |
| **`OBJECTIFIED_MCP_OPENAI_EMBEDDING_URL`** | No | `https://api.openai.com/v1/embeddings` | OpenAI-compatible embeddings endpoint (POST JSON `model`, `input`, `dimensions`). |
| **`OBJECTIFIED_MCP_OPENAI_EMBEDDING_MODEL`** | No | `text-embedding-3-small` | Passed through to the embeddings API as **`model`**. |
| **`OBJECTIFIED_MCP_OPENAI_EMBEDDING_DIMENSIONS`** | No | `1536` | Must match **`odb.versions.mcp_public_embedding`** (`vector(1536)` migration). |
| **`OBJECTIFIED_MCP_OPENAI_EMBEDDING_TIMEOUT_S`** | No | `60` | HTTP timeout for embedding requests (**> 0**, **≤ 600**). |

## Related files

- **[`../.env.example`](../.env.example)** — copy/paste template for local development.
- **Repository root [`docker-compose.env.example`](../../docker-compose.env.example)** — overrides for **`docker compose`** (Postgres + MCP port + secret).
