# Plan: Shared Request Body with Inline Schema and Class Reference Support (FINAL)

This feature enables shared request body definitions at the path level that can be linked to multiple operations (POST, PUT, PATCH). Request bodies support multiple content-types per OpenAPI 3.1.0 spec. Each content-type can use either: (1) a `$ref` to an existing `odb.classes` entry via `class_id`, OR (2) an inline free-form schema stored directly in `inline_schema` JSONB field. When switching from class_id reference to inline schema, the system automatically copies all properties from the referenced class. Inline schemas are NOT stored in `odb.classes` or `odb.class_properties` - they exist only within the request/response body content tables. **OpenAPI export transformation of inline schemas is a critical core feature that converts the inline_schema.properties array to proper nested JSON Schema structures.**

## Steps

### 1. Create shared request body database schema in new migration file
Create `20260117-120000.sql` migration file following sem-tools pattern with tables: `shared_path_request_body` (id, version_path_id, description, required, created_at, updated_at), `path_operation_request_body_link` (id, path_operation_id, shared_path_request_body_id, metadata JSONB, UNIQUE constraint), `shared_path_request_body_content` (id, shared_path_request_body_id, media_type, class_id UUID nullable FK to odb.classes, inline_schema JSONB with structure `{type: 'object', description, properties: [{id, name, data, parent_id}]}`, encoding JSONB for multipart, examples JSONB array, UNIQUE on request_body + media_type, CHECK constraint `(class_id IS NOT NULL OR inline_schema IS NOT NULL)`); add indexes, update triggers, and comments following 20260110-111100.sql pattern; create in /objectified-db/scripts

**Status: ✅ COMPLETED**

### 2. Implement helper-shared-path-request-bodies.ts with class-to-inline conversion
Create `/objectified-ui/lib/db/helper-shared-path-request-bodies.ts` with functions: `getSharedPathRequestBodies(versionPathId)` joins to odb.classes when class_id set; `createSharedPathRequestBody(versionPathId, description?, required?)`; `addRequestBodyContentType(requestBodyId, mediaType, classId?, inlineSchema?, encoding?, examples?)` validates one or the other; `convertClassToInlineSchema(contentId)` fetches class properties from odb.class_properties, transforms to inline_schema.properties array format with parent_id hierarchy, updates content record setting class_id=NULL and inline_schema=converted data; `updateInlineSchemaProperty(contentId, propertyId, updates)` modifies properties within inline_schema JSONB; `addPropertyToInlineSchema(contentId, propertyData, parentId?)` generates UUID and appends to properties array; `deletePropertyFromInlineSchema(contentId, propertyId)` removes property and cascade deletes children; follow helper-shared-path-parameters.ts patterns

**Status: ✅ COMPLETED**

### 3. Create PathRequestBodyNode with class/inline visual distinction
Build canvas component in PathsCanvasView.tsx showing: request body name with required badge, content-type chips with icons (🔗 for class_id reference showing class name, ✏️ for inline_schema showing property count), expandable property tree for inline schemas reading from `inline_schema.properties` array, drag-drop handles for operation linking, delete button with confirmation; enable property drag-drop onto inline schemas calling `addPropertyToInlineSchema`, double-click properties to edit using `ClassPropertyEditDialog` from ClassPropertyEditDialog.tsx; position at x=100-400 canvas zone

**Status: ✅ COMPLETED**

### 4. Extend PathsCanvasView with request body management
Update `loadOperationsAndParameters` function in PathsCanvasView.tsx around line 500 to call `getSharedPathRequestBodies(selectedPathId)` and render nodes, check `class_id` null vs set to display inline property tree or class name, load `getLinkedRequestBodiesForOperation(operationId)` to create edges between request body nodes and operation nodes, implement handlers: `handleRequestBodyPropertyDrop`, `handleRequestBodyPropertyEdit`, `handleRequestBodyPropertyDelete` all updating inline_schema JSONB; add canvas drop zone for "New Request Body" from sidebar

**Status: ✅ COMPLETED**

### 5. Update OperationPropertiesPanel with schema type switching
Modify OperationPropertiesPanel.tsx around line 1019 to replace `SchemaBuilder` with request body UI showing: available shared request bodies with Link buttons, linked request body details with content-type tabs, schema type toggle: "Reference Existing Class" dropdown (sets class_id) OR "Inline Schema" property editor (uses inline_schema), when switching from class reference to inline automatically call `convertClassToInlineSchema(contentId)` to copy properties, inline property list with add/edit/delete using `ClassPropertyEditDialog` and `PropertyFormFields` from ClassPropertyEditDialog.tsx, encoding editor for multipart (contentType, headers, style, explode per property), examples JSONB array editor

**Status: ✅ COMPLETED**

