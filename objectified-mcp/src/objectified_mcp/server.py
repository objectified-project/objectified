"""FastMCP application instance (stdio and streamable HTTP via ``objectified-mcp serve``)."""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from fastmcp import Context, FastMCP
from fastmcp.server.lifespan import lifespan
from structlog.contextvars import bound_contextvars

from objectified_mcp.database_pool import MCP_DB_POOL_KEY, create_async_pool, get_db_pool, ping_pool
from objectified_mcp.http_credential_middleware import StashHttpBearerInToolContextMiddleware
from objectified_mcp.logging_config import configure_logging
from objectified_mcp.ping_tool import build_ping_response
from objectified_mcp.settings import get_settings
from objectified_mcp.spec_list_tool import build_spec_list_response

_log = structlog.get_logger(__name__)


@lifespan
async def database_lifespan(server: Any) -> Any:
    """Open the shared async pool at MCP startup; close it on shutdown (including cancellation)."""
    settings = get_settings()
    configure_logging(settings)
    with bound_contextvars(request_id=str(uuid.uuid4()), tool_name="lifespan.database"):
        pool = create_async_pool(settings, open=False)
        try:
            _log.info("database_pool_opening")
            await pool.open()
            try:
                await ping_pool(pool)
                _log.info("database_pool_ready")
            except Exception as exc:
                _log.warning("database_pool_probe_failed_at_startup", error=str(exc))
            yield {MCP_DB_POOL_KEY: pool}
        finally:
            _log.info("database_pool_closing")
            await pool.close()


mcp = FastMCP("Objectified", lifespan=database_lifespan)
mcp.add_middleware(StashHttpBearerInToolContextMiddleware())


@mcp.tool
async def ping(ctx: Context) -> dict[str, Any]:
    """Smoke-test: service name, package version, Postgres reachability, UTC timestamp."""
    pool = get_db_pool(ctx)
    return await build_ping_response(pool)


@mcp.tool(
    name="spec.list",
    description=(
        "List published public OpenAPI specs (cursor pagination over odb.mcp_v_public_specs). "
        "Optional filters: tenant_id, project_id (UUID strings). "
        "limit defaults to 50, capped at 100. Pass next_cursor from the previous response for the next page."
    ),
)
async def spec_list(
    ctx: Context,
    tenant_id: str | None = None,
    project_id: str | None = None,
    limit: int | None = None,
    cursor: str | None = None,
) -> dict[str, Any]:
    pool = get_db_pool(ctx)
    return await build_spec_list_response(
        pool,
        tenant_id=tenant_id,
        project_id=project_id,
        limit=limit,
        cursor=cursor,
    )
