# OBJECTIFIED UI

## Feature Roadmap: API Paths Designer

**Version 2.0 — Visual OpenAPI Path Definition & Testing**

---

## Executive Summary

This roadmap outlines the implementation of API Paths functionality within the Objectified UI Studio. The Paths Designer introduces a third tab in the Studio interface, enabling developers to visually design RESTful API endpoints using a drag-and-drop React Flow canvas. This feature bridges the gap between schema definition and API specification, providing a complete OpenAPI 3.1 design experience.

The visual approach maintains consistency with the existing schema designer, where developers can drag path nodes, method nodes, and schema references onto a canvas to construct their API specifications. Path variables, query parameters, request bodies, and response definitions are configured through contextual panels rather than traditional form-based interfaces.

---

## 1. Core Architecture & Data Model

### 1.1 React Flow Canvas Integration

#### Initial Implementation (Phase 1)

- [ ] Dedicated PathsDesigner component as third Studio tab with independent React Flow instance
- [ ] PathNode: Represents URL path segments with configurable base path and inline variable extraction
- [ ] MethodNode: HTTP verb containers (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD) with color-coded visual distinction
- [ ] SchemaRefNode: Draggable schema references from the existing schema library for request/response binding
- [ ] ParameterNode: Query, header, cookie, and path parameter definitions with type inference
- [ ] Edge connections between nodes representing parent-child and reference relationships

#### Advanced Features (Phase 2)

- [ ] OperationGroupNode: Logical grouping of related operations with tag-based organization
- [ ] SecurityNode: Reusable security scheme references with scope configuration
- [ ] CallbackNode: Webhook and callback URL definitions with payload schema binding
- [ ] LinkNode: OpenAPI link objects for response-to-operation relationships
- [ ] ServerNode: Per-path server override configurations
- [ ] Mini-map navigation for large API specifications with 50+ paths
- [ ] Canvas zoom controls with keyboard shortcuts (Cmd/Ctrl + scroll, +/- keys)

#### Enterprise Extensions (Phase 3)

- [ ] DeprecationNode: Visual deprecation markers with migration path suggestions
- [ ] VersionNode: API versioning containers for multi-version specifications
- [ ] GatewayNode: API gateway-specific extensions (rate limits, transformations)
- [ ] DocumentationNode: Extended description blocks with markdown support

### 1.2 Node Type Specifications

| Node Type | Visual Representation | Configurable Properties |
|-----------|----------------------|------------------------|
| PathNode | Rounded rectangle, gray header | path, summary, description, servers[], deprecated |
| MethodNode | Colored badge (verb-specific) | operationId, tags[], security[], externalDocs |
| RequestBodyNode | Input icon, blue accent | content types, required, description, schema ref |
| ResponseNode | Output icon, status-colored | statusCode, description, headers, content, links |
| ParameterNode | Tag chip, location-coded | name, in (query/path/header/cookie), schema, required |

---

## 2. Path Definition Features

### 2.1 Path Variable Configuration

#### Core Features

- [ ] Automatic path variable detection from curly brace syntax: `/users/{userId}/posts/{postId}`
- [ ] Inline variable editor: click on `{variable}` segment to configure type, format, and constraints
- [ ] Path variable schema binding: drag schema property onto variable for type inheritance
- [ ] Variable validation rules: pattern (regex), minLength, maxLength, enum values
- [ ] Required/optional path segment configuration (OpenAPI 3.1 style)
- [ ] Path template preview with sample values for developer reference

#### Advanced Features

- [ ] Matrix parameter support: `/users{;id,name}` with explode configuration
- [ ] Label parameter support: `/files{.extension}` for file type routing
- [ ] Path variable documentation: inline help text visible on hover
- [ ] Variable dependency graph: visualize relationships between path variables
- [ ] Common pattern library: UUID, slug, numeric ID templates

### 2.2 HTTP Method Configuration

#### Core Features

- [ ] Drag method badges onto path nodes to create operations
- [ ] Color-coded method visualization: GET (green), POST (blue), PUT (orange), DELETE (red), PATCH (purple)
- [ ] OperationId auto-generation from method + path pattern (e.g., `getUserById`)
- [ ] Tag assignment panel for logical API grouping
- [ ] Operation summary and description fields with markdown preview
- [ ] Deprecated flag toggle with visual strikethrough indicator

#### Advanced Features

- [ ] Custom `x-*` extension fields for vendor-specific metadata
- [ ] ExternalDocs linking for operation-level documentation
- [ ] Operation-level server overrides for multi-environment support
- [ ] Callback definitions with webhook URL patterns
- [ ] Link objects for hypermedia-style API navigation

### 2.3 Content Type Management

#### Core Features

- [ ] Default content types: `application/json`, `application/xml`, `multipart/form-data`
- [ ] Per-operation content type configuration for request and response bodies
- [ ] Schema binding per content type: same operation, different payload structures
- [ ] Content negotiation preview: see all supported types at a glance
- [ ] Encoding object configuration for multipart requests

#### Advanced Features

- [ ] Custom media type registration with vendor prefixes
- [ ] Binary content handling: `application/octet-stream`, `image/*`, `audio/*`
- [ ] Content type inheritance from global defaults
- [ ] Accept header preview generation for client SDK hints

---

## 3. Request & Response Design

### 3.1 Request Body Configuration

#### Core Features

- [ ] Drag schema from library panel onto method node to bind request body
- [ ] Inline schema preview: collapsed view shows property names, expanded shows full structure
- [ ] Required toggle with visual indicator on request body node
- [ ] Description field with markdown support for developer documentation
- [ ] Multiple content type schemas: different structures for JSON vs form-data
- [ ] Example value editor with JSON/YAML toggle

#### Advanced Features

- [ ] Polymorphic request body: oneOf/anyOf schema selector visualization
- [ ] Discriminator configuration for union type payloads
- [ ] Request body validation preview: see what the server will accept
- [ ] File upload configuration with progress indicator hints
- [ ] Encoding options for multipart: contentType, headers, style, explode

### 3.2 Response Definition

#### Core Features

- [ ] Status code node library: 200, 201, 204, 400, 401, 403, 404, 500 with presets
- [ ] Response schema binding via drag-and-drop from schema library
- [ ] Response header configuration with type and description
- [ ] Multiple response codes per operation with visual status code badges
- [ ] Default response configuration for catch-all error handling
- [ ] Response description with semantic status code suggestions

#### Advanced Features

- [ ] Response range patterns: 2XX, 4XX, 5XX wildcard definitions
- [ ] Link objects for response-driven navigation (HATEOAS support)
- [ ] Media type examples per response code
- [ ] Response header templates for common patterns (pagination, rate limiting)
- [ ] Content negotiation visualization showing all response variants

