"""
Primitives API Routes

Provides CRUD endpoints for managing primitive type definitions.
All endpoints are tenant-scoped and require authentication via JWT token or API key.
"""

from fastapi import APIRouter, HTTPException, Header, Query, Depends
from typing import Optional, List, Dict, Any
import json

from .database import db
from .models import (
    PrimitiveSchema,
    PrimitiveCreateRequest,
    PrimitiveUpdateRequest,
    PrimitiveImportRequest
)
from .auth import validate_authentication, get_authenticated_user_id

router = APIRouter(prefix="/v1/primitives", tags=["primitives"])


@router.get("/{tenant_slug}")
async def list_primitives(
    tenant_slug: str,
    category: Optional[str] = Query(None, description="Filter by category"),
    auth_data: Dict[str, Any] = Depends(validate_authentication)
) -> List[PrimitiveSchema]:
    """
    List all primitives for a tenant.

    Supports authentication via:
    - JWT token in Authorization header (Bearer token)
    - API key in X-API-Key header

    Args:
        tenant_slug: The tenant slug
        category: Optional category filter
        auth_data: Authentication data (injected by dependency)

    Returns:
        List of primitives for the tenant
    """
    # Get primitives
    primitives = db.get_primitives_for_tenant(auth_data['tenant_id'], category)

    return [PrimitiveSchema(**p) for p in primitives]


@router.get("/{tenant_slug}/{primitive_id}")
async def get_primitive(
    tenant_slug: str,
    primitive_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication)
) -> PrimitiveSchema:
    """
    Get a specific primitive by ID.

    Supports authentication via JWT token or API key.

    Args:
        tenant_slug: The tenant slug
        primitive_id: The primitive ID
        auth_data: Authentication data (injected by dependency)

    Returns:
        The primitive details
    """
    # Get primitive
    primitive = db.get_primitive_by_id(primitive_id, auth_data['tenant_id'])

    if not primitive:
        raise HTTPException(
            status_code=404,
            detail=f"Primitive not found: {primitive_id}"
        )

    return PrimitiveSchema(**primitive)


@router.post("/{tenant_slug}")
async def create_primitive(
    tenant_slug: str,
    request: PrimitiveCreateRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication)
) -> PrimitiveSchema:
    """
    Create a new primitive.

    Supports authentication via JWT token or API key.
    When using JWT, the created_by field will be set to the authenticated user.

    Args:
        tenant_slug: The tenant slug
        request: Primitive creation data
        auth_data: Authentication data (injected by dependency)

    Returns:
        The created primitive
    """
    try:
        # Get user_id from auth data (will be None for API key auth)
        created_by = get_authenticated_user_id(auth_data)

        # Create primitive
        primitive = db.create_primitive(
            tenant_id=auth_data['tenant_id'],
            name=request.name,
            category=request.category,
            schema=request.schema,
            description=request.description,
            tags=request.tags,
            created_by=created_by
        )

        return PrimitiveSchema(**primitive)
    except Exception as e:
        # Check for unique constraint violation
        if "unique constraint" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail=f"A primitive with name '{request.name}' already exists in category '{request.category}'"
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{tenant_slug}/{primitive_id}")
async def update_primitive(
    tenant_slug: str,
    primitive_id: str,
    request: PrimitiveUpdateRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication)
) -> PrimitiveSchema:
    """
    Update an existing primitive.

    Supports authentication via JWT token or API key.

    Args:
        tenant_slug: The tenant slug
        primitive_id: The primitive ID
        request: Primitive update data
        auth_data: Authentication data (injected by dependency)

    Returns:
        The updated primitive
    """
    # Check if primitive exists
    existing = db.get_primitive_by_id(primitive_id, auth_data['tenant_id'])
    if not existing:
        raise HTTPException(
            status_code=404,
            detail=f"Primitive not found: {primitive_id}"
        )

    # Prevent updating system primitives
    if existing.get('is_system'):
        raise HTTPException(
            status_code=403,
            detail="Cannot update system primitives"
        )

    try:
        # Build updates dict from request
        updates = {}
        if request.name is not None:
            updates['name'] = request.name
        if request.description is not None:
            updates['description'] = request.description
        if request.category is not None:
            updates['category'] = request.category
        if request.schema is not None:
            updates['schema'] = request.schema
        if request.tags is not None:
            updates['tags'] = request.tags
        if request.enabled is not None:
            updates['enabled'] = request.enabled

        # Update primitive
        primitive = db.update_primitive(
            primitive_id,
            auth_data['tenant_id'],
            updates
        )

        if not primitive:
            raise HTTPException(
                status_code=404,
                detail=f"Primitive not found: {primitive_id}"
            )

        return PrimitiveSchema(**primitive)
    except Exception as e:
        # Check for unique constraint violation
        if "unique constraint" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail=f"A primitive with that name already exists in the category"
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tenant_slug}/{primitive_id}")
async def delete_primitive(
    tenant_slug: str,
    primitive_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication)
) -> Dict[str, str]:
    """
    Delete a primitive (soft delete).

    Supports authentication via JWT token or API key.

    Args:
        tenant_slug: The tenant slug
        primitive_id: The primitive ID
        auth_data: Authentication data (injected by dependency)

    Returns:
        Success message
    """
    # Check if primitive exists
    existing = db.get_primitive_by_id(primitive_id, auth_data['tenant_id'])
    if not existing:
        raise HTTPException(
            status_code=404,
            detail=f"Primitive not found: {primitive_id}"
        )

    # Prevent deleting system primitives
    if existing.get('is_system'):
        raise HTTPException(
            status_code=403,
            detail="Cannot delete system primitives"
        )

    # Delete primitive
    success = db.delete_primitive(primitive_id, auth_data['tenant_id'])

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to delete primitive"
        )

    return {"message": "Primitive deleted successfully"}


