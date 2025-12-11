# OpenAPI Template System Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Application Code                            │
│  (API endpoints, export functions, schema generators)            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ calls
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  openapi.ts (Main Generator)                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  generateOpenApiSpec(classes, options)                    │  │
│  │  generateClassOpenApiSpec(classData, allClasses, options) │  │
│  │                                                             │  │
│  │  • buildClassSchema()                                      │  │
│  │  • buildPropertySchema()                                   │  │
│  │  • findReferencedClasses()                                 │  │
│  │  • extractClassNameFromRef()                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────┬──────────────────────────┬────────────────────────────┘
          │                          │
          │                          │ uses
          ▼                          ▼
┌──────────────────────┐   ┌─────────────────────────────────────┐
│  openapi-versions.ts │   │     template-loader.ts              │
│                      │   │                                     │
│  • OPENAPI_VERSIONS  │   │  • loadTemplate()                   │
│  • DEFAULT_VERSION   │   │  • renderTemplate()                 │
│  • getConfig()       │   │  • clearTemplateCache()             │
│                      │   │  • preloadTemplates()               │
│  Maps versions to    │   │  • Custom Handlebars helpers:       │
│  template files      │   │    - json                           │
└──────────┬───────────┘   │    - jsonInline                     │
           │               │    - hasValue                       │
           │               │    - hasKeys                        │
           │               └───────────┬─────────────────────────┘
           │                           │
           │ provides config           │ loads & compiles
           │                           │
           ▼                           ▼
    ┌─────────────┐         ┌──────────────────────────────┐
    │  Version    │         │   templates/ directory       │
    │  Config     │         │                              │
    │             │         │  • openapi-spec.hbs          │
    │  version    │─────────│  • openapi-future-template   │
    │  template   │  maps   │  • schema-object.hbs         │
    │  features   │   to    │  • property-schema.hbs       │
    └─────────────┘         └──────────────────────────────┘
```

## Data Flow

```
Input: Class Definitions
         │
         ▼
    ┌─────────────────────────────────────┐
    │  Parse class schema & properties    │
    │  (existing logic, unchanged)         │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │  buildClassSchema()                  │
    │  • Process properties                │
    │  • Handle nesting                    │
    │  • Resolve references                │
    │  • Build JSON Schema objects         │
    └─────────────┬───────────────────────┘
                  │
                  │ Schema objects
                  ▼
    ┌─────────────────────────────────────┐
    │  Prepare Template Data               │
    │  {                                   │
    │    openapi: "3.1.0",                 │
    │    info: {...},                      │
    │    schemas: { ... }                  │
    │  }                                   │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │  Get Version Config                  │
    │  • Look up version                   │
    │  • Get template file name            │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │  Load Template                       │
    │  • Read .hbs file                    │
    │  • Compile with Handlebars           │
    │  • Cache for reuse                   │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │  Render Template                     │
    │  • Apply data to template            │
    │  • Execute Handlebars helpers        │
    │  • Generate JSON string              │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │  Validate & Format                   │
    │  • Parse JSON                        │
    │  • Re-stringify with formatting      │
    │  • Return final spec                 │
    └─────────────┬───────────────────────┘
                  │
                  ▼
Output: OpenAPI Specification (JSON string)
```

## Component Interactions

```
┌──────────────────┐
│   Application    │
│   Code Layer     │
└────────┬─────────┘
         │
         │ 1. Call with classes + options
         │
         ▼
┌──────────────────┐         ┌──────────────────┐
│  OpenAPI Layer   │────────▶│  Version Config  │
│  (openapi.ts)    │ 2. Get  │  Layer           │
│                  │ config  │                  │
│  • Build schemas │◀────────│  • Map version   │
│  • Resolve refs  │ 3. Ver- │    to template   │
│  • Nest props    │ sion &  │  • Validate      │
│                  │ template│    version       │
└────────┬─────────┘         └──────────────────┘
         │
         │ 4. Request template rendering
         │    with data
         ▼
┌──────────────────┐         ┌──────────────────┐
│  Template Layer  │────────▶│   Templates      │
│  (loader.ts)     │ 5. Load │   (.hbs files)   │
│                  │ file    │                  │
│  • Load template │         │  • Structure     │
│  • Compile       │         │  • Placeholders  │
│  • Cache         │         │  • Conditionals  │
│  • Render        │         │                  │
└────────┬─────────┘         └──────────────────┘
         │
         │ 6. Return rendered JSON
         │
         ▼
