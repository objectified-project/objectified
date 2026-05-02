from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from psycopg_pool import AsyncConnectionPool

from objectified_mcp.spec_list_tags_tool import (
    LIST_TAGS_CACHE_TTL_SEC,
    build_spec_list_tags_response,
    reset_spec_list_tags_cache_for_tests,
)


def _pool_mock_for_fetch(rows: list[dict[str, object]]) -> tuple[MagicMock, MagicMock]:
    pool = MagicMock(spec=AsyncConnectionPool)
    cur = MagicMock()
    cur.execute = AsyncMock()
    cur.fetchall = AsyncMock(return_value=rows)
    cur_cm = AsyncMock()
    cur_cm.__aenter__.return_value = cur
    cur_cm.__aexit__.return_value = None
    conn = MagicMock()
    conn.cursor = MagicMock(return_value=cur_cm)
    conn_cm = AsyncMock()
    conn_cm.__aenter__.return_value = conn
    conn_cm.__aexit__.return_value = None
    pool.connection = MagicMock(return_value=conn_cm)
    return pool, cur


@pytest.fixture(autouse=True)
def _clear_tags_cache() -> None:
    reset_spec_list_tags_cache_for_tests()
    yield
    reset_spec_list_tags_cache_for_tests()


def test_build_spec_list_tags_response_maps_rows() -> None:
    rows = [
        {"tag": "stable", "cnt": 5},
        {"tag": "beta", "cnt": 2},
    ]
    pool, _ = _pool_mock_for_fetch(rows)

    async def run() -> list[dict[str, object]]:
        return await build_spec_list_tags_response(pool)

    out = asyncio.run(run())
    assert out == [{"tag": "stable", "count": 5}, {"tag": "beta", "count": 2}]


def test_build_spec_list_tags_response_empty() -> None:
    pool, _ = _pool_mock_for_fetch([])

    async def run() -> list[dict[str, object]]:
        return await build_spec_list_tags_response(pool)

    out = asyncio.run(run())
    assert out == []


def test_cache_returns_second_call_without_extra_db_hit(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    async def fake_fetch(_pool: AsyncConnectionPool) -> list[dict[str, object]]:
        calls["n"] += 1
        return [{"tag": "a", "count": 1}]

    monkeypatch.setattr(
        "objectified_mcp.spec_list_tags_tool._fetch_tag_counts",
        fake_fetch,
    )

    pool = MagicMock(spec=AsyncConnectionPool)

    async def run() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
        first = await build_spec_list_tags_response(pool)
        second = await build_spec_list_tags_response(pool)
        return first, second

    first, second = asyncio.run(run())
    assert first == second == [{"tag": "a", "count": 1}]
    assert calls["n"] == 1


def test_cache_expires_after_ttl(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    async def fake_fetch(_pool: AsyncConnectionPool) -> list[dict[str, object]]:
        calls["n"] += 1
        return [{"tag": "x", "count": calls["n"]}]

    monkeypatch.setattr(
        "objectified_mcp.spec_list_tags_tool._fetch_tag_counts",
        fake_fetch,
    )

    t = {"v": 0.0}
    monkeypatch.setattr("objectified_mcp.spec_list_tags_tool.time.monotonic", lambda: t["v"])

    pool = MagicMock(spec=AsyncConnectionPool)

    async def run() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
        first = await build_spec_list_tags_response(pool)
        t["v"] += LIST_TAGS_CACHE_TTL_SEC + 0.001
        second = await build_spec_list_tags_response(pool)
        return first, second

    first, second = asyncio.run(run())
    assert first == [{"tag": "x", "count": 1}]
    assert second == [{"tag": "x", "count": 2}]
    assert calls["n"] == 2


def test_spec_list_tags_tool_registered_on_mcp() -> None:
    from objectified_mcp.server import mcp

    async def load() -> object:
        return await mcp.get_tool("spec.list_tags")

    tool = asyncio.run(load())
    assert tool is not None
    assert tool.name == "spec.list_tags"
