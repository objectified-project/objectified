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

## 1. REST API Foundation

> **Section Status**: Implement in objectified-rest (or equivalent OSS service). No UI in these tickets.

### 1.1 Users, Tenants, and Auth

**Core data model & authentication**
- Implement REST routes for **users**: list (admin), get by id, create (signup), update, deactivate (no hard delete if audit needed).
- Implement **tenants**: list (for current user), get, create, update, delete; enforce slug uniqueness per tenant.
- Implement **user–tenant**: list members for a tenant, add member (by user id or email), remove member, optional role field.
- Implement **tenant administrators**: list, add, remove; only admins can manage tenant and members.
- **Auth**: Login (issue JWT); API key create/revoke per tenant; middleware that attaches `user_id` and `tenant_id` (when applicable) to requests. Support JWT in `Authorization: Bearer` and API key in `X-API-Key`.
- [DONE] **DB**: Tables/schema for users, tenants, user_tenants, tenant_administrators; migrations as needed.
- **Reference**: Extend `objectified-rest/src/app/auth.py` and add routes under `/v1/users`, `/v1/tenants`, `/v1/tenants/{id}/members`, `/v1/tenants/{id}/administrators`. Document in OpenAPI.

| Ticket | Feature Description |
|--------|---------------------|
| #13    | Create the scaffolding for the REST services, only the class representations in the #/definitions/schemas |
| #15    | Create user services |
| #16    | Create tenant services |
| #17    | Create user-tenant services |
| #18    | Create tenant administration services |
| #19    | Create authentication services |
| #20    | Create routes and document in OpenAPI Specification file |

---

### 1.2 Projects & Versions with History

**Projects and versioned schema with historical storage**
- **Projects**: Create, list by tenant, get, update, delete; tenant-scoped; creator tracking; slug/name uniqueness per tenant.
- **Versions**: Create (optional `source_version_id` for branch), list by project, get by id, update metadata (description, changelog), delete. Project-scoped.
- **Version history**: Store each committed version state (e.g. `version_snapshots` or `version_commits` table) with reference to classes/properties at that point. Support “list revisions for version” and “get version at revision”.
- **Publish**: Publish/unpublish/freeze-schema endpoints; only published versions visible for pull by others (define policy).
- [DONE] **DB**: projects table; versions table; version_history or version_snapshots table for rollback and branch.
- **Reference**: `objectified-rest/src/app/projects_routes.py`, `versions_routes.py`; add history tables and `/v1/versions/{id}/history`, get-by-revision.

**Enterprise and advanced (Projects)**
- **Project lifecycle**: Soft delete or archive projects (retain data for audit); restore archived project; project status (active, archived, locked).
- **Project metadata and governance**: Owner, team, or cost-center metadata; project tags/labels for filtering and catalog; optional project templates or blueprints for quick setup.
- **Quotas and limits**: Configurable per-tenant or per-project quotas (e.g. max versions per project, max classes per version) with clear errors and optional dashboard visibility.

**Enterprise and advanced (Versions)**
- **Version locking**: Lock version to prevent further edits (freeze); optional unlock by authorized role; lock state in version metadata.
- **Version tags and promotion**: Tags or labels on versions (e.g. `staging`, `production`, semantic version); list/filter by tag; optional promotion workflow (promote version to tag).
- **Version comparison**: REST endpoint to diff two versions (or two revisions) and return structural delta (classes/properties added, removed, changed) for review and compliance.

**Enterprise and advanced (Version history)**
- **Revision metadata**: Store author (user_id), optional commit message, and optional external id (e.g. CI run id, ticket id) per revision for audit and traceability.
- **History retention and export**: Optional retention policy (e.g. keep last N revisions or by age); export version history (or range) for compliance or backup; immutable append-only revisions where required.

**Enterprise and advanced (Publish)**
- **Publish channels or targets**: Publish to named targets (e.g. `dev`, `staging`, `production`); list what is published where; unpublish per target.
- **Publish artifacts and integrity**: Optional checksum or signed manifest for published schema; webhook or event on publish for downstream systems (API gateways, codegen, Backstage).

| Ticket | Feature Description |
|--------|---------------------|
| #22    | Create projects services |
| #23    | Create versions services |
| #24    | Create version history services |
| #25    | Create publish services |
| #26    | Modify REST services endpoints to match names |
|        | Add project soft delete/archive and restore with status (active, archived, locked) |
|        | Add project metadata (owner, team, tags/labels) and optional project templates or blueprints |
|        | Add per-tenant or per-project quotas (max versions, max classes) with enforcement and visibility |
|        | Add version locking (freeze edits) with optional unlock by role |
|        | Add version tags/labels and promotion workflow (e.g. staging, production) |
|        | Add version comparison/diff endpoint (structural delta between two versions or revisions) |
|        | Add revision metadata (author, commit message, optional CI/ticket id) and immutable append-only option |
|        | Add history retention policy and export for compliance or backup |
|        | Add publish channels/targets (e.g. dev, staging, production) and list-by-target |
|        | Add publish artifact integrity (checksum/signed manifest) and webhook or event on publish |

---

### 1.3 Classes, Properties, Class-Property (Ticket 3)

**Schema entities and bulk read for canvas**
- **Classes**: Create, list by version, get, update (metadata + `canvas_metadata`: position, dimensions, style, group), delete. Version-scoped.
- **Bulk**: Endpoint to get all classes for a version with properties (and tags if kept) in one response for canvas load.
- **Properties**: Create, list by project, get, update, delete; `data` JSON holds schema (OpenAPI/JSON Schema). Project-scoped (reusable library).
- **Class-property**: Add property to class, reorder, update overrides (e.g. required, description), remove; support `parent_id` for nested properties. Endpoints: add to class, update join row, remove from class, list by class.
- [DONE] **DB**: classes, properties, class_properties tables; indexes for version_id, project_id, class_id.
- **Reference**: `objectified-rest/src/app/classes_routes.py`, `properties_routes.py`, `get_classes_with_properties_and_tags_for_version` in database layer.

**Enterprise and advanced (Classes)**
- **Class lifecycle**: Soft delete or archive classes (retain for audit/history); restore; optional class status (active, deprecated, archived).
- **Class metadata and governance**: Extended metadata (e.g. owner, domain, lifecycle stage); class-level tags for filtering and catalog; optional base class or inheritance metadata for codegen.
- **Bulk class operations**: Copy or clone class (with properties) within version or across versions; move class between versions; bulk update canvas_metadata (position, group) for many classes in one request.

**Enterprise and advanced (Bulk)**
- **Bulk read options**: Pagination or cursor for large versions; optional sparse fieldsets (e.g. only class names and ids, or exclude canvas_metadata); filter by group or tag for partial load.
- **Consistency and performance**: ETag or version hash for bulk response to support conditional fetch and cache invalidation; optional field-level consistency guarantees for canvas load.

**Enterprise and advanced (Properties)**
- **Property library and reuse**: Shared property library at tenant or org level (reusable across projects); reference library properties from project properties; list usages of a property across classes/versions.
- **Property lifecycle**: Deprecate property (mark deprecated, retain in schema); optional deprecation message and sunset date; list deprecated properties for cleanup.
- **Property search and discovery**: Search properties by name, type, or tag across project or tenant; list properties unused in any class (orphans) for governance.

**Enterprise and advanced (Class-Property)**
- **Override audit**: Optional history or audit of class-property overrides (who changed required/description, when); validate overrides against property schema (e.g. required override only if property allows).
- **Bulk join operations**: Bulk add/remove properties to/from class; bulk reorder properties across classes; bulk update overrides (e.g. set required for multiple class-properties in one request).

| Ticket | Feature Description |
|--------|---------------------|
| #27    | Create class services |
| #28    | Create bulk services |
| #29    | Create property services |
| #30    | Create class property services |
| #31    | Modify REST services endpoints to match names |
|        | Add class soft delete/archive and restore with optional status (active, deprecated, archived) |
|        | Add extended class metadata (owner, domain, lifecycle, tags) and optional base-class/inheritance metadata |
|        | Add bulk class operations (copy/clone within or across versions, move, bulk canvas_metadata update) |
|        | Add bulk read options (pagination/cursor, sparse fieldsets, filter by group/tag) and ETag/version hash |
|        | Add shared property library at tenant/org level and list property usages across classes/versions |
|        | Add property deprecation (mark, message, sunset date) and list deprecated properties |
|        | Add property search (by name, type, tag) and list orphan properties |
|        | Add class-property override audit/history and validation of overrides against property schema |
|        | Add bulk class-property operations (bulk add/remove/reorder/update overrides) |

---

### 1.4 OpenAPI 3.2.0 & JSON Schema 2020-12 (Ticket 4)

**Validation, export, and import**
- **Validation**: On create/update of class or property, validate `schema`/`data` against OpenAPI 3.2.0 schema object and JSON Schema 2020-12; return 400 with error details if invalid.
- **Export**: Endpoints to export a version as OpenAPI 3.2.0 document and as JSON Schema 2020-12 document (single or multi-schema). Reuse/extend `openapi_generator` and `jsonschema_generator` to 3.2.0 and 2020-12.
- **Import**: Import OpenAPI 3.2.0 or JSON Schema 2020-12; create/update classes and properties; conflict handling can be deferred to merge (Ticket 5).
- **Docs**: Document which keywords and features are supported (full coverage statement and any exclusions).
- **Reference**: `objectified-ui/src/app/utils/openapi.ts`, `jsonschema.ts`; objectified-rest generators; `lib/db/import-helper.ts`, importers.

**Enterprise and advanced (Validation)**
- **Validation modes and batch**: Configurable validation strictness (e.g. warn vs error, allow unknown keywords); optional tenant or project-level validation rules (e.g. naming conventions, required fields). Batch validate entire version in one request and return aggregated errors/warnings.
- **Validation metadata**: Return validation fingerprint or hash for cache invalidation; optional validation result caching with TTL for unchanged schema.

**Enterprise and advanced (Export)**
- **Export options**: Export with options (include/exclude deprecated classes or properties, include examples, choose format version); optional sparse export (subset of classes by tag or name). Signed or checksummed export artifact for integrity and audit.
- **Large and async export**: Async export for large versions (job id, poll for completion, download URL); optional webhook or event when export is ready for downstream (API gateway, codegen, catalog).

**Enterprise and advanced (Import)**
- **Import strategy and reporting**: Configurable conflict strategy (overwrite, merge, skip) per import; dry-run or preview that returns what would be added/changed/removed without applying. Post-import report (summary and per-class/property changes) for audit.
- **Import source and scale**: Import from URL with optional auth (e.g. private registry); async import for large documents with progress or webhook on completion. Optional support for additional schema dialects (e.g. JSON Schema draft-07) with mapping to 2020-12.

**Enterprise and advanced (Compliance and docs)**
- **Schema compliance profile**: Configurable compliance profile (e.g. strict 2020-12 only, or allow custom `x-*` extensions); tenant-level policy for allowed keywords or forbidden patterns. Document compatibility matrix (OpenAPI/JSON Schema versions and exclusions).
- **Schema lint and policy**: Optional schema lint rules (naming, required fields, no empty descriptions) as configurable policy; expose lint results via validation endpoint or separate lint endpoint for CI and governance.

| Ticket | Feature Description |
|--------|---------------------|
| #32    | Create validation endpoint |
| #33    | Create export endpoints |
| #34    | Create import endpoints |
| #35    | Modify REST services endpoints to match names |
|        | Add configurable validation strictness, optional tenant/project rules, and batch validate entire version |
|        | Add validation fingerprint/hash and optional result caching |
|        | Add export options (deprecated, examples, sparse, format) and signed/checksummed artifact |
|        | Add async export for large versions with job/poll/download and optional webhook on completion |
|        | Add import conflict strategy (overwrite/merge/skip), dry-run preview, and post-import report |
|        | Add import from URL with auth and async import for large documents with progress/webhook |
|        | Add optional support for additional schema dialects (e.g. draft-07) with mapping to 2020-12 |
|        | Add schema compliance profile and tenant-level policy; document compatibility matrix |
|        | Add configurable schema lint rules (naming, required, descriptions) and lint/validation endpoint for CI |

---

### 1.5 Version Commit, Push, Pull, Merge (Ticket 5)

**Git-like version workflow APIs**
- **Commit**: Endpoint that accepts full version payload (classes, properties, class_properties, canvas_metadata) and writes to DB and version history; returns new revision id.
- **Push**: Client sends committed state; server overwrites (or merges) working version and appends to history; returns success and revision id.
- **Pull**: Get version state (latest or by revision); optionally return “since revision” diff.
- **Merge**: Input base revision, “ours” state, “theirs” state (or server current). Output: merged state plus list of conflicts (e.g. class/property modified in both). Conflict entries: path, description, suggested resolution. Optional endpoint to submit resolution choices and return merged state.
- **DB**: Ensure version_history stores full or delta snapshots so pull and merge are implementable.
- **Reference**: New routes e.g. `POST /v1/versions/{id}/commit`, `POST /v1/versions/{id}/push`, `GET /v1/versions/{id}/pull`, `POST /v1/versions/{id}/merge`. Use `objectified-ui/src/app/utils/schema-merge.ts` and ClassImportDialog merge logic for conflict semantics.

