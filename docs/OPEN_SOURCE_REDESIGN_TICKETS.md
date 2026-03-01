# Open Source Redesign: Canvas & Dashboard Roadmap

> Roadmap for redesigning the Objectified application into a community-maintained Open Source version. Scope: **canvas and dashboard only**. The UI uses **REST only** (no `lib/db/helper`); version edits are **local-first** (browser → commit → push); **pull/merge** with conflict resolution; versions stored **historically** for rollback, remove, and branch.
>
> **Last Updated**: February 28, 2026  
> **Version**: 1.0 – Canvas & Dashboard Open Source Redesign

---

## Design Principles

- **REST-only UI**: All data operations via REST (objectified-rest or equivalent); no direct DB or helper usage from UI.
- **OpenAPI 3.2.0 & JSON Schema 2020-12**: Full spec coverage for schema and property/class authoring.
- **Local-first version workflow**: Edits in memory/local storage → commit → push; pull/merge with visual conflict resolution.
- **Version history**: DB stores version history; support rollback, remove, and branch.

**Data model (in scope):** User, Tenant, User–Tenant, Tenant administrators, Project, Version (with history), Class, Property, Class–Property join; forms for properties and classes per OpenAPI 3.2.0 / JSON Schema 2020-12.

---

## REST API Foundation

> **Section Status**: Implement in objectified-rest (or equivalent OSS service). No UI in these tickets.

### Users, Tenants, and Auth (Ticket 1)

**Core data model & authentication**
- Implement REST routes for **users**: list (admin), get by id, create (signup), update, deactivate (no hard delete if audit needed).
- Implement **tenants**: list (for current user), get, create, update, delete; enforce slug uniqueness per tenant.
- Implement **user–tenant**: list members for a tenant, add member (by user id or email), remove member, optional role field.
- Implement **tenant administrators**: list, add, remove; only admins can manage tenant and members.
- **Auth**: Login (issue JWT); API key create/revoke per tenant; middleware that attaches `user_id` and `tenant_id` (when applicable) to requests. Support JWT in `Authorization: Bearer` and API key in `X-API-Key`.
- **DB**: Tables/schema for users, tenants, user_tenants, tenant_administrators; migrations as needed.
- **Reference**: Extend `objectified-rest/src/app/auth.py` and add routes under `/v1/users`, `/v1/tenants`, `/v1/tenants/{id}/members`, `/v1/tenants/{id}/administrators`. Document in OpenAPI.

| Ticket | Feature Description |
|--------|---------------------|
| #13    | Create the scaffolding for the REST services, only the class representations in the #/definitions/schemas |
| #15    | Create user services |
| #16    | Create tenant services |
| #17    | Create user-tenant services |

---

### Projects & Versions with History (Ticket 2)

**Projects and versioned schema with historical storage**
- **Projects**: Create, list by tenant, get, update, delete; tenant-scoped; creator tracking; slug/name uniqueness per tenant.
- **Versions**: Create (optional `source_version_id` for branch), list by project, get by id, update metadata (description, changelog), delete. Project-scoped.
- **Version history**: Store each committed version state (e.g. `version_snapshots` or `version_commits` table) with reference to classes/properties at that point. Support “list revisions for version” and “get version at revision”.
- **Publish**: Publish/unpublish/freeze-schema endpoints; only published versions visible for pull by others (define policy).
- **DB**: projects table; versions table; version_history or version_snapshots table for rollback and branch.
- **Reference**: `objectified-rest/src/app/projects_routes.py`, `versions_routes.py`; add history tables and `/v1/versions/{id}/history`, get-by-revision.

| Ticket | Feature Description |
|--------|---------------------|
| #2     | REST API: Projects CRUD; versions CRUD with historical storage; publish/unpublish/freeze-schema. |

---

### Classes, Properties, Class-Property (Ticket 3)

**Schema entities and bulk read for canvas**
- **Classes**: Create, list by version, get, update (metadata + `canvas_metadata`: position, dimensions, style, group), delete. Version-scoped.
- **Bulk**: Endpoint to get all classes for a version with properties (and tags if kept) in one response for canvas load.
- **Properties**: Create, list by project, get, update, delete; `data` JSON holds schema (OpenAPI/JSON Schema). Project-scoped (reusable library).
- **Class-property**: Add property to class, reorder, update overrides (e.g. required, description), remove; support `parent_id` for nested properties. Endpoints: add to class, update join row, remove from class, list by class.
- **DB**: classes, properties, class_properties tables; indexes for version_id, project_id, class_id.
- **Reference**: `objectified-rest/src/app/classes_routes.py`, `properties_routes.py`, `get_classes_with_properties_and_tags_for_version` in database layer.