┌──────────────────┐
│   Format &       │
│   Validate       │
│                  │
│  • Parse JSON    │
│  • Pretty-print  │
│  • Verify valid  │
└────────┬─────────┘
         │
         │ 7. Return to caller
         ▼
┌──────────────────┐
│  OpenAPI Spec    │
│  (JSON string)   │
└──────────────────┘
```

## Extension Point: Adding New Versions

```
Developer wants OpenAPI 3.2.0
         │
         ▼
┌──────────────────────────────────────┐
│  1. Create new template              │
│     templates/openapi-3.2.0-spec.hbs │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│  2. Add to openapi-versions.ts       │
│     OPENAPI_VERSIONS['3.2.0'] = {    │
│       version: '3.2.0',               │
│       templateFile: 'openapi-3.2...  │
│       ...                             │
│     }                                 │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│  3. Use in application               │
│     generateOpenApiSpec(classes, {   │
│       openapiVersion: '3.2.0'        │
│     })                                │
└─────────────┬────────────────────────┘
              │
              ▼
         System automatically:
         • Loads new template
         • Renders with new structure
         • Returns 3.2.0 spec
         
         No changes to core logic!
```

## File Dependencies

```
openapi.ts
├── depends on: openapi-versions.ts
├── depends on: template-loader.ts
└── exports: generateOpenApiSpec, generateClassOpenApiSpec

openapi-versions.ts
├── no dependencies
└── exports: getOpenAPIVersionConfig, OPENAPI_VERSIONS

template-loader.ts
├── depends on: handlebars (npm package)
├── depends on: fs, path (node built-ins)
├── reads from: templates/*.hbs
└── exports: renderTemplate, loadTemplate, clearTemplateCache

templates/
├── openapi-spec.hbs (main template)
├── openapi-future-template.hbs (starter for new versions)
├── schema-object.hbs (optional component template)
└── property-schema.hbs (optional component template)
```

## Layer Responsibilities

### Application Layer
- Calls OpenAPI generation functions
- Provides class definitions and metadata
- Receives JSON string output

### OpenAPI Layer (openapi.ts)
- Builds JSON Schema objects from class definitions
- Handles property nesting and references
- Orchestrates template rendering
- **Does NOT** contain version-specific code

### Configuration Layer (openapi-versions.ts)
- Maps version strings to templates
- Validates version support
- Provides version metadata
- **Single source of truth for versions**

### Template Layer (template-loader.ts)
- Loads and compiles templates
- Manages template cache
- Provides Handlebars helpers
- Renders templates with data
- **Handles all Handlebars interaction**

### Template Files (.hbs)
- Define document structure
- Use Handlebars syntax
- Version-specific formatting
- **Pure structure, no logic**

## Key Design Principles

1. **Separation of Concerns**
   - Schema building ≠ Document structure
   - Logic in code, structure in templates

2. **Single Responsibility**
   - Each file has one clear purpose
   - No overlapping responsibilities

3. **Open/Closed Principle**
   - Open for extension (add versions)
   - Closed for modification (no core changes)

4. **Dependency Inversion**
   - Code depends on abstractions (version config)
   - Not on concrete implementations (template files)

5. **Backward Compatibility**
   - Default behavior unchanged
   - Optional parameters for new features

## Performance Characteristics

```
First Request:
  1. Load template from disk      (~5-10ms)
  2. Compile with Handlebars      (~10-20ms)
  3. Cache compiled template      (~1ms)
  4. Build schemas                (depends on class count)
  5. Render template              (~5-10ms)
  Total: ~20-50ms + schema building time

Subsequent Requests:
  1. Get cached template          (~0.1ms)
  2. Build schemas                (depends on class count)
  3. Render template              (~5-10ms)
  Total: ~5-15ms + schema building time

Cache Benefits:
  • Templates compiled once
  • Reused across all requests
  • No disk I/O after first load
  • Minimal memory overhead
```

---

*This architecture is designed to be:*
- ✅ **Maintainable** - Clear separation of concerns
- ✅ **Extensible** - Easy to add new versions
- ✅ **Performant** - Template caching
- ✅ **Testable** - Each layer can be tested independently
- ✅ **Backward Compatible** - No breaking changes