@router.post("/{tenant_slug}/import")
async def import_primitives(
    tenant_slug: str,
    request: PrimitiveImportRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication)
) -> Dict[str, Any]:
    """
    Import primitives from a JSON Schema document.

    Extracts type definitions from JSON Schema's $defs or definitions
    and creates primitives from them.

    Supports authentication via JWT token or API key.
    When using JWT, the created_by field will be set to the authenticated user.

    Args:
        tenant_slug: The tenant slug
        request: Import request with JSON Schema document
        auth_data: Authentication data (injected by dependency)

    Returns:
        Summary of imported primitives
    """
    # Extract definitions from schema
    definitions = {}

    # Check for $defs (JSON Schema 2020-12)
    if '$defs' in request.schema:
        definitions.update(request.schema['$defs'])

    # Check for definitions (older JSON Schema versions)
    if 'definitions' in request.schema:
        definitions.update(request.schema['definitions'])

    if not definitions:
        raise HTTPException(
            status_code=400,
            detail="No definitions found in JSON Schema. Schema must contain $defs or definitions."
        )

    # Filter definitions if specific ones are requested
    if not request.import_all and request.selected_definitions:
        definitions = {
            k: v for k, v in definitions.items()
            if k in request.selected_definitions
        }

    if not definitions:
        raise HTTPException(
            status_code=400,
            detail="No matching definitions found to import"
        )

    # Get user_id from auth data (will be None for API key auth)
    created_by = get_authenticated_user_id(auth_data)

    # Import each definition as a primitive
    imported = []
    skipped = []
    errors = []

    for def_name, def_schema in definitions.items():
        try:
            # Determine category from schema type
            schema_type = def_schema.get('type', 'object')
            if isinstance(schema_type, list):
                schema_type = schema_type[0] if schema_type else 'object'

            # Create primitive
            primitive = db.create_primitive(
                tenant_id=auth_data['tenant_id'],
                name=def_name,
                category=schema_type,
                schema=def_schema,
                description=def_schema.get('description'),
                tags=def_schema.get('tags', []),
                created_by=created_by
            )
            imported.append(primitive['name'])
        except Exception as e:
            if "unique constraint" in str(e).lower():
                skipped.append(def_name)
            else:
                errors.append({"name": def_name, "error": str(e)})

    return {
        "message": f"Import completed",
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "total_imported": len(imported),
        "total_skipped": len(skipped),
        "total_errors": len(errors)
    }
