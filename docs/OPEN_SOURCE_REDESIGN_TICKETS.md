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
