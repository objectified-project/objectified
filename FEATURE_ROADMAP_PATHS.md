# Paths Designer Feature Roadmap (Planned)

This is the list of planned features to eventually implement into the paths designer.

---

## Engineer-Focused Features

### 3. Developer Experience Enhancements

#### 3.1 Code-Level Editors 📋 PLANNED

Software engineers need precision and control. The Paths Designer provides inline editors with IDE-quality features:

**JSON Schema Editor**:
- Syntax highlighting with theme support (light/dark)
- Bracket matching and auto-closing
- Real-time validation with inline error messages
- Autocomplete for OpenAPI keywords and schema properties
- Quick reference sidebar for OpenAPI 3.1 spec

| Ticket | Feature                                   |
|--------|-------------------------------------------|

**Example Value Editor**:
- Format toggle: JSON, YAML, XML, form-data
- Syntax validation per content type
- Auto-format with `Shift+Alt+F`
- Copy example as cURL command
- Import from file or paste from clipboard

| Ticket | Feature                                   |
|--------|-------------------------------------------|

**Markdown Description Editor**:
- Live preview split view
- CommonMark + GitHub Flavored Markdown
- Code block syntax highlighting
- Link to schema definitions
- Image upload for API documentation

| Ticket | Feature                                   |
|--------|-------------------------------------------|

#### 3.2 Keyboard-First Navigation 📋 PLANNED

Optimized for engineers who prefer keyboard over mouse:

| Action                  | Shortcut           | Description                      |
|-------------------------|--------------------|----------------------------------|
| Open command palette    | `Cmd/Ctrl+K`       | Quick actions menu               |
| Create new path         | `Cmd/Ctrl+N`       | Add path node at canvas center   |
| Add GET method          | `G`                | Add GET to selected path         |
| Add POST method         | `P`                | Add POST to selected path        |
| Add parameter           | `Q` (query)        | Add query param to selected op   |
| Toggle request body     | `B`                | Add/remove request body          |
| Add 200 response        | `2`                | Add 200 OK response              |
| Add 404 response        | `4`                | Add 404 Not Found response       |
| Delete selected         | `Delete/Backspace` | Remove node with confirmation    |
| Duplicate               | `Cmd/Ctrl+D`       | Clone selected node              |
| Search/filter           | `/`                | Focus search box                 |
| Navigate canvas         | `Arrow keys`       | Pan canvas (hold Shift to zoom)  |
| Select all              | `Cmd/Ctrl+A`       | Select all nodes                 |
| Copy                    | `Cmd/Ctrl+C`       | Copy selected nodes              |
| Paste                   | `Cmd/Ctrl+V`       | Paste at cursor position         |

| Ticket | Feature                                   |
|--------|-------------------------------------------|

#### 3.3 Real-Time Validation 📋 PLANNED

Catch errors as you design, not during export:

**Validation Rules**:
- ✅ Unique operation IDs across all paths
- ✅ Valid path variable syntax: `{var}` not `<var>` or `:var`
- ✅ All path variables have corresponding parameter definitions
- ✅ Required request body has at least one content type
- ✅ Status codes are valid HTTP codes (100-599)
- ✅ Schema references point to existing schemas
- ✅ No circular dependencies in schema composition
- ✅ Security schemes referenced in operations exist in global config
- ✅ Example values conform to their schemas
- ⚠️ Warning for missing operation descriptions
- ⚠️ Warning for operations without tags
- ⚠️ Warning for deprecated operations without migration docs

**Visual Indicators**:
- Red border on nodes with errors
- Yellow border on nodes with warnings
- Error/warning badge with count
- Hover for detailed error message
- Click to jump to fix location

| Ticket | Feature                                   |
|--------|-------------------------------------------|

#### 3.4 OpenAPI Export & Import 📋 PLANNED

**Export Formats**:
- OpenAPI 3.1 JSON (prettified or minified)
- OpenAPI 3.1 YAML (with proper indentation)
- Swagger 2.0 (legacy compatibility)
- Postman Collection v2.1
- Insomnia Collection
- API Blueprint (Markdown-based)
- RAML 1.0

| Ticket | Feature                                   |
|--------|-------------------------------------------|

**Export Options**:
- Include/exclude examples
- Include/exclude descriptions
- Bundle schemas inline or use $ref links
- Add custom `x-*` extensions
- Resolve all $ref to embedded schemas (dereferencing)
- Add server URLs for multiple environments

| Ticket | Feature                                   |
|--------|-------------------------------------------|

---

## Testing & Documentation

### 5. Integrated API Testing 📋 PLANNED (Q2 2026)

#### 5.1 Built-In API Tester

Test operations directly from the canvas without leaving the Paths Designer:

