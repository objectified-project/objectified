from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastmcp.exceptions import NotFoundError
from psycopg_pool import AsyncConnectionPool

from objectified_mcp.mcp_auth import McpAuthContext
from objectified_mcp.scope import Scope
from objectified_mcp.spec_describe_operation_tool import (
    build_spec_describe_operation_response,
    extract_operation_detail,
    merge_path_and_operation_parameters,
    resolve_openapi_refs,
)


def test_merge_path_and_operation_parameters_operation_wins() -> None:
    path_item = {
        "parameters": [
            {"name": "a", "in": "query", "schema": {"type": "string"}},
            {"name": "shared", "in": "header", "schema": {"type": "string"}},
        ]
    }
    operation = {
        "parameters": [
            {"name": "shared", "in": "header", "schema": {"type": "integer"}},
            {"name": "b", "in": "path", "schema": {"type": "string"}},
        ]
    }
    merged = merge_path_and_operation_parameters(path_item, operation)
    assert [p["name"] for p in merged if isinstance(p, dict)] == ["a", "shared", "b"]
    hdr = next(p for p in merged if isinstance(p, dict) and p.get("name") == "shared")
    assert hdr["schema"]["type"] == "integer"


def test_resolve_openapi_refs_internal_expands() -> None:
    spec: dict[str, object] = {
        "paths": {"/x": {"get": {"responses": {"$ref": "#/components/responses/Ok"}}}},
        "components": {"responses": {"Ok": {"description": "fine"}}},
    }
    out = resolve_openapi_refs(spec, spec["paths"]["/x"]["get"], frozenset())
    assert isinstance(out, dict)
    assert out["responses"] == {"description": "fine"}


def test_resolve_openapi_refs_leaves_external_ref() -> None:
    spec: dict[str, object] = {}
    node = {"$ref": "https://example.com/other.json#/Foo"}
    assert resolve_openapi_refs(spec, node, frozenset()) == node


def test_resolve_openapi_refs_circular() -> None:
    spec: dict[str, object] = {
        "components": {
            "schemas": {
                "A": {"type": "object", "properties": {"b": {"$ref": "#/components/schemas/B"}}},
                "B": {"type": "object", "properties": {"a": {"$ref": "#/components/schemas/A"}}},
            }
        }
    }
    out = resolve_openapi_refs(spec, {"$ref": "#/components/schemas/A"}, frozenset())
    assert isinstance(out, dict)
    assert out["type"] == "object"
    b = out["properties"]["b"]
    assert isinstance(b, dict)
    a_back = b["properties"]["a"]
    assert a_back == {"$ref": "#/components/schemas/A"}


def test_extract_operation_detail_resolves_components() -> None:
    spec: dict[str, object] = {
        "openapi": "3.1.0",
        "security": [{"ApiKeyAuth": []}],
        "paths": {
            "/users": {
                "parameters": [{"$ref": "#/components/parameters/Limit"}],
                "post": {
                    "parameters": [{"name": "id", "in": "path", "schema": {"type": "string"}}],
                    "requestBody": {"$ref": "#/components/requestBodies/UserBody"},
                    "responses": {"200": {"$ref": "#/components/responses/Ok"}},
                    "security": [{"OAuth2": ["write"]}],
                },
            }
        },
        "components": {
            "parameters": {
                "Limit": {"name": "limit", "in": "query", "schema": {"type": "integer"}},
            },
            "requestBodies": {
                "UserBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/User"}}},
                }
            },
            "schemas": {"User": {"type": "object", "properties": {"id": {"type": "string"}}}},
            "responses": {"Ok": {"description": "ok"}},
        },
    }
    detail = extract_operation_detail(spec, "/users", "post")
    assert detail is not None
    params = detail["parameters"]
    assert len(params) == 2
    lim = next(p for p in params if p["name"] == "limit")
    assert lim["in"] == "query"
    assert detail["requestBody"]["required"] is True
    assert detail["requestBody"]["content"]["application/json"]["schema"]["type"] == "object"
    assert detail["responses"] == {"200": {"description": "ok"}}
    assert detail["security"] == [{"OAuth2": ["write"]}]


def test_extract_operation_detail_inherits_security() -> None:
    spec: dict[str, object] = {
        "openapi": "3.1.0",
        "security": [{"ApiKeyAuth": []}],
        "paths": {"/x": {"get": {"responses": {"200": {"description": "ok"}}}}},
    }
    detail = extract_operation_detail(spec, "/x", "get")
    assert detail is not None
    assert detail["security"] == [{"ApiKeyAuth": []}]


def test_extract_operation_detail_path_item_ref() -> None:
    spec: dict[str, object] = {
        "openapi": "3.1.0",
        "paths": {
            "/shared": {"$ref": "#/paths/~1items"},
            "/items": {"get": {"summary": "x"}},
        },
    }
    detail = extract_operation_detail(spec, "/shared", "get")
    assert detail is not None
    assert detail["parameters"] == []
    assert detail["responses"] is None
    assert detail["requestBody"] is None


def test_extract_operation_detail_unknown_path() -> None:
    spec: dict[str, object] = {"openapi": "3.1.0", "paths": {"/a": {"get": {}}}}
    assert extract_operation_detail(spec, "/missing", "get") is None


def test_extract_operation_detail_unknown_method() -> None:
    spec: dict[str, object] = {"openapi": "3.1.0", "paths": {"/a": {"get": {}}}}
    assert extract_operation_detail(spec, "/a", "post") is None


def test_extract_operation_detail_method_case_insensitive() -> None:
    spec: dict[str, object] = {
        "openapi": "3.1.0",
        "paths": {"/a": {"get": {"responses": {"204": {"description": "n"}}}}},
    }
    assert extract_operation_detail(spec, "/a", "GET") is not None


