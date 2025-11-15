# Lightweight local test for openapi_generator without DB
from app.openapi_generator import build_class_openapi_schema

# Simulate a class with nested properties, including array of inline objects
class_data = {
    'id': 'class-a',
    'name': 'User',
    'description': 'User entity',
    'schema': { 'type': 'object' }
}

# Properties with nesting via parent_id
properties = [
    { 'id': 'p1', 'class_id': 'class-a', 'name': 'id', 'data': { 'type': 'string', 'format': 'uuid', 'required': True } },
    { 'id': 'p2', 'class_id': 'class-a', 'name': 'name', 'data': { 'type': 'string' } },
    { 'id': 'p3', 'class_id': 'class-a', 'name': 'address', 'data': { 'type': 'object' } },
    { 'id': 'p4', 'class_id': 'class-a', 'name': 'street', 'data': { 'type': 'string', 'required': True }, 'parent_id': 'p3' },
    { 'id': 'p5', 'class_id': 'class-a', 'name': 'city', 'data': { 'type': 'string' }, 'parent_id': 'p3' },
    { 'id': 'p6', 'class_id': 'class-a', 'name': 'phones', 'data': { 'type': 'array' } },
    { 'id': 'p7', 'class_id': 'class-a', 'name': 'number', 'data': { 'type': 'string', 'required': True }, 'parent_id': 'p6' },
    { 'id': 'p8', 'class_id': 'class-a', 'name': 'type', 'data': { 'type': 'string' }, 'parent_id': 'p6' },
]

schema = build_class_openapi_schema(class_data, properties)
print(schema)