**Enterprise and advanced (Commit)**
- **Commit metadata and integrity**: Commit accepts optional author, message, and external id (e.g. CI run id, ticket id); store in revision metadata for audit. Optional commit checksum or fingerprint for integrity; reject if payload hash does not match client claim.
- **Pre-commit validation and policy**: Optional pre-commit validation (run schema validation; reject commit if invalid). Configurable commit policy (e.g. require non-empty message, max payload size, or tenant-level rules).

**Enterprise and advanced (Push)**
- **Push policy and permissions**: Configurable conflict policy on push (e.g. fail if server changed, overwrite, or require pull-then-merge). Enforce permissions (e.g. only certain roles can push to locked or production-tagged versions). Optional branch protection (block force-push, require merge path).
- **Push notification**: Webhook or event on successful push (revision id, version, project) for downstream (CI, catalog sync, API gateway).

**Enterprise and advanced (Pull)**
- **Conditional and efficient pull**: Support ETag or If-None-Match so client can skip refetch when unchanged; return 304 when appropriate. Optional delta pull (return only changes since given revision) for large versions and bandwidth savings.
- **Pull options**: Pull with include/exclude options (e.g. exclude canvas_metadata for headless or CI); pull by revision range for history export.

**Enterprise and advanced (Merge)**
- **Merge strategies and preview**: Configurable merge strategy (auto-merge when no conflict, three-way with conflict list). Merge preview (dry-run): return would-be merged state and conflict list without persisting. Submit resolution choices via API and return merged state for client to push.
- **Post-merge validation**: Optional validation of merged schema before accepting merge result; reject or flag if merged state fails validation or lint policy.

**Enterprise and advanced (Workflow audit and locking)**
- **Optimistic locking**: Require revision id (or base revision) on push/merge to prevent lost updates; return 409 with current revision if base is stale.
- **Workflow audit**: Audit log for commit, push, pull, merge (who, when, client/revision, outcome) for compliance and debugging; queryable via REST or dashboard.

| Ticket | Feature Description |
|--------|---------------------|
| #40    | Review DB for version history functionality |
| #36    | Create version commit endpoints |
| #37    | Create version push endpoints |
| #38    | Create version pull endpoints |
| #39    | Create version merge endpoints |
| #41    | Modify REST services endpoints to match names |
|        | Add commit metadata (author, message, external id) and optional checksum/fingerprint for integrity |
|        | Add pre-commit validation and configurable commit policy (message, payload size, tenant rules) |
|        | Add push conflict policy, permissions, and optional branch protection |
|        | Add webhook or event on successful push for downstream systems |
|        | Add conditional pull (ETag/If-None-Match) and optional delta pull (changes since revision) |
|        | Add pull options (include/exclude canvas_metadata, revision range) for headless/CI |
|        | Add merge preview (dry-run), resolution submission API, and optional post-merge validation |
|        | Add optimistic locking (revision id on push/merge, 409 when stale) and workflow audit log |

---

## 2 UI: REST-Only (No Helpers)

> **Section Status**: All canvas and dashboard code must call REST only; no `lib/db/helper` or server-side DB access from UI.

### 2.1 Remove Helpers and Introduce REST Client (Ticket 6)

**Replace all helper usage with REST client**
- **Audit**: List every use of `lib/db/helper` and `lib/db/helper-*` in canvas and dashboard (grep `@lib/db/helper` and helper imports).
- **REST client**: Implement or extend client that wraps fetch for tenants, projects, versions (CRUD + publish/unpublish), classes, properties, class-properties (CRUD + bulk), and commit/push/pull/merge. Auth: send JWT or API key per objectified-rest contract.
- **Replace**: For each call site in dashboard (stats, recent activity, projects, versions), studio/editor, sidebar, and forms, use REST client or Next.js API route that only proxies to objectified-rest with session. No direct DB or helper usage.
- **Next.js API routes**: Either remove and call objectified-rest directly from client, or keep thin proxy routes that add session and forward to objectified-rest.
- **Cleanup**: Remove or archive helper modules used only by canvas/dashboard; fix tests and build.
- **Reference**: `objectified-ui/lib/api/rest-client.ts`, `paths-client.ts`; dashboard pages; `editor/page.tsx`; StudioSideNav; ClassEditDialog, PropertyDialog, ClassPropertyEditDialog.

| Ticket | Feature Description |
|--------|---------------------|
| #42    | Add UI-Only REST services for Auditing |
| #43    | Add REST service usage to UI |
| #44    | Replace all calls in Dashboard with REST services calls |
| #45    | Replace Next.JS API routes with REST service calls |
| #46    | Clean up Canvas/Dashboard call conversions |

---

## 3 UI: Dashboard

> **Section Status**: Dashboard layout and all list/manage pages use REST only.

### 3.1 Dashboard Shell & Navigation (Ticket 7)

**Layout, nav, theme, routes**
- **Layout**: Main content area and responsive shell; sidebar with links to Dashboard home, Projects, Versions, Tenants, Users (if admin), Profile. Active state and responsive behavior.
- **Theme**: Use existing theme provider and system preference for light/dark; ensure all dashboard pages respect it. Theme selector in header if desired.
- **Routes**: `/dashboard`, `/dashboard/projects`, `/dashboard/versions`, `/dashboard/tenants`, `/dashboard/users`, `/dashboard/profile`. Placeholder pages OK until Tickets 8/9.
- **Reference**: `objectified-ui/src/app/ade/dashboard/layout.tsx`, `DashboardSideNav.tsx`; ThemeSelector, ThemeRegistry.

**Enterprise and advanced (Layout)**
- **Responsive and navigation**: Collapsible sidebar with persisted state (localStorage or user pref); breadcrumbs for deep navigation (e.g. Project → Version → Class). Global search in header (quick find projects, versions, or classes by name) with keyboard shortcut (e.g. Cmd/Ctrl+K).
- **Role-based nav**: Show/hide nav items by role (admin sees Users; tenant-admin sees members; member sees Projects/Versions/Profile). Tenant switcher in header when user has multiple tenants; persist last-selected tenant.
- **Keyboard and accessibility**: Keyboard shortcuts for main nav and actions; skip-to-content link; focus trap in modals; optional reduced-motion preference.

**Enterprise and advanced (Theme and branding)**
- **Theme and preference**: User or tenant override for theme (light/dark/system) persisted per user; optional high-contrast or accessibility theme. Tenant-level branding (logo, favicon, primary color) when configured; fallback to default when not set.
- **Consistency**: All dashboard pages respect theme and branding; print styles where relevant (e.g. project/version lists).

**Enterprise and advanced (Routes and performance)**
- **Deep linking and guards**: Deep links (e.g. `/dashboard/projects/{id}/versions/{id}`) resolve and load correct context; route guards that redirect or show “forbidden” when user lacks permission for the resource. Optional audit log of dashboard page visits (tenant, user, route, timestamp) for compliance.
- **Performance**: Lazy-load dashboard section routes (code-split); optional prefetch on sidebar hover for faster navigation; loading skeletons for initial shell and data.

| Ticket | Feature Description |
|--------|---------------------|
| #47    | Create main layout and content area for UI Dashboard |
| #48    | Establish theme provider and system preferences |
| #49    | Establish correct routes for dashboard |
|        | Add collapsible sidebar with persisted state, breadcrumbs, and global search (e.g. Cmd+K) |
|        | Add role-based nav visibility and tenant switcher in header with persisted selection |
|        | Add keyboard shortcuts, skip-to-content, focus management, and reduced-motion support |
|        | Add user/tenant theme override and optional high-contrast theme; tenant branding (logo, color) |
|        | Add deep linking, route guards by permission, and optional audit of dashboard page visits |
|        | Add lazy-loaded routes, prefetch on nav hover, and loading skeletons for shell and data |

---

### 3.2 Users, Tenants, Tenant-Admins (Ticket 8)

**User and tenant management via REST**
- **Users**: List (admin only), create (signup), edit, deactivate; all via REST users API.
- **Tenants**: List (current user’s tenants), create, edit, delete; slug; REST tenants API. Reference: `objectified-ui/src/app/ade/dashboard/tenants/page.tsx`.
- **User–tenant**: Per tenant, list members, add member (by user id or email), remove member, optional role; REST members API.
- **Tenant administrators**: List, add, remove; only tenant admins see this; REST tenant-admins API.
- **Permissions**: Show/hide sections by role (admin vs tenant-admin vs member); handle 403 from API.
- **Reference**: New or refactored pages under dashboard: users, tenants, tenant members, tenant administrators; shared tables, forms, confirm dialogs; Radix UI and Tailwind.

**Enterprise and advanced (Users)**
- **User list and actions**: Search and filter users (by name, email, status); sort by last active or created. Optional bulk invite (CSV or list of emails) with role; deactivation with optional reason and audit. Display last login or last activity when available from API.
- **User detail and audit**: User detail view (profile, tenants, roles); optional audit trail of user record changes (who changed what, when) for compliance.

**Enterprise and advanced (Tenants)**
- **Tenant list and settings**: Search and filter tenants; tenant settings page (branding, default theme, optional quotas display). Archive tenant (soft delete) with restore; show tenant status (active, archived) in list.
- **Tenant activity**: Optional summary of tenant activity (recent projects, member count, last activity) on tenant card or list for admins.

**Enterprise and advanced (User–tenant and Tenant admins)**
- **Members and roles**: Role selector (e.g. viewer, editor, publisher) when adding member; bulk add/remove members; invite by email with pending-invitation state and resend/cancel. Export member list (CSV) for audit.
- **Tenant admins**: Audit of admin add/remove; optional “transfer ownership” or primary-admin designation with confirmation.

**Enterprise and advanced (Permissions and UX)**
- **Permission feedback**: Clear “forbidden” or “insufficient permission” messaging with suggested action (e.g. ask an admin); show current tenant and role in shell. Optional session timeout warning and re-auth flow.
- **Tables and forms**: Pagination, column visibility, and optional export for user/tenant tables; confirm dialogs for destructive actions with optional “don’t ask again” per session.

| Ticket | Feature Description |
|--------|---------------------|
| #50    | Create Users page in Dashboard |
| #51    | Create Tenants page in Dashboard |
| #52    | Create User-Tenant page in Dashboard |
| #53    | Create Tenant Administrators page in Dashboard |
| #54    | Handle Permissions to show/hide sections by role |
|        | Add user search/filter, sort, bulk invite, deactivation reason, and last-activity display |
|        | Add user detail view and optional audit trail of user record changes |
|        | Add tenant search/filter, settings (branding, quotas), archive/restore, and activity summary |
|        | Add member role selector, bulk add/remove, invite-by-email with pending state, and export member list |
|        | Add tenant-admin audit and optional transfer-of-ownership flow |
|        | Add permission-denied messaging, tenant/role in shell, and optional session timeout warning |
|        | Add table options (pagination, column visibility, export) and confirm-dialog improvements |

---

### 3.3 Projects & Versions List (Ticket 9)

**Projects and versions CRUD and publish**
- **Projects**: List by tenant via REST; create project dialog (name, slug, description, metadata); edit dialog; delete / permanent delete; dropdown actions. Reference: `objectified-ui/src/app/ade/dashboard/projects/page.tsx`.
- **Import**: Optional import project from OpenAPI/URL; call REST import if available. Reference: OpenAPIImportDialog, ImportDialog.
- **Versions**: List by project via REST; create version dialog (version_id, description, changelog, copy from for branch); edit; delete. Reference: `objectified-ui/src/app/ade/dashboard/versions/page.tsx`.
- **Publish**: Publish dialog (visibility); unpublish; freeze-schema; all via REST.
- **Published**: List published versions; link to open in Studio. Reference: `published/page.tsx`.
- **Optional**: Version diff view; relationship graph dialog (RelationshipGraphDialog, compareSchemas). Primitives list/create/edit/import if in OSS scope (PrimitivesManagementClient, PrimitiveEditorDialog).

**Enterprise and advanced (Projects)**
- **Project list and filters**: Search and filter projects (by name, slug, tag, status, owner); sort by updated, created, or name. Project cards or table with status (active, archived), tag badges, and version count. Bulk actions (archive, add tag) where supported by API.
- **Project actions**: Duplicate or clone project (copy project and optionally latest version); archive/restore with confirmation. Project settings subpage (metadata, tags, owner) when API supports it.
- **Quotas and governance**: Display project or tenant quotas (e.g. version count, class count) when available; warn or block create when at limit with clear messaging.

**Enterprise and advanced (Import)**
- **Import flow**: Import from URL with optional auth (e.g. token); import history or recent imports list. Conflict preview before apply (what would be added/changed); optional dry-run and post-import report in UI.
- **Import source options**: Import from file upload, URL, or paste; support OpenAPI and JSON Schema; show validation errors and partial-import option when supported.

**Enterprise and advanced (Versions)**
- **Version list and filters**: Search and filter versions (by name, tag, status); sort by updated, published. Version tags/chips (e.g. staging, production); show locked or published state. Bulk actions (publish to target, archive) where supported.
- **Version actions**: Create version from branch (copy from) with clear source display; version comparison/diff view (side-by-side or delta) from dashboard; optional branch/lineage visualization (which version branched from which).
- **Version history in list**: Link to version history from list; show last revision or “last committed” timestamp; optional rollback or “open at revision” from list.

