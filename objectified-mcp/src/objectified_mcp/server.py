"""FastMCP application instance (stdio / HTTP transports land in later tickets)."""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from fastmcp import FastMCP
from fastmcp.server.lifespan import lifespan
from structlog.contextvars import bound_contextvars

from objectified_mcp.database_pool import MCP_DB_POOL_KEY, create_async_pool, ping_pool
from objectified_mcp.logging_config import configure_logging
from objectified_mcp.settings import get_settings

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
            await ping_pool(pool)
            _log.info("database_pool_ready")
            yield {MCP_DB_POOL_KEY: pool}
        finally:
            _log.info("database_pool_closing")
            await pool.close()


mcp = FastMCP("Objectified", lifespan=database_lifespan)
