"""MCP API key read scope stored in ``odb.mcp_api_keys.scope_json`` (#3001).

Persisted JSON shape::

    {"tenants": ["<tenant_uuid>", ...], "projects": ["<project_uuid>", ...]}

Each list holds string identifiers (typically UUIDs as stored by the platform).

**Semantics**

- **Public** — both lists empty: :meth:`Scope.allows` permits any tenant/project
  pair passed in (subject to other product rules such as row visibility).
- **Tenant-limited** — ``tenants`` non-empty: the resource tenant id must be a
  member of ``tenants``.
- **Project-limited** — ``projects`` non-empty: the resource project id must be
  provided and be a member of ``projects``.

Unknown JSON keys are ignored. Missing ``tenants`` / ``projects`` keys behave
like empty lists. Non-dict ``scope_json`` values yield an empty scope.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def _coerce_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str):
            out.append(item)
    return out


@dataclass(frozen=True)
class Scope:
    """Declared read scope for an MCP API key (mirrors ``scope_json``)."""

    tenants: list[str] = field(default_factory=list)
    projects: list[str] = field(default_factory=list)

    def allows(self, tenant: str, project: str | None = None) -> bool:
        """Return True if reading *tenant* / *project* is allowed by this scope."""
        if self.tenants and tenant not in self.tenants:
            return False
        if self.projects:
            if project is None or project not in self.projects:
                return False
        return True

    def to_json_dict(self) -> dict[str, list[str]]:
        """Serialize for JSONB (stable keys for issuance and migrations)."""
        return {"tenants": list(self.tenants), "projects": list(self.projects)}


def parse_scope_json(raw: Any) -> Scope:
    """Build a :class:`Scope` from ``scope_json`` (database value or plain dict)."""
    if raw is None:
        return Scope()
    if isinstance(raw, Scope):
        return raw
    if not isinstance(raw, dict):
        return Scope()
    return Scope(
        tenants=_coerce_str_list(raw.get("tenants")),
        projects=_coerce_str_list(raw.get("projects")),
    )