| Ticket | Feature Description |
|--------|---------------------|
| #3     | REST API: Classes and properties CRUD; class-property join; bulk “classes for version with properties”. |

---

### OpenAPI 3.2.0 & JSON Schema 2020-12 (Ticket 4)

**Validation, export, and import**
- **Validation**: On create/update of class or property, validate `schema`/`data` against OpenAPI 3.2.0 schema object and JSON Schema 2020-12; return 400 with error details if invalid.
- **Export**: Endpoints to export a version as OpenAPI 3.2.0 document and as JSON Schema 2020-12 document (single or multi-schema). Reuse/extend `openapi_generator` and `jsonschema_generator` to 3.2.0 and 2020-12.
- **Import**: Import OpenAPI 3.2.0 or JSON Schema 2020-12; create/update classes and properties; conflict handling can be deferred to merge (Ticket 5).
- **Docs**: Document which keywords and features are supported (full coverage statement and any exclusions).
- **Reference**: `objectified-ui/src/app/utils/openapi.ts`, `jsonschema.ts`; objectified-rest generators; `lib/db/import-helper.ts`, importers.

| Ticket | Feature Description |
|--------|---------------------|
| #4     | REST API: Validate class/property schema (OpenAPI 3.2.0 + JSON Schema 2020-12); export and import. |

---

### Version Commit, Push, Pull, Merge (Ticket 5)

**Git-like version workflow APIs**
- **Commit**: Endpoint that accepts full version payload (classes, properties, class_properties, canvas_metadata) and writes to DB and version history; returns new revision id.
- **Push**: Client sends committed state; server overwrites (or merges) working version and appends to history; returns success and revision id.
- **Pull**: Get version state (latest or by revision); optionally return “since revision” diff.
- **Merge**: Input base revision, “ours” state, “theirs” state (or server current). Output: merged state plus list of conflicts (e.g. class/property modified in both). Conflict entries: path, description, suggested resolution. Optional endpoint to submit resolution choices and return merged state.
- **DB**: Ensure version_history stores full or delta snapshots so pull and merge are implementable.
- **Reference**: New routes e.g. `POST /v1/versions/{id}/commit`, `POST /v1/versions/{id}/push`, `GET /v1/versions/{id}/pull`, `POST /v1/versions/{id}/merge`. Use `objectified-ui/src/app/utils/schema-merge.ts` and ClassImportDialog merge logic for conflict semantics.

| Ticket | Feature Description |
|--------|---------------------|
| #5     | REST API: Version commit, push, pull, merge and conflict detection. |

---

## UI: REST-Only (No Helpers)

> **Section Status**: All canvas and dashboard code must call REST only; no `lib/db/helper` or server-side DB access from UI.

### Remove Helpers and Introduce REST Client (Ticket 6)

**Replace all helper usage with REST client**
- **Audit**: List every use of `lib/db/helper` and `lib/db/helper-*` in canvas and dashboard (grep `@lib/db/helper` and helper imports).
- **REST client**: Implement or extend client that wraps fetch for tenants, projects, versions (CRUD + publish/unpublish), classes, properties, class-properties (CRUD + bulk), and commit/push/pull/merge. Auth: send JWT or API key per objectified-rest contract.
- **Replace**: For each call site in dashboard (stats, recent activity, projects, versions), studio/editor, sidebar, and forms, use REST client or Next.js API route that only proxies to objectified-rest with session. No direct DB or helper usage.
- **Next.js API routes**: Either remove and call objectified-rest directly from client, or keep thin proxy routes that add session and forward to objectified-rest.
- **Cleanup**: Remove or archive helper modules used only by canvas/dashboard; fix tests and build.
- **Reference**: `objectified-ui/lib/api/rest-client.ts`, `paths-client.ts`; dashboard pages; `editor/page.tsx`; StudioSideNav; ClassEditDialog, PropertyDialog, ClassPropertyEditDialog.

| Ticket | Feature Description |
|--------|---------------------|
| #6     | UI: Remove all lib/db/helper usage; replace with REST client; fix tests and build. |

---

## UI: Dashboard

> **Section Status**: Dashboard layout and all list/manage pages use REST only.

### Dashboard Shell & Navigation (Ticket 7)