### 3.3 Parameter Management

#### Core Features

- [ ] Query parameter nodes with name, type, and required configuration
- [ ] Header parameter nodes for authentication and custom headers
- [ ] Cookie parameter support with security considerations
- [ ] Parameter schema binding from existing schema properties
- [ ] Enum constraint visualization for fixed parameter values
- [ ] Default value configuration with type-appropriate editors

#### Advanced Features

- [ ] Array parameter serialization: style (form, spaceDelimited, pipeDelimited) and explode
- [ ] Object parameter deep serialization with deepObject style
- [ ] Parameter deprecation with migration notices
- [ ] Reusable parameter components: define once, reference everywhere
- [ ] Parameter grouping for common patterns (pagination: page, limit, offset)

---

## 4. Database Schema Improvements

### 4.1 Paths Table Structure

#### Core Tables

- [ ] `obj_paths`: Primary path storage with path_pattern, summary, description, deprecated, servers[]
- [ ] `obj_path_operations`: Method definitions linked to paths with operation_id, tags[], external_docs
- [ ] `obj_path_parameters`: Reusable parameter definitions with in_location, schema_ref, required, style
- [ ] `obj_request_bodies`: Request body definitions with content_type_map, required, description
- [ ] `obj_responses`: Response definitions with status_code, description, headers[], content_map
- [ ] `obj_path_security`: Per-operation security requirement assignments

#### Advanced Tables

- [ ] `obj_callbacks`: Webhook callback definitions with expression patterns and operation refs
- [ ] `obj_links`: Response link definitions with operationRef/operationId and parameter mapping
- [ ] `obj_path_servers`: Per-path server override configurations
- [ ] `obj_encoding`: Multipart encoding configurations per property
- [ ] `obj_examples`: Reusable example objects with summary, description, value, externalValue

### 4.2 React Flow State Persistence

#### Core Features

- [ ] `obj_path_canvas`: Store React Flow node positions, viewport state, and zoom level per project version
- [ ] `obj_path_edges`: Edge connections between nodes with source/target handles and edge types
- [ ] `obj_path_node_data`: Serialized node configuration data with type-specific properties
- [ ] Optimistic updates with debounced persistence (300ms delay) for smooth canvas interaction
- [ ] Undo/redo history stack with configurable depth (default: 50 operations)

#### Advanced Features

- [ ] Canvas snapshots for version comparison and rollback
- [ ] Collaborative editing state with real-time sync markers
- [ ] Layout algorithm persistence for auto-arrange preferences
- [ ] Node grouping and folder structures for complex APIs

### 4.3 Version Control Integration

#### Core Features

- [ ] Path definitions linked to project versions via `obj_project_versions` FK
- [ ] Change tracking: created_at, updated_at, created_by, updated_by on all path tables
- [ ] Soft delete with deleted_at for path recovery
- [ ] Version promotion: copy paths between versions with conflict detection

#### Advanced Features

- [ ] Branching support: fork paths for experimental changes
- [ ] Merge conflict resolution UI for path definition conflicts
- [ ] Change diff visualization between versions
- [ ] Audit log for compliance: who changed what, when

---

## 5. Enterprise Features

### 5.1 Security Configuration

#### Core Features

- [ ] Security scheme library: OAuth2, API Key, HTTP Basic/Bearer, OpenID Connect
- [ ] Drag security nodes onto operations to apply authentication requirements
- [ ] Scope selector for OAuth2 flows with visual scope hierarchy
- [ ] Multiple security requirements with AND/OR logic visualization
- [ ] Global security defaults with per-operation override capability

#### Advanced Features

- [ ] Custom security scheme extensions for proprietary auth systems
- [ ] Security requirement inheritance from parent paths
- [ ] Role-based access preview: see which roles can access which endpoints
- [ ] Security audit report generation for compliance review
- [ ] JWT claim mapping visualization for token-based auth

### 5.2 Multi-Tenant & Team Collaboration

#### Core Features

- [ ] Organization-scoped path libraries for shared endpoint patterns
- [ ] Team-level path templates: CRUD generators, pagination patterns
- [ ] Path ownership assignment with edit/view permissions
- [ ] Comment threads on paths and operations for design review
- [ ] Real-time collaboration indicators: see who's editing which path

#### Advanced Features

- [ ] Path approval workflows for production API changes
- [ ] Change request system with diff preview and approver assignment
- [ ] API governance policies: naming conventions, security requirements
- [ ] Cross-project path sharing for microservice coordination
- [ ] Conflict resolution for concurrent edits with merge tools

### 5.3 API Gateway Integration

#### Core Features

- [ ] Rate limiting configuration per operation with `x-rateLimit` extensions
- [ ] Request/response transformation rules attached to operations
- [ ] Caching policy configuration with TTL and invalidation rules
- [ ] CORS configuration at path and operation level

#### Advanced Features

- [ ] Kong, AWS API Gateway, Azure APIM extension export
- [ ] Circuit breaker configuration for resilience patterns
- [ ] Request validation enforcement toggles
- [ ] Backend service binding for gateway proxy configuration
- [ ] Traffic policy rules: canary, blue-green, A/B testing metadata

---

## 6. Testing & Validation

### 6.1 Integrated Swagger UI

#### Core Features

- [ ] Embedded Swagger UI panel within Studio for live API testing
- [ ] Real-time spec sync: changes in visual designer reflect immediately in Swagger
- [ ] Try It Out functionality with configurable base URL and auth headers
- [ ] Request/response logging with copy-to-curl capability
- [ ] Environment variable support for dynamic base URLs and auth tokens
- [ ] Response validation against defined schemas with error highlighting

#### Advanced Features

- [ ] Mock server generation from OpenAPI spec for frontend development
- [ ] Request history with replay capability
- [ ] Response diff comparison between expected and actual
- [ ] Performance metrics: response time, payload size tracking
- [ ] Collection runner for sequential endpoint testing

### 6.2 Specification Validation

#### Core Features

- [ ] Real-time OpenAPI 3.1 compliance validation with inline error markers
- [ ] Missing operationId detection with auto-generation suggestions
- [ ] Unused schema detection: identify orphaned schema definitions
- [ ] Circular reference detection in schema hierarchies
- [ ] Security requirement validation: ensure all operations have security

#### Advanced Features

- [ ] Custom lint rules for organization-specific conventions
- [ ] Spectral integration for industry-standard API linting
- [ ] Breaking change detection between versions
- [ ] Completeness scoring: documentation coverage percentage
- [ ] Best practices advisor: suggest improvements based on API design patterns

### 6.3 Contract Testing

#### Core Features

- [ ] Example-based request generation for each operation
- [ ] Response schema validation with detailed mismatch reporting
- [ ] Status code coverage tracking per operation
- [ ] Export test cases to Postman, Insomnia formats