**Features**:
- Click "Test" button on any method node
- Auto-populate request from schema + examples
- Edit request body, headers, query params
- Select environment/server for testing
- Send HTTP request and view response
- Response inspector: body, headers, status, timing
- Save as test case for regression testing
- Generate cURL command from request

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Advanced Testing**:
- Request history with replay functionality
- Environment variables for dynamic values
- Pre-request scripts (JavaScript)
- Post-response assertions (status code, JSON path, regex)
- Collection runner for sequential operation testing
- Mock responses when server not available

| Ticket | Feature                                   |
|--------|-------------------------------------------|

#### 5.2 Mock Server Generation 📋 PLANNED (Q2 2026)

Auto-generate mock APIs for frontend development before backend is ready:

**Features**:
- One-click mock server deployment per version
- Serves example responses from operation definitions
- Randomized data generation from schemas
- Configurable response delays for latency simulation
- Error response simulation (4XX, 5XX)
- Request validation against schemas
- Mock server URL for client integration

| Ticket | Feature                                   |
|--------|-------------------------------------------|

#### 5.3 Interactive Documentation 📋 PLANNED (Q2 2026)

Auto-generated API docs with "Try It Out" functionality:

**Features**:
- ReDoc/Swagger UI-style documentation
- Generated from path definitions
- Searchable operation catalog
- Tag-based navigation
- Try It Out for all operations
- Code snippet generation (cURL, JavaScript, Python, etc.)
- Download OpenAPI spec from docs page

| Ticket | Feature                                   |
|--------|-------------------------------------------|

---

## Code Generation

### 6. SDK & Server Stub Generation 📋 PLANNED (Q2 2026)

#### 6.1 Client SDK Generation

Generate type-safe client libraries from path definitions:

**Supported Languages**:
- **TypeScript/JavaScript**: fetch, axios, or custom HTTP client
- **Python**: httpx, requests, or aiohttp
- **Java**: OkHttp, RestTemplate, or WebClient
- **C#**: HttpClient with strongly-typed models
- **Go**: net/http with generated structs
- **Rust**: reqwest with serde models

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**SDK Features**:
- Type-safe request/response models
- Automatic serialization/deserialization
- Error handling with typed exceptions
- Retry logic with exponential backoff
- Authentication handling (API key, OAuth2, etc.)
- Request/response interceptors
- TypeScript IntelliSense support

| Ticket | Feature                                   |
|--------|-------------------------------------------|

#### 6.2 Server Stub Generation

Generate backend API stubs with routing and validation:

**Supported Frameworks**:
- **Node.js**: Express, Fastify, NestJS
- **Python**: FastAPI, Flask, Django REST
- **Java**: Spring Boot, Quarkus
- **Go**: Gin, Echo, Chi
- **Rust**: Actix-web, Rocket

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Generated Code Includes**:
- Route definitions mapped to operations
- Request validation middleware
- Response serialization
- OpenAPI documentation endpoint
- Health check endpoint
- Error handling middleware
- Authentication middleware stubs

| Ticket | Feature                                   |
|--------|-------------------------------------------|

---

#### Core Features

- `obj_path_canvas`: Store React Flow node positions, viewport state, and zoom level per project version
- `obj_path_edges`: Edge connections between nodes with source/target handles and edge types
- `obj_path_node_data`: Serialized node configuration data with type-specific properties
- Optimistic updates with debounced persistence (300ms delay) for smooth canvas interaction
- Undo/redo history stack with configurable depth (default: 50 operations)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Canvas snapshots for version comparison and rollback
- Collaborative editing state with real-time sync markers
- Layout algorithm persistence for auto-arrange preferences
- Node grouping and folder structures for complex APIs

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 4.3 Version Control Integration

#### Core Features

- Path definitions linked to project versions via `obj_project_versions` FK
- Change tracking: created_at, updated_at, created_by, updated_by on all path tables
- Soft delete with deleted_at for path recovery
- Version promotion: copy paths between versions with conflict detection

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Branching support: fork paths for experimental changes
- Merge conflict resolution UI for path definition conflicts
- Change diff visualization between versions
- Audit log for compliance: who changed what, when

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### OpenAPI 3.1 / JSON Schema 2020-12 Feature Coverage

**Not Yet Implemented** 📋 PLANNED (Low Priority)
- `$id`: Schema identifier for referencing
- `$schema`: JSON Schema version declaration
- `$ref`: Schema references (currently handled via class references)
- `$defs`: Reusable schema definitions
- `$anchor`: Named anchors for deep linking
- `$dynamicRef`/`$dynamicAnchor`: Dynamic references (advanced)
- `$vocabulary`: Custom vocabulary definitions
- `contentMediaType`: Media type for string content
- `contentEncoding`: Content encoding (base64, etc.)
- `contentSchema`: Schema for decoded content

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 5. Enterprise Features

### 5.1 Security Configuration

#### Core Features