**Enterprise and advanced (Publish and Published)**
- **Publish flow**: Publish dialog with target/channel selector when API supports multiple targets (e.g. dev, staging, production); optional publish note or changelog. Unpublish with confirmation; show publish history (when published, by whom, to which target) when available.
- **Published list**: Filter and search published versions (by project, tag, target); deep link to open in Studio (read-only or edit depending on policy). Optional export of published schema list (e.g. CSV) for audit or catalog sync.

**Enterprise and advanced (Optional support pages)**
- **Diff and graph**: Version diff view (structural diff between two versions); relationship graph dialog (RelationshipGraphDialog, compareSchemas) for dependency visualization. Schema metrics summary (class count, depth, circular refs) on project or version card when available.
- **Primitives and extras**: Primitives list/create/edit/import if in OSS scope; “Recent activity” or “Recently updated” widget on dashboard home; quick actions (e.g. “New project”, “Open last version”) for power users.

| Ticket | Feature Description |
|--------|---------------------|
| #55    | Create Projects page in Dashboard |
| #56    | Create import for versions in dashboard |
| #57    | Create Versions page in Dashboard |
| #58    | Create Publish page in Dashboard |
| #59    | Create Published page in Dashboard |
| #60    | Create additional support pages in Dashboard |
|        | Add project search/filter/sort, status and tag display, and bulk actions (archive, tag) |
|        | Add duplicate/clone project, archive/restore, and project settings subpage |
|        | Add quota display and create blocking/warning when at limit |
|        | Add import from URL with auth, import history, conflict preview, and post-import report in UI |
|        | Add version search/filter/tags, bulk publish/archive, and version comparison/diff view |
|        | Add version history link from list, branch/lineage display, and open-at-revision |
|        | Add publish target/channel selector, publish history, and published list filter/export |
|        | Add version diff view, relationship graph dialog, schema metrics on cards, and dashboard quick actions |

---

## 4 UI: Local-First Version & Workflow

> **Section Status**: Version edits live in browser until commit; push/pull/merge with conflict resolution.

### 4.1 Local Version State & Undo/Redo (Ticket 10)

**In-browser version state and undo stack**
- **State shape**: Single source of truth: versionId, classes[], properties[], class_properties[] (order and overrides), canvas_metadata per class, groups. Reference: StudioContext, editor types.
- **Load**: On “Open in Studio”, call REST get (or pull) for version; hydrate local state and canvas/sidebar. Reference: editor/page.tsx initial load.
- **Mutations**: Add/update/delete class, add/update/remove class-property, reorder; all update local state only (no REST per edit). Canvas metadata (position, dimensions, style, group) updated on drag/resize/group; persist in local state (saveDefaultCanvasLayout/getDefaultCanvasLayout pattern).
- **Undo stack**: Push previous state on each mutation; max depth (e.g. 50). Undo/redo: pop and apply; clear stack on commit or discard.
- **Optional**: localStorage backup keyed by versionId; clear on successful push.

**Enterprise and advanced (State and load)**
- **State integrity and sync**: Optional state checksum or fingerprint for integrity check before push; detect and warn when state is corrupted or from incompatible version. Optional cross-tab sync (e.g. BroadcastChannel or storage event) so multiple Studio tabs for same version stay in sync or warn of conflict.
- **Load and recovery**: Loading skeleton and progress during initial load; error recovery (retry, fallback to cached/localStorage draft when REST fails). Optional version compatibility check (e.g. warn if server schema format is newer than client).

**Enterprise and advanced (Mutations and undo)**
- **Mutation performance**: Debounce or batch canvas_metadata updates (position, size) during drag/resize to avoid excessive state updates; optional “pending changes” summary (e.g. “3 classes modified”) for large edits. In-memory audit of mutations (what changed since load) for commit message suggestion or conflict context.
- **Undo stack**: Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) with focus management; optional persist undo stack to sessionStorage so refresh preserves undo within session. Clear stack and backup on version switch; configurable max depth (e.g. 50) via settings.

**Enterprise and advanced (Backup and draft)**
- **Draft and restore**: Auto-save draft to localStorage (or IndexedDB for large state) keyed by versionId with TTL (e.g. 7 days); on reload after crash or refresh, prompt “Restore unsaved draft?” when draft exists and is newer than last pushed. Clear draft on successful push; optional “discard draft” without loading.
- **Conflict detection**: When loading or before push, detect if server has newer revision; show “Server has new changes—pull first?” and offer pull/merge or overwrite (when allowed by policy).

| Ticket | Feature Description |
|--------|---------------------|
| #61    | Create local in-browser version and undo stack in UI |
| #62    | Create Load functionality in browser application |
| #63    | Create canvas mutations functionality |
| #64    | Add undo stack to the UI |
| #65    | Add localStorage backup |
|        | Add state checksum, cross-tab sync or conflict warn, and version compatibility check on load |
|        | Add loading skeleton, error recovery (retry, cached draft), and load progress |
|        | Add debounced/batched canvas_metadata updates and optional mutation summary for commit |
|        | Add undo/redo keyboard shortcuts, optional session persistence of undo stack, and configurable depth |
|        | Add auto-save draft with TTL, restore-draft prompt on reload, and discard-draft option |
|        | Add server-ahead detection and “pull first” or overwrite prompt before push |

---

### 4.2 Commit, Push, Pull, Merge Workflow (Ticket 11)

**Toolbar actions and conflict resolution**
- **Toolbar/menu**: Commit (snapshot local state, optional message; reset undo or keep one pre-commit); Push; Pull; Merge (enabled when pull indicates diverged or conflicts). Reference: EditorToolbar, StudioHeader.
- **Commit**: Persist “last committed” locally; after Push, clear dirty and optionally undo stack.
- **Push**: Call REST push with committed (or current) state; on 409 (newer on server), suggest Pull then Merge.
- **Pull**: Call REST pull; if local dirty, block or offer stash/discard; replace or merge local state with server response.
- **Merge UI**: List conflicts (class/property, path, description); “Use mine” / “Use theirs” / “Edit manually” per conflict; apply resolution and update local state; allow Push. Reference: ClassImportDialog conflict resolution patterns.
- **Indicators**: Dirty, unpushed commits, “server has new changes”.

**Enterprise and advanced (Toolbar and commit)**
- **Toolbar UX**: Keyboard shortcuts (e.g. Ctrl/Cmd+S for commit, Ctrl/Cmd+Shift+P for push); disabled states when read-only or user lacks permission; progress indicators (spinner or progress bar) during commit/push/pull/merge. Optional “Commit and push” single action when policy allows.
- **Commit flow**: Optional “commit message required” (enforce before commit); pre-commit validation summary (e.g. list errors/warnings) with option to commit anyway or fix. Optional external id (e.g. CI run id, ticket id) in commit for traceability; show last commit message and revision in toolbar or status.

**Enterprise and advanced (Push and pull)**
- **Push**: Retry on transient network failure (with backoff); on 409, clear “server has new changes” guidance (pull then merge, or open conflict UI). Optional push to multiple targets (e.g. dev, staging) when API supports; push progress or success toast with revision id.
- **Pull**: Conditional pull (If-None-Match / ETag) to avoid refetch when unchanged; when local dirty, stash/discard dialog with clear explanation and “Stash and pull” / “Discard and pull” / “Cancel”. Pull progress; after pull, optional “Merge required” if server and local diverged.

**Enterprise and advanced (Merge UI)**
- **Conflict resolution**: Merge preview (dry-run) showing would-be merged state and conflict list before applying. Side-by-side or inline diff for each conflict (mine vs theirs); bulk “Use mine” / “Use theirs” for same conflict type (e.g. all property renames). Apply resolution and re-validate; allow Push only when conflicts resolved. Reference: ClassImportDialog patterns.
- **Indicators and status**: Unpushed commit count (e.g. “2 unpushed”); “Server has new changes” banner with Pull/Merge CTA; optional connection status (online/offline) and reconnection retry. Show current revision id and “last pushed” timestamp when available.

| Ticket | Feature Description |
|--------|---------------------|
| #66    | Add Toolbar for Version-based actions |
| #67    | Add Toolbar for commit |
| #68    | Add Toolbar for Push functionality |
| #69    | Add Toolbar for Pull functionality |
| #70    | Add Merge UI for merging versions |
|        | Add toolbar keyboard shortcuts, disabled states by permission, and progress indicators |
|        | Add optional required commit message, pre-commit validation summary, and external id (CI/ticket) |
|        | Add push retry on failure, 409 handling guidance, and optional multi-target push |
|        | Add conditional pull (ETag), stash/discard dialog, and pull progress |
|        | Add merge preview (dry-run), side-by-side conflict diff, and bulk resolve actions |
|        | Add unpushed count, server-ahead banner, connection status, and revision/timestamp display |

---

### 4.3 Version History – Rollback, Remove, Branch (Ticket 12)

**History panel and version actions**
- **History panel**: List revisions (id, timestamp, optional message) via REST; show in dashboard or Studio.
- **Load revision**: Replace local state with chosen revision (read-only or editable in Studio).
- **Rollback (server)**: Set version state to chosen revision; append to history; call REST.
- **Branch**: Dialog for new version name/id; REST create version from source revision; open new version in Studio. Reference: versions page “copy from”.
- **Remove**: Confirm; REST delete version (or revision); redirect to versions list.

**Enterprise and advanced (History panel)**
- **List and filter**: Search or filter revisions (by message, author, date range); pagination or virtual scroll for long history. Show revision metadata (author, message, external id when available); optional “Compare with current” to open diff view between selected revision and current state.
- **Revision detail**: Expand or tooltip with full message and timestamp; link to “Load”, “Rollback”, “Branch from here”. Show which revision is current (or last pushed) and which is loaded in Studio when different.

**Enterprise and advanced (Load revision)**
- **Load options**: Load revision as read-only vs editable (toggle or policy-based); warn when loading old revision (“You are viewing a past revision”). “Compare with current” side-by-side or delta view; “Restore to this revision” (rollback) with confirmation and optional message.
- **State consistency**: After load revision, clear or preserve undo stack (configurable); update “last committed” display; dirty state when user edits after loading a revision (allow commit to create new revision from that point when supported by API).

**Enterprise and advanced (Rollback and branch)**
- **Rollback**: Rollback confirmation with summary (e.g. “Revert to revision X; N classes will change”); optional rollback message for audit; permission check (e.g. only editors can rollback); success toast and refresh history. Handle locked or published version (warn or block rollback when policy requires).
- **Branch**: Branch-from-revision dialog with prefill name (e.g. “version-name-rev-123”); create version via REST and open in same tab or new tab (user preference). Link from dashboard “copy from” to same flow for consistency.

**Enterprise and advanced (Remove and retention)**
- **Remove**: Confirm dialog with impact (e.g. “This will delete version X and its history”); optional soft delete (archive) when API supports; redirect to versions list or dashboard with toast. Cascade warning when version has dependents (e.g. branches) if API provides.
- **Retention and export**: Optional “Export history” (revisions list or full state per revision) for compliance; display retention or cleanup policy when configured (e.g. “Revisions older than 90 days may be archived”).

| Ticket | Feature Description |
|--------|---------------------|
| #71    | Add version history to UI |
| #72    | Add load revision to UI version history |
| #73    | Add rollback to UI version history |
| #74    | Add branching to UI version history |
| #75    | Add history removal to UI version history |
|        | Add history search/filter, pagination, revision metadata, and “Compare with current” |
|        | Add load-as-read-only vs editable, “viewing past revision” warning, and state/undo handling |
|        | Add rollback confirmation with summary, optional message, permission check, and locked-version handling |
|        | Add branch dialog with prefill name and open-in-new-tab option |
|        | Add remove confirmation with impact, optional soft delete, and cascade warning |
|        | Add optional export history and display of retention/cleanup policy |

---

## 5 UI: Schema Canvas (Class Diagram)

> **Section Status**: React Flow canvas; all data from local version state; no per-move REST.

### 5.1 Canvas Container & Selectors (Ticket 13a)

**Project/version selector and canvas shell**
- **Project/version selector**: In toolbar; load projects and versions via REST; on switch, reload local state and canvas. Reference: EditorToolbar project/version Select.
- **React Flow**: Background, Controls, MiniMap; viewport persistence. Reference: editor/page.tsx ReactFlow, Background, Controls.
- **Read-only**: When version is published, set read-only (no add/delete/edit). Reference: isReadOnly from version.published.

**Enterprise and advanced (Project/version selector)**
- **Selector UX**: Recent versions or “last opened” list for quick switch; optional favorites (pin project/version); keyboard navigation (arrow keys, type-ahead); display validation or sync status (e.g. “Unpushed changes”, “Server has updates”) next to version. Breadcrumb or full path (Tenant → Project → Version) for context in multi-tenant setups.
- **Switch and confirm**: Confirm dialog when switching project/version with unsaved changes (save/discard/cancel); optional “Open in new tab” to keep current canvas and open another. Preload or lazy-load version list for large tenants; search/filter in selector dropdown.

