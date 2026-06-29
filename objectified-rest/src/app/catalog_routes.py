"""
Catalog API Routes (MFI-23.2)

Read endpoints for the *Catalog* — the ``publishable = false`` slice of projects, i.e. the
OpenAPI-worthy non-OpenAPI imports that are deliberately *not* publishable Projects (MFI-23.1).

The list + detail responses deliberately mirror the Projects contract (``projects_routes.py``):
the same envelope (id/name/slug/description/timestamps/creator/qualityScore/qualityGrade) plus the
catalog-only format/source fields (``sourceFormat``, ``protocol``, ``formatMetadata``,
``toolVersions``) and the ``publishable = false`` invariant. Matching the Projects shape is the
whole point — it lets the Catalog screen (MFI-23.3) be cloned from the Projects dashboard.

Catalog items are created by the import routing (MFI-23.7), not through this API, so only read
endpoints exist here. All endpoints are tenant-scoped and require authentication via JWT token or
API key.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, List

from .database import db
from .models import CatalogItemSchema
from .auth import validate_authentication

router = APIRouter(prefix="/v1/catalog", tags=["catalog"])


@router.get("/{tenant_slug}")
async def list_catalog_items(
    tenant_slug: str,
    include_deleted: bool = Query(
        False,
        description="When true, include soft-deleted catalog items (active items listed first).",
    ),
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> List[CatalogItemSchema]:
    """
    List all catalog items for a tenant.

    Returns the same envelope as ``GET /v1/projects/{tenant_slug}`` (so the Catalog screen can be
    cloned from the Projects dashboard) restricted to the non-publishable slice, with each item
    also carrying the latest revision's format/protocol/source provenance.

    Supports authentication via:
    - JWT token in Authorization header (Bearer token)
    - API key in X-API-Key header

    Args:
        tenant_slug: The tenant slug.
        include_deleted: Include rows with deleted_at set (for trash / restore flows).
        auth_data: Authentication data (injected by dependency).

    Returns:
        List of catalog items for the tenant (active first when include_deleted is set).
    """
    items = db.get_catalog_items_for_tenant(
        auth_data['tenant_id'], include_deleted=include_deleted
    )

    return [CatalogItemSchema(**item) for item in items]


@router.get("/{tenant_slug}/{item_id}")
async def get_catalog_item(
    tenant_slug: str,
    item_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> CatalogItemSchema:
    """
    Get a specific catalog item by ID.

    A publishable Project is intentionally *not* returned here: only the non-publishable slice is a
    catalog item, so requesting a Project's id (or an unknown id) yields 404.

    Supports authentication via JWT token or API key.

    Args:
        tenant_slug: The tenant slug.
        item_id: The catalog item ID.
        auth_data: Authentication data (injected by dependency).

    Returns:
        The catalog item details.
    """
    item = db.get_catalog_item_by_id(item_id, auth_data['tenant_id'])

    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Catalog item not found: {item_id}"
        )

    return CatalogItemSchema(**item)
