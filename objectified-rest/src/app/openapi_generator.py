import json
from typing import Dict, Any, List, Optional
from .models import ClassSchema, PropertySchema


def parse_json_field(field: Any) -> Any:
    """Parse a JSON field that might be a string or dict."""
    if field is None:
        return None
    if isinstance(field, str):
        try:
            return json.loads(field)
        except json.JSONDecodeError:
            return field
    return field


def build_class_openapi_schema(class_data: Dict[str, Any], properties: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build an OpenAPI schema for a single class."""
    class_name = class_data['name']
    class_schema = parse_json_field(class_data.get('schema'))

    # Start with basic schema structure
    schema = {
        "type": "object",
        "title": class_name,
        "properties": {},
        "required": []
    }

    # Add description if available
    if class_data.get('description'):
        schema['description'] = class_data['description']

    # If the class has a schema with composition (allOf, anyOf, oneOf), include it
    if class_schema:
        if 'allOf' in class_schema:
            schema['allOf'] = class_schema['allOf']
        if 'anyOf' in class_schema:
            schema['anyOf'] = class_schema['anyOf']
        if 'oneOf' in class_schema:
            schema['oneOf'] = class_schema['oneOf']

    # Add properties from class_properties
    for prop in properties:
        prop_name = prop['name']
        prop_data = parse_json_field(prop.get('data'))

        if prop_data:
            schema['properties'][prop_name] = prop_data

            # Check if property is required
            if prop_data.get('required'):
                schema['required'].append(prop_name)

    # Remove required array if empty
    if not schema['required']:
        del schema['required']

    return schema


def generate_openapi_spec(
    tenant_slug: str,
    project_slug: str,
    version_id: str,
    classes: List[Dict[str, Any]],
    all_properties: Dict[str, List[Dict[str, Any]]]
) -> Dict[str, Any]:
    """Generate a complete OpenAPI 3.1.0 specification for all classes in a version."""

    # Build components/schemas for all classes
    schemas = {}
    for class_data in classes:
        class_id = class_data['id']
        class_name = class_data['name']
        properties = all_properties.get(class_id, [])

        schemas[class_name] = build_class_openapi_schema(class_data, properties)

    # Build the OpenAPI specification
    openapi_spec = {
        "openapi": "3.1.0",
        "info": {
            "title": f"{project_slug} API",
            "version": version_id,
            "description": f"OpenAPI specification for {tenant_slug}/{project_slug}/{version_id}"
        },
        "paths": {},
        "components": {
            "schemas": schemas
        }
    }

    return openapi_spec


def generate_class_openapi_spec(
    tenant_slug: str,
    project_slug: str,
    version_id: str,
    class_data: Dict[str, Any],
    properties: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generate an OpenAPI specification for a single class."""
    class_name = class_data['name']

    schema = build_class_openapi_schema(class_data, properties)

    openapi_spec = {
        "openapi": "3.1.0",
        "info": {
            "title": f"{class_name}",
            "version": version_id,
            "description": f"OpenAPI specification for {tenant_slug}/{project_slug}/{version_id}/{class_name}"
        },
        "paths": {},
        "components": {
            "schemas": {
                class_name: schema
            }
        }
    }

    return openapi_spec

