"""Tests for MCP API key :class:`objectified_mcp.scope.Scope` (#3001)."""

from __future__ import annotations

import uuid

from objectified_mcp.scope import Scope, parse_scope_json


def test_allows_public_empty_lists() -> None:
    s = Scope()
    t, p = str(uuid.uuid4()), str(uuid.uuid4())
    assert s.allows(t, p)
    assert s.allows(t, None)


def test_allows_tenant_restriction() -> None:
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    s = Scope(tenants=[a])
    assert s.allows(a, None)
    assert s.allows(a, str(uuid.uuid4()))
    assert not s.allows(b, None)


def test_allows_project_restriction() -> None:
    tid = str(uuid.uuid4())
    p1, p2 = str(uuid.uuid4()), str(uuid.uuid4())
    s = Scope(projects=[p1])
    assert s.allows(tid, p1)
    assert not s.allows(tid, p2)
    assert not s.allows(tid, None)


def test_allows_tenant_and_project() -> None:
    tid_ok, tid_bad = str(uuid.uuid4()), str(uuid.uuid4())
    pid_ok, pid_bad = str(uuid.uuid4()), str(uuid.uuid4())
    s = Scope(tenants=[tid_ok], projects=[pid_ok])
    assert s.allows(tid_ok, pid_ok)
    assert not s.allows(tid_bad, pid_ok)
    assert not s.allows(tid_ok, pid_bad)


def test_parse_scope_json_none_and_empty_dict() -> None:
    assert parse_scope_json(None) == Scope()
    assert parse_scope_json({}) == Scope()


def test_parse_scope_json_round_trip_lists() -> None:
    t, p = str(uuid.uuid4()), str(uuid.uuid4())
    raw = {"tenants": [t], "projects": [p]}
    s = parse_scope_json(raw)
    assert s == Scope(tenants=[t], projects=[p])
    assert s.to_json_dict() == raw


def test_parse_scope_json_ignores_unknown_keys_and_legacy_shape() -> None:
    assert parse_scope_json({"tenant": True}) == Scope()
    assert parse_scope_json({"tenants": ["x"], "extra": 1}) == Scope(tenants=["x"])


def test_parse_scope_json_coerces_non_lists_and_non_strings() -> None:
    assert parse_scope_json({"tenants": "bad"}) == Scope()
    assert parse_scope_json({"tenants": [1, "keep", None]}) == Scope(tenants=["keep"])


def test_parse_scope_json_non_dict() -> None:
    assert parse_scope_json([1, 2]) == Scope()


def test_parse_scope_json_scope_instance() -> None:
    s = Scope(tenants=["a"])
    assert parse_scope_json(s) is s
