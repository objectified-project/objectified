"""
Public browse directory endpoints (no authentication).

Mirrors the data surfaced by ``objectified-browse`` ``getPublicTenants`` and
``getDirectoryStats`` for CLI and API consumers.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query

from .database import db
from .models import BrowseDirectoryStats, BrowsePublicTenantRow, BrowsePublicTenantsResponse

router = APIRouter(prefix="/v1/browse", tags=["browse"])


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
