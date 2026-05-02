from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastmcp import Context
from fastmcp.exceptions import AuthorizationError
from psycopg_pool import AsyncConnectionPool

from objectified_mcp.database_pool import MCP_DB_POOL_KEY
from objectified_mcp.mcp_auth import (
    McpAuthContext,
    extract_raw_mcp_api_key,
    hash_mcp_api_key_secret,
    mcp_key_prefix,
    meta_as_dict,
    require_mcp_auth,
    validate_mcp_api_key,
)

_SECRET = "0123456789ab" + "cursor-test-secret"


def test_mcp_key_prefix_format() -> None:
    assert mcp_key_prefix(_SECRET) == _SECRET[:12] + "..."


def test_extract_prefers_http_authorization_over_meta() -> None:
    meta = {"objectified_api_key": "from-meta"}
    got = extract_raw_mcp_api_key(
        http_headers={"authorization": "Bearer from-header"},
        request_meta=meta,
    )
    assert got == "from-header"


def test_extract_bearer_case_insensitive() -> None:
    assert extract_raw_mcp_api_key(http_headers={"authorization": "bearer abc.def"}, request_meta=None) == "abc.def"


def test_extract_meta_authorization_and_raw_keys() -> None:
    assert extract_raw_mcp_api_key(http_headers={}, request_meta={"authorization": "Bearer meta-token"}) == "meta-token"
    assert extract_raw_mcp_api_key(http_headers={}, request_meta={"objectified_api_key": " raw "}) == "raw"
    assert extract_raw_mcp_api_key(http_headers={}, request_meta={"api_key": "plain"}) == "plain"


def test_meta_as_dict_merges_nested_meta() -> None:
    d = meta_as_dict({"_meta": {"api_key": "nested"}, "other": 1})
    assert d["api_key"] == "nested"
    assert d["other"] == 1


def _pool_mock(rows: list[dict]) -> MagicMock:
    cur = AsyncMock()
    cur.fetchall = AsyncMock(return_value=rows)
    cur.execute = AsyncMock()
    conn = MagicMock()
    cm_cur = AsyncMock()
    cm_cur.__aenter__ = AsyncMock(return_value=cur)
    cm_cur.__aexit__ = AsyncMock(return_value=None)
    conn.cursor = MagicMock(return_value=cm_cur)
    cm_conn = AsyncMock()
    cm_conn.__aenter__ = AsyncMock(return_value=conn)
    cm_conn.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock(spec=AsyncConnectionPool)
    pool.connection = MagicMock(return_value=cm_conn)
    return pool


def test_validate_success_returns_scope() -> None:
    kid = str(uuid.uuid4())
    tid = str(uuid.uuid4())
    stored_hash = hash_mcp_api_key_secret(_SECRET).decode("ascii")
    row = {
        "id": kid,
        "tenant_id": tid,
        "label": "unit",
        "scope_json": {"tenant": True},
        "key_hash": stored_hash,
        "expires_at": None,
        "revoked_at": None,
    }
    pool = _pool_mock([row])

    async def run() -> None:
        auth = await validate_mcp_api_key(pool, _SECRET)
        assert auth == McpAuthContext(key_id=kid, tenant_id=tid, label="unit", scope={"tenant": True})

    asyncio.run(run())


def test_validate_revoked() -> None:
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": str(uuid.uuid4()),
        "label": "x",
        "scope_json": {},
        "key_hash": hash_mcp_api_key_secret(_SECRET).decode("ascii"),
        "expires_at": None,
        "revoked_at": datetime.now(timezone.utc),
    }
    pool = _pool_mock([row])

    async def run() -> None:
        with pytest.raises(AuthorizationError, match="revoked"):
            await validate_mcp_api_key(pool, _SECRET)

    asyncio.run(run())


def test_validate_expired() -> None:
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": str(uuid.uuid4()),
        "label": "x",
        "scope_json": {},
        "key_hash": hash_mcp_api_key_secret(_SECRET).decode("ascii"),
        "expires_at": datetime.now(timezone.utc) - timedelta(days=1),
        "revoked_at": None,
    }
    pool = _pool_mock([row])

    async def run() -> None:
        with pytest.raises(AuthorizationError, match="expired"):
            await validate_mcp_api_key(pool, _SECRET)

    asyncio.run(run())


def test_validate_wrong_secret() -> None:
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": str(uuid.uuid4()),
        "label": "x",
        "scope_json": {},
        "key_hash": hash_mcp_api_key_secret(_SECRET).decode("ascii"),
        "expires_at": None,
        "revoked_at": None,
    }
    pool = _pool_mock([row])

    async def run() -> None:
        with pytest.raises(AuthorizationError, match="Invalid or unknown"):
            await validate_mcp_api_key(pool, _SECRET + "x")

    asyncio.run(run())


def test_require_mcp_auth_missing_credential() -> None:
    ctx = MagicMock(spec=Context)
    ctx.request_context = None

    async def run() -> None:
        with pytest.raises(AuthorizationError, match="MCP authentication required"):
            await require_mcp_auth(ctx, {})

    asyncio.run(run())


def test_require_mcp_auth_happy_path() -> None:
    kid = str(uuid.uuid4())
    tid = str(uuid.uuid4())
    stored_hash = hash_mcp_api_key_secret(_SECRET).decode("ascii")
    row = {
        "id": kid,
        "tenant_id": tid,
        "label": "live",
        "scope_json": {},
        "key_hash": stored_hash,
        "expires_at": None,
        "revoked_at": None,
    }
    pool = _pool_mock([row])
    ctx = MagicMock(spec=Context)
    ctx.request_context = None
    ctx.lifespan_context = {MCP_DB_POOL_KEY: pool}

    async def run() -> None:
        auth = await require_mcp_auth(ctx, {"authorization": f"Bearer {_SECRET}"})
        assert auth.key_id == kid

    asyncio.run(run())