**Layout, nav, theme, routes**
- **Layout**: Main content area and responsive shell; sidebar with links to Dashboard home, Projects, Versions, Tenants, Users (if admin), Profile. Active state and responsive behavior.
- **Theme**: Use existing theme provider and system preference for light/dark; ensure all dashboard pages respect it. Theme selector in header if desired.
- **Routes**: `/dashboard`, `/dashboard/projects`, `/dashboard/versions`, `/dashboard/tenants`, `/dashboard/users`, `/dashboard/profile`. Placeholder pages OK until Tickets 8/9.
- **Reference**: `objectified-ui/src/app/ade/dashboard/layout.tsx`, `DashboardSideNav.tsx`; ThemeSelector, ThemeRegistry.

| Ticket | Feature Description |
|--------|---------------------|
| #7     | UI: Dashboard layout, side nav, theme (light/dark), routing. |

---

### Users, Tenants, Tenant-Admins (Ticket 8)

**User and tenant management via REST**
- **Users**: List (admin only), create (signup), edit, deactivate; all via REST users API.
- **Tenants**: List (current user’s tenants), create, edit, delete; slug; REST tenants API. Reference: `objectified-ui/src/app/ade/dashboard/tenants/page.tsx`.
- **User–tenant**: Per tenant, list members, add member (by user id or email), remove member, optional role; REST members API.
- **Tenant administrators**: List, add, remove; only tenant admins see this; REST tenant-admins API.
- **Permissions**: Show/hide sections by role (admin vs tenant-admin vs member); handle 403 from API.
- **Reference**: New or refactored pages under dashboard: users, tenants, tenant members, tenant administrators; shared tables, forms, confirm dialogs; Radix UI and Tailwind.

| Ticket | Feature Description |
|--------|---------------------|
| #8     | UI: Dashboard – Users list, Tenants list/create/edit, members, tenant-admins; REST only; permission guards. |

---

### Projects & Versions List (Ticket 9)

**Projects and versions CRUD and publish**
- **Projects**: List by tenant via REST; create project dialog (name, slug, description, metadata); edit dialog; delete / permanent delete; dropdown actions. Reference: `objectified-ui/src/app/ade/dashboard/projects/page.tsx`.
- **Import**: Optional import project from OpenAPI/URL; call REST import if available. Reference: OpenAPIImportDialog, ImportDialog.
- **Versions**: List by project via REST; create version dialog (version_id, description, changelog, copy from for branch); edit; delete. Reference: `objectified-ui/src/app/ade/dashboard/versions/page.tsx`.
- **Publish**: Publish dialog (visibility); unpublish; freeze-schema; all via REST.
- **Published**: List published versions; link to open in Studio. Reference: `published/page.tsx`.
- **Optional**: Version diff view; relationship graph dialog (RelationshipGraphDialog, compareSchemas). Primitives list/create/edit/import if in OSS scope (PrimitivesManagementClient, PrimitiveEditorDialog).

| Ticket | Feature Description |
|--------|---------------------|
| #9     | UI: Dashboard – Projects and versions list, create/edit/delete, publish, published list; REST only. |

---

## UI: Local-First Version & Workflow

> **Section Status**: Version edits live in browser until commit; push/pull/merge with conflict resolution.

### Local Version State & Undo/Redo (Ticket 10)

**In-browser version state and undo stack**
- **State shape**: Single source of truth: versionId, classes[], properties[], class_properties[] (order and overrides), canvas_metadata per class, groups. Reference: StudioContext, editor types.
- **Load**: On “Open in Studio”, call REST get (or pull) for version; hydrate local state and canvas/sidebar. Reference: editor/page.tsx initial load.
- **Mutations**: Add/update/delete class, add/update/remove class-property, reorder; all update local state only (no REST per edit). Canvas metadata (position, dimensions, style, group) updated on drag/resize/group; persist in local state (saveDefaultCanvasLayout/getDefaultCanvasLayout pattern).
- **Undo stack**: Push previous state on each mutation; max depth (e.g. 50). Undo/redo: pop and apply; clear stack on commit or discard.
- **Optional**: localStorage backup keyed by versionId; clear on successful push.

| Ticket | Feature Description |
|--------|---------------------|
| #10    | UI: Local version state (classes, properties, canvas_metadata, groups); load from REST; undo/redo in-memory; optional localStorage backup. |

---

### Commit, Push, Pull, Merge Workflow (Ticket 11)