#### Advanced Features

- [ ] Pact contract generation for consumer-driven testing
- [ ] Dredd test generation for automated contract validation
- [ ] CI/CD integration hooks for automated testing pipelines
- [ ] Test coverage reports with gap analysis

---

## 7. Automatic Endpoint Generation

### 7.1 Schema-to-Endpoint Generation

#### Core Features

- [ ] Right-click schema → Generate CRUD Endpoints: creates GET, POST, PUT, DELETE paths
- [ ] Configurable path pattern: `/resources`, `/resources/{id}`, `/resources/{id}/subresources`
- [ ] Automatic request body binding to schema for POST/PUT operations
- [ ] Response schema inference: wrap in array for list endpoints, single for detail
- [ ] Standard error response generation: 400, 401, 403, 404, 500 templates
- [ ] OperationId generation following RESTful conventions: `listUsers`, `getUser`, `createUser`

#### Advanced Features

- [ ] Nested resource generation: `/users/{userId}/posts` creates related endpoints
- [ ] Custom generation templates: define your own CRUD patterns
- [ ] Bulk operation generation: `POST /resources/bulk`, `DELETE /resources/bulk`
- [ ] Search endpoint generation with query parameter inference from schema
- [ ] Action endpoint generation: `POST /resources/{id}/actions/activate`
- [ ] Soft delete vs hard delete pattern selection

### 7.2 Pattern Libraries

#### Core Features

- [ ] Pagination pattern: page/limit, cursor-based, or offset-based with response envelope
- [ ] Filtering pattern: query parameter generation from schema filterable fields
- [ ] Sorting pattern: sort, order query parameters with field validation
- [ ] Error response pattern: RFC 7807 Problem Details or custom format
- [ ] Authentication patterns: Bearer token, API key, OAuth2 scope requirements

#### Advanced Features

- [ ] Custom pattern creation and sharing within organization
- [ ] Industry-specific patterns: healthcare (FHIR), finance (Open Banking)
- [ ] Pattern composition: combine multiple patterns for complex operations
- [ ] Pattern versioning: track changes to organizational standards

### 7.3 Code Generation Integration

#### Core Features

- [ ] OpenAPI Generator integration for client SDK generation
- [ ] Server stub generation: Express, FastAPI, Spring Boot templates
- [ ] TypeScript type generation from OpenAPI spec
- [ ] One-click download of generated code artifacts

#### Advanced Features

- [ ] Custom generator templates for proprietary frameworks
- [ ] Git integration: push generated code to repository
- [ ] Incremental generation: update only changed endpoints
- [ ] Multi-language generation in single workflow

---

## 8. UI/UX Design Considerations

### 8.1 Visual Design System

#### Core Features

