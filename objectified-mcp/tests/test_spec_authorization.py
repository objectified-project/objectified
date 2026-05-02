"""Tests for MCP spec authorization: scope ∩ visibility (#3010)."""

from __future__ import annotations

import pytest

from objectified_mcp.mcp_auth import McpAuthContext
from objectified_mcp.scope import Scope
from objectified_mcp.spec_authorization import (
    authorize_spec,
    build_authorized_spec_sql_predicate,
)


def _ctx(
    *,
    key_tenant: str = "tenant-key",
    scope: Scope | None = None,
) -> McpAuthContext:
    return McpAuthContext(
        key_id="00000000-0000-4000-8000-000000000001",
        tenant_id=key_tenant,
        label="test",
        scope=scope if scope is not None else Scope(),
    )


def _row(*, tenant: str, project: str, visibility: str) -> dict[str, str]:
    return {"tenant_id": tenant, "project_id": project, "visibility": visibility}


@pytest.mark.parametrize(
    ("visibility", "spec_tenant", "spec_project", "scope", "key_tenant", "expected"),
    [
        # public × in-scope (unrestricted scope)
        ("public", "t-a", "p-1", Scope(), "tenant-key", True),
        # public × out-of-scope (tenant allow-list excludes spec tenant)
        ("public", "t-a", "p-1", Scope(tenants=("t-b",)), "tenant-key", False),
        # public × out-of-scope (project allow-list excludes spec project)
        ("public", "t-a", "p-1", Scope(projects=("p-2",)), "tenant-key", False),
        # private × in-scope × same tenant as key
        ("private", "tenant-key", "p-1", Scope(), "tenant-key", True),
        # private × in-scope × different tenant than key (no cross-tenant private)
        ("private", "t-other", "p-1", Scope(), "tenant-key", False),
        # private × out-of-scope (wrong tenant in scope lists)
        ("private", "tenant-key", "p-1", Scope(tenants=("t-b",)), "tenant-key", False),
    ],
)
def test_authorize_spec_public_private_times_scope_matrix(
    visibility: str,
    spec_tenant: str,
    spec_project: str,
    scope: Scope,
    key_tenant: str,
    expected: bool,
) -> None:
    auth = _ctx(key_tenant=key_tenant, scope=scope)
    row = _row(tenant=spec_tenant, project=spec_project, visibility=visibility)
    assert authorize_spec(auth, row) is expected


def test_authorize_spec_deny_all_scope_always_false() -> None:
    auth = _ctx(scope=Scope(deny_all=True))
    assert authorize_spec(auth, _row(tenant="t-a", project="p-1", visibility="public")) is False


def test_authorize_spec_unknown_visibility_denied() -> None:
    auth = _ctx()
    assert authorize_spec(auth, {"tenant_id": "t-a", "project_id": "p-1", "visibility": "internal"}) is False


def test_build_sql_deny_all() -> None:
    auth = _ctx(scope=Scope(deny_all=True))
    sql, params = build_authorized_spec_sql_predicate(
        auth,
        tenant_column="v.tenant_id",
        project_column="v.project_id",
        visibility_column="v.visibility",
    )
    assert sql == "FALSE"
    assert params == []


def test_build_sql_unrestricted_scope_includes_visibility_guard_params() -> None:
    auth = _ctx(key_tenant="kt-1")
    sql, params = build_authorized_spec_sql_predicate(
        auth,
        tenant_column="v.tenant_id",
        project_column="v.project_id",
        visibility_column="v.visibility",
    )
    assert sql.startswith("(TRUE) AND ")
    assert "v.visibility::text = 'public'" in sql
    assert "private" in sql
    assert params == ["kt-1"]


def test_build_sql_tenant_and_project_allowlists_order_params() -> None:
    auth = _ctx(
        key_tenant="kt-9",
        scope=Scope(tenants=("t-a", "t-b"), projects=("p-1",)),
    )
    sql, params = build_authorized_spec_sql_predicate(
        auth,
        tenant_column="s.tenant_id",
        project_column="s.project_id",
        visibility_column="s.visibility",
    )
    assert "s.tenant_id::text = ANY(%s)" in sql
    assert "s.project_id::text = ANY(%s)" in sql
    assert params == [["t-a", "t-b"], ["p-1"], "kt-9"]


def test_build_sql_rejects_bad_identifiers() -> None:
    auth = _ctx()
    with pytest.raises(ValueError, match="tenant_column"):
        build_authorized_spec_sql_predicate(
            auth,
            tenant_column="v.tenant_id; DROP",
            project_column="v.project_id",
            visibility_column="v.visibility",
        )