**Enterprise and advanced (React Flow shell)**
- **Performance and scale**: Virtualization or lazy rendering for large diagrams (100+ nodes); minimize re-renders on pan/zoom; optional “simplified view” (hide property list in nodes) for overview. Canvas performance metrics or warning when node count exceeds threshold (e.g. “Consider using groups or focus mode”).
- **Viewport and persistence**: Save viewport (pan, zoom) per version or per user; restore on load; optional “fit to content” or “fit selected” with animation. MiniMap with optional legend (groups, selected); controls with keyboard shortcuts (zoom in/out, fit, reset).
- **Accessibility**: Full keyboard navigation (tab through nodes, enter to open); ARIA labels and live regions for selection and actions; optional high-contrast mode for edges and nodes; reduced motion option for animations. Screen reader summary of canvas (e.g. “42 classes, 3 groups”).

**Enterprise and advanced (Read-only and governance)**
- **Read-only experience**: Clear visual distinction when version is read-only (banner, disabled toolbar actions, cursor feedback); tooltips explaining “Published versions are read-only”. Optional “Request edit access” or “Branch from this version” CTA for governed workflows. Allow view, search, export, and copy in read-only; block add/delete/edit and push.
- **Locked and permission**: When version is locked (or user lacks edit permission), same read-only behavior with appropriate message; optional “View as” (viewer) vs “Edit” (editor) mode selector when both are allowed.

| Ticket | Feature Description |
|--------|---------------------|
| #76    | Add project/version selector in UI Canvas |
| #77    | Configure react-flow canvas properly |
| #78    | Add read-only behavior to the UI canvas |
|        | Add recent/favorites in selector, keyboard nav, validation/sync status, and breadcrumb (Tenant → Project → Version) |
|        | Add switch confirmation when dirty, “Open in new tab”, and search/filter in version dropdown |
|        | Add canvas virtualization/lazy render for large diagrams and simplified overview mode |
|        | Add viewport save/restore per version, fit-to-content/fit-selected, and MiniMap legend |
|        | Add full keyboard nav, ARIA, high-contrast option, reduced motion, and screen reader summary |
|        | Add read-only banner, “Request edit”/“Branch from here” CTA, and locked/permission-aware mode |

---

### 5.2 Class Nodes & Edges (Ticket 13b)

**Nodes and edges from local state**
- **Class nodes**: Render from local state; position, dimensions, style from canvas_metadata. Reference: ClassNode.tsx, NodeData.
- **Class node**: Expand/collapse properties; theme (backgroundColor, border, icon); double-click opens class form. Reference: ClassNode.
- **Edges**: Refs between classes; style by type (direct/optional/weak/bidirectional). Reference: SmartEdge.tsx, EdgeWithWideHit.tsx, edge-styling.
- **Interactions**: Node drag/resize; single and multi selection; pan/zoom. Reference: useNodesState, onNodesChange.

**Enterprise and advanced (Class nodes)**
- **Node state and status**: Visual indicators for node state (e.g. deprecated, new since last commit, modified, has validation errors); optional badge or icon for tags (e.g. “API”, “internal”). Tooltip or popover with class summary (name, property count, ref count, description snippet) without opening full form. Optional custom node layout or “compact” vs “full” property list per node.
- **Theming and branding**: Per-version or per-project node theme (colors, border style); support for tenant or tag-based colors (e.g. all “core” classes blue). Icon or avatar per class type or tag; consistent with dashboard theme (light/dark, high contrast).
- **Node interactions**: Right-click context menu (edit, duplicate, add to group, create reference, delete); keyboard shortcut to open class form (Enter when focused). Optional “quick edit” inline (e.g. rename) without opening dialog. Support for very long property lists (virtual scroll or “show first N” with expand).

**Enterprise and advanced (Edges)**
- **Edge labeling and semantics**: Show property name or cardinality on edge (hover or always); edge type legend (composition, association, inheritance when modeled). Style edges by ref type (required vs optional, array vs single); optional “broken reference” warning (target class missing or deleted) with visual (dashed red) and click to fix.
- **Edge interactions**: Click edge to select and show property/ref details in sidebar or tooltip; optional “edit ref” (change target, override) from edge. Multiple edges between same pair (different properties) clearly distinguished; edge routing that avoids overlap when possible.
- **ID-based refs (SQL mode)**: When in SQL mode, display ID-based references (e.g. `user_id` → User) with distinct edge style (e.g. dashed); support both $ref and ID refs on same canvas with clear visual difference.

**Enterprise and advanced (Interactions and selection)**
- **Selection**: Multi-select with Shift+click and Ctrl/Cmd+click; box-select (drag on background); “Select all”, “Select by group”, “Select by tag”. Selection count in toolbar; bulk actions (move to group, delete, duplicate, export selection). Clear selection (Esc); persist selection across pan/zoom (optional).
- **Drag and resize**: Snap to grid with configurable spacing; snap to other nodes (alignment guides). Resize handle visibility (always vs on hover); min/max node size; undo/redo for position and size changes. Touch and gesture support (pinch zoom, two-finger pan) for tablets and touch devices.
- **Accessibility**: Focus ring and tab order for nodes and edges; announce selection and action result to screen reader; keyboard-driven pan/zoom (arrow keys when canvas focused). Optional “list view” of classes (accessible table) that syncs selection with canvas.

| Ticket | Feature Description |
|--------|---------------------|
| #79    | Class node design for the react-flow canvas |
| #80    | Class-node properties and themes |
| #81    | Class node edge design and behavior in the canvas |
| #82    | Add interactivity to nodes in the react-flow canvas |
|        | Add node status indicators (deprecated, new, modified, errors), tag badges, and summary tooltip |
|        | Add per-version/tag node theming, tenant colors, and compact/full property display options |
|        | Add node context menu, keyboard open form, inline quick-edit, and virtual scroll for long property lists |
|        | Add edge labels (property name, cardinality), edge legend, and broken-reference warning and fix |
|        | Add edge click-to-detail, edit ref from edge, and ID-ref (SQL mode) visual distinction |
|        | Add multi-select, box-select, select by group/tag, bulk actions, and selection count in toolbar |
|        | Add snap-to-grid/alignment, resize limits, undo for position/size, and touch/gesture support |
|        | Add keyboard and screen reader support for nodes/edges and optional accessible list view of classes |

---

### 5.3 Groups (Ticket 13c)

**Group nodes and class membership**
- **Create group**: From toolbar or at drop position; add/remove class nodes; rename, color, style. Reference: GroupNode.tsx, handleCreateGroup, handleCreateGroupAtPosition.
- **Delete**: Delete group; “delete all classes in group” with confirm. Reference: handleDeleteAllClassesInGroup.

**Enterprise and advanced (Group creation and membership)**
- **Create and organize**: Create group from selection (selected nodes become members); create empty group at drop position; drag classes in/out of group. Nested groups (group inside group) when supported by layout; rename group with inline edit or dialog; assign color, border style, and optional icon. Group metadata (description, owner, or tag) for governance and filtering.
- **Bulk and templates**: “Add selection to group” and “Remove from group” from context menu or toolbar; “Create group from tag” (all classes with tag X form new group). Optional group templates (e.g. “Domain: Order”, “Layer: API”) with predefined style and naming for consistency across versions.
- **Group list and sidebar**: Groups tab in sidebar lists all groups with member count; click to focus/zoom to group on canvas; reorder groups (z-index or logical order); expand/collapse group header on canvas to save space.

**Enterprise and advanced (Group delete and lifecycle)**
- **Delete options**: Delete group only (classes remain on canvas, ungrouped); “Delete group and all classes” with strong confirmation and list of class names. Optional “Archive group” (hide from canvas but retain in state for restore); “Move classes out and delete group” as single action.
- **Ungroup**: “Ungroup” action to remove group and keep classes; classes keep position when possible. Audit or undo support for group delete/ungroup so users can recover from mistakes.

**Enterprise and advanced (Groups and layout/export)**
- **Layout by group**: Auto-layout with “layout by group” (arrange groups first, then nodes within each group); keep groups compact; option to expand/collapse all groups for presentation. Export or print with group boundaries and labels.
- **Export and filter by group**: Export (image, PDF, Mermaid, etc.) with option “current view only”, “selected nodes”, or “by group” (one export per group or include group boundaries). Filter canvas or search by group (e.g. “show only Group A and Group B”); use groups in focus mode (“Focus on group” already noted; extend to “Focus on multiple groups”).

| Ticket | Feature Description |
|--------|---------------------|
| #83    | Add ability to create groups in the react-flow canvas |
| #84    | Deletion of groups in the UI |
|        | Add create group from selection, nested groups, group metadata (description, tag), and group templates |
|        | Add groups sidebar tab, focus/zoom to group, reorder groups, and expand/collapse group header |
|        | Add delete-group-only vs delete-all-classes, archive group, and ungroup with position preserve |
|        | Add layout-by-group option, export by group or with group boundaries, and filter canvas by group |

---

### 5.4 Canvas Search & Focus (Ticket 13d)

**Search and focus mode**
- **Canvas search**: Query input; regex toggle; filters: type (class/allOf/oneOf/anyOf), group, has properties, property name. Reference: canvasSearchQuery, searchFilterType, searchFilterGroup.
- **Search history**: Add on close; list, remove, clear (localStorage). Reference: useSearchHistory.ts, CanvasSettingsDialog.
- **Focus mode**: Selection plus N-degree neighbors; “Focus on group”; exit on Esc. Reference: focusModeEnabled, focusModeDegree, focusOnGroup.

**Enterprise and advanced (Search)**
- **Search scope and filters**: Search in class name, description, property names, property types, and optional tag/annotation; regex and case-sensitive toggles. Filters: by type (class/composition/oneOf/anyOf), by group, by tag, “has property X”, “has validation error”, “deprecated”. Combine filters (AND/OR); save current search as “saved search” with name for reuse. Search results count and “No matches” state with suggestion to broaden filters.
- **Search navigation and highlight**: “Find next” / “Find previous” to step through matches (keyboard and buttons); highlight all matching nodes (dim non-matches or hide); zoom to first match or “zoom to fit all matches”. Clear highlight on search close or new search; optional “Search in current focus only” when focus mode is on.
- **Search history and sync**: Search history (last N queries) in dropdown or separate panel; remove single or clear all; optional sync of search history to user account (cross-device) when API supports. Export search results (list of class names/ids) for audit or documentation.

**Enterprise and advanced (Focus mode)**
- **Focus options**: Focus on selection + N-degree neighbors (upstream, downstream, or both) with configurable N (1–5); “Focus on group” (current group of selection or choose from list); “Focus on path” between two selected nodes (shortest path or all paths). Focus on “classes with tag X” or “classes in group Y” without selecting first. Blur or hide non-focus nodes (with option to show as faded); exit on Esc or “Show all”.
- **Saved focus and share**: Save current focus view as named “view” (e.g. “Order domain”, “API surface”); list saved views and restore with one click. Optional share focus as link (e.g. deep link with focus params) for collaboration or documentation. Focus + layout: “Apply layout to focus only” for a clean subgraph layout.
- **Focus and search combined**: When in focus mode, search can be scoped to focused nodes only; “Find in focus” for quick navigation within large diagrams. Combine with “Select all in focus” for bulk operations.

| Ticket | Feature Description |
|--------|---------------------|
| #85    | Add search functionality to the canvas |
| #86    | Add search history to the canvas search functionality |
| #87    | Implement Focus Mode into the Canvas |
|        | Add search in description/property/tag, advanced filters (AND/OR), saved searches, and result count |
|        | Add find next/previous, highlight all matches, zoom to matches, and search-in-focus option |
|        | Add search history sync (account), export search results list, and clear-highlight behavior |
|        | Add focus by path between two nodes, focus by tag/group, and saved focus views with names |
|        | Add share focus as link, “layout to focus only”, and “Find in focus” / “Select all in focus” |

---

### 5.5 Layout & Dependency (Ticket 13e)

**Layout and dependency overlay**
- **Layout**: Save default layout (per version/user); load default on version load. Auto-layout (e.g. dagre); layout preview then apply. Reference: saveDefaultCanvasLayout, getDefaultCanvasLayout, canvas-auto-layout.ts, layoutPreviewNodes.
- **Layout quality**: Optional hints (edge crossings, spacing). Reference: layout-quality.ts, canvasSuggestions.
- **Dependency overlay**: Upstream/downstream/path from selected node; circular ref warning. Reference: schema-metrics, getCircularDependencyEdgeIds, dependencyView.
- **Schema metrics panel**: Optional (depth, circular, affected count). Reference: SchemaMetricsPanel.