- Security scheme library: OAuth2, API Key, HTTP Basic/Bearer, OpenID Connect
- Drag security nodes onto operations to apply authentication requirements
- Scope selector for OAuth2 flows with visual scope hierarchy
- Multiple security requirements with AND/OR logic visualization
- Global security defaults with per-operation override capability

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Custom security scheme extensions for proprietary auth systems
- Security requirement inheritance from parent paths
- Role-based access preview: see which roles can access which endpoints
- Security audit report generation for compliance review
- JWT claim mapping visualization for token-based auth

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 5.2 Multi-Tenant & Team Collaboration

#### Core Features

- Organization-scoped path libraries for shared endpoint patterns
- Team-level path templates: CRUD generators, pagination patterns
- Path ownership assignment with edit/view permissions
- Comment threads on paths and operations for design review
- Real-time collaboration indicators: see who's editing which path

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Path approval workflows for production API changes
- Change request system with diff preview and approver assignment
- API governance policies: naming conventions, security requirements
- Cross-project path sharing for microservice coordination
- Conflict resolution for concurrent edits with merge tools

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 5.3 API Gateway Integration

#### Core Features

- Rate limiting configuration per operation with `x-rateLimit` extensions
- Request/response transformation rules attached to operations
- Caching policy configuration with TTL and invalidation rules
- CORS configuration at path and operation level

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Kong, AWS API Gateway, Azure APIM extension export
- Circuit breaker configuration for resilience patterns
- Request validation enforcement toggles
- Backend service binding for gateway proxy configuration
- Traffic policy rules: canary, blue-green, A/B testing metadata

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 6. Testing & Validation

### 6.1 Integrated Swagger UI

#### Core Features

- Embedded Swagger UI panel within Studio for live API testing
- Real-time spec sync: changes in visual designer reflect immediately in Swagger
- Try It Out functionality with configurable base URL and auth headers
- Request/response logging with copy-to-curl capability
- Environment variable support for dynamic base URLs and auth tokens
- Response validation against defined schemas with error highlighting

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Mock server generation from OpenAPI spec for frontend development
- Request history with replay capability
- Response diff comparison between expected and actual
- Performance metrics: response time, payload size tracking
- Collection runner for sequential endpoint testing

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 6.2 Specification Validation

#### Core Features

- Real-time OpenAPI 3.1 compliance validation with inline error markers
- Missing operationId detection with auto-generation suggestions
- Unused schema detection: identify orphaned schema definitions
- Circular reference detection in schema hierarchies
- Security requirement validation: ensure all operations have security

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Custom lint rules for organization-specific conventions
- Spectral integration for industry-standard API linting
- Breaking change detection between versions
- Completeness scoring: documentation coverage percentage
- Best practices advisor: suggest improvements based on API design patterns

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 6.3 Contract Testing

#### Core Features

- Example-based request generation for each operation
- Response schema validation with detailed mismatch reporting
- Status code coverage tracking per operation
- Export test cases to Postman, Insomnia formats

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Pact contract generation for consumer-driven testing
- Dredd test generation for automated contract validation
- CI/CD integration hooks for automated testing pipelines
- Test coverage reports with gap analysis

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 7. Automatic Endpoint Generation

### 7.1 Schema-to-Endpoint Generation

#### Core Features

- Right-click schema → Generate CRUD Endpoints: creates GET, POST, PUT, DELETE paths
- Configurable path pattern: `/resources`, `/resources/{id}`, `/resources/{id}/subresources`
- Automatic request body binding to schema for POST/PUT operations
- Response schema inference: wrap in array for list endpoints, single for detail
- Standard error response generation: 400, 401, 403, 404, 500 templates
- OperationId generation following RESTful conventions: `listUsers`, `getUser`, `createUser`

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Nested resource generation: `/users/{userId}/posts` creates related endpoints
- Custom generation templates: define your own CRUD patterns
- Bulk operation generation: `POST /resources/bulk`, `DELETE /resources/bulk`
- Search endpoint generation with query parameter inference from schema
- Action endpoint generation: `POST /resources/{id}/actions/activate`
- Soft delete vs hard delete pattern selection

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 7.2 Pattern Libraries

#### Core Features

- Pagination pattern: page/limit, cursor-based, or offset-based with response envelope
- Filtering pattern: query parameter generation from schema filterable fields
- Sorting pattern: sort, order query parameters with field validation
- Error response pattern: RFC 7807 Problem Details or custom format
- Authentication patterns: Bearer token, API key, OAuth2 scope requirements

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Custom pattern creation and sharing within organization
- Industry-specific patterns: healthcare (FHIR), finance (Open Banking)
- Pattern composition: combine multiple patterns for complex operations
- Pattern versioning: track changes to organizational standards

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 7.3 Code Generation Integration

#### Core Features