**Toolbar actions and conflict resolution**
- **Toolbar/menu**: Commit (snapshot local state, optional message; reset undo or keep one pre-commit); Push; Pull; Merge (enabled when pull indicates diverged or conflicts). Reference: EditorToolbar, StudioHeader.
- **Commit**: Persist “last committed” locally; after Push, clear dirty and optionally undo stack.
- **Push**: Call REST push with committed (or current) state; on 409 (newer on server), suggest Pull then Merge.
- **Pull**: Call REST pull; if local dirty, block or offer stash/discard; replace or merge local state with server response.
- **Merge UI**: List conflicts (class/property, path, description); “Use mine” / “Use theirs” / “Edit manually” per conflict; apply resolution and update local state; allow Push. Reference: ClassImportDialog conflict resolution patterns.
- **Indicators**: Dirty, unpushed commits, “server has new changes”.

| Ticket | Feature Description |
|--------|---------------------|
| #11    | UI: Commit, Push, Pull, Merge in toolbar; conflict list and resolution; dirty/unpushed indicators. |

---

### Version History – Rollback, Remove, Branch (Ticket 12)

**History panel and version actions**
- **History panel**: List revisions (id, timestamp, optional message) via REST; show in dashboard or Studio.
- **Load revision**: Replace local state with chosen revision (read-only or editable in Studio).
- **Rollback (server)**: Set version state to chosen revision; append to history; call REST.
- **Branch**: Dialog for new version name/id; REST create version from source revision; open new version in Studio. Reference: versions page “copy from”.
- **Remove**: Confirm; REST delete version (or revision); redirect to versions list.

| Ticket | Feature Description |
|--------|---------------------|
| #12    | UI: Version history list; load revision; rollback; branch from revision; remove version. |

---

## UI: Schema Canvas (Class Diagram)

> **Section Status**: React Flow canvas; all data from local version state; no per-move REST.

### Canvas Container & Selectors (Ticket 13a)

**Project/version selector and canvas shell**
- **Project/version selector**: In toolbar; load projects and versions via REST; on switch, reload local state and canvas. Reference: EditorToolbar project/version Select.
- **React Flow**: Background, Controls, MiniMap; viewport persistence. Reference: editor/page.tsx ReactFlow, Background, Controls.
- **Read-only**: When version is published, set read-only (no add/delete/edit). Reference: isReadOnly from version.published.

| Ticket | Feature Description |
|--------|---------------------|
| #13a   | UI: Project/version selector; React Flow canvas shell; read-only when published. |

---

### Class Nodes & Edges (Ticket 13b)

**Nodes and edges from local state**
- **Class nodes**: Render from local state; position, dimensions, style from canvas_metadata. Reference: ClassNode.tsx, NodeData.
- **Class node**: Expand/collapse properties; theme (backgroundColor, border, icon); double-click opens class form. Reference: ClassNode.
- **Edges**: Refs between classes; style by type (direct/optional/weak/bidirectional). Reference: SmartEdge.tsx, EdgeWithWideHit.tsx, edge-styling.
- **Interactions**: Node drag/resize; single and multi selection; pan/zoom. Reference: useNodesState, onNodesChange.

| Ticket | Feature Description |
|--------|---------------------|
| #13b   | UI: Class nodes (position, theme, expand); edges by ref type; drag/resize/selection. |

---

### Groups (Ticket 13c)

**Group nodes and class membership**
- **Create group**: From toolbar or at drop position; add/remove class nodes; rename, color, style. Reference: GroupNode.tsx, handleCreateGroup, handleCreateGroupAtPosition.
- **Delete**: Delete group; “delete all classes in group” with confirm. Reference: handleDeleteAllClassesInGroup.

| Ticket | Feature Description |
|--------|---------------------|
| #13c   | UI: Group nodes – create, add/remove nodes, rename/color/style; delete group or delete all classes in group. |

---

### Canvas Search & Focus (Ticket 13d)

**Search and focus mode**
- **Canvas search**: Query input; regex toggle; filters: type (class/allOf/oneOf/anyOf), group, has properties, property name. Reference: canvasSearchQuery, searchFilterType, searchFilterGroup.
- **Search history**: Add on close; list, remove, clear (localStorage). Reference: useSearchHistory.ts, CanvasSettingsDialog.
- **Focus mode**: Selection plus N-degree neighbors; “Focus on group”; exit on Esc. Reference: focusModeEnabled, focusModeDegree, focusOnGroup.

| Ticket | Feature Description |
|--------|---------------------|
| #13d   | UI: Canvas search (query, regex, filters); search history; focus mode (selection+neighbors, focus on group). |

---

### Layout & Dependency (Ticket 13e)

