from __future__ import annotations

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from psycopg_pool import AsyncConnectionPool

from objectified_mcp import __version__
from objectified_mcp.ping_tool import build_ping_response


def _mock_pool_for_ping() -> MagicMock:
    exec_mock = AsyncMock()
    conn = MagicMock()
    conn.execute = exec_mock
    cm = AsyncMock()
    cm.__aenter__.return_value = conn
    cm.__aexit__.return_value = None
    mock_pool = MagicMock(spec=AsyncConnectionPool)
    mock_pool.connection = MagicMock(return_value=cm)
    return mock_pool


def test_build_ping_response_ok() -> None:
    mock_pool = _mock_pool_for_ping()

    async def run() -> dict[str, object]:
        return await build_ping_response(mock_pool)

    result = asyncio.run(run())
    assert result["service"] == "objectified-mcp"
    assert result["version"] == __version__
    assert result["db_ok"] is True
    assert "db_error" not in result
    parsed = datetime.fromisoformat(str(result["ts"]).replace("Z", "+00:00"))
    assert parsed.tzinfo is not None


def test_build_ping_response_db_failure_includes_error_string() -> None:
    mock_pool = _mock_pool_for_ping()
    mock_pool.connection.side_effect = OSError("connection refused")

    async def run() -> dict[str, object]:
        return await build_ping_response(mock_pool)

    result = asyncio.run(run())

    assert result["service"] == "objectified-mcp"
    assert result["version"] == __version__
    assert result["db_ok"] is False
    assert result["db_error"] == "connection refused"
    assert result["ts"]


def test_ping_tool_registered_on_mcp() -> None:
    from objectified_mcp.server import mcp

    async def load() -> object:
        return await mcp.get_tool("ping")

    tool = asyncio.run(load())
    assert tool is not None
    assert tool.name == "ping"