- OpenAPI Generator integration for client SDK generation
- Server stub generation: Express, FastAPI, Spring Boot templates
- TypeScript type generation from OpenAPI spec
- One-click download of generated code artifacts

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Custom generator templates for proprietary frameworks
- Git integration: push generated code to repository
- Incremental generation: update only changed endpoints
- Multi-language generation in single workflow

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 8. UI/UX Design Considerations

### 8.1 Visual Design System

#### Core Features

- Consistent node styling with schema designer: same color palette, typography, shadows
- HTTP method color coding: GET (#48BB78), POST (#4299E1), PUT (#ED8936), DELETE (#F56565), PATCH (#9F7AEA)
- Status code color bands: 2XX (green), 3XX (blue), 4XX (yellow), 5XX (red)
- Iconography for node types: path (route), method (HTTP verb), schema (brackets)
- Dark mode support with accessible contrast ratios (WCAG AA)
- Responsive canvas with touch support for tablet use

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Customizable color themes for organization branding
- High contrast mode for accessibility
- Print-optimized layout for documentation export
- Presentation mode: hide toolbars for demos and reviews

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 8.2 Interaction Patterns

#### Core Features

- Drag from library panel to canvas to create nodes
- Double-click node to open configuration panel (slide-in drawer)
- Edge drawing: drag from output handle to input handle to connect
- Multi-select with Shift+click or rectangle selection
- Keyboard shortcuts: Delete (remove), Cmd+D (duplicate), Cmd+Z (undo), Cmd+G (group)
- Context menu on right-click with relevant actions
- Snap-to-grid alignment with optional grid visibility

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Auto-layout algorithms: hierarchical, force-directed, orthogonal
- Smart guides for manual alignment
- Copy/paste across browser tabs with serialization
- Gesture support: pinch-to-zoom, two-finger pan
- Command palette (Cmd+K) for quick actions

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### 8.3 React Flow Implementation

#### Core Features

- Custom node components with TypeScript type safety
- Node resize handles for adjustable container sizes
- Connection validation: prevent invalid edge connections (e.g., response to path)
- Smooth edge rendering with bezier curves and step lines
- Node grouping with collapsible containers
- Performance optimization: virtualization for 100+ nodes

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Features

- Custom edge types: labeled, animated, conditional
- Sub-flow navigation: drill into complex operations
- Background patterns: dots, lines, cross-hatch
- Fit-to-view controls with animation
- Export canvas as PNG/SVG for documentation

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|


### 9.11 Tasks: Visual Design Implementation

#### Core Visual Tasks

- Implement three-panel Studio layout with collapsible side panels
- Create Library Panel with collapsible sections and drag handles
- Design PathNode component with header, body, and footer zones
- Design MethodNode components with HTTP verb color coding
- Design SchemaRefNode with property preview and modifier toggles
- Design ParameterNode chips for query, header, cookie, path types
- Design ResponseNode with status code color bands
- Implement Properties Panel with contextual forms per node type
- Create edge styles for different relationship types
- Implement canvas controls (zoom, pan, fit, minimap)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

#### Advanced Visual Tasks

- Add node resize handles with minimum size constraints
- Implement multi-select visual feedback (selection rectangle)
- Create context menus for all node types
- Design visual states: default, hover, selected, error, deprecated
- Implement drop zone highlighting during drag operations
- Add keyboard shortcut overlay (triggered by `?` key)
- Create loading/saving state indicators
- Design validation error tooltips with inline positioning
- Implement dark mode color scheme for all node types
- Add animation for edge connections and node transitions

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

Establish the core infrastructure for path design with essential node types and basic canvas functionality.

- Create PathsDesigner component with React Flow integration
- Implement PathNode, MethodNode, and SchemaRefNode components
- Build database tables: `obj_paths`, `obj_path_operations`, `obj_path_parameters`
- Create node library panel with drag-and-drop functionality
- Implement basic path variable detection and configuration
- Add canvas state persistence (positions, viewport)
- Integrate with existing project version system

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Phase 2: Request/Response (Weeks 5-8)

Complete the request/response design capabilities with full parameter and content type support.

- Implement RequestBodyNode and ResponseNode components
- Build ParameterNode for query, header, cookie, and path parameters
- Create content type management with schema binding
- Add response status code library with presets
- Implement configuration panels for all node types
- Add undo/redo functionality with history stack
- Build OpenAPI export with paths integration

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Phase 3: Testing & Validation (Weeks 9-12)

Integrate testing capabilities and specification validation for developer productivity.

- Embed Swagger UI panel with real-time spec sync
- Implement OpenAPI 3.1 validation with inline error markers
- Add Try It Out functionality with environment support
- Create auto-generation from schemas (CRUD endpoints)
- Build security scheme library and assignment
- Add request/response logging with history
- Implement pattern libraries for common API patterns

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|
