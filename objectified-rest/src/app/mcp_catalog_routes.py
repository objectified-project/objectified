"""
MCP Catalog — endpoint registration & management (V2-MCP-17.1 / MCAT-3.1, #3663).

Tenants register external MCP servers under a friendly catalog name. This module
exposes tenant-scoped CRUD over ``odb.mcp_endpoints``:

- ``POST   /v1/mcp/{tenant_slug}/endpoints``           — register an endpoint
- ``GET    /v1/mcp/{tenant_slug}/endpoints``           — list a tenant's endpoints
- ``GET    /v1/mcp/{tenant_slug}/endpoints/{id}``      — fetch one endpoint
- ``PATCH  /v1/mcp/{tenant_slug}/endpoints/{id}``      — patch mutable fields

Tenant scoping comes from the existing :func:`validate_authentication` dependency
(JWT Bearer or ``X-API-Key``): the caller's ``tenant_id`` — never the URL slug —
is what scopes every DB query, so a cross-tenant id reads as ``404``. The catalog
slug is derived from the endpoint name and made unique within the tenant.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from psycopg2 import errors as pg_errors

from .auth import get_authenticated_user_id, validate_authentication
from .database import db
from .models import (
    McpEndpointCreate,
    McpEndpointListResponse,
    McpEndpointResponse,
    McpEndpointUpdate,
    mcp_endpoint_out_from_row,
)

_logger = logging.getLogger(__name__)

mcp_endpoints_router = APIRouter(prefix="/v1/mcp", tags=["mcp-catalog"])


def _slugify(name: str) -> str:
    """Derive a URL-safe catalog slug from an endpoint name.

    Lowercases, collapses runs of non-alphanumerics to single hyphens, and trims
    leading/trailing hyphens. Falls back to ``"endpoint"`` when the name has no
    slug-able characters (e.g. all punctuation), so a slug is always produced.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "endpoint"


def _require_actor(auth_data: Dict[str, Any]) -> str:
    """Resolve the acting user id for ``creator_id`` (NOT NULL on the table).

    JWT callers carry their own ``user_id``; API-key callers resolve to the key's
    creator (or a tenant fallback). When neither yields a user, the endpoint
    cannot be attributed, so creation is rejected with ``403``.
    """
    actor = get_authenticated_user_id(auth_data)
    if not actor:
        raise HTTPException(
            status_code=403,
            detail="a resolvable user is required to register an MCP endpoint",
        )
    return str(actor)


@mcp_endpoints_router.get(
    "/{tenant_slug}/endpoints",
    response_model=McpEndpointListResponse,
)
async def list_mcp_endpoints(
    tenant_slug: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> McpEndpointListResponse:
    """List every catalog endpoint owned by the caller's tenant (newest first)."""
    _ = tenant_slug  # scoping comes from the token, not the URL slug
    tenant_id = str(auth_data["tenant_id"])
    rows = db.list_mcp_endpoints(tenant_id)
    return McpEndpointListResponse(
        success=True,
        endpoints=[mcp_endpoint_out_from_row(r) for r in rows],
    )


@mcp_endpoints_router.get(
    "/{tenant_slug}/endpoints/{endpoint_id}",
    response_model=McpEndpointResponse,
)
async def get_mcp_endpoint(
    tenant_slug: str,
    endpoint_id: uuid.UUID,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> McpEndpointResponse:
    """Fetch a single catalog endpoint by id; 404 when it is not the tenant's."""
    _ = tenant_slug
    tenant_id = str(auth_data["tenant_id"])
    row = db.get_mcp_endpoint(tenant_id, str(endpoint_id))
    if not row:
        raise HTTPException(status_code=404, detail="MCP endpoint not found")
    return McpEndpointResponse(success=True, endpoint=mcp_endpoint_out_from_row(row))


@mcp_endpoints_router.post(
    "/{tenant_slug}/endpoints",
    response_model=McpEndpointResponse,
    status_code=201,
)
async def create_mcp_endpoint(
    tenant_slug: str,
    body: McpEndpointCreate,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> McpEndpointResponse:
    """Register a new MCP endpoint in the tenant's catalog.

    The slug is taken from ``body.slug`` when supplied, otherwise derived from the
    name; either way it is uniquified within the tenant by the DB layer. Returns
    the created endpoint with ``201``.
    """
    _ = tenant_slug
    tenant_id = str(auth_data["tenant_id"])
    actor_id = _require_actor(auth_data)

    name = body.name.strip()
    base_slug = _slugify(body.slug) if body.slug and body.slug.strip() else _slugify(name)

    description = body.description.strip() if body.description else None
    if description == "":
        description = None
    category = body.category.strip() if body.category else None
    if category == "":
        category = None

    try:
        inserted = db.insert_mcp_endpoint(
            tenant_id=tenant_id,
            creator_id=actor_id,
            name=name,
            base_slug=base_slug,
            endpoint_url=body.endpoint_url.strip(),
            transport=body.transport,
            description=description,
            category=category,
            visibility=body.visibility,
            discovery_cadence_seconds=body.discovery_cadence_seconds,
        )
    except pg_errors.UniqueViolation as exc:
        # Belt-and-braces: the slug resolver already avoids collisions, but a
        # concurrent insert racing on the same base slug could still trip the
        # (tenant_id, slug) unique constraint.
        raise HTTPException(
            status_code=409,
            detail="an MCP endpoint with this slug already exists for this tenant",
        ) from exc

    return McpEndpointResponse(success=True, endpoint=mcp_endpoint_out_from_row(inserted))


@mcp_endpoints_router.patch(
    "/{tenant_slug}/endpoints/{endpoint_id}",
    response_model=McpEndpointResponse,
)
async def update_mcp_endpoint(
    tenant_slug: str,
    endpoint_id: uuid.UUID,
    body: McpEndpointUpdate,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> McpEndpointResponse:
    """Patch mutable fields on a catalog endpoint; 404 when not the tenant's.

    Only the fields present in the request body are applied (the slug is not
    patchable). An empty body is a no-op that returns the current record.
    """
    _ = tenant_slug
    tenant_id = str(auth_data["tenant_id"])
    eid = str(endpoint_id)

    fields: Dict[str, Any] = {}
    if body.name is not None:
        fields["name"] = body.name.strip()
    if body.endpoint_url is not None:
        fields["endpoint_url"] = body.endpoint_url.strip()
    if body.transport is not None:
        fields["transport"] = body.transport
    if body.description is not None:
        stripped = body.description.strip()
        fields["description"] = stripped or None
    if body.category is not None:
        stripped = body.category.strip()
        fields["category"] = stripped or None
    if body.visibility is not None:
        fields["visibility"] = body.visibility
    if body.published is not None:
        fields["published"] = body.published
    if body.enabled is not None:
        fields["enabled"] = body.enabled
    if body.discovery_cadence_seconds is not None:
        fields["discovery_cadence_seconds"] = body.discovery_cadence_seconds

    updated = db.update_mcp_endpoint(tenant_id, eid, fields)
    if not updated:
        raise HTTPException(status_code=404, detail="MCP endpoint not found")
    return McpEndpointResponse(success=True, endpoint=mcp_endpoint_out_from_row(updated))