**Enterprise and advanced (Layout)**
- **Layout algorithms and options**: Multiple algorithms (e.g. dagre, ELK, Cola) with options (direction TB/LR, rank spacing, node spacing); “Layout by group” (layout within each group, then arrange groups). Incremental layout (layout only selected nodes or new nodes); “Layout from here” (selected node as root). Layout preview with “Apply” / “Revert”; optional animation (on/off, duration) for large diagrams. Save layout as default per version or per user; “Reset to default layout” and “Load from version” when multiple defaults exist.
- **Layout templates and consistency**: Named layout presets (e.g. “Left-to-right”, “Top-down compact”, “By group”) for teams; apply same preset across versions for consistent diagrams. Optional “Align selection” (align left/right/top/bottom, distribute evenly) for manual tweaks. Layout constraints (e.g. keep node X left of node Y) when algorithm supports.
- **Layout at scale**: Progress indicator for layout when node count is high (e.g. 50+); optional “Layout in background” (web worker) so UI stays responsive. Fallback or simplified layout when full layout times out; “Layout visible area only” for very large schemas.

**Enterprise and advanced (Layout quality and hints)**
- **Quality metrics**: Detect and report edge crossings, node overlap, and spacing issues; suggest “Improve layout” with one click to re-run with adjusted params. Optional “Layout quality score” (e.g. 0–100) for governance or CI; export layout quality report (e.g. for documentation or review).
- **Suggestions**: Inline or panel suggestions (e.g. “Consider grouping these 5 classes”, “Circular ref detected”, “High depth—consider flattening”); dismiss or “Apply suggestion” where applicable. Link suggestion to relevant node or edge.

**Enterprise and advanced (Dependency overlay)**
- **Dependency views**: Toggle overlay showing upstream only, downstream only, or both from selected node(s); highlight path between two nodes (shortest path or all paths). Color or style edges by dependency type (direct, transitive); “Impact analysis” (if I change/delete this class, what is affected?) with list or subgraph. Circular dependency: list all cycles, highlight cycle edges, and “Break cycle” suggestion (e.g. suggest which ref to remove or make optional).
- **Dependency depth and governance**: Show dependency depth (max depth from root or to leaf); warn or block when depth exceeds threshold (e.g. “Max depth 5 exceeded”). “Critical path” or “Root nodes” / “Leaf nodes” view for understanding entry points and sinks. Export dependency graph (DOT, GraphML) for external analysis or documentation.
- **Dependency and focus**: Combine dependency overlay with focus mode (“Focus on upstream/downstream”); “Focus on cycle” to isolate circular ref subgraph. Dependency view persists with saved focus view when supported.

**Enterprise and advanced (Schema metrics panel)**
- **Metrics content**: Class count, property count, group count; max depth, circular ref count, orphan count (classes with no refs); “affected” count (e.g. classes that would need review if selected class changes). Trend or comparison (e.g. “+3 classes since last commit”) when version history available. Breakdown by group or tag (e.g. “Group API: 12 classes”).
- **Metrics actions**: Click metric to filter or focus (e.g. click “Circular: 2” to highlight cycles); “Export metrics” (JSON, CSV) for reporting or governance. Optional thresholds with visual (e.g. “Depth 6 exceeds limit 5” in red); link to config or policy when tenant has layout/depth rules.
- **Metrics and CI**: Expose metrics via REST or export so CI pipelines can fail on threshold (e.g. “No new circular refs”, “Depth ≤ N”); document metrics API for enterprise integrations.

| Ticket | Feature Description |
|--------|---------------------|
| #88    | Implement Layout functions to the Canvas |
| #89    | Add layout hinting to the canvas |
| #90    | Add dependency overlay to the Canvas |
| #91    | Add schema metrics panel to the canvas |
|        | Add multiple layout algorithms (dagre, ELK, Cola), layout-by-group, incremental layout, and layout preview |
|        | Add layout presets, align selection, save/reset default, and optional layout constraints |
|        | Add layout progress, background (worker) layout, and “layout visible only” for large schemas |
|        | Add layout quality score, edge-crossing/overlap detection, and “Improve layout” suggestion |
|        | Add impact analysis (affected nodes), cycle list and “break cycle” hint, and dependency depth warning |
|        | Add critical path/root/leaf view, export dependency graph, and dependency + focus combination |
|        | Add metrics breakdown by group/tag, click-to-focus, export metrics, and threshold alerts |
|        | Add metrics API or export for CI (depth, circular ref, orphan thresholds) |

---

### 5.6 Export & Canvas Settings (Ticket 13f)

**Export and settings dialog**
- **Export**: PNG, SVG, JPEG, PDF, Mermaid, PlantUML, DOT, GraphML, JSON. Reference: useExportFunctions, EditorToolbar.
- **Export Wizard**: Format options, include groups, background; capture and download. Reference: ExportWizard.
- **Canvas settings**: Grid (size, style, snap, visible); background (solid/grid/image/gradient/texture); edge styling (style type, color, arrow per ref type); routing (straight/bezier/orthogonal/smart); animation; search history management. Reference: CanvasSettingsDialog.tsx, StudioContext edgeStyling.

**Enterprise and advanced (Export)**
- **Export scope and format**: Export “current view” (viewport), “entire canvas”, “selected nodes only”, or “by group” (one file per group or combined with group labels). All existing formats (PNG, SVG, JPEG, PDF, Mermaid, PlantUML, DOT, GraphML, JSON); optional resolution/size for raster (e.g. 2x for print). Include/exclude: groups, minimap, background, legend; optional watermark (e.g. “Draft”, “Confidential”, tenant logo) for enterprise. Batch export (e.g. “Export as PNG and SVG” in one action); optional “Export and copy to clipboard” for quick paste into docs.
- **Export wizard and options**: Wizard steps: scope → format → options (size, watermark, include groups) → preview → download. Preview before download for image/PDF; for Mermaid/PlantUML/DOT/GraphML/JSON, show snippet or “Download” directly. Optional “Schedule export” or “Export to URL” when API supports (e.g. save to tenant storage or trigger webhook).
- **Export governance and audit**: Optional “Export reason” or tag (e.g. “For audit”, “For documentation”) for compliance; log export action (format, scope, timestamp, user) when audit is enabled. Restrict export formats by role or tenant policy (e.g. PDF only for viewers); show allowed formats in UI.

**Enterprise and advanced (Canvas settings)**
- **Grid and background**: Grid size (e.g. 10, 20, 50px), style (dots, lines, cross); snap-to-grid on/off with spacing; show/hide grid. Background: solid color, grid (match theme), image (upload or URL), gradient, or texture; opacity and contrast for readability. Per-version or global default; “Reset to default” and import/export settings (JSON) for sharing team presets.
- **Edges and routing**: Edge style (straight, bezier, step, smoothstep); color by ref type or custom; arrow style and size; edge label position. Routing: straight, bezier, orthogonal, smart (avoid nodes); configurable curvature and spacing. Animated edges (e.g. on selection or for dependency flow) with on/off and reduced-motion respect. Edge styling per ref type (required vs optional, $ref vs ID-ref) for SQL mode and clarity.
- **Accessibility and performance**: High-contrast edges and nodes option; large drag handles for motor accessibility; “Reduce motion” (disable layout animation, minimize transition duration). Canvas performance: optional “Simplified rendering” (fewer shadows, simpler edges) for low-end devices; option to disable minimap or controls when not needed.
- **Settings persistence and scope**: Save settings per user, per version, or globally; sync to account when logged in. Settings dialog search or categories for long lists; “Restore defaults” per section (grid, background, edges). Optional tenant-level default settings (admin sets default theme/layout for all users in tenant).

| Ticket | Feature Description |
|--------|---------------------|
| #92    | Add export dialog with export functions for the Canvas |
| #93    | Create an export wizard in the export form |
| #94    | Add canvas settings form |
|        | Add export scope (view/entire/selected/group), resolution/watermark, batch export, and clipboard copy |
|        | Add export wizard with preview, optional schedule/export-to-URL, and export reason for audit |
|        | Add export audit log and role/tenant restrictions on export formats |
|        | Add grid/background options, import/export settings JSON, and tenant default settings |
|        | Add edge routing and styling options, animation toggle, and per-ref-type styling (including ID-ref) |
|        | Add high-contrast/large-handles/reduce-motion and optional simplified rendering for performance |
|        | Add settings persistence (user/version/global), sync to account, and settings search/categories |

---

### 5.7 Class Actions & Sidebar (Ticket 13g)

**Add/delete/copy/reference and sidebar**
- **Add class**: Toolbar or context menu; create in local state; place on canvas.
- **Delete class**: Single or multi-select; confirm; remove from local state and canvas. Reference: handleDelete, deleteClassWithSession pattern.
- **Copy / Paste / Duplicate**: Classes (and optional refs) in local state.
- **Create reference**: From property to class (edge); update local state (class-property $ref). Reference: handleCreateReference.
- **Sidebar**: Classes tab (list, search, add, edit, delete, select → zoom); Properties tab (list project properties; add, edit, delete; select → highlight on canvas); Groups tab (list groups; select → focus on group; delete group / delete all classes). Load from local state. Reference: StudioSideNav.tsx.
- **Tag manager**: Assign/remove tags to class; list tags for project; load/save via REST or local state. Reference: TagManager, ClassEditDialog tags.

**Enterprise and advanced (Class actions)**
- **Add class**: Add from toolbar, context menu (right-click on canvas), or sidebar “+” with optional “Quick add” (name only, place on canvas, edit details later). “Add from template” (class template with predefined properties and tags) for consistency; optional “Add from library” (reuse class definition from another version or project when API supports). Place new class at click position or “center of viewport”; optional “Add and connect” (create class and ref from selected node in one flow).
- **Delete and bulk**: Delete with confirmation showing impact (e.g. “This will remove N references”); “Delete and fix refs” (option to set refs to null or remove property). Bulk delete from multi-select with same confirm; undo support for delete (restore from undo stack). Soft delete or “Move to archive” when tenant supports; block delete when class is referenced by locked/published version if policy applies.
- **Copy, paste, duplicate**: Copy/paste with Ctrl/Cmd+C/V; paste at cursor or center; duplicate (Ctrl/Cmd+D) with “Copy of X” name and offset position. “Duplicate with refs” (copy class and its outgoing refs as new classes); “Duplicate to group”. Paste from clipboard (e.g. JSON or Mermaid) to create classes when format is supported. Cross-version or cross-project paste when API supports (e.g. paste class from another version as new class).

**Enterprise and advanced (References and ref creation)**
- **Create reference**: Create ref from property panel (select target class) or by dragging from property to class node; support $ref and ID-ref (SQL mode). “Create ref and add property” when class has no property yet (add property + set $ref in one step). Validate target exists and type is compatible; warn on circular ref creation. Bulk “Create refs from list” (e.g. CSV or table: source class, property, target class) for migrations or bulk edits.
- **Edit and break refs**: Edit ref (change target, switch to/from ID-ref) from edge or property panel; “Break ref” (remove $ref, keep property as primitive or delete). “Find broken refs” (target missing) and list with “Fix” (choose new target or remove).

**Enterprise and advanced (Sidebar)**
- **Classes tab**: List classes with search and sort (name, updated, tag, group); keyboard nav (arrow keys, Enter to open, Delete to delete). “Select on canvas” (zoom to and select); “Select all” / “Select none”; bulk actions from list (add to group, delete, tag). Favorites or “pinned” classes at top; recent or “last edited” section. Collapse/expand sidebar; resize sidebar width; optional “List view only” (no canvas) for accessibility or small screens. Show class status in list (modified, deprecated, has errors) when available.
- **Properties tab**: List project properties with search and filter (type, used/unused); “Used in” count or list of classes. Select property to highlight all classes that use it on canvas; add/edit/delete property (opens property form). “Orphan properties” filter for governance; bulk “Assign to class” or “Remove from class” when supported. Sort by name, type, or usage count.
- **Groups tab**: List groups with member count; select to focus on canvas; add/remove members; delete group or delete group and classes. Reorder groups; group color and name inline edit. “Ungroup” from list; “Create group from selection” when classes selected on canvas.
- **Sidebar state and UX**: Persist sidebar open/closed and active tab per user or session; optional “Compact sidebar” (icons only) for more canvas space. Loading state when switching version; empty state with “Add first class” or “Import schema” CTA. Accessibility: tab order, ARIA labels, keyboard shortcuts (e.g. Ctrl+B toggle sidebar).

**Enterprise and advanced (Tags and governance)**
- **Tag manager**: Assign/remove tags in class form or from sidebar (multi-select classes then “Add tag”); tag list with count per tag; create new tag (name, optional color). Tag hierarchy or categories (e.g. “Domain::Order”, “Layer::API”) when supported; bulk tag from sidebar. Filter canvas or list by tag; “Classes without tag” for governance. Tag colors on canvas (node border or badge); consistent with dashboard tag colors when synced.
- **Templates and usage**: Class templates (predefined name, properties, tags) for “Add from template”; template library (tenant or project level) when API supports. “Usage count” (how many refs point to this class) in sidebar or tooltip for impact analysis; “Used by” / “Uses” list in class form or panel. Optional “Request new class” or “Propose class” workflow (submit for approval) for governed tenants.
- **Audit and compliance**: Optional “Last modified by” and “Last modified at” in sidebar or class list when version history provides it; “Classes modified in this session” for commit message context. Export class list (with tags, groups) for audit or documentation.