**Layout and dependency overlay**
- **Layout**: Save default layout (per version/user); load default on version load. Auto-layout (e.g. dagre); layout preview then apply. Reference: saveDefaultCanvasLayout, getDefaultCanvasLayout, canvas-auto-layout.ts, layoutPreviewNodes.
- **Layout quality**: Optional hints (edge crossings, spacing). Reference: layout-quality.ts, canvasSuggestions.
- **Dependency overlay**: Upstream/downstream/path from selected node; circular ref warning. Reference: schema-metrics, getCircularDependencyEdgeIds, dependencyView.
- **Schema metrics panel**: Optional (depth, circular, affected count). Reference: SchemaMetricsPanel.

| Ticket | Feature Description |
|--------|---------------------|
| #13e   | UI: Save/load default layout; auto-layout with preview; dependency overlay; optional schema metrics panel. |

---

### Export & Canvas Settings (Ticket 13f)

**Export and settings dialog**
- **Export**: PNG, SVG, JPEG, PDF, Mermaid, PlantUML, DOT, GraphML, JSON. Reference: useExportFunctions, EditorToolbar.
- **Export Wizard**: Format options, include groups, background; capture and download. Reference: ExportWizard.
- **Canvas settings**: Grid (size, style, snap, visible); background (solid/grid/image/gradient/texture); edge styling (style type, color, arrow per ref type); routing (straight/bezier/orthogonal/smart); animation; search history management. Reference: CanvasSettingsDialog.tsx, StudioContext edgeStyling.

| Ticket | Feature Description |
|--------|---------------------|
| #13f   | UI: Export (formats + Export Wizard); canvas settings (grid, background, edges, search history). |

---

### Class Actions & Sidebar (Ticket 13g)

**Add/delete/copy/reference and sidebar**
- **Add class**: Toolbar or context menu; create in local state; place on canvas.
- **Delete class**: Single or multi-select; confirm; remove from local state and canvas. Reference: handleDelete, deleteClassWithSession pattern.
- **Copy / Paste / Duplicate**: Classes (and optional refs) in local state.
- **Create reference**: From property to class (edge); update local state (class-property $ref). Reference: handleCreateReference.
- **Sidebar**: Classes tab (list, search, add, edit, delete, select → zoom); Properties tab (list project properties; add, edit, delete; select → highlight on canvas); Groups tab (list groups; select → focus on group; delete group / delete all classes). Load from local state. Reference: StudioSideNav.tsx.
- **Tag manager**: Assign/remove tags to class; list tags for project; load/save via REST or local state. Reference: TagManager, ClassEditDialog tags.

| Ticket | Feature Description |
|--------|---------------------|
| #13g   | UI: Add/delete/copy/paste/duplicate class; create reference; sidebar (Classes, Properties, Groups); tag manager. |

---

## UI: Class & Property Forms

> **Section Status**: Forms drive local state (or REST on submit); 100% OpenAPI 3.2.0 / JSON Schema 2020-12 coverage for in-scope subset.

### Class Form (Ticket 14a)

**Class edit dialog and schema**
- **Class edit dialog**: Name, description; open from canvas double-click or sidebar. Reference: ClassEditDialog.tsx.
- **Schema extensions**: OpenAPI 3.2.0 / JSON Schema 2020-12 (e.g. discriminator, externalDocs).
- **Tags**: Assign, remove; tag list for project. Reference: assignTagToClass, removeTagFromClass, getTagsForClass.

| Ticket | Feature Description |
|--------|---------------------|
| #14a   | UI: Class edit dialog – name, description, schema extensions, tags. |

---

### Property Form – Core & Types (Ticket 14b)

**Property dialog and type-specific fields**
- **Property dialog**: Create/edit; name, type (string/number/integer/boolean/object/array/null), description, required. Reference: PropertyDialog.tsx, PropertyFormFields.tsx.
- **$ref selector**: Link to class or library property; store in property data. Reference: PropertyFormFields, PrimitiveSelector.
- **String**: format, pattern, minLength, maxLength, enum, default, example. Reference: stringConstraints.
- **Number/integer**: format (int32/int64, float/double); minimum, maximum, exclusiveMin/Max, multipleOf; enum, default. Reference: numberConstraints.
- **Array**: items schema, minItems, maxItems, uniqueItems; prefixItems (tuple); contains, minContains, maxContains. Reference: arrayConstraints, tupleMode.
- **Object**: properties, required, additionalProperties, patternProperties, unevaluatedProperties. Reference: objectConstraints.

