from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse
from typing import Dict, Any
import yaml
import json

from .database import db
from .openapi_generator import generate_openapi_spec, generate_class_openapi_spec
from .models import OpenAPIResponse

# Create FastAPI app
app = FastAPI(
    title="Objectified REST API",
    description="REST API for serving OpenAPI specifications from the Objectified database",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    """Connect to database on startup."""
    db.connect()


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection on shutdown."""
    db.close()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Objectified REST API",
        "version": "1.0.0",
        "endpoints": {
            "version_spec": "/v1/{tenant-slug}/{project-slug}/{version-slug}",
            "class_spec": "/v1/{tenant-slug}/{project-slug}/{version-slug}/{class-name}.{format}"
        }
    }


@app.get("/v1/{tenant_slug}/{project_slug}/{version_slug}")
async def get_version_openapi_spec(
    tenant_slug: str,
    project_slug: str,
    version_slug: str
) -> JSONResponse:
    """
    Get the complete OpenAPI specification for all classes in a version.

    Args:
        tenant_slug: The tenant slug
        project_slug: The project slug
        version_slug: The version ID (e.g., "1.0.0")

    Returns:
        OpenAPI 3.1.0 specification in JSON format
    """
    # Get version information
    version = db.get_version_by_slugs(tenant_slug, project_slug, version_slug)

    if not version:
        raise HTTPException(
            status_code=404,
            detail=f"Version not found: {tenant_slug}/{project_slug}/{version_slug}"
        )

    # Check if version is published
    if not version['published']:
        raise HTTPException(
            status_code=403,
            detail="This version is not published"
        )

    # Check visibility - if private, would need API key validation here
    # For now, we'll allow access but you can add API key check for private versions
    if version['visibility'] == 'private':
        # TODO: Add API key validation here
        pass

    # Get all classes for this version
    classes = db.get_classes_for_version(version['id'])

    # Get properties for each class
    all_properties = {}
    for class_data in classes:
        class_id = class_data['id']
        properties = db.get_properties_for_class(class_id)
        all_properties[class_id] = properties

    # Generate OpenAPI specification
    openapi_spec = generate_openapi_spec(
        tenant_slug,
        project_slug,
        version_slug,
        classes,
        all_properties
    )

    return JSONResponse(content=openapi_spec)


@app.get("/v1/{tenant_slug}/{project_slug}/{version_slug}/{class_name}.json")
async def get_class_openapi_json(
    tenant_slug: str,
    project_slug: str,
    version_slug: str,
    class_name: str
) -> JSONResponse:
    """
    Get the OpenAPI specification for a single class in JSON format.

    Args:
        tenant_slug: The tenant slug
        project_slug: The project slug
        version_slug: The version ID (e.g., "1.0.0")
        class_name: The name of the class

    Returns:
        OpenAPI 3.1.0 specification for the class in JSON format
    """
    # Get version information
    version = db.get_version_by_slugs(tenant_slug, project_slug, version_slug)

    if not version:
        raise HTTPException(
            status_code=404,
            detail=f"Version not found: {tenant_slug}/{project_slug}/{version_slug}"
        )

    # Check if version is published
    if not version['published']:
        raise HTTPException(
            status_code=403,
            detail="This version is not published"
        )

    # Check visibility
    if version['visibility'] == 'private':
        # TODO: Add API key validation here
        pass

    # Get the specific class
    class_data = db.get_class_by_name(version['id'], class_name)

    if not class_data:
        raise HTTPException(
            status_code=404,
            detail=f"Class not found: {class_name}"
        )

    # Get properties for the class
    properties = db.get_properties_for_class(class_data['id'])

    # Generate OpenAPI specification for this class
    openapi_spec = generate_class_openapi_spec(
        tenant_slug,
        project_slug,
        version_slug,
        class_data,
        properties
    )

    return JSONResponse(content=openapi_spec)


@app.get("/v1/{tenant_slug}/{project_slug}/{version_slug}/{class_name}.yaml")
async def get_class_openapi_yaml(
    tenant_slug: str,
    project_slug: str,
    version_slug: str,
    class_name: str
) -> Response:
    """
    Get the OpenAPI specification for a single class in YAML format.

    Args:
        tenant_slug: The tenant slug
        project_slug: The project slug
        version_slug: The version ID (e.g., "1.0.0")
        class_name: The name of the class

    Returns:
        OpenAPI 3.1.0 specification for the class in YAML format
    """
    # Get version information
    version = db.get_version_by_slugs(tenant_slug, project_slug, version_slug)

    if not version:
        raise HTTPException(
            status_code=404,
            detail=f"Version not found: {tenant_slug}/{project_slug}/{version_slug}"
        )

    # Check if version is published
    if not version['published']:
        raise HTTPException(
            status_code=403,
            detail="This version is not published"
        )

    # Check visibility
    if version['visibility'] == 'private':
        # TODO: Add API key validation here
        pass

    # Get the specific class
    class_data = db.get_class_by_name(version['id'], class_name)

    if not class_data:
        raise HTTPException(
            status_code=404,
            detail=f"Class not found: {class_name}"
        )

    # Get properties for the class
    properties = db.get_properties_for_class(class_data['id'])

    # Generate OpenAPI specification for this class
    openapi_spec = generate_class_openapi_spec(
        tenant_slug,
        project_slug,
        version_slug,
        class_data,
        properties
    )

    # Convert to YAML
    yaml_content = yaml.dump(openapi_spec, sort_keys=False, default_flow_style=False)

    return Response(
        content=yaml_content,
        media_type="application/x-yaml",
        headers={
            "Content-Disposition": f'attachment; filename="{class_name}.yaml"'
        }
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Try to connect to database
        db.connect()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

