import json
from typing import Dict, Any, List, Optional, DefaultDict
from collections import defaultdict


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


def _build_children_index(properties: List[Dict[str, Any]]) -> DefaultDict[Optional[str], List[Dict[str, Any]]]:
    """Index properties by parent_id for quick child lookup."""
    index: DefaultDict[Optional[str], List[Dict[str, Any]]] = defaultdict(list)
    for p in properties:
        index[p.get('parent_id')].append(p)
    return index


def _clean_description(data: Dict[str, Any]) -> None:
    """Normalize description if it's null; optionally copy from title."""
    if 'description' in data and data['description'] is None:
        # Remove null descriptions to keep output clean
        data.pop('description', None)
        # If title exists, optionally set it as description for readability
        if 'title' in data and data['title']:
            data['description'] = data['title']


def _build_property_schema(prop: Dict[str, Any], children_index: DefaultDict[Optional[str], List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Recursively build property schema including inline/nested children."""
    prop_data_raw = prop.get('data')
    prop_data = parse_json_field(prop_data_raw) or {}

    # Work on a shallow copy to avoid mutating input
    prop_schema: Dict[str, Any] = dict(prop_data)

    _clean_description(prop_schema)

    # Inline object children if this is an object without $ref
    if prop_schema.get('type') == 'object' and '$ref' not in prop_schema:
        children = children_index.get(prop.get('id'), [])
        if children:
            nested_props: Dict[str, Any] = {}
            nested_required: List[str] = []
            for child in children:
                child_schema = _build_property_schema(child, children_index)
                # Move required flag to parent's required array
                if child_schema.get('required') is True:
                    nested_required.append(child['name'])
                    child_schema.pop('required', None)
                elif child_schema.get('required') is False:
                    child_schema.pop('required', None)
                nested_props[child['name']] = child_schema
            if nested_props:
                prop_schema['properties'] = nested_props
            if nested_required:
                prop_schema['required'] = nested_required
            elif 'required' in prop_schema and not prop_schema['required']:
                # Drop empty required to keep output tidy
                prop_schema.pop('required', None)

    # Arrays: if items is object (or missing) and there are children, inline under items
    if prop_schema.get('type') == 'array':
        children = children_index.get(prop.get('id'), [])
        # If children exist but items missing, infer items as object
        if children and 'items' not in prop_schema:
            prop_schema['items'] = { 'type': 'object' }
        items = prop_schema.get('items')
        # Only inline if items is not a $ref and is (or will be) an object
        if isinstance(items, dict) and '$ref' not in items and (items.get('type') == 'object' or children):
            nested_props: Dict[str, Any] = {}
            nested_required: List[str] = []
            for child in children:
                child_schema = _build_property_schema(child, children_index)
                if child_schema.get('required') is True:
                    nested_required.append(child['name'])
                    child_schema.pop('required', None)
                elif child_schema.get('required') is False:
                    child_schema.pop('required', None)
                nested_props[child['name']] = child_schema
            merged_items = dict(items)
            merged_items['type'] = 'object'
            if nested_props:
                merged_items['properties'] = nested_props
            if nested_required:
                merged_items['required'] = nested_required
            else:
                # Ensure no empty required remains
                if 'required' in merged_items and not merged_items['required']:
                    merged_items.pop('required', None)
            prop_schema['items'] = merged_items

    return prop_schema


def build_class_openapi_schema(class_data: Dict[str, Any], properties: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build an OpenAPI schema for a single class with nested/inline properties."""
    class_name = class_data['name']
    class_schema_raw = class_data.get('schema')
    class_schema_parsed = parse_json_field(class_schema_raw) or {}

    # Remove properties/required from stored class schema to avoid overwriting DB-driven props
    schema_without_props: Dict[str, Any] = dict(class_schema_parsed)
    schema_without_props.pop('properties', None)
    schema_without_props.pop('required', None)

    # Base object schema
    schema: Dict[str, Any] = {
        "type": "object",
        "title": class_name,
        **({"description": class_data['description']} if class_data.get('description') else {}),
        **schema_without_props,
        "properties": {},
    }

    # Build children index and process only top-level properties (parent_id is null)
    children_index = _build_children_index(properties)
    top_level_props = children_index.get(None, [])

    required: List[str] = []

    for prop in top_level_props:
        prop_name = prop['name']
        prop_schema = _build_property_schema(prop, children_index)
        # Move property-level required flag to class required
        if prop_schema.get('required') is True:
            required.append(prop_name)
            prop_schema.pop('required', None)
        elif prop_schema.get('required') is False:
            prop_schema.pop('required', None)
        schema['properties'][prop_name] = prop_schema

    # Add required if any
    if required:
        schema['required'] = required

    # Clean up empty properties
    if not schema['properties']:
        schema.pop('properties', None)

    return schema


def generate_openapi_spec(
    tenant_slug: str,
    project_slug: str,
    version_id: str,
    classes: List[Dict[str, Any]],
    all_properties: Dict[str, List[Dict[str, Any]]],
    project_description: Optional[str] = None
) -> Dict[str, Any]:
    """Generate a complete OpenAPI 3.1.0 specification for all classes in a version."""

    # Build components/schemas for all classes
    schemas: Dict[str, Any] = {}
    for class_data in classes:
        class_id = class_data['id']
        class_name = class_data['name']
        properties = all_properties.get(class_id, [])
        schemas[class_name] = build_class_openapi_schema(class_data, properties)

    # Use project description if provided and not empty, otherwise use default
    description = project_description if project_description and project_description.strip() else "No description provided"

    # Build the OpenAPI specification
    openapi_spec = {
        "openapi": "3.1.0",
        "info": {
            "title": f"{project_slug} API",
            "version": version_id,
            "description": description
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
