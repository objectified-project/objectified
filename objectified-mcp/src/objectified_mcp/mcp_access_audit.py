"""Append-only audit for MCP reads of private published revisions (#3013)."""

from __future__ import annotations

import asyncio

import structlog
from psycopg_pool import AsyncConnectionPool

_log = structlog.get_logger(__name__)


async def insert_mcp_access_audit(
    pool: AsyncConnectionPool,
    *,
    key_id: str,
    tool: str,
    spec_id: str,
    success: bool,
    error: str | None,
) -> None:
    """Persist one audit row; callers should use :func:`schedule_mcp_private_access_audit` from tools."""
    async with pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO odb.mcp_access_audit (key_id, tool, spec_id, at, success, error)
            VALUES (%s::uuid, %s, %s::uuid, CURRENT_TIMESTAMP, %s, %s)
            """,
            (key_id, tool, spec_id, success, error),
        )
        await conn.commit()


def schedule_mcp_private_access_audit(
    pool: AsyncConnectionPool,
    *,
    key_id: str,
    tool: str,
    spec_id: str,
    success: bool = True,
    error: str | None = None,
) -> None:
    """Fire-and-forget audit insert so MCP tool latency stays low."""

    async def _run() -> None:
        try:
            await insert_mcp_access_audit(
                pool,
                key_id=key_id,
                tool=tool,
                spec_id=spec_id,
                success=success,
                error=error,
            )
        except Exception:
            _log.warning(
                "mcp_access_audit_insert_failed",
                key_id=key_id,
                tool=tool,
                spec_id=spec_id,
                exc_info=True,
            )

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        _log.debug("mcp_access_audit_skip_no_event_loop", key_id=key_id, tool=tool)
