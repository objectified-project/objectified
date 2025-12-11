# OpenAPI Template System

This directory contains the Handlebars template-based OpenAPI specification generation system. This approach makes it easy to maintain and upgrade OpenAPI specifications across different versions.

## Architecture Overview

The system consists of four main components:

1. **Templates** (`templates/` directory) - Handlebars templates for generating OpenAPI specs
2. **Version Configuration** (`openapi-versions.ts`) - Manages supported OpenAPI versions
3. **Template Loader** (`template-loader.ts`) - Loads and compiles Handlebars templates
4. **OpenAPI Generator** (`openapi.ts`) - Core logic for building schemas from class definitions

## Files

### Core Files

- **`openapi.ts`** - Main OpenAPI specification generator with schema building logic
- **`openapi-versions.ts`** - Configuration for supported OpenAPI versions
- **`template-loader.ts`** - Handlebars template loading and caching utilities

### Template Files

- **`templates/openapi-spec.hbs`** - Main OpenAPI document template (currently 3.1.0)
- **`templates/schema-object.hbs`** - Schema object template (for future use)
- **`templates/property-schema.hbs`** - Property schema template (for future use)

## How It Works

### 1. Schema Building

The `buildClassSchema()` and `buildPropertySchema()` functions construct JSON Schema objects from database class/property definitions. They handle:

- Nested properties (object types with children)
- Array items (inline object schemas)
- Schema composition (allOf, anyOf, oneOf)
- Property references ($ref)
- Required fields

### 2. Template Rendering

Once schemas are built, they are passed to Handlebars templates:

```typescript
const templateData = {
  openapi: '3.1.0',
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API description'
  },
  schemas: {
    Person: { type: 'object', properties: {...} },
    Address: { type: 'object', properties: {...} }
  }
};

const rendered = renderTemplate('openapi-spec.hbs', templateData);
```

### 3. Version Management

The system supports multiple OpenAPI versions through configuration:

```typescript
import { getOpenAPIVersionConfig } from './openapi-versions';

// Get configuration for a specific version
const config = getOpenAPIVersionConfig('3.1.0');

// Use in generation
const spec = generateOpenApiSpec(classes, {
  openapiVersion: '3.1.0'
});
```

## Usage Examples

### Generate Full API Specification

```typescript
import { generateOpenApiSpec } from './utils/openapi';

const classes = [
  { name: 'Person', schema: {...}, properties: [...] },
  { name: 'Address', schema: {...}, properties: [...] }
];

const spec = generateOpenApiSpec(classes, {
  projectName: 'My API',
  version: '1.0.0',
  description: 'My API description',
  openapiVersion: '3.1.0' // Optional, defaults to 3.1.0
});
```

### Generate Single Class Specification

```typescript
import { generateClassOpenApiSpec } from './utils/openapi';

const personClass = { name: 'Person', schema: {...}, properties: [...] };
const allClasses = [...]; // All classes for reference resolution

const spec = generateClassOpenApiSpec(personClass, allClasses, {
  title: 'Person Schema',
  version: '1.0.0',
  openapiVersion: '3.1.0'
});
```

## Adding Support for New OpenAPI Versions

To add support for a new OpenAPI version (e.g., 3.2.0):

### 1. Create a New Template

First, create `templates/openapi-3.2.0-spec.hbs` with the new version's structure (for reference and source control):

Create `templates/openapi-3.2.0-spec.hbs` with the new version's structure:
{
  "openapi": "{{openapi}}",
  "info": {
    "title": "{{info.title}}",
    "version": "{{info.version}}"{{#if info.description}},
    "description": "{{info.description}}"{{/if}}
  },
  {{!-- Add any 3.2.0-specific features here --}}
  "components": {
    "schemas": {
{{#each schemas}}
      "{{@key}}": {{{json this}}}{{#unless @last}},{{/unless}}
{{/each}}
    }
  }
}
```

### 2. Embed Template in Code

**Important:** Add the template content to `template-loader.ts` in the `templateSources` object:

### 2. Update Version Configuration
export const OPENAPI_VERSIONS: Record<string, OpenAPIVersion> = {
  '3.1.0': {
    version: '3.1.0',
    templateFile: 'openapi-spec.hbs',
    description: 'OpenAPI 3.1.0 specification',
    supportedFeatures: [...]
  },
  '3.2.0': {
    version: '3.2.0',
    templateFile: 'openapi-3.2.0-spec.hbs',
    description: 'OpenAPI 3.2.0 specification',
    supportedFeatures: [
      'All 3.1.0 features',
      'New 3.2.0 feature 1',
      'New 3.2.0 feature 2'
    ]
  }
};

// Update default if needed
export const DEFAULT_OPENAPI_VERSION = '3.2.0';
```

### 4. Update Schema Building Logic (if needed)

If the new version requires different schema structures, update `buildClassSchema()` or `buildPropertySchema()` in `openapi.ts`.

### 3. Update Schema Building Logic (if needed)

Test the new version by specifying it in generation calls:

```typescript
const spec = generateOpenApiSpec(classes, {
  openapiVersion: '3.2.0'
});
```

## Handlebars Helpers

The template loader registers several custom helpers:

- **`json`** - Converts objects to formatted JSON strings
- **`jsonInline`** - Converts objects to inline JSON strings
- **`hasValue`** - Checks if a value exists and is not empty
- **`hasKeys`** - Checks if an object has keys

### Helper Usage Example

```handlebars
### 4. Test
  "description": "{{description}}",
{{/if}}

{{#if (hasKeys properties)}}
  "properties": {{{json properties}}},
{{/if}}
```

## Template Caching

Templates are cached after first load for performance. In development, you can clear the cache:

```typescript
import { clearTemplateCache } from './utils/template-loader';

clearTemplateCache();
```

## Benefits of Template-Based Approach

1. **Version Flexibility** - Easy to support multiple OpenAPI versions simultaneously
2. **Maintainability** - Templates are easier to read and modify than string concatenation
3. **Separation of Concerns** - Schema logic separate from document structure
4. **Future-Proof** - Adding new versions doesn't require rewriting core logic
5. **Consistency** - Templates ensure consistent formatting across all generated specs
6. **Extensibility** - Easy to add custom sections or modify structure per version

## Migration Notes

This system replaces the previous hard-coded JSON generation approach. Key differences:

- **Before**: JSON structure hard-coded in JavaScript
- **After**: JSON structure defined in Handlebars templates
- **Version support**: Now configurable instead of hard-coded to 3.1.0
- **Template data**: Schemas are built the same way, then passed to templates

## Troubleshooting

### Template Not Found Error

```
Failed to load template "openapi-spec.hbs"
```

**Solution**: Ensure templates are in `src/app/utils/templates/` directory.

### Invalid OpenAPI Version Error

```
Unsupported OpenAPI version: 3.2.0
```

**Solution**: Add the version to `OPENAPI_VERSIONS` in `openapi-versions.ts`.

### JSON Parse Error

```
Unexpected token in JSON
```

**Solution**: Check template syntax - ensure no trailing commas or malformed JSON.

## Future Enhancements

Potential improvements for the template system:

- [ ] Add templates for OpenAPI 3.2.0 when released
- [ ] Support for custom template directories
- [ ] Template validation and linting
- [ ] Hot-reloading templates in development mode
- [ ] Template inheritance for version-specific overrides
- [ ] Export templates for external customization