| Ticket | Feature Description |
|--------|---------------------|
| #14b   | UI: Property dialog – name, type, $ref; string/number/array/object constraints per OpenAPI 3.2.0 / JSON Schema 2020-12. |

---

### Property Form – Metadata & Class-Property (Ticket 14c)

**Metadata, conditionals, extensions, class-property overrides**
- **Metadata**: readOnly, writeOnly, deprecated, nullable, title; default; examples (array). Reference: propertyFlags, values section.
- **Conditional schema**: if/then/else, dependentSchemas (JSON Schema 2020-12). Reference: ConditionalSchemaBuilder.
- **Extensions**: x-*; XML (attribute, wrapped). Reference: ExtensionsEditor, xmlAttribute, xmlWrapped.
- **Class-property edit**: Override required, description; order; nested parent_id. Reference: ClassPropertyEditDialog.
- **Validation**: Client-side validation (same rules as REST); call REST validate on submit; show errors.

| Ticket | Feature Description |
|--------|---------------------|
| #14c   | UI: Property metadata, conditionals, extensions; class-property overrides; validation (client + REST). |

---

## UI: Paths Canvas (Optional)

> **Section Status**: In scope for OSS or document as future work.

### Paths Canvas (Ticket 15)

**API paths canvas or future work**
- **If in scope**: Paths list; path nodes; operation nodes (GET/POST/etc.); parameter and request/response body nodes; link to schema (class). Load/save via REST or local state. Reference: PathsCanvasView.tsx, PathsSidebar, PathParameterNode, PathRequestBodyNode, PathResponseNode.
- **Panels**: Operation/parameter/response property panels; schema builder for request/response. Reference: OperationPropertiesPanel, ParameterPropertiesPanel, ResponsePropertiesPanel, SchemaBuilder. Servers panel; security schemes panel if in scope. Reference: ServersPanel, SecuritySchemesPanel.
- **If out of scope**: Document Paths canvas as future work; exclude from OSS build.

| Ticket | Feature Description |
|--------|---------------------|
| #15    | UI: Paths canvas (paths, operations, params, request/response, panels) – or document as future work. |

---

## Docs & Community

### Documentation and Release (Ticket 16)

**README, CONTRIBUTING, API docs, release**
- **README**: Project overview; how to run UI and REST service; env vars; link to API docs and schema coverage.
- **CONTRIBUTING**: Dev setup; code style; how to run tests; PR process; architecture summary (REST-only UI, local-first versions).
- **API docs**: OpenAPI 3.2.0 export of objectified-rest; Redoc or Swagger UI; document commit/push/pull/merge and conflict format.
- **Changelog and release**: Versioning (e.g. semver); changelog; statement of stable surface (REST API, dashboard, canvas).

| Ticket | Feature Description |
|--------|---------------------|
| #16    | Docs: README, CONTRIBUTING, API docs, changelog and release process. |

---

## Dependency Order

- **REST**: 1 → 2 → 3 → 4 → 5 (5 depends on 2 for version history).
- **UI**: 6 after 5; 7 after 6; 8, 9 after 7; 10 after 6 and 9; 11 after 5 and 10; 12 after 5 and 6; 13a–13g after 10 and 3; 14a–14c after 10 and 4; 15 optional after 10 and paths REST; 16 any time.

---

## Current Code References

| Area | Reference |
|------|-----------|
| Dashboard | `objectified-ui/src/app/ade/dashboard/**`, `DashboardSideNav.tsx` |
| Studio/editor | `objectified-ui/src/app/ade/studio/editor/page.tsx`, `EditorToolbar.tsx`, `StudioContext.tsx` |
| Canvas nodes/edges | `ClassNode.tsx`, `GroupNode.tsx`, `SmartEdge.tsx`, `EdgeWithWideHit.tsx` |
| Sidebar | `StudioSideNav.tsx` |
| Forms | `ClassEditDialog.tsx`, `PropertyDialog.tsx`, `PropertyFormFields.tsx`, `ClassPropertyEditDialog.tsx` |
| Utils | `openapi.ts`, `jsonschema.ts`, `schema-merge.ts`, `canvas-auto-layout.ts`, `edge-styling.ts` |
| REST client | `lib/api/rest-client.ts`, `paths-client.ts` |
| objectified-rest | `src/app/*_routes.py`, `database.py`, `auth.py` |

---

**Document Version**: 1.0  
**Last Updated**: February 28, 2026  
**Next Review**: Before OSS release  
**Purpose**: Single-step tasks with enough detail to drive an LLM/Agent to implement each feature.