- [ ] Consistent node styling with schema designer: same color palette, typography, shadows
- [ ] HTTP method color coding: GET (#48BB78), POST (#4299E1), PUT (#ED8936), DELETE (#F56565), PATCH (#9F7AEA)
- [ ] Status code color bands: 2XX (green), 3XX (blue), 4XX (yellow), 5XX (red)
- [ ] Iconography for node types: path (route), method (HTTP verb), schema (brackets)
- [ ] Dark mode support with accessible contrast ratios (WCAG AA)
- [ ] Responsive canvas with touch support for tablet use

#### Advanced Features

- [ ] Customizable color themes for organization branding
- [ ] High contrast mode for accessibility
- [ ] Print-optimized layout for documentation export
- [ ] Presentation mode: hide toolbars for demos and reviews

### 8.2 Interaction Patterns

#### Core Features

- [ ] Drag from library panel to canvas to create nodes
- [ ] Double-click node to open configuration panel (slide-in drawer)
- [ ] Edge drawing: drag from output handle to input handle to connect
- [ ] Multi-select with Shift+click or rectangle selection
- [ ] Keyboard shortcuts: Delete (remove), Cmd+D (duplicate), Cmd+Z (undo), Cmd+G (group)
- [ ] Context menu on right-click with relevant actions
- [ ] Snap-to-grid alignment with optional grid visibility

#### Advanced Features

- [ ] Auto-layout algorithms: hierarchical, force-directed, orthogonal
- [ ] Smart guides for manual alignment
- [ ] Copy/paste across browser tabs with serialization
- [ ] Gesture support: pinch-to-zoom, two-finger pan
- [ ] Command palette (Cmd+K) for quick actions

### 8.3 React Flow Implementation

#### Core Features

- [ ] Custom node components with TypeScript type safety
- [ ] Node resize handles for adjustable container sizes
- [ ] Connection validation: prevent invalid edge connections (e.g., response to path)
- [ ] Smooth edge rendering with bezier curves and step lines
- [ ] Node grouping with collapsible containers
- [ ] Performance optimization: virtualization for 100+ nodes

#### Advanced Features

- [ ] Custom edge types: labeled, animated, conditional
- [ ] Sub-flow navigation: drill into complex operations
- [ ] Background patterns: dots, lines, cross-hatch
- [ ] Fit-to-view controls with animation
- [ ] Export canvas as PNG/SVG for documentation

---

## 9. Visual Design Specification

This section describes the visual appearance and layout of the Paths Designer within the Studio interface, including the React Flow canvas structure, node designs, and interaction patterns.

### 9.1 Studio Layout Structure

The Paths Designer exists as the third tab within the Studio page, alongside the existing Schema Designer and (future) Components tabs. The overall layout follows a three-panel structure:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STUDIO HEADER                                                                   │
│  ┌──────────────┬──────────────┬──────────────┐                                 │
│  │   Schemas    │  Components  │    Paths     │  ← Tab Navigation               │
│  └──────────────┴──────────────┴──────────────┘                                 │
├────────────────┬────────────────────────────────────────────────┬───────────────┤
│                │                                                │               │
│   LIBRARY      │              REACT FLOW CANVAS                 │  PROPERTIES   │
│   PANEL        │                                                │  PANEL        │
│                │                                                │               │
│  ┌──────────┐  │                                                │  (Contextual  │
│  │ Paths    │  │     Visual drag-and-drop workspace             │   config for  │
│  ├──────────┤  │     for designing API endpoints                │   selected    │
│  │ Methods  │  │                                                │   node)       │
│  ├──────────┤  │                                                │               │
│  │ Schemas  │  │                                                │               │
│  ├──────────┤  │                                                │               │
│  │ Params   │  │                                                │               │
│  ├──────────┤  │                                                │               │
│  │ Responses│  │                                                │               │
│  └──────────┘  │                                                │               │
│                │                                                │               │
│   240px        │              Flexible Width                    │    320px      │
├────────────────┴────────────────────────────────────────────────┴───────────────┤
│  FOOTER: Validation Status │ Zoom Controls │ Mini-map Toggle │ Export Button   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Library Panel Structure

The left-side library panel provides draggable elements organized into collapsible sections:

```
┌─────────────────────────┐
│ 🔍 Search components... │
├─────────────────────────┤
│ ▼ PATHS                 │
│   ┌───────────────────┐ │
│   │ ＋ New Path       │ │  ← Drag to canvas to create PathNode
│   └───────────────────┘ │
├─────────────────────────┤
│ ▼ HTTP METHODS          │
│   ┌─────┐ ┌─────┐       │
│   │ GET │ │POST │       │  ← Color-coded method badges
│   └─────┘ └─────┘       │
│   ┌─────┐ ┌─────┐       │
│   │ PUT │ │ DEL │       │
│   └─────┘ └─────┘       │
│   ┌─────┐ ┌─────┐       │
│   │PATCH│ │HEAD │       │
│   └─────┘ └─────┘       │
├─────────────────────────┤
│ ▼ SCHEMAS (from lib)    │
│   ┌───────────────────┐ │
│   │ { } User          │ │  ← Schemas defined in Schema Designer
│   ├───────────────────┤ │
│   │ { } Product       │ │  ← Drag onto RequestBody/Response
│   ├───────────────────┤ │
│   │ { } Order         │ │
│   ├───────────────────┤ │
│   │ { } Address       │ │
│   ├───────────────────┤ │
│   │ { } ErrorResponse │ │
│   └───────────────────┘ │
├─────────────────────────┤
│ ▼ PARAMETERS            │
│   ┌───────────────────┐ │
│   │ ? Query Param     │ │
│   ├───────────────────┤ │
│   │ H Header Param    │ │
│   ├───────────────────┤ │
│   │ 🍪 Cookie Param   │ │
│   └───────────────────┘ │
├─────────────────────────┤
│ ▼ RESPONSES             │
│   ┌─────┐ ┌─────┐       │
│   │ 200 │ │ 201 │       │  ← Status code presets
│   └─────┘ └─────┘       │
│   ┌─────┐ ┌─────┐       │
│   │ 400 │ │ 401 │       │
│   └─────┘ └─────┘       │
│   ┌─────┐ ┌─────┐       │
│   │ 404 │ │ 500 │       │
│   └─────┘ └─────┘       │
├─────────────────────────┤
│ ▼ SECURITY              │
│   ┌───────────────────┐ │
│   │ 🔐 Bearer Token   │ │
│   ├───────────────────┤ │
│   │ 🔑 API Key        │ │
│   ├───────────────────┤ │
│   │ 🔒 OAuth2         │ │
│   └───────────────────┘ │
└─────────────────────────┘
```

### 9.3 Node Visual Designs

Each node type has a distinct visual appearance to enable quick identification on the canvas.

#### PathNode (Primary Container)

The PathNode serves as the top-level container for an API endpoint:

```
┌─────────────────────────────────────────────────────────────┐
│ ○ PATH                                           ⋮ ≡       │  ← Header with drag handle
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   /api/v1/users/{userId}/orders                             │  ← Path pattern (editable)
│                    ├────┘                                   │
│                    └─ {userId} detected as path variable    │
│                                                             │
│   Summary: Manage user orders                               │  ← Optional summary
│                                                             │
│   ┌─ METHODS ─────────────────────────────────────────────┐ │
│   │                                                       │ │
│   │  (Drop zone for MethodNodes)                          │ │  ← Methods attach here
│   │                                                       │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Tags: orders, users          │  ⚠️ deprecated             │  ← Footer metadata
└─────────────────────────────────────────────────────────────┘
     │
     ○ ← Output handle for edge connections
```

#### MethodNode (HTTP Verb Container)

MethodNodes are color-coded and nest inside PathNodes:

```
GET (Green #48BB78)                    POST (Blue #4299E1)
┌────────────────────────────┐         ┌────────────────────────────┐
│ ●━━ GET ━━━━━━━━━━━━━━━━━ │         │ ●━━ POST ━━━━━━━━━━━━━━━━ │
├────────────────────────────┤         ├────────────────────────────┤
│ operationId: listUserOrders│         │ operationId: createOrder   │
│                            │         │                            │
│ ┌─ Request ──────────────┐ │         │ ┌─ Request ──────────────┐ │
│ │ (No body for GET)      │ │         │ │ ○ CreateOrderRequest   │←── Schema ref
│ └────────────────────────┘ │         │ │   application/json     │ │
│                            │         │ └────────────────────────┘ │
│ ┌─ Responses ────────────┐ │         │                            │
│ │ 200 ○ Order[]          │←── Schema │ ┌─ Responses ────────────┐ │
│ │ 401 ○ ErrorResponse    │ │  refs   │ │ 201 ○ Order            │ │
│ │ 404 ○ ErrorResponse    │ │         │ │ 400 ○ ValidationError  │ │
│ └────────────────────────┘ │         │ │ 401 ○ ErrorResponse    │ │
│                            │         │ └────────────────────────┘ │
│ 🔐 bearerAuth             │         │                            │
└────────────────────────────┘         │ 🔐 bearerAuth             │
                                       └────────────────────────────┘

PUT (Orange #ED8936)                   DELETE (Red #F56565)
┌────────────────────────────┐         ┌────────────────────────────┐
│ ●━━ PUT ━━━━━━━━━━━━━━━━━ │         │ ●━━ DELETE ━━━━━━━━━━━━━━ │
├────────────────────────────┤         ├────────────────────────────┤
│ operationId: updateOrder   │         │ operationId: deleteOrder   │
│ ...                        │         │ ...                        │
└────────────────────────────┘         └────────────────────────────┘

PATCH (Purple #9F7AEA)                 OPTIONS/HEAD (Gray #718096)
┌────────────────────────────┐         ┌────────────────────────────┐
│ ●━━ PATCH ━━━━━━━━━━━━━━━ │         │ ●━━ OPTIONS ━━━━━━━━━━━━━ │
├────────────────────────────┤         ├────────────────────────────┤
│ operationId: patchOrder    │         │ operationId: orderOptions  │
│ ...                        │         │ ...                        │
└────────────────────────────┘         └────────────────────────────┘
```

#### SchemaRefNode (Draggable from Library)

When a schema is dragged from the library panel onto the canvas or into a request/response zone:

```
┌─────────────────────────────────┐
│ { } User                    ↗️  │  ← Click to jump to Schema Designer
├─────────────────────────────────┤
│                                 │
│  id: string (uuid)              │  ← Preview of top-level properties
│  email: string (email)          │
│  name: string                   │
│  createdAt: string (date-time)  │
│  ... +3 more properties         │
│                                 │
├─────────────────────────────────┤
│  ○ ref    ○ array    ○ partial  │  ← Modifier toggles
└─────────────────────────────────┘
  │
  ○ ← Handle for connecting to Request/Response
```

#### ParameterNode

Parameters appear as compact chips that can be attached to operations:

```
Query Parameter:                    Path Parameter (auto-detected):
┌─────────────────────────────┐    ┌─────────────────────────────┐
│ ? limit                     │    │ : userId                    │
│   integer · optional        │    │   string (uuid) · required  │
│   default: 20               │    │   in: path                  │
└─────────────────────────────┘    └─────────────────────────────┘

Header Parameter:                   Cookie Parameter:
┌─────────────────────────────┐    ┌─────────────────────────────┐
│ H X-Request-ID              │    │ 🍪 session_id               │
│   string · optional         │    │   string · required         │
└─────────────────────────────┘    └─────────────────────────────┘
```

#### ResponseNode

Response nodes show status code with color coding:

```
2XX Success (Green background)      4XX Client Error (Yellow/Orange)
┌─────────────────────────────┐    ┌─────────────────────────────┐
│ 200 OK                  ✓   │    │ 400 Bad Request         ⚠️  │
├─────────────────────────────┤    ├─────────────────────────────┤
│ Content:                    │    │ Content:                    │
│ ○ application/json          │    │ ○ application/json          │
│   └─ { } User               │    │   └─ { } ValidationError    │
│                             │    │                             │
│ Headers:                    │    │ Headers:                    │
│   X-RateLimit-Remaining     │    │   (none)                    │
└─────────────────────────────┘    └─────────────────────────────┘

5XX Server Error (Red background)   Default Response (Gray)
┌─────────────────────────────┐    ┌─────────────────────────────┐
│ 500 Internal Error      ✕   │    │ default                 ∿   │
├─────────────────────────────┤    ├─────────────────────────────┤
│ Content:                    │    │ Content:                    │
│ ○ application/json          │    │ ○ application/json          │
│   └─ { } ErrorResponse      │    │   └─ { } ErrorResponse      │
└─────────────────────────────┘    └─────────────────────────────┘
```

### 9.4 Complete Canvas Example

Here's how a complete API endpoint design might appear on the canvas:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    REACT FLOW CANVAS                                     │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│                                                                                          │
│  │ ┌───────────────────────────────────────────────────────────────────────────────┐ │  │
│    │ ○ PATH                                                                    ⋮ ≡ │    │
│  │ ├───────────────────────────────────────────────────────────────────────────────┤ │  │
│    │                                                                               │    │
│  │ │   /api/v1/users/{userId}                                                      │ │  │
│    │                                                                               │    │
│  │ │   ┌─────────────────────────────────────────────────────────────────────────┐ │ │  │
│    │   │                                                                         │ │    │
│  │ │   │  ┌────────────────────────┐    ┌────────────────────────┐               │ │ │  │
│    │   │  │ ●━━ GET ━━━━━━━━━━━━━ │    │ ●━━ PUT ━━━━━━━━━━━━━━ │               │ │    │
│  │ │   │  ├────────────────────────┤    ├────────────────────────┤               │ │ │  │
│    │   │  │ operationId: getUser   │    │ operationId: updateUser│               │ │    │
│  │ │   │  │                        │    │                        │               │ │ │  │
│    │   │  │ ┌─ Responses ────────┐ │    │ ┌─ Request ──────────┐ │               │ │    │
│  │ │   │  │ │ 200 ────────────┐  │ │    │ │                    │ │               │ │ │  │
│    │   │  │ │     ┌───────────┴──┴─┴────┴─┤ { } UpdateUserReq  │ │               │ │    │
│  │ │   │  │ │     │ { } User         │◀───│     app/json       │ │               │ │ │  │
│    │   │  │ │     │                  │    │ └────────────────────┘               │ │    │
│  │ │   │  │ │     │  id: string      │    │                        │             │ │ │  │
│    │   │  │ │     │  email: string   │    │ ┌─ Responses ────────┐ │             │ │    │
│  │ │   │  │ │     │  name: string    │    │ │ 200 ○──────────────┼─┘             │ │ │  │
│    │   │  │ │     │  role: enum      │    │ │ 400 ○ ValidationErr│               │ │    │
│  │ │   │  │ │     └──────────────────┘    │ │ 404 ○ NotFoundError│               │ │ │  │
│    │   │  │ │ 401 ○ ErrorResponse    │    │ └────────────────────┘               │ │    │
│  │ │   │  │ │ 404 ○ ErrorResponse    │    │                        │             │ │ │  │
│    │   │  │ └────────────────────────┘    │ 🔐 bearerAuth          │             │ │    │
│  │ │   │  │                        │    └────────────────────────┘               │ │ │  │
│    │   │  │ 🔐 bearerAuth          │                                             │ │    │
│  │ │   │  └────────────────────────┘    ┌────────────────────────┐               │ │ │  │
│    │   │                                │ ●━━ DELETE ━━━━━━━━━━━ │               │ │    │
│  │ │   │                                ├────────────────────────┤               │ │ │  │
│    │   │                                │ operationId: deleteUser│               │ │    │
│  │ │   │                                │                        │               │ │ │  │
│    │   │                                │ ┌─ Responses ────────┐ │               │ │    │
│  │ │   │                                │ │ 204 (No Content)   │ │               │ │ │  │
│    │   │                                │ │ 401 ○ ErrorResponse│ │               │ │    │
│  │ │   │                                │ │ 404 ○ ErrorResponse│ │               │ │ │  │
│    │   │                                │ └────────────────────┘ │               │ │    │
│  │ │   │                                │                        │               │ │ │  │
│    │   │                                │ 🔐 bearerAuth          │               │ │    │
│  │ │   │                                └────────────────────────┘               │ │ │  │
│    │   │                                                                         │ │    │
│  │ │   └─────────────────────────────────────────────────────────────────────────┘ │ │  │
│    │                                                                               │    │
│  │ ├───────────────────────────────────────────────────────────────────────────────┤ │  │
│    │  Tags: users                    │  Path Params: userId (uuid)                 │    │
│  │ └───────────────────────────────────────────────────────────────────────────────┘ │  │
│                                                                                          │
│  │                                                                                   │  │
│     ┌─ FLOATING SCHEMA REFERENCES ─────────────────────────────────────────────────┐    │
│  │  │                                                                              │ │  │
│     │  ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐ │    │
│  │  │  │ { } User        ↗️  │   │ { } UpdateUserReq↗️  │   │ { } ErrorResponse↗️ │ │ │  │
│     │  ├─────────────────────┤   ├─────────────────────┤   ├─────────────────────┤ │    │
│  │  │  │ id: string (uuid)  │   │ email?: string      │   │ code: string        │ │ │  │
│     │  │ email: string      │   │ name?: string       │   │ message: string     │ │    │
│  │  │  │ name: string       │   │ role?: enum         │   │ details?: object    │ │ │  │
│     │  │ role: enum         │   │                     │   │                     │ │    │
│  │  │  │ createdAt: date    │   │                     │   │                     │ │ │  │
│     │  └──────────○─────────┘   └──────────○─────────┘   └──────────○─────────┘ │    │
│  │  │             │                        │                        │            │ │  │
│     │             │     ┌──────────────────┘                        │            │    │
│  │  │             │     │     ┌─────────────────────────────────────┘            │ │  │
│     │             ▼     ▼     ▼                                                  │    │
│  │  │        (Edges connect to response/request schema slots above)              │ │  │
│     │                                                                              │    │
│  │  └──────────────────────────────────────────────────────────────────────────────┘ │  │
│                                                                                          │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ Valid  │  Zoom: 100%  │  ⊞ Grid  │  🗺️ Mini-map  │  Nodes: 8  │  Export ▼    │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.5 Properties Panel (Right Side)

When a node is selected, the properties panel shows contextual configuration:

```
┌─────────────────────────────┐
│ ✕  PATH PROPERTIES          │
├─────────────────────────────┤
│                             │
│ Path Pattern                │
│ ┌─────────────────────────┐ │
│ │ /api/v1/users/{userId}  │ │
│ └─────────────────────────┘ │
│                             │
│ ─────────────────────────── │
│ PATH VARIABLES              │
│                             │
│ ┌─────────────────────────┐ │
│ │ userId                  │ │
│ │ ┌─────────────────────┐ │ │
│ │ │ Type: string      ▼ │ │ │
│ │ └─────────────────────┘ │ │
│ │ ┌─────────────────────┐ │ │
│ │ │ Format: uuid      ▼ │ │ │
│ │ └─────────────────────┘ │ │
│ │ ☑ Required              │ │
│ └─────────────────────────┘ │
│                             │
│ ─────────────────────────── │
│ METADATA                    │
│                             │
│ Summary                     │
│ ┌─────────────────────────┐ │
│ │ User management         │ │
│ └─────────────────────────┘ │
│                             │
│ Description                 │
│ ┌─────────────────────────┐ │
│ │ Endpoints for managing  │ │
│ │ individual user         │ │
│ │ accounts...             │ │
│ └─────────────────────────┘ │
│                             │
│ Tags                        │
│ ┌─────────────────────────┐ │
│ │ users ✕ │ accounts ✕    │ │
│ │ + Add tag               │ │
│ └─────────────────────────┘ │
│                             │
│ ─────────────────────────── │
│ OPTIONS                     │
│                             │
│ ☐ Deprecated                │
│ ☐ Override servers          │
│                             │
│ ─────────────────────────── │
│                             │
│ ┌─────────────────────────┐ │
│ │     🗑️ Delete Path      │ │
│ └─────────────────────────┘ │
│                             │
└─────────────────────────────┘
```

When a MethodNode is selected:

```
┌─────────────────────────────┐
│ ✕  GET OPERATION            │
├─────────────────────────────┤
│                             │
│ Operation ID                │
│ ┌─────────────────────────┐ │
│ │ getUserById             │ │
│ └─────────────────────────┘ │
│ 💡 Auto-generate            │
│                             │
│ ─────────────────────────── │
│ REQUEST                     │
│                             │
│ Parameters                  │
│ ┌─────────────────────────┐ │
│ │ + Add Query Param       │ │
│ │ + Add Header Param      │ │
│ └─────────────────────────┘ │
│                             │
│ ─────────────────────────── │
│ RESPONSES                   │
│                             │
│ ┌─────────────────────────┐ │
│ │ 200 OK              ✕   │ │
│ │   → User schema         │ │
│ ├─────────────────────────┤ │
│ │ 401 Unauthorized    ✕   │ │
│ │   → ErrorResponse       │ │
│ ├─────────────────────────┤ │
│ │ 404 Not Found       ✕   │ │
│ │   → ErrorResponse       │ │
│ ├─────────────────────────┤ │
│ │ + Add Response          │ │
│ └─────────────────────────┘ │
│                             │
│ ─────────────────────────── │
│ SECURITY                    │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🔐 bearerAuth       ✕   │ │
│ │ + Add Security          │ │
│ └─────────────────────────┘ │
│                             │
│ ─────────────────────────── │
│ DOCUMENTATION               │
│                             │
│ Summary                     │
│ ┌─────────────────────────┐ │
│ │ Get user by ID          │ │
│ └─────────────────────────┘ │
│                             │
│ Description (Markdown)      │
│ ┌─────────────────────────┐ │
│ │ Returns a single user   │ │
│ │ object by their unique  │ │
│ │ identifier.             │ │
│ │                         │ │
│ │ ## Notes                │ │
│ │ - Requires auth         │ │
│ └─────────────────────────┘ │
│ 👁️ Preview                  │
│                             │
└─────────────────────────────┘
```

### 9.6 Schema Drag-and-Drop Interaction

The key interaction for binding schemas to requests and responses:

```
STEP 1: Locate schema in Library Panel
┌─────────────────────────┐
│ ▼ SCHEMAS (from lib)    │
│   ┌───────────────────┐ │
│   │ { } User      ⬚⬚  │ │ ← Drag handle appears on hover
│   └───────────────────┘ │

STEP 2: Drag schema onto canvas or directly into drop zone
                                    ┌─────────────────────────┐
         ╭─ ─ ─ ─ ─ ─ ─ ─ ╮        │ ●━━ POST ━━━━━━━━━━━━━ │
         ┆  { } User      ┆ ───▶   ├─────────────────────────┤
         ╰─ ─ ─ ─ ─ ─ ─ ─ ╯        │ ┌─ Request ───────────┐ │
               dragging             │ │ ┌─────────────────┐ │ │
                                    │ │ │  DROP SCHEMA    │ │ │ ← Drop zone highlights
                                    │ │ │  HERE           │ │ │   when schema hovers
                                    │ │ └─────────────────┘ │ │
                                    │ └─────────────────────┘ │

STEP 3: Schema reference created with edge connection
┌─────────────────────────┐         ┌─────────────────────────┐
│ { } User            ↗️  │         │ ●━━ POST ━━━━━━━━━━━━━ │
├─────────────────────────┤         ├─────────────────────────┤
│ id: string              │         │ ┌─ Request ───────────┐ │
│ email: string           │────────▶│ │ ○ User              │ │
│ name: string            │  edge   │ │   application/json  │ │
│ ...                     │         │ └─────────────────────┘ │
└─────────────────────────┘         └─────────────────────────┘
```

### 9.7 Edge Connection Types

Different edge styles represent different relationship types:

```
Schema Reference (solid line with arrow):
┌───────────┐                    ┌─────────────┐
│ { } User  │───────────────────▶│ 200 Response│
└───────────┘                    └─────────────┘

Request Body Binding (solid blue line):
┌───────────────┐                ┌─────────────┐
│ { } CreateReq │━━━━━━━━━━━━━━━▶│ POST /users │
└───────────────┘   (required)   └─────────────┘

Optional Reference (dashed line):
┌───────────┐                    ┌─────────────┐
│ { } Opts  │┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄▶│ Query Param │
└───────────┘   (optional)       └─────────────┘

Array Wrapper (line with brackets):
┌───────────┐                    ┌─────────────┐
│ { } User  │──────[  ]─────────▶│ 200 Response│
└───────────┘   (returns array)  └─────────────┘

Polymorphic (branching lines):
┌───────────┐
│ { } Cat   │──────┐
└───────────┘      │  oneOf      ┌─────────────┐
                   ├────────────▶│ 200 Response│
┌───────────┐      │             └─────────────┘
│ { } Dog   │──────┘
└───────────┘
```

### 9.8 Canvas Controls and Navigation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  ┌─────────┐                                              ┌─────────────────┐  │
│  │ ◀ ▶ ▲ ▼ │  Pan controls                               │   MINI-MAP      │  │
│  └─────────┘                                              │  ┌───────────┐  │  │
│                                                           │  │  ▪   ▪    │  │  │
│  ┌─────────────────────────────┐                          │  │    ▪      │  │  │
│  │  ➖  100%  ➕  │ Fit │ 1:1  │  Zoom controls           │  │  ▪    ▪   │  │  │
│  └─────────────────────────────┘                          │  └───────────┘  │  │
│                                                           └─────────────────┘  │
│  KEYBOARD SHORTCUTS:                                                           │
│  ─────────────────────────────────────────────────                             │
│  Space + Drag     Pan canvas                                                   │
│  Cmd/Ctrl + Scroll    Zoom in/out                                              │
│  Cmd/Ctrl + 0     Fit to view                                                  │
│  Cmd/Ctrl + 1     Zoom to 100%                                                 │
│  Delete/Backspace Delete selected                                              │
│  Cmd/Ctrl + D     Duplicate selected                                           │
│  Cmd/Ctrl + Z     Undo                                                         │
│  Cmd/Ctrl + Shift + Z Redo                                                     │
│  Cmd/Ctrl + G     Group selected                                               │
│  Cmd/Ctrl + A     Select all                                                   │
│  Escape           Deselect all                                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.9 Context Menus

Right-click context menus provide quick actions:

```
On PathNode:                        On MethodNode:
┌─────────────────────────┐        ┌─────────────────────────┐
│ ✏️  Edit Path            │        │ ✏️  Edit Operation       │
│ 📋 Duplicate             │        │ 📋 Duplicate             │
├─────────────────────────┤        ├─────────────────────────┤
│ ➕ Add GET               │        │ ➕ Add Response          │
│ ➕ Add POST              │        │ ➕ Add Parameter         │
│ ➕ Add PUT               │        │ 🔐 Add Security          │
│ ➕ Add DELETE            │        ├─────────────────────────┤
├─────────────────────────┤        │ 🧪 Test in Swagger       │
│ 📦 Generate All CRUD    │        │ 📄 Copy as cURL          │
├─────────────────────────┤        ├─────────────────────────┤
│ ⚠️  Mark Deprecated      │        │ ⚠️  Mark Deprecated      │
│ 🗑️  Delete               │        │ 🗑️  Delete               │
└─────────────────────────┘        └─────────────────────────┘

On SchemaRefNode:                   On Canvas (empty area):
┌─────────────────────────┐        ┌─────────────────────────┐
│ ↗️  Open in Schema Editor│        │ ➕ Add Path              │
│ 📋 Duplicate Reference   │        │ 📋 Paste                 │
├─────────────────────────┤        ├─────────────────────────┤
│ [ ] Wrap as Array       │        │ ⊞  Toggle Grid           │
│ { } Use as Partial      │        │ 🔄 Auto-arrange          │
├─────────────────────────┤        │ 🎯 Fit to View           │
│ 🔗 Disconnect            │        ├─────────────────────────┤
│ 🗑️  Remove from Canvas   │        │ 📥 Import from OpenAPI   │
└─────────────────────────┘        │ 📤 Export Selection      │
                                   └─────────────────────────┘
```

### 9.10 Visual States

Nodes display different visual states for user feedback:

```
DEFAULT STATE:                      SELECTED STATE:
┌─────────────────────────┐        ┌─────────────────────────┐
│ ○ PATH                  │        │ ○ PATH              ⬚⬚ │ ← Resize handles
├─────────────────────────┤        ╔═════════════════════════╗ ← Blue border
│ /api/v1/users           │        ║ /api/v1/users           ║
└─────────────────────────┘        ╚═════════════════════════╝

HOVER STATE:                        ERROR STATE:
┌─────────────────────────┐        ┌─────────────────────────┐
│ ○ PATH              ═══ │ ← Drag │ ○ PATH              ⚠️  │ ← Error indicator
├─────────────────────────┤   grab ╔═════════════════════════╗ ← Red border
│ /api/v1/users           │ handle ║ /api/v1/users/{         ║ ← Invalid syntax
└─────────────────────────┘        ║ Missing closing brace   ║ ← Error tooltip
                                   ╚═════════════════════════╝

CONNECTING STATE:                   DEPRECATED STATE:
┌─────────────────────────┐        ┌─────────────────────────┐
│ { } User                │        │ ○ PATH              ⚠️  │
├─────────────────────────┤        ├─────────────────────────┤
│ id: string              │        │ /api/v1/legacy/users    │ ← Strikethrough
│ email: string       ◉───┼───▶    │ ░░░░░░░░░░░░░░░░░░░░░░░ │ ← Dimmed/grayed
└─────────────────────────┘        └─────────────────────────┘
        Active connection handle

DROP TARGET STATE:
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  ┌─────────────────────┐   ← Dashed highlight
│ │   DROP SCHEMA HERE  │ │   appears when dragging
  │   { } ───────────▶  │     compatible node type
│ └─────────────────────┘ │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

### 9.11 Tasks: Visual Design Implementation

#### Core Visual Tasks

- [ ] Implement three-panel Studio layout with collapsible side panels
- [ ] Create Library Panel with collapsible sections and drag handles
- [ ] Design PathNode component with header, body, and footer zones
- [ ] Design MethodNode components with HTTP verb color coding
- [ ] Design SchemaRefNode with property preview and modifier toggles
- [ ] Design ParameterNode chips for query, header, cookie, path types
- [ ] Design ResponseNode with status code color bands
- [ ] Implement Properties Panel with contextual forms per node type
- [ ] Create edge styles for different relationship types
- [ ] Implement canvas controls (zoom, pan, fit, minimap)

#### Advanced Visual Tasks

- [ ] Add node resize handles with minimum size constraints
- [ ] Implement multi-select visual feedback (selection rectangle)
- [ ] Create context menus for all node types
- [ ] Design visual states: default, hover, selected, error, deprecated
- [ ] Implement drop zone highlighting during drag operations
- [ ] Add keyboard shortcut overlay (triggered by `?` key)
- [ ] Create loading/saving state indicators
- [ ] Design validation error tooltips with inline positioning
- [ ] Implement dark mode color scheme for all node types
- [ ] Add animation for edge connections and node transitions

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

Establish the core infrastructure for path design with essential node types and basic canvas functionality.

- [ ] Create PathsDesigner component with React Flow integration
- [ ] Implement PathNode, MethodNode, and SchemaRefNode components
- [ ] Build database tables: `obj_paths`, `obj_path_operations`, `obj_path_parameters`
- [ ] Create node library panel with drag-and-drop functionality
- [ ] Implement basic path variable detection and configuration
- [ ] Add canvas state persistence (positions, viewport)
- [ ] Integrate with existing project version system

### Phase 2: Request/Response (Weeks 5-8)

Complete the request/response design capabilities with full parameter and content type support.

- [ ] Implement RequestBodyNode and ResponseNode components
- [ ] Build ParameterNode for query, header, cookie, and path parameters
- [ ] Create content type management with schema binding
- [ ] Add response status code library with presets
- [ ] Implement configuration panels for all node types
- [ ] Add undo/redo functionality with history stack
- [ ] Build OpenAPI export with paths integration

### Phase 3: Testing & Validation (Weeks 9-12)

Integrate testing capabilities and specification validation for developer productivity.

- [ ] Embed Swagger UI panel with real-time spec sync
- [ ] Implement OpenAPI 3.1 validation with inline error markers
- [ ] Add Try It Out functionality with environment support
- [ ] Create auto-generation from schemas (CRUD endpoints)
- [ ] Build security scheme library and assignment
- [ ] Add request/response logging with history
- [ ] Implement pattern libraries for common API patterns

---

## 11. Success Metrics

The Paths Designer implementation will be measured against the following criteria:

- **Time to Define**: Reduction in time to define a complete API endpoint from schema to tested operation
- **Compliance Score**: Improvement in OpenAPI specification compliance scores across user projects
- **Adoption Rate**: Usage of auto-generation features for CRUD endpoint creation
- **Developer Satisfaction**: Usability testing session scores and feedback

---

## Task Summary by Priority

### Immediate (Phase 1 - Weeks 1-4)

| Category | Task | Priority |
|----------|------|----------|
| Architecture | PathsDesigner component with React Flow | Critical |
| Architecture | PathNode component | Critical |
| Architecture | MethodNode component | Critical |
| Architecture | SchemaRefNode component | Critical |
| Architecture | Edge connections | Critical |
| Visual Design | Three-panel Studio layout | Critical |
| Visual Design | Library Panel with collapsible sections | Critical |
| Visual Design | PathNode visual design with zones | Critical |
| Visual Design | MethodNode HTTP verb color coding | Critical |
| Visual Design | Properties Panel contextual forms | Critical |
| Database | `obj_paths` table | Critical |
| Database | `obj_path_operations` table | Critical |
| Database | `obj_path_parameters` table | Critical |
| UI | Node library panel | Critical |
| UI | Drag-and-drop functionality | Critical |
| Paths | Path variable detection | Critical |
| Paths | Inline variable editor | High |
| Visual Design | SchemaRefNode with property preview | High |
| Visual Design | ParameterNode chip designs | High |
| Visual Design | ResponseNode status code colors | High |
| Visual Design | Edge styles for relationship types | High |
| Visual Design | Canvas controls (zoom, pan, minimap) | High |
| State | Canvas position persistence | High |
| State | Viewport state persistence | High |
| Integration | Project version linking | High |

### Short-Term (Phase 2 - Weeks 5-8)

| Category | Task | Priority |
|----------|------|----------|
| Nodes | RequestBodyNode component | Critical |
| Nodes | ResponseNode component | Critical |
| Nodes | ParameterNode component | Critical |
| Database | `obj_request_bodies` table | Critical |
| Database | `obj_responses` table | Critical |
| Content | Content type management | Critical |
| Content | Schema binding per content type | High |
| UI | Status code library | High |
| UI | Configuration panels | High |
| Visual Design | Drop zone highlighting | High |
| Visual Design | Node visual states (hover, selected, error) | High |
| Visual Design | Context menus for all node types | High |
| State | Undo/redo history | High |
| Export | OpenAPI paths export | Critical |

### Medium-Term (Phase 3 - Weeks 9-12)

| Category | Task | Priority |
|----------|------|----------|
| Testing | Swagger UI integration | Critical |
| Testing | Real-time spec sync | Critical |
| Testing | Try It Out functionality | High |
| Validation | OpenAPI 3.1 validation | Critical |
| Validation | Inline error markers | High |
| Generation | CRUD endpoint generation | High |
| Security | Security scheme library | High |
| Visual Design | Multi-select visual feedback | Medium |
| Visual Design | Keyboard shortcut overlay | Medium |
| Visual Design | Validation error tooltips | Medium |
| Logging | Request/response history | Medium |
| Patterns | Pattern library | Medium |

### Future (Post-Phase 3)

| Category | Task | Priority |
|----------|------|----------|
| Nodes | OperationGroupNode | Medium |
| Nodes | SecurityNode | Medium |
| Nodes | CallbackNode | Low |
| Nodes | LinkNode | Low |
| Database | `obj_callbacks` table | Low |
| Database | `obj_links` table | Low |
| Visual Design | Dark mode color scheme | Medium |
| Visual Design | Node resize handles | Medium |
| Visual Design | Animation for connections | Low |
| Visual Design | Custom edge types (animated) | Low |
| Enterprise | Approval workflows | Medium |
| Enterprise | API governance policies | Medium |
| Gateway | Rate limiting extensions | Medium |
| Gateway | Kong/AWS/Azure export | Low |
| Testing | Mock server generation | Medium |
| Testing | Pact contract generation | Low |
| Generation | Custom templates | Medium |
| Generation | Git integration | Low |

---

*This roadmap positions Objectified UI as a comprehensive visual API design platform,
bridging the gap between schema definition and full OpenAPI specification authoring while
maintaining the visual, developer-centric design philosophy established in the schema designer.*