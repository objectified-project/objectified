"""
Public browse directory endpoints (no authentication).

Mirrors the data surfaced by ``objectified-browse`` ``getPublicTenants`` and
``getDirectoryStats`` for CLI and API consumers.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, Query

from .auth import resolve_optional_tenant_member_auth
from .database import db
from .models import (
    BrowseDirectoryStats,
    BrowsePublicProjectRow,
    BrowsePublicProjectsResponse,
    BrowsePublicTenantRow,
    BrowsePublicTenantsResponse,
)

router = APIRouter(prefix="/v1/browse", tags=["browse"])


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
