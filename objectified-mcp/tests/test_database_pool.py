from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from psycopg_pool import AsyncConnectionPool

from objectified_mcp.database_pool import MCP_DB_POOL_KEY, get_db_pool, ping_pool
from objectified_mcp.server import database_lifespan, mcp


@pytest.fixture(autouse=True)
def _settings_env_for_lifespan(monkeypatch: pytest.MonkeyPatch) -> None:
    from objectified_mcp.settings import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("OBJECTIFIED_MCP_DATABASE_URL", "postgresql://localhost/db")
    monkeypatch.setenv("OBJECTIFIED_MCP_INTERNAL_SECRET", "x" * 16)
    yield
    get_settings.cache_clear()


def _mock_pool_for_ping() -> MagicMock:
    exec_mock = AsyncMock()
    conn = MagicMock()
    conn.execute = exec_mock
    cm = AsyncMock()
    cm.__aenter__.return_value = conn
    cm.__aexit__.return_value = None
    mock_pool = MagicMock(spec=AsyncConnectionPool)
    mock_pool.connection = MagicMock(return_value=cm)
    mock_pool.open = AsyncMock()
    mock_pool.close = AsyncMock()
    return mock_pool


def test_ping_pool_runs_select_one() -> None:
    mock_pool = _mock_pool_for_ping()

    async def run() -> None:
        await ping_pool(mock_pool)

    asyncio.run(run())
    mock_pool.connection.assert_called_once()
    inner = mock_pool.connection.return_value.__aenter__.return_value
    inner.execute.assert_awaited_once()


def test_concurrent_ping_pool_acquires_release() -> None:
    mock_pool = _mock_pool_for_ping()

    async def run() -> None:
        await asyncio.gather(*[ping_pool(mock_pool) for _ in range(16)])

    asyncio.run(run())
    inner = mock_pool.connection.return_value.__aenter__.return_value
    assert inner.execute.await_count == 16


def test_get_db_pool_from_context() -> None:
    from fastmcp import Context

    pool = MagicMock(spec=AsyncConnectionPool)
    ctx = MagicMock(spec=Context)
    ctx.lifespan_context = {MCP_DB_POOL_KEY: pool}
    assert get_db_pool(ctx) is pool


def test_get_db_pool_missing_raises() -> None:
    from fastmcp import Context

    ctx = MagicMock(spec=Context)
    ctx.lifespan_context = {}
    with pytest.raises(RuntimeError, match="Database pool is not available"):
        get_db_pool(ctx)


def test_database_lifespan_opens_ping_closes() -> None:
    mock_pool = _mock_pool_for_ping()

    async def run() -> None:
        with patch("objectified_mcp.server.create_async_pool", return_value=mock_pool):
            async with database_lifespan(mcp) as ctx:
                assert MCP_DB_POOL_KEY in ctx
                assert ctx[MCP_DB_POOL_KEY] is mock_pool
        mock_pool.open.assert_awaited_once()
        mock_pool.close.assert_awaited_once()

    asyncio.run(run())


def test_database_lifespan_closes_when_ping_fails() -> None:
    mock_pool = _mock_pool_for_ping()
    mock_pool.connection.side_effect = OSError("boom")

    async def run() -> None:
        with patch("objectified_mcp.server.create_async_pool", return_value=mock_pool):
            with pytest.raises(OSError, match="boom"):
                async with database_lifespan(mcp):
                    pass
        mock_pool.close.assert_awaited_once()

    asyncio.run(run())


def test_database_lifespan_closes_when_server_task_cancelled() -> None:
    """Pool ``close()`` runs when the MCP runner task is cancelled (e.g. SIGTERM-style shutdown)."""
    mock_pool = _mock_pool_for_ping()

    async def run() -> None:
        hang = asyncio.Event()

        async def blocked_inside_lifespan() -> None:
            async with database_lifespan(mcp):
                await hang.wait()

        with patch("objectified_mcp.server.create_async_pool", return_value=mock_pool):
            task = asyncio.create_task(blocked_inside_lifespan())
            await asyncio.sleep(0)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
        mock_pool.close.assert_awaited_once()

    asyncio.run(run())