| Ticket | Feature Description |
|--------|---------------------|
| #95    | Add the ability to create a new class from the sidebar |
| #96    | Add ability to delete classes from the canvas |
| #97    | Add copy/paste/duplicate for classes in the canvas |
| #98    | Add the ability to create a reference in a class node |
| #99    | Add sidebar updates for the Classes in the Canvas |
| #100   | Create a tag manager that can be used in the canvas |
|        | Add “Add from template”, “Add from library”, quick add, and “Add and connect” flow |
|        | Add delete impact summary, bulk delete, undo for delete, and optional soft delete/archive |
|        | Add duplicate with refs, duplicate to group, paste from JSON/Mermaid, and cross-version paste |
|        | Add create ref by drag, “create ref and add property”, bulk create refs, and find/fix broken refs |
|        | Add classes tab search/sort, favorites, bulk actions from list, and class status in list |
|        | Add properties tab “used in”/orphan filter, highlight on canvas, and bulk assign/remove |
|        | Add sidebar persist state, compact mode, empty state, and keyboard/accessibility |
|        | Add tag hierarchy, bulk tag, “classes without tag”, template library, and usage count |
|        | Add “Request new class” workflow, last-modified in list, and export class list for audit |

---

## 6 UI: Class & Property Forms

> **Section Status**: Forms drive local state (or REST on submit); 100% OpenAPI 3.2.0 / JSON Schema 2020-12 coverage for in-scope subset.

### 6.1 Class Form (Ticket 14a)

**Class edit dialog and schema**
- **Class edit dialog**: Name, description; open from canvas double-click or sidebar. Reference: ClassEditDialog.tsx.
- **Schema extensions**: OpenAPI 3.2.0 / JSON Schema 2020-12 (e.g. discriminator, externalDocs).
- **Tags**: Assign, remove; tag list for project. Reference: assignTagToClass, removeTagFromClass, getTagsForClass.

**OpenAPI 3.2.0 / JSON Schema 2020-12 – 100% class form coverage**

The class form MUST support every Schema Object keyword that applies to an object-type schema, so that authoring is fully spec-compliant and export/import round-trips without loss. The following subsections enumerate all keywords and form behavior.

**Identification and metadata (JSON Schema Core)**
- **$id**: Optional URI/IRI for the schema (e.g. `#/components/schemas/Order` or full URI). Form field: text input with validation; used for $ref resolution and export. When absent, tooling may derive from class name or path.
- **$schema**: Optional dialect URI (e.g. OpenAPI 3.2 dialect or JSON Schema 2020-12 meta-schema). Form: dropdown or text; default from project or version setting. Affects validation and export.
- **$ref**: For a class that is an alias to another schema, single $ref with no other siblings (per JSON Schema). Form: “Extends or references” with schema/class selector; when set, show read-only summary of target and optional overrides (e.g. description) if supported.
- **$defs**: Reusable nested schemas keyed by name. Form: “Local definitions” section: add/edit/remove named subschemas (each with full schema form or inline); used when this class embeds definitions for its properties or composition. Export emits $defs; import parses and maps to class or inline.
- **$comment**: Internal note, not for documentation. Form: optional text area; exclude from docs and codegen unless explicitly included.
- **title**: Human-readable title. Form: text input; maps to or replaces “name” in UI where appropriate; required in many docs/codegen flows.
- **description**: Full description; [CommonMark] MAY be used (OpenAPI 3.2). Form: rich-text or Markdown-capable text area; preview toggle; required for governance when policy is “no empty description”.
- **default**: Default value for the whole object (e.g. sample instance). Form: JSON text area or structured key-value; validate against this schema; used in examples and codegen.
- **examples**: Array of example instances (JSON Schema 2020-12). Form: list of example entries (add/remove/reorder); each entry: JSON or key-value; validate each against schema; used in docs and try-it-out.
- **deprecated**: Boolean; mark class as deprecated. Form: checkbox; optional “Deprecation message” and “Sunset date”; show deprecated badge in canvas and sidebar; exclude or flag in codegen when configured.
- **readOnly** / **writeOnly**: Boolean hints for the object as a whole. Form: checkboxes; when readOnly true, object is not sent in requests; when writeOnly true, not returned in responses. Used in request/response schemas and codegen.
- **enum** / **const**: Allowed at schema level (instance must be one of enum values, or exactly const). Form: optional “Enum” (array of allowed instances, e.g. object literals) or “Const” (single value); validate structure; used for fixed shapes or polymorphic hints; when type is object, each enum/const value typically an object.

**Object-type keywords (JSON Schema Validation – object)**
- **type**: For a class, fixed to `"object"` (or absent to allow any type when modeling polymorphic roots). Form: fixed display “object” with optional “Allow multiple types” (array of types) for advanced polymorphic classes; validate that only object-relevant keywords are used when type is object.
- **properties**: Handled by class-properties (add/remove/reorder properties; each property has its own schema). Form: link to “Properties” (class-properties) and inline list with edit/delete; ensure exported schema has `properties` object keyed by property name.
- **required**: Array of property names. Form: multi-select or checklist of class properties; sync with class-property “required” overrides; export as `required: [ "a", "b" ]`.
- **additionalProperties**: Boolean or schema. Form: toggle “Allow additional properties” (true/false) or “Additional properties schema” (subschema selector or inline); when schema, use full property-form capabilities for that schema.
- **unevaluatedProperties**: Schema for properties not evaluated by properties, patternProperties, or additionalProperties (JSON Schema 2020-12). Form: optional subschema selector or inline schema; validate that use is consistent with composition (e.g. with allOf).
- **propertyNames**: Schema that property names must satisfy. Form: optional “Property names must match schema” with subschema (e.g. pattern); used for key constraints.
- **minProperties** / **maxProperties**: Non-negative integers. Form: number inputs; validate min ≤ max; export/import round-trip.
- **patternProperties**: Map of regex to schema. Form: “Pattern properties” section: add/edit/remove entries (pattern string + schema); each pattern validated as regex; export as object keyed by pattern.

**Schema composition (allOf, oneOf, anyOf, not)**
- **allOf**: Array of schemas; instance must satisfy all. Form: “Composition – allOf” list: add/remove items; each item: $ref to class/schema or inline schema; order preserved; used for inheritance/mixins; validate no conflicting required or type.
- **oneOf**: Array of schemas; instance must satisfy exactly one. Form: “Composition – oneOf” list; each item $ref or inline; often used with discriminator; validate exactly-one semantics in docs/codegen.
- **anyOf**: Array of schemas; instance must satisfy at least one. Form: “Composition – anyOf” list; each item $ref or inline.
- **not**: Schema that instance must NOT satisfy. Form: single “not” schema ($ref or inline); used for exclusion.

**Conditional schema (JSON Schema 2020-12)**
- **if** / **then** / **else**: Conditional application. Form: “Conditional – if/then/else”: if-schema (condition), then-schema (when true), else-schema (when false); each $ref or inline; validate and export per spec.
- **dependentRequired**: Map of property name to array of required property names. Form: “Dependent required” list: when property X is present, require Y, Z; key + list of required names; export as object.
- **dependentSchemas**: Map of property name to schema (when property present, instance must also satisfy schema). Form: “Dependent schemas” list: property name + subschema; each subschema full form or inline.

**OpenAPI Schema Object – fixed fields**
- **discriminator**: Hint for polymorphic payloads. Form: “Discriminator” section: **propertyName** (string, required)—property that holds the type value; **mapping** (optional)—map of value to schema name/ref (e.g. `order: "#/components/schemas/Order"`); used with oneOf/allOf for inheritance and codegen.
- **externalDocs**: Additional documentation. Form: **url** (required URI), **description** (optional); link opens in new tab; used in docs and client SDKs.
- **xml**: XML representation. Form: **name** (element name), **namespace** (URI), **prefix** (namespace prefix), **attribute** (boolean, treat as attribute), **wrapped** (boolean); used for XML serialization and docs.
- **example**: Deprecated singular example (OpenAPI 3.0 compatibility). Form: optional “Legacy example” field; when present, export as `example`; prefer **examples** array for new authoring; show deprecation notice in UI.

**Specification extensions (x-*)**
- **x-***: Arbitrary custom keys. Form: “Extensions” section: add/remove key-value pairs (key must start with `x-` or be allowed without prefix per OAS); value: string, number, boolean, object, or array (JSON); used for codegen hints, vendor metadata, and tooling.

**Form UX and validation**
- **Single dialog or tabbed**: Class form organized by sections (Metadata, Object constraints, Composition, Conditional, OpenAPI, Extensions) with tabs or accordions; all fields persist to class schema in local state.
- **Validation**: On blur or submit, validate schema against OpenAPI 3.2 / JSON Schema 2020-12 (via REST or client-side); show errors at field level; block save when invalid if policy is “strict”.
- **Import/export**: Paste JSON/YAML schema to prefill form (when structure matches); copy schema to clipboard; ensure round-trip (form → export → import → form) preserves all supported keywords.

**Tags and cross-cutting**
- **Tags**: Assign/remove tags to class; tag list for project; filter and group by tag in canvas/sidebar. Reference: assignTagToClass, removeTagFromClass, getTagsForClass.
- **Class name and identity**: Class “name” in UI maps to schema title or a stable id; ensure $id/name are consistent in export (e.g. component key = class name or $id fragment).

| Ticket | Feature Description |
|--------|---------------------|
| #101   | Add Class Edit dialog, reuses the Add Edit dialog |
| #102   | Class edit dialog needs to handle schema extensions |
| #103   | Class node tag behavior |
|        | Add $id, $schema, $ref, $defs, $comment to class form with validation and export |
|        | Add title, description (CommonMark), default, examples (array), deprecated, readOnly, writeOnly, enum, const to class form |
|        | Add object keywords: required, additionalProperties, unevaluatedProperties, propertyNames, minProperties, maxProperties, patternProperties |
|        | Add composition: allOf, oneOf, anyOf, not with $ref/inline schema per item and order preserved |
|        | Add conditional: if/then/else, dependentRequired, dependentSchemas in class form |
|        | Add discriminator (propertyName, mapping), externalDocs (url, description), xml (name, namespace, prefix, attribute, wrapped), example (deprecated) |
|        | Add x-* extensions section (add/remove key-value, JSON value types) and form sections/tabs for all keyword groups |
|        | Add class form validation (OpenAPI 3.2 / JSON Schema 2020-12), field-level errors, and schema paste/copy/round-trip |

---

### 6.2 Property Form – Core & Types (Ticket 14b)

**Property dialog and type-specific fields**
- **Property dialog**: Create/edit; name, type (string/number/integer/boolean/object/array/null), description, required. Reference: PropertyDialog.tsx, PropertyFormFields.tsx.
- **$ref selector**: Link to class or library property; store in property data. Reference: PropertyFormFields, PrimitiveSelector.
- **String**: format, pattern, minLength, maxLength, enum, default, example. Reference: stringConstraints.
- **Number/integer**: format (int32/int64, float/double); minimum, maximum, exclusiveMin/Max, multipleOf; enum, default. Reference: numberConstraints.
- **Array**: items schema, minItems, maxItems, uniqueItems; prefixItems (tuple); contains, minContains, maxContains. Reference: arrayConstraints, tupleMode.
- **Object**: properties, required, additionalProperties, patternProperties, unevaluatedProperties. Reference: objectConstraints.

**OpenAPI 3.2.0 / JSON Schema 2020-12 – 100% property form coverage**

The property form MUST support every Schema Object keyword that applies to the property’s value schema, so that authoring is fully spec-compliant and export/import round-trips without loss. Property “name” is the key in the parent object’s `properties`; the form edits the schema for the property value. The following subsections enumerate all keywords and form behavior by category.

**Property identity and type selector**
- **Property name**: Required; identifier for the property key; validate per JSON Schema (no leading/trailing spaces; uniqueness within parent when in class-property context). Form: text input; sync with class-property join.
- **type**: One of `"string"`, `"number"`, `"integer"`, `"boolean"`, `"object"`, `"array"`, `"null"`, or an array of these (multiple types). Form: type selector (single or “Allow multiple types” with multi-select); when array of types, show only keywords that apply to any selected type or allow per-type subschemas where needed.
- **$ref**: When property is a reference to another schema (class or library property). Form: “Reference” selector (class or reusable property); when set, schema may contain only $ref or $ref + overrides per spec; show target summary and optional description override. Reference: PropertyFormFields, PrimitiveSelector.

**Identification and metadata (property value schema)**
- **$id**, **$schema**, **$defs**, **$comment**: Same as class form; optional for inline or reusable property schemas. Form: optional section “Schema identity” with $id (URI), $schema (dialect), $defs (named subschemas), $comment (internal note).
- **title**, **description**: Human-readable title and description; [CommonMark] for description (OpenAPI 3.2). Form: text inputs; description with preview; used in docs and codegen.
- **default**, **examples**: Default value and examples array for the property value. Form: type-aware input (string/number/boolean/object/array) or JSON; examples as list of values; validate each against schema.
- **deprecated**, **readOnly**, **writeOnly**: Booleans; same semantics as class form. Form: checkboxes; optional deprecation message.
- **enum**, **const**: Enum (array of allowed values) or const (single value); type-consistent. Form: list editor for enum; single value for const; validate type and uniqueness for enum.

