"""MCP ``ping`` tool: service identity, version, DB reachability, timestamp."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from psycopg_pool import AsyncConnectionPool

from objectified_mcp import __version__
from objectified_mcp.database_pool import ping_pool


async def build_ping_response(pool: AsyncConnectionPool) -> dict[str, Any]:
    """Return ping payload; ``db_ok`` is True after ``SELECT 1``, else False with ``db_error``."""
    ts = datetime.now(timezone.utc).isoformat()
    common: dict[str, Any] = {
        "service": "objectified-mcp",
        "version": __version__,
        "ts": ts,
    }
    try:
        await ping_pool(pool)
    except Exception as exc:
        return {**common, "db_ok": False, "db_error": str(exc)}
    return {**common, "db_ok": True}
