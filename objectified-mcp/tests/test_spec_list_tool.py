from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from psycopg_pool import AsyncConnectionPool

from objectified_mcp.spec_list_tool import (
    MAX_PAGE_SIZE,
    InvalidSpecListCursorError,
    build_spec_list_response,
    decode_spec_list_cursor,
    encode_spec_list_cursor,
)


def _sample_row(
    *,
    spec_id: UUID | None = None,
    updated_at: datetime | None = None,
) -> dict[str, object]:
    sid = spec_id or uuid4()
    ts = updated_at or datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
    return {
        "id": sid,
        "tenant_id": uuid4(),
        "project_id": uuid4(),
        "title": "Demo",
        "version": "1.0.0",
        "description": None,
        "tags": ["alpha"],
        "updated_at": ts,
    }


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


def test_encode_spec_list_cursor_is_stable_and_roundtrips() -> None:
    sid = UUID("33333333-3333-4333-8333-333333333333")
    ts = datetime(2026, 5, 2, 15, 30, 45, 123456, tzinfo=timezone.utc)
    c1 = encode_spec_list_cursor(ts, sid)
    c2 = encode_spec_list_cursor(ts, sid)
    assert c1 == c2
    assert "=" not in c1

    out = decode_spec_list_cursor(c1)
    assert out is not None
    got_ts, got_id = out
    assert got_id == sid
    assert got_ts == ts.astimezone(timezone.utc)


def test_decode_spec_list_cursor_none_and_blank() -> None:
    assert decode_spec_list_cursor(None) is None
    assert decode_spec_list_cursor("") is None
    assert decode_spec_list_cursor("   ") is None


def test_decode_spec_list_cursor_rejects_garbage() -> None:
    with pytest.raises(InvalidSpecListCursorError):
        decode_spec_list_cursor("not-valid-base64???")

    with pytest.raises(InvalidSpecListCursorError):
        decode_spec_list_cursor("aaaa")


def test_decode_spec_list_cursor_rejects_wrong_version() -> None:
    import base64
    import json

    raw = json.dumps({"v": 99, "i": str(uuid4()), "u": "2026-01-01T00:00:00Z"}).encode()
    token = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    with pytest.raises(InvalidSpecListCursorError, match="version"):
        decode_spec_list_cursor(token)


@pytest.mark.parametrize(
    ("limit_in", "expected_fetch_limit"),
    [(None, 51), (1, 2), (100, 101), (500, 101)],
)
def test_build_spec_list_response_clamps_limit(limit_in: int | None, expected_fetch_limit: int) -> None:
    rows = [_sample_row()]
    pool, cur = _pool_mock_for_fetch(rows)

    async def run() -> None:
        await build_spec_list_response(pool, limit=limit_in)

    asyncio.run(run())
    _sql, params = cur.execute.await_args.args
    assert params["lim"] == expected_fetch_limit


def test_build_spec_list_response_has_more_and_next_cursor() -> None:
    base_ts = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
    id_a = uuid4()
    id_b = uuid4()
    rows = [
        _sample_row(spec_id=id_a, updated_at=base_ts),
        _sample_row(spec_id=id_b, updated_at=base_ts.replace(hour=11)),
    ]
    pool, _cur = _pool_mock_for_fetch(rows)

    async def run() -> dict[str, object]:
        return await build_spec_list_response(pool, limit=1)

    out = asyncio.run(run())
    assert out["has_more"] is True
    assert len(out["items"]) == 1
    assert out["next_cursor"] is not None
    decoded = decode_spec_list_cursor(str(out["next_cursor"]))
    assert decoded is not None
    assert decoded[1] == id_a


def test_build_spec_list_response_no_next_when_last_page() -> None:
    rows = [_sample_row()]
    pool, _cur = _pool_mock_for_fetch(rows)

    async def run() -> dict[str, object]:
        return await build_spec_list_response(pool, limit=50)

    out = asyncio.run(run())
    assert out["has_more"] is False
    assert out["next_cursor"] is None


def test_build_spec_list_invalid_tenant_uuid() -> None:
    pool, _cur = _pool_mock_for_fetch([])

    async def run() -> None:
        await build_spec_list_response(pool, tenant_id="not-a-uuid")

    with pytest.raises(ValueError, match="tenant_id"):
        asyncio.run(run())


def test_spec_list_tool_registered_on_mcp() -> None:
    from objectified_mcp.server import mcp

    async def load() -> object:
        return await mcp.get_tool("spec.list")

    tool = asyncio.run(load())
    assert tool is not None
    assert tool.name == "spec.list"


def test_max_page_size_constant() -> None:
    assert MAX_PAGE_SIZE == 100
