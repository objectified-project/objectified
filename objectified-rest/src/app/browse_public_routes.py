"""
Public browse directory endpoints (no authentication).

Mirrors the data surfaced by ``objectified-browse`` ``getPublicTenants`` and
``getDirectoryStats`` for CLI and API consumers.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Header, HTTPException, Query

from .auth import resolve_optional_tenant_member_auth
from .browse_change_summary import browse_version_changes_summary
from .database import db
from .models import (
    BrowseDirectoryStats,
    BrowsePublicProjectRow,
    BrowsePublicProjectsResponse,
    BrowsePublicTenantRow,
    BrowsePublicTenantsResponse,
    BrowsePublicVersionRow,
    BrowsePublicVersionsResponse,
)

router = APIRouter(prefix="/v1/browse", tags=["browse"])


_SEMVER_PREFIX_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)")


def _semver_sort_key(version_slug: str) -> tuple:
    """Sort key: semver triple first (descending sort via reverse=True), then opaque strings last."""
    s = (version_slug or "").strip().lstrip("vV")
    m = _SEMVER_PREFIX_RE.match(s)
    if m:
        return (0, int(m.group(1)), int(m.group(2)), int(m.group(3)), s.lower())
    return (1, 0, 0, 0, s.lower())


def _sort_versions_semver_desc(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(rows, key=lambda r: _semver_sort_key(str(r.get("version_id") or "")), reverse=True)


def _browse_project_domain_label(metadata: Any) -> str:
    """Human-facing domain/category cell (matches CLI ``domainDisplay`` semantics)."""
    if not metadata or not isinstance(metadata, dict):
        return "—"
    d_raw = metadata.get("domain")
    if isinstance(d_raw, str):
        d = d_raw.strip()
        if d:
            return d
    c_raw = metadata.get("domainCategory")
    if isinstance(c_raw, str):
        c = c_raw.strip()
        if c and c.lower() != "none":
            return c
    return "—"


@router.get("/tenants", response_model=BrowsePublicTenantsResponse)
async def list_public_browse_tenants(
    search: str | None = Query(
        None,
        description="Case-insensitive substring filter on tenant name and slug.",
    ),
    sort: Literal["latest", "name", "projects"] = Query(
        "name",
        description="Sort order: name (default), projects (desc), or latest activity (desc).",
    ),
) -> BrowsePublicTenantsResponse:
    stats = db.get_public_browse_directory_stats()
    rows = db.list_public_browse_tenants(search=search, sort=sort)
    tenants = [BrowsePublicTenantRow.model_validate(r) for r in rows]
    return BrowsePublicTenantsResponse(
        directory_stats=BrowseDirectoryStats.model_validate(stats),
        tenants=tenants,
        filtered_count=len(tenants),
    )


@router.get("/tenants/{tenant_slug}/projects", response_model=BrowsePublicProjectsResponse)
async def list_public_browse_projects(
    tenant_slug: str,
    search: str | None = Query(
        None,
        description="Case-insensitive substring filter on project slug and name.",
    ),
    domain: str | None = Query(
        None,
        description="Filter by project metadata domain or domainCategory (case-insensitive).",
    ),
    has_published: bool = Query(
        False,
        description="Only include projects with at least one published version (visibility rules apply).",
    ),
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> BrowsePublicProjectsResponse:
    tenant = db.get_tenant_row_by_slug(tenant_slug)
    if tenant is None:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {tenant_slug}")

    is_member = resolve_optional_tenant_member_auth(
        tenant_slug,
        authorization=authorization,
        x_api_key=x_api_key,
    )
    tenant_id = tenant["id"]

    if is_member:
        raw_rows = db.list_member_browse_projects_for_tenant(
            tenant_id,
            search=search,
            domain=domain,
            require_published=has_published,
        )
    else:
        raw_rows = db.list_public_browse_projects_for_tenant(
            tenant_id,
            search=search,
            domain=domain,
            require_published=has_published,
        )

    projects = [
        BrowsePublicProjectRow(
            slug=row["slug"],
            name=row["name"],
            domain=_browse_project_domain_label(row.get("metadata")),
            published_versions=int(row["published_versions"] or 0),
            latest_version=row.get("latest_version"),
            latest_published_at=row.get("latest_published_at"),
        )
        for row in raw_rows
    ]

    return BrowsePublicProjectsResponse(
        tenant_slug=str(tenant["slug"]),
        tenant_name=str(tenant["name"]),
        projects=projects,
        filtered_count=len(projects),
    )


@router.get("/tenants/{tenant_slug}/projects/{project_slug}/versions", response_model=BrowsePublicVersionsResponse)
async def list_public_browse_versions(
    tenant_slug: str,
    project_slug: str,
    since: datetime | None = Query(
        None,
        description="Include only versions whose published_at is at or after this timestamp (ISO 8601).",
    ),
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> BrowsePublicVersionsResponse:
    tenant = db.get_tenant_row_by_slug(tenant_slug)
    if tenant is None:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {tenant_slug}")

    is_member = resolve_optional_tenant_member_auth(
        tenant_slug,
        authorization=authorization,
        x_api_key=x_api_key,
    )
    tenant_id = tenant["id"]

    project = db.get_project_by_slug(project_slug, tenant_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project not found: {project_slug}")

    if not is_member:
        if not db.project_has_public_published_version(tenant_id, project_slug):
            raise HTTPException(status_code=404, detail=f"Project not found: {project_slug}")

    if is_member:
        raw_rows = db.list_member_browse_versions_for_project(tenant_id, project_slug, since=since)
    else:
        raw_rows = db.list_public_browse_versions_for_project(tenant_id, project_slug, since=since)

    rows_sorted = _sort_versions_semver_desc(raw_rows)

    versions_out: List[BrowsePublicVersionRow] = []
    for i, row in enumerate(rows_sorted):
        next_row = rows_sorted[i + 1] if i + 1 < len(rows_sorted) else None
        baseline_slug = str(next_row["version_id"]) if next_row else None

        tags_raw = row.get("tags") or []
        tags_list = [str(t) for t in tags_raw] if isinstance(tags_raw, list) else []

        desc = row.get("description")
        clog = row.get("change_log")
        summary = browse_version_changes_summary(
            change_model_json=row.get("change_model_json"),
            change_log=str(clog) if clog is not None else None,
            description=str(desc) if desc is not None else None,
            baseline_version_slug=baseline_slug,
        )

        versions_out.append(
            BrowsePublicVersionRow(
                id=str(row["id"]),
                version_id=str(row["version_id"]),
                published_at=row.get("published_at"),
                tags=tags_list,
                changes_summary=summary,
                description=str(desc) if desc is not None else None,
                change_log=str(clog) if clog is not None else None,
            )
        )

    return BrowsePublicVersionsResponse(
        tenant_slug=str(tenant["slug"]),
        tenant_name=str(tenant["name"]),
        project_slug=str(project["slug"]),
        project_name=str(project["name"]),
        versions=versions_out,
        filtered_count=len(versions_out),
    )