**String – full coverage (JSON Schema Validation + Content vocabulary)**
- **minLength**, **maxLength**: Non-negative integers. Form: number inputs; min ≤ max; export/import round-trip.
- **pattern**: ECMA-262 regular expression. Form: text input with regex validation and optional “Test pattern” with sample string; escape rules for JSON.
- **format**: Format attribute (annotation or assertion). Form: dropdown or combobox with all supported formats; **String formats**: date-time, date, time, duration (RFC 3339 / ISO 8601); email, idn-email; hostname, idn-hostname; ipv4, ipv6; uri, uri-reference, iri, iri-reference; uuid; uri-template; json-pointer, relative-json-pointer; regex. **OpenAPI additional**: password. Allow custom format (text) when supported. Document which formats are annotation-only vs validated.
- **contentEncoding**: String (e.g. base64, base16, base32 per RFC 4648 / MIME). Form: dropdown or text; when set, string is interpreted as encoded binary; used with contentMediaType.
- **contentMediaType**: Media type of string contents (RFC 2046). Form: text input (e.g. image/png, application/json); when set, optionally **contentSchema** (schema describing decoded/parsed content). Form: subschema selector or inline schema for contentSchema; used for embedded JSON, HTML, or binary payloads.

**Number and integer – full coverage**
- **minimum**, **maximum**: Inclusive bounds; numbers. Form: number inputs; min ≤ max.
- **exclusiveMinimum**, **exclusiveMaximum**: Exclusive bounds (JSON Schema 2020-12: number value). Form: number inputs; validate exclusiveMin < exclusiveMax when both set.
- **multipleOf**: Positive number; instance must be multiple. Form: number input; validate > 0.
- **format**: **number/integer formats** (OpenAPI): int32, int64 (integer); float, double (number). Form: format selector when type is number or integer; document semantics for codegen.

**Array – full coverage (JSON Schema 2020-12)**
- **items**: Schema for array elements (when not using prefixItems for tuple). Form: single schema selector or inline schema (full property-form recursion); when used with prefixItems, applies to “additional items” only per spec.
- **prefixItems**: Array of schemas (tuple); each position has its own schema. Form: “Tuple” mode: list of schemas (add/remove/reorder); each item: $ref or inline schema; export as array of schema objects.
- **additionalItems**: Schema for items beyond prefixItems (when prefixItems present). Form: schema selector or inline; “Allow additional items” boolean + schema when true; when false, no additional items allowed.
- **contains**: Schema; at least one element must satisfy. Form: schema selector or inline; used for “array of X that has at least one Y”.
- **minContains**, **maxContains**: Non-negative integers; constrain how many elements match contains. Form: number inputs; minContains default 1, maxContains optional; only apply when contains is set.
- **minItems**, **maxItems**: Non-negative integers. Form: number inputs; min ≤ max.
- **uniqueItems**: Boolean; all elements must be unique. Form: checkbox.
- **unevaluatedItems**: Schema for items not evaluated by items/prefixItems/additionalItems (JSON Schema 2020-12). Form: optional subschema; used with composition (e.g. allOf); validate consistency.

**Object (when property type is object) – full coverage**
- **properties**: Nested properties (name → schema). Form: “Properties” list: add/edit/remove child properties; each child opens nested property form or inline schema; export as object keyed by name.
- **required**: Array of property names (nested). Form: multi-select of nested property names; sync with child required flags.
- **additionalProperties**: Boolean or schema. Form: toggle or schema selector; when schema, full inline or $ref.
- **unevaluatedProperties**: Schema for properties not evaluated (2020-12). Form: optional subschema.
- **propertyNames**: Schema that property names must satisfy. Form: subschema (e.g. pattern); validate regex or structure.
- **minProperties**, **maxProperties**: Non-negative integers. Form: number inputs; min ≤ max.
- **patternProperties**: Map of regex → schema. Form: list of pattern + schema pairs; each pattern valid regex; export as object.

**Schema composition (property value schema)**
- **allOf**, **oneOf**, **anyOf**, **not**: Same as class form; each item $ref or inline schema. Form: composition section with add/remove/reorder; each entry: class/schema selector or expand inline; validate no conflicting required/type when possible; used for polymorphic or combined constraints.

**Conditional schema (property value schema)**
- **if** / **then** / **else**: Conditional application. Form: if-schema, then-schema, else-schema (each $ref or inline).
- **dependentRequired**, **dependentSchemas**: Same as class form; apply to nested object when type is object. Form: list of “when property X present, require [Y,Z]” or “when X present, instance must satisfy schema”.

**OpenAPI Schema Object – fixed fields (property value schema)**
- **discriminator**: When property schema is polymorphic (oneOf/allOf). Form: propertyName + optional mapping; same as class form.
- **externalDocs**: url + optional description. Form: url (required), description.
- **xml**: name, namespace, prefix, attribute, wrapped. Form: same as class form; for XML serialization of this property.
- **example**: Deprecated singular example; prefer **examples** array. Form: optional legacy example field with deprecation notice.

**Specification extensions (x-*)**
- **x-***: Arbitrary key-value; key `x-` prefix or as allowed. Form: “Extensions” list: add/remove; value JSON (string, number, boolean, object, array); used for codegen hints and vendor metadata.

**Form UX and validation**
- **Type-driven UI**: Show only fields relevant to selected type (and multiple types when applicable); e.g. string section when type includes string; array section when type includes array. When type is array or object, allow “inline” or “$ref” for nested schemas.
- **Validation**: On blur or submit, validate property schema against OpenAPI 3.2 / JSON Schema 2020-12; show errors at field level; block save when invalid if policy is strict. Validate default and examples against schema.
- **Round-trip**: Form → export → import → form preserves all supported keywords; paste JSON/YAML schema to prefill; copy schema to clipboard.

| Ticket | Feature Description |
|--------|---------------------|
| #104   | Add create property form that can be reused for editing |
| #105   | Add $ref selector to the property dialog |
| #106   | Add string constraints to the property form |
| #107   | Add number/integer constraints to the property form |
| #108   | Add array constraints to the property form |
| #109   | Add object constraints to the property form |
|        | Add property name validation, type selector (single or array of types), and $ref with override summary |
|        | Add $id, $schema, $defs, $comment, title, description, default, examples, deprecated, readOnly, writeOnly, enum, const to property form |
|        | Add string: minLength, maxLength, pattern; all string formats (date-time, email, uri, uuid, etc.) and contentEncoding, contentMediaType, contentSchema |
|        | Add number/integer: minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format (int32, int64, float, double) |
|        | Add array: items, prefixItems (tuple), additionalItems, contains, minContains, maxContains, minItems, maxItems, uniqueItems, unevaluatedItems |
|        | Add object: properties, required, additionalProperties, unevaluatedProperties, propertyNames, minProperties, maxProperties, patternProperties |
|        | Add composition (allOf, oneOf, anyOf, not) and conditional (if/then/else, dependentRequired, dependentSchemas) to property form |
|        | Add discriminator, externalDocs, xml, example (deprecated), and x-* extensions to property form |
|        | Add type-driven UI (show only relevant fields), schema validation on submit, and round-trip/paste/copy for property schema |

---

### 6.3 Property Form – Metadata & Class-Property (Ticket 14c)

**Metadata, conditionals, extensions, class-property overrides**
- **Metadata**: readOnly, writeOnly, deprecated, nullable, title; default; examples (array). Reference: propertyFlags, values section.
- **Conditional schema**: if/then/else, dependentSchemas (JSON Schema 2020-12). Reference: ConditionalSchemaBuilder.
- **Extensions**: x-*; XML (attribute, wrapped). Reference: ExtensionsEditor, xmlAttribute, xmlWrapped.
- **Class-property edit**: Override required, description; order; nested parent_id. Reference: ClassPropertyEditDialog.
- **Validation**: Client-side validation (same rules as REST); call REST validate on submit; show errors.

**OpenAPI 3.2.0 / JSON Schema 2020-12 – 100% metadata, conditional, extensions, class-property, and validation**

This section ensures every metadata, conditional, extension, and class-property usage keyword is supported so that the property form and class-property join are fully spec-compliant. It complements 6.2 (core and type-specific keywords) by covering annotations, conditionals, XML, extensions, per-class usage overrides, and validation.

**Metadata and annotation keywords (complete set)**

- **title**, **description**: Short title and full description; [CommonMark] for description (OpenAPI 3.2). Form: text inputs; description with preview; used in docs, codegen, and UI. When property is reused, class-property may override **description** for this usage (see Class-property overrides).
- **default**: Default value for the property; RECOMMENDED to be valid against the schema. Form: type-aware input or JSON; validate against schema; used in docs and codegen.
- **examples**: Array of example values (JSON Schema 2020-12). Form: list of examples (add/remove/reorder); validate each against schema; used in docs and try-it-out. **example** (singular) is deprecated (OpenAPI 3.0); form may support it for compatibility with deprecation notice; prefer **examples**.
- **deprecated**: Boolean; instance location is deprecated. Form: checkbox; optional deprecation message; when true, UI and codegen may warn or hide. Applies to each instance (e.g. every array item if schema applies to items).
- **readOnly**, **writeOnly**: Booleans. Form: checkboxes. **readOnly** true: value may be sent in response, not in request; **writeOnly** true: value may be sent in request, not in response. Used in request/response schemas and codegen. When both true, behavior is implementation-defined; form may warn.
- **nullable (OpenAPI 3.2 / JSON Schema 2020-12)**: In OAS 3.2, nullability is expressed via **type** including `"null"` (e.g. `type: ["string", "null"]`), not a separate keyword. Form: “Allow null” checkbox or include “null” in type array; export as type array when null allowed; do not emit deprecated **nullable: true** unless compatibility mode for older OAS is on.
- **$comment**: Internal note; not for documentation. Form: optional text area; exclude from docs and codegen unless explicitly included.
- **$anchor**, **$dynamicAnchor** (JSON Schema 2020-12): When property schema is in **$defs** or reusable, optional **$anchor** (static) or **$dynamicAnchor** (dynamic) for reference by **$ref** / **$dynamicRef**. Form: optional “Anchor” text (valid anchor token); used for ref resolution in multi-schema documents.

**Conditional schema (JSON Schema 2020-12) – full form**

- **if**, **then**, **else**: Conditional application; instance must satisfy **if** schema, then **then** applies, else **else** applies. Form: three schema inputs (if, then, else); each $ref or inline; validate that if/then/else are valid schemas; export in order; used for conditional validation and docs. Reference: ConditionalSchemaBuilder.
- **dependentRequired**: Object; key = property name, value = array of required property names (when key is present, required list must be present). Form: list of “When property X is present, also require [Y, Z]”; key + multi-select or list of names; export as object; applies when property type is object.
- **dependentSchemas**: Object; key = property name, value = schema (when key is present, instance must satisfy schema). Form: list of “When property X is present, instance must satisfy schema”; key + schema selector or inline; export as object; applies when property type is object.
- **Validation**: Conditional keywords apply in order; validate that dependent keys exist in same schema’s properties when applicable; show errors if subschemas are invalid; round-trip export/import.

**OpenAPI XML Object – full coverage**

- **xml**: Describes XML representation of this property. Form: dedicated “XML” section with all fields:
  - **name**: Element or attribute name (overrides property name for XML). Form: text input.
  - **namespace**: XML namespace URI. Form: text input (URI).
  - **prefix**: Namespace prefix. Form: text input.
  - **attribute**: Boolean; when true, property is serialized as XML attribute not element. Form: checkbox.
  - **wrapped**: Boolean; when true, array items are wrapped in a parent element. Form: checkbox; relevant when type is array.
- Export as **xml** object; import parses and populates form; used for XML serialization and docs. Reference: ExtensionsEditor, xmlAttribute, xmlWrapped.

**Specification extensions (x-*)**

- **x-***: Arbitrary custom keys. Form: “Extensions” section: add/remove entries; **key** MUST start with **x-** (or be allowed without prefix per OpenAPI); **value** is any JSON (string, number, boolean, object, array). Form: key text input (validate prefix); value as JSON text or structured editor (string/number/boolean/object/array). Used for codegen hints, vendor metadata, and tooling. Multiple extensions allowed; keys unique.
- **Validation**: Key format; value valid JSON; no duplicate keys; export/import round-trip.

**Class-property join (usage context)**

When a property is attached to a class, the join row carries usage-specific overrides and ordering. These are not part of the standalone property schema but affect the parent class’s **properties** and **required** in export.

- **required (override)**: Whether this property is required in this class. Form: checkbox “Required in this class”; when true, property name is included in parent class’s **required** array; when false, omitted. Overrides or complements the property’s own schema (required applies to object’s properties, not to a single property schema).
- **description (override)**: Optional description override for this usage. Form: text area; when set, export uses this description for the property in this class; when empty, use property schema’s description. [CommonMark] supported.
- **order**: Position of this property in the class’s property list. Form: number input or drag-and-drop reorder; export preserves order (JSON object key order); used for UI and docs ordering.
- **parent_id** (nested property): When this property is nested under another property (e.g. object property’s child), **parent_id** references the parent property. Form: selector for parent property in same class (or parent class-property id); used for nested structure and canvas/sidebar tree; export reflects nesting in **properties** structure.
- **Class-property edit dialog**: Single place to edit join: required, description override, order, parent_id; link to full property form for schema. Reference: ClassPropertyEditDialog.