### 6. Implement inline_schema property management and export utilities
Create utility functions in new file `lib/utils/inline-schema-utils.ts`: `buildPropertyTreeFromInlineSchema(inlineSchema)` constructs hierarchy from flat array using parent_id, `addPropertyToInlineSchemaArray(properties, propertyData, parentId?)` generates UUID and inserts, `updatePropertyInInlineSchemaArray(properties, propertyId, updates)` finds and merges, `deletePropertyFromInlineSchemaArray(properties, propertyId, cascadeChildren)` removes property and optionally orphans, `cloneClassPropertiesToInlineSchema(classId)` fetches from odb.class_properties and transforms to inline_schema.properties format; **CRITICAL: `buildSchemaFromInlineProperties(properties)` transforms flat properties array with parent_id relationships into nested OpenAPI 3.1.0 JSON Schema structure with recursive properties/required arrays, handles all JSON Schema types (object, array, primitives), preserves $ref patterns, validates schema structure**; integrate with `PropertyFormFields` for editing

**Status: ✅ COMPLETED**

### 7. Implement OpenAPI export for inline schemas in paths generator
Update OpenAPI path generation in `/objectified-rest/src/app/openapi_generator.py` or create new TypeScript equivalent to handle request/response bodies: when `class_id` is set, generate `$ref` to `#/components/schemas/{ClassName}`, when `class_id` is NULL and `inline_schema` exists, call `buildSchemaFromInlineProperties(inline_schema.properties)` to generate inline JSON Schema in `requestBody.content[mediaType].schema`, handle multiple content-types per request body, include encoding objects for multipart/form-data, include examples arrays, ensure full OpenAPI 3.1.0 compliance with nested object properties and required fields

**Status: ✅ COMPLETED**
- Created `lib/utils/openapi-paths-generator.ts` with functions: `buildParameterForOpenAPI`, `buildResponseForOpenAPI`, `buildOperationForOpenAPI`, `buildPathItemForOpenAPI`, `generatePathsForOpenAPI`, `generateOpenAPISpecWithPaths`, `collectReferencedClassNames`
- Created `lib/db/helper-paths-export.ts` with `loadPathsForOpenAPIExport` and `loadReferencedClassesForPaths` for loading all paths data in the right format
- Created comprehensive test suite with 15 tests covering all generator functions
- Supports both class references (`$ref`) and inline schemas
- Handles multiple content-types per request body
- Full OpenAPI 3.1.0 compliance

### 8. Apply same pattern to response bodies for consistency
After request body implementation, update existing response tables in new migration `20260117-130000.sql`: add `inline_schema` JSONB to `shared_path_response_content` or `path_response_content` table, add `class_id` nullable FK if not exists, add CHECK constraint `(class_id IS NOT NULL OR inline_schema IS NOT NULL)`, implement `convertClassToInlineSchema` for responses in response helpers, update `PathResponseNode` component to show inline property trees with same editing UI, apply same OpenAPI export logic using `buildSchemaFromInlineProperties` for response schemas, ensure complete symmetry between request and response body management

**Status: ⏳ PENDING**

## Further Considerations

### 1. Extract Inline Schema to Component Class
Provide "Extract to Component Class" action in context menu that: prompts for class name, creates new `odb.classes` record, migrates `inline_schema.properties` to `odb.class_properties` table preserving parent_id hierarchy, updates content record to set `class_id` and clear `inline_schema`, makes the schema a first-class reusable component across the project

### 2. Inline Schema Validation
Implement client-side validation using existing property validation from `PropertyFormFields` component, show validation errors inline similar to class property editing, prevent invalid schemas from being saved, validate against JSON Schema/OpenAPI 3.1 rules in real-time during editing

---

## Critical Implementation Notes

- **`buildSchemaFromInlineProperties`** is essential for OpenAPI export - it must handle:
  - Recursive nesting: properties with `parent_id` become nested `properties` objects
  - Required fields: property-level `required: true` in data becomes parent's `required` array
  - Arrays: properties with parent having `type: 'array'` become `items` schema
  - $ref preservation: `$ref` in property data is passed through unchanged
  - Type unions: `type: ['string', 'null']` for nullable fields
  - All JSON Schema keywords: format, pattern, minimum, maximum, enum, etc.

- **Schema structure consistency:** Both request and response bodies use identical inline_schema structure and export logic

- **Migration sequencing:** Request bodies first (20260117-120000.sql), then response bodies (20260117-130000.sql)

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| 1 | Database migration for shared request bodies | ✅ Complete |
| 2 | Helper functions for request body management | ✅ Complete |
| 3 | PathRequestBodyNode canvas component | ✅ Complete |
| 4 | PathsCanvasView integration | ✅ Complete |
| 5 | OperationPropertiesPanel request body UI | ✅ Complete |
| 6 | Inline schema utilities | ✅ Complete |
| 7 | OpenAPI export for inline schemas | ✅ Complete |
| 8 | Response body symmetry | ⏳ Pending |

---

*Last updated: January 17, 2026*
