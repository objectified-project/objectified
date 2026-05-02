from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from psycopg_pool import AsyncConnectionPool

from objectified_mcp.mcp_access_audit import insert_mcp_access_audit, schedule_mcp_private_access_audit


def test_insert_mcp_access_audit_executes_insert() -> None:
    conn = MagicMock()
    conn.execute = AsyncMock()
    conn.commit = AsyncMock()
    cm_conn = AsyncMock()
    cm_conn.__aenter__ = AsyncMock(return_value=conn)
    cm_conn.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock(spec=AsyncConnectionPool)
    pool.connection = MagicMock(return_value=cm_conn)

    async def run() -> None:
        await insert_mcp_access_audit(
            pool,
            key_id="00000000-0000-4000-8000-000000000001",
            tool="spec.list",
            spec_id="11111111-1111-4111-8111-111111111111",
            success=True,
            error=None,
        )

    asyncio.run(run())
    conn.execute.assert_awaited_once()
    conn.commit.assert_awaited_once()


def test_schedule_mcp_private_access_audit_creates_background_task() -> None:
    pool = MagicMock(spec=AsyncConnectionPool)

    async def run_inner() -> None:
        with patch("objectified_mcp.mcp_access_audit.insert_mcp_access_audit", new=AsyncMock()) as ins:
            schedule_mcp_private_access_audit(
                pool,
                key_id="00000000-0000-4000-8000-000000000002",
                tool="spec.describe",
                spec_id="22222222-2222-4222-8222-222222222222",
            )
            await asyncio.sleep(0)
            ins.assert_awaited_once_with(
                pool,
                key_id="00000000-0000-4000-8000-000000000002",
                tool="spec.describe",
                spec_id="22222222-2222-4222-8222-222222222222",
                success=True,
                error=None,
            )

    asyncio.run(run_inner())