**Validation – client-side and server**

- **Client-side**: Validate property schema (and class-property overrides) using same rules as REST: OpenAPI 3.2 / JSON Schema 2020-12; type consistency; required fields; pattern/regex; min/max; etc. Validate on blur or on submit; show errors at field level (inline or summary); block save when invalid if policy is “strict”. Validate **default** and each **examples** entry against the schema.
- **Server (REST)**: On submit, call REST validate endpoint (when available) with the full class or property payload; display returned errors (path and message) in form; map path to field when possible.
- **Format**: When dialect uses format as assertion (Format-Assertion vocabulary), optionally validate format client-side or via REST; when annotation-only, validate structure only; document behavior in settings or help.
- **Round-trip**: Form → export (OpenAPI/JSON Schema) → import → form preserves all metadata, conditional, xml, extensions, and class-property required/description/order/parent_id.

| Ticket | Feature Description |
|--------|---------------------|
| #110   | Add Metadata to property form |
| #111   | Add Conditional schema settings to the property form |
| #112   | Add extensions to the property form |
| #113   | Add additional class-property editing features |
| #114   | Add validation to client-side for properties |
|        | Add full metadata: title, description, default, examples (array), deprecated, readOnly, writeOnly; nullable via type; $comment; $anchor/$dynamicAnchor |
|        | Add conditional: if/then/else with three schemas; dependentRequired (key → required list); dependentSchemas (key → schema) with validation and export |
|        | Add XML Object: name, namespace, prefix, attribute, wrapped; form section and round-trip |
|        | Add x-* extensions: key (x- prefix), value (JSON); validation and uniqueness |
|        | Add class-property: required override, description override, order, parent_id (nested); ClassPropertyEditDialog and export sync |
|        | Add client-side validation (full schema + default + examples), REST validate call, field-level errors, and format assertion option |
|        | Add round-trip for metadata, conditional, xml, extensions, and class-property in export/import |

---

## 7 Schema Designer: Enterprise, Code Generation & Mode Switching

> **Section Status**: Schema-designer features for OSS release: enterprise capabilities, code generation support, and OpenAPI vs SQL schema mode. Ticket numbers to be assigned in GitHub.

### 7.1 Schema Mode: OpenAPI vs SQL

**Mode switching and ID-based references**
- Allow the schema designer to operate in **OpenAPI mode** (current: JSON Schema / OpenAPI 3.2.0) or **SQL mode**.
- In **SQL mode**, references between schema objects (classes) are expressed by **ID** (e.g. foreign-key style: `user_id`, `tenant_id`, `parent_id`) rather than (or in addition to) nested `$ref`; support defining and editing these ID-based references in the class/property forms and on the canvas.
- Persist the selected mode per version or project; validate and export appropriately (OpenAPI doc in OpenAPI mode; DDL or relational model in SQL mode).
- **Reference**: ClassEditDialog, PropertyFormFields, canvas edges; add mode selector in toolbar or project/version settings; extend schema storage for ID-reference metadata.

| Ticket | Feature Description |
|--------|---------------------|
| #115   | Add schema mode selector (OpenAPI vs SQL) in the schema designer |
| #116   | Implement ID-based references between classes in SQL mode (e.g. foreign-key style properties) |
| #117   | Persist and validate schema according to selected mode; export OpenAPI or SQL/DDL accordingly |
| #118   | Extend class and property forms to define and edit ID-based references when in SQL mode |

---

### 7.2 Code Generation from Schema

**Templates, preview, and versioning for codegen**
- **Code generation templates**: Configurable templates for generating code from the current schema (e.g. TypeScript/JavaScript types, Prisma schema, SQL DDL, GraphQL schema, Go structs, Pydantic models). Store templates in project or workspace; allow custom templates (e.g. Mustache/Handlebars or a small DSL).
- **Code generation preview**: In the schema designer, a panel or dialog to preview generated code for the selected template and target (e.g. “TypeScript types for this version”). Refresh on schema change; copy or download output.
- **Schema version tag for codegen**: Tag or label schema versions for code generation (e.g. `v1`, `api-v2`); generate against a chosen version or the current working version.
- **Validation rules export**: Export validation rules (required, format, pattern, min/max, enum, etc.) in a form suitable for code generation or documentation (e.g. JSON or structured format for client validators).
- **Reference**: New UI under Studio or Dashboard (e.g. “Generate code” action); template registry; reuse existing export/generator patterns where applicable.

| Ticket | Feature Description |
|--------|---------------------|
| #119   | Add configurable code generation templates (TypeScript, Prisma, SQL DDL, GraphQL, etc.) |
| #120   | Add code generation preview panel in schema designer with copy/download |
| #121   | Add schema version tagging for code generation and generate against chosen version |
| #122   | Export validation rules in a structured format for code generation and documentation |

---

### 7.3 Enterprise Schema Designer Features

**Annotations, multi-schema, and audit**
- **Schema annotations for codegen**: Support `x-*` or custom annotations on classes and properties that drive code generation (e.g. table name, column name, ORM hints, serialization name). Edit in class/property forms; include in exports and codegen templates.
- **Multi-schema workspace**: Support viewing or comparing multiple schemas (or versions) in one workspace (e.g. side-by-side or diff) for comparison and code generation across versions.
- **Audit log for schema changes**: Optional audit trail of schema changes (who changed what, when) for compliance; store in version history or separate audit table; expose in dashboard or version history UI.
- **Documentation generation**: Generate API documentation (e.g. OpenAPI document, Markdown, or static site) from the schema designer with optional branding and tenant-specific styling.
- **Reference**: ClassEditDialog, PropertyDialog, version history; new “Annotations” or “Codegen” section in forms; audit tables and REST endpoints; docs generator.

| Ticket | Feature Description |
|--------|---------------------|
| #123   | Add schema annotations (x-* / custom) for code generation in class and property forms |
| #124   | Add multi-schema workspace view for comparison and code generation across versions |
| #125   | Add optional audit log for schema changes (who, what, when) with dashboard visibility |
| #126   | Add documentation generation from schema (OpenAPI, Markdown, or static site) with optional branding |

---

## 8 Enterprise & Developer Experience

> **Section Status**: Enterprise readiness and development-friendly capabilities. Ticket numbers to be assigned in GitHub.

### 8.1 Security, Auth & Permissions

**Enterprise auth and fine-grained access**
- **SSO / OIDC / SAML**: Optional integration with identity providers (e.g. Okta, Auth0, Azure AD) for login and user provisioning; support OIDC discovery and SAML metadata for enterprise deployments.
- **RBAC**: Fine-grained roles and permissions beyond tenant-admin (e.g. schema-editor, viewer, publisher, auditor); permission checks on REST endpoints and UI; optional resource-level permissions (per project or version).
- **API key scopes**: Scope API keys by tenant, project, or role (e.g. read-only vs full) for CI/CD and external integrations.
- **Reference**: auth routes, middleware; new tables or config for roles/permissions; document in OpenAPI.

| Ticket | Feature Description |
|--------|---------------------|
| #127   | Add optional SSO integration (OIDC / SAML) for enterprise identity providers |
| #128   | Implement RBAC with configurable roles and permissions (schema-editor, viewer, publisher, auditor) |
| #129   | Add API key scopes (tenant, project, role) for CI/CD and integrations |

---

### 8.2 Observability, Reliability & Operations

**Health, metrics, and operational controls**
- **Health and readiness**: REST endpoints for liveness and readiness (e.g. `/health`, `/ready`) for Kubernetes and load balancers; optional DB and dependency checks.
- **Structured logging and tracing**: Structured logs (e.g. JSON) with request id, tenant, user; optional OpenTelemetry or trace-id for debugging and observability.
- **Rate limiting and quotas**: Configurable rate limits per tenant or API key; optional quotas for projects/versions for fair use and cost control.
- **Backup and restore**: Documented backup/restore procedures for version history and audit data; optional export/import for disaster recovery.
- **Reference**: new health routes; logging middleware; rate-limit middleware; ops runbook or docs.

| Ticket | Feature Description |
|--------|---------------------|
| #130   | Add health and readiness endpoints for orchestration and load balancers |
| #131   | Add structured logging and optional OpenTelemetry tracing |
| #132   | Add configurable rate limiting and optional quotas per tenant or API key |
| #133   | Document backup/restore and optional export/import for disaster recovery |

---

### 8.3 Developer-Friendly Integrations

**CLI, webhooks, catalog API, and promotion**
- **Developer CLI / SDK**: CLI or SDK (e.g. Node or Python) for scripting: pull/push schema, export OpenAPI, trigger code generation; usable in CI/CD pipelines and local dev.
- **Webhooks**: Configurable webhooks on schema events (e.g. version committed, published, branch created); payload with version/project metadata; retry and secret for signing.
- **Schema catalog API**: Public or authenticated catalog API to list projects, versions, and published schemas (by tenant or org) for discovery, Backstage catalog sync, or API gateways.
- **Schema promotion and environments**: Optional promotion workflow (e.g. dev → staging → prod) with environment or deployment targets; track which version is “live” per environment.
- **Reference**: new CLI package or script; webhook table and delivery job; catalog endpoints; environment/promotion metadata.

| Ticket | Feature Description |
|--------|---------------------|
| #134   | Add developer CLI or SDK for pull/push, export, and codegen in CI/CD |
| #135   | Add configurable webhooks for schema events (commit, publish, branch) with retry and signing |
| #136   | Add schema catalog API for discovery and integration with API gateways or IDPs |
| #137   | Add optional schema promotion workflow (dev/staging/prod) with deployment targets |

---

### 8.4 Developer Onboarding & Tooling

**Quickstart, samples, and IDE support**
- **Quickstart and samples**: One-command or script to run Objectified locally (e.g. Docker Compose); sample project(s) with example schemas and versions for onboarding.
- **API playground**: Interactive API docs (e.g. Swagger UI or Stoplight) from the published OpenAPI spec; try-it-out for key endpoints with auth.
- **IDE or editor integration**: Optional VS Code (or other) extension for schema validation, snippet generation, or “open in Objectified” from local OpenAPI/JSON Schema files.
- **Reference**: docker-compose, sample data seeds; OpenAPI UI; extension repo or spec.

| Ticket | Feature Description |
|--------|---------------------|
| #138   | Add quickstart (e.g. Docker Compose) and sample projects for onboarding |
| #139   | Add API playground (Swagger UI or similar) from OpenAPI spec with try-it-out |
| #140   | Add optional IDE/editor integration (e.g. VS Code extension) for schema validation and links to Objectified |

---

## 9 Backstage IDP Plugin

> **Section Status**: Plugin for use within Backstage (Internal Developer Portal). Enables schema discovery, documentation, and workflow from the IDP. Ticket numbers to be assigned in GitHub.

### 9.1 Backstage Plugin – Core

**Plugin package and integration**
- **Backstage plugin package**: Create a Backstage plugin (e.g. `@internal/objectified-plugin` or OSS name) that can be added to a Backstage app; plugin exposes one or more pages and optional entity cards.
- **Configuration and auth**: Plugin config for Objectified REST base URL and auth (API key or Backstage proxy with user identity); support Backstage’s proxy for secure backend calls.
- **Entity integration**: Define Backstage catalog entity kind(s) for “Schema” or “API” (e.g. `objectified-schema.v1`) with spec pointing to project/version; optional entity provider to sync from Objectified catalog API into Backstage Software Catalog.
- **Reference**: Backstage plugin API; `createPlugin`, `createRouteRef`; Backstage auth and proxy; catalog `Entity` and provider interfaces.

| Ticket | Feature Description |
|--------|---------------------|
| #141   | Create Backstage plugin package with page(s) and configuration for Objectified REST URL and auth |
| #142   | Add Backstage proxy support for secure calls to Objectified API |
| #143   | Define Backstage catalog entity kind for Schema/API and optional entity provider to sync from Objectified |

---

### 9.2 Backstage Plugin – Features

**Schema discovery, docs, and actions**
- **Schema overview page**: Plugin page that lists projects and versions (by tenant or org); link to open schema in Objectified or show read-only summary (classes, last updated).
- **TechDocs integration**: Option to publish generated schema documentation (OpenAPI, Markdown) to Backstage TechDocs so schema docs appear alongside other docs in the IDP.
- **Entity card and actions**: Catalog entity card for Schema/API entities showing version, last published, link to Objectified; optional “Open in Objectified” and “Export OpenAPI” actions.
- **Reference**: Backstage frontend components; TechDocs API; catalog entity page extensions.

| Ticket | Feature Description |
|--------|---------------------|
| #144   | Add plugin page for schema overview (projects, versions) with links to Objectified |
| #145   | Add optional TechDocs integration to publish schema documentation into Backstage |
| #146   | Add catalog entity card and actions (Open in Objectified, Export OpenAPI) for Schema/API entities |

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

**Document Version**: 1.1
**Last Updated**: March 02, 2026  
**Next Review**: Before OSS release  
**Purpose**: Single-step tasks with enough detail to drive an LLM/Agent to implement each feature.