def _openapi_row(*, spec_id: UUID | None = None, visibility: str = "public") -> dict[str, object]:
    sid = spec_id or uuid4()
    return {
        "id": sid,
        "tenant_slug": "acme",
        "project_slug": "payments",
        "version_label": "2.1.0",
        "project_description": "Payments service",
        "metadata": None,
        "spec_visibility": visibility,
    }


def test_build_spec_describe_operation_success() -> None:
    sid = uuid4()
    row = _openapi_row(spec_id=sid)
    sample_spec: dict[str, object] = {
        "openapi": "3.1.0",
        "paths": {"/ping": {"get": {"responses": {"200": {"description": "pong"}}}}},
    }

    pool = MagicMock(spec=AsyncConnectionPool)
    describe_cur = MagicMock()
    describe_cur.execute = AsyncMock()
    describe_cur.fetchone = AsyncMock(return_value=row)
    describe_cm = AsyncMock()
    describe_cm.__aenter__.return_value = describe_cur
    describe_cm.__aexit__.return_value = None
    conn = MagicMock()
    conn.cursor = MagicMock(return_value=describe_cm)
    conn_cm = AsyncMock()
    conn_cm.__aenter__.return_value = conn
    conn_cm.__aexit__.return_value = None
    pool.connection = MagicMock(return_value=conn_cm)

    async def fake_fetch(_conn: object, _revision_id: UUID) -> tuple:
        return ([], {}, [], [], [])

    with (
        patch("objectified_mcp.spec_get_openapi_tool.fetch_openapi_generation_inputs_async", side_effect=fake_fetch),
        patch("objectified_mcp.spec_get_openapi_tool.generate_openapi_spec", return_value=sample_spec),
    ):

        async def run() -> dict[str, object]:
            return await build_spec_describe_operation_response(pool, spec_id=str(sid), path="/ping", method="get")

        out = asyncio.run(run())

    assert out["responses"] == {"200": {"description": "pong"}}


def test_build_spec_describe_operation_unknown_operation() -> None:
    sid = uuid4()
    row = _openapi_row(spec_id=sid)
    sample_spec: dict[str, object] = {"openapi": "3.1.0", "paths": {"/ping": {"get": {}}}}

    pool = MagicMock(spec=AsyncConnectionPool)
    describe_cur = MagicMock()
    describe_cur.execute = AsyncMock()
    describe_cur.fetchone = AsyncMock(return_value=row)
    describe_cm = AsyncMock()
    describe_cm.__aenter__.return_value = describe_cur
    describe_cm.__aexit__.return_value = None
    conn = MagicMock()
    conn.cursor = MagicMock(return_value=describe_cm)
    conn_cm = AsyncMock()
    conn_cm.__aenter__.return_value = conn
    conn_cm.__aexit__.return_value = None
    pool.connection = MagicMock(return_value=conn_cm)

    async def fake_fetch(_conn: object, _revision_id: UUID) -> tuple:
        return ([], {}, [], [], [])

    with (
        patch("objectified_mcp.spec_get_openapi_tool.fetch_openapi_generation_inputs_async", side_effect=fake_fetch),
        patch("objectified_mcp.spec_get_openapi_tool.generate_openapi_spec", return_value=sample_spec),
    ):

        async def run() -> None:
            await build_spec_describe_operation_response(pool, spec_id=str(sid), path="/ping", method="post")

        with pytest.raises(NotFoundError, match="Unknown path or method"):
            asyncio.run(run())


def test_build_spec_describe_operation_private_audited() -> None:
    sid = uuid4()
    row = _openapi_row(spec_id=sid, visibility="private")
    auth = McpAuthContext(
        key_id="00000000-0000-4000-8000-000000000099",
        tenant_id=str(uuid4()),
        label="k",
        scope=Scope(),
    )
    sample_spec: dict[str, object] = {
        "openapi": "3.1.0",
        "paths": {"/x": {"get": {"responses": {"200": {"description": "ok"}}}}},
    }

    pool = MagicMock(spec=AsyncConnectionPool)
    describe_cur = MagicMock()
    describe_cur.execute = AsyncMock()
    describe_cur.fetchone = AsyncMock(return_value=row)
    describe_cm = AsyncMock()
    describe_cm.__aenter__.return_value = describe_cur
    describe_cm.__aexit__.return_value = None
    conn = MagicMock()
    conn.cursor = MagicMock(return_value=describe_cm)
    conn_cm = AsyncMock()
    conn_cm.__aenter__.return_value = conn
    conn_cm.__aexit__.return_value = None
    pool.connection = MagicMock(return_value=conn_cm)

    async def fake_fetch(_conn: object, _revision_id: UUID) -> tuple:
        return ([], {}, [], [], [])

    with (
        patch("objectified_mcp.spec_get_openapi_tool.fetch_openapi_generation_inputs_async", side_effect=fake_fetch),
        patch("objectified_mcp.spec_get_openapi_tool.generate_openapi_spec", return_value=sample_spec),
        patch("objectified_mcp.spec_get_openapi_tool.schedule_mcp_private_access_audit") as audit,
    ):

        async def run() -> None:
            await build_spec_describe_operation_response(pool, spec_id=str(sid), path="/x", method="get", auth_ctx=auth)

        asyncio.run(run())

    audit.assert_called_once()
    assert audit.call_args.kwargs["tool"] == "spec.describe_operation"


def test_spec_describe_operation_tool_registered_on_mcp() -> None:
    from objectified_mcp.server import mcp

    async def load() -> object:
        return await mcp.get_tool("spec.describe_operation")

    tool = asyncio.run(load())
    assert tool is not None
    assert tool.name == "spec.describe_operation"
