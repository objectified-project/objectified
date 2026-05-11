# Objectified: Developer Mode + Unified Workspace - Feature Roadmap

> An "Advanced / Developer Mode" view inside the Objectified web app that exposes the Designer (schemas) and Paths (operations) artifacts as first-class code surfaces — Monaco-based editors with bidirectional sync to the existing canvases, an LSP for Objectified's schema/OpenAPI dialect, a unified Designer+Paths workspace with combined-lens visualization, and a sandboxed TypeScript SDK playground for programmatic schema operations.
>
> **Revenue Model**: Pro tier feature; Developer Mode toggle gated by entitlement. SDK playground & combined-lens canvas are Pro-exclusive.
>
> **Tech Stack**: NextJS App Router, Radix UI primitives, Monaco Editor, Language Server Protocol (LSP) over web-worker, Y.js for canvas↔code sync, React Flow for combined canvas, Spectral for OpenAPI lint, web-worker TS runtime (esbuild-wasm + ses) for the SDK sandbox.
>
> **Reference Mockups**: `objectified-ui/public/mockups/developer/{index,schema-editor,paths-editor,sdk-playground}.html` and `objectified-ui/public/mockups/new-layout/{index,workspace}.html`.
>
> **Last Updated**: May 11, 2026

## GitHub tracking

**Repository**: [KenSuenobu/objectified-commercial](https://github.com/KenSuenobu/objectified-commercial)

Tickets were created from this roadmap with structured descriptions (problem, scope, acceptance criteria, parallelism/dependencies, tech stack, epic parent, ASCII diagrams).

### Epics

| # | Epic | Issue |
|---|------|------:|
| 1 | Developer Mode Foundation *(MVP)* | [#3337](https://github.com/KenSuenobu/objectified-commercial/issues/3337) |
| 2 | Schema Code Editor *(MVP)* | [#3338](https://github.com/KenSuenobu/objectified-commercial/issues/3338) |
| 3 | Paths Code Editor *(MVP)* | [#3339](https://github.com/KenSuenobu/objectified-commercial/issues/3339) |
| 4 | Unified Workspace Layout *(MVP)* | [#3340](https://github.com/KenSuenobu/objectified-commercial/issues/3340) |
| 5 | SDK Playground *(v2)* | [#3341](https://github.com/KenSuenobu/objectified-commercial/issues/3341) |
| 6 | Advanced Editor Capabilities *(v2)* | [#3342](https://github.com/KenSuenobu/objectified-commercial/issues/3342) |

### Work items (roadmap ID → GitHub issue)

| ID | Issue |
|----|------:|
| 1.1 | [#3343](https://github.com/KenSuenobu/objectified-commercial/issues/3343) |
| 1.2 | [#3344](https://github.com/KenSuenobu/objectified-commercial/issues/3344) |
| 1.3 | [#3345](https://github.com/KenSuenobu/objectified-commercial/issues/3345) |
| 1.4 | [#3346](https://github.com/KenSuenobu/objectified-commercial/issues/3346) |
| 1.5 | [#3347](https://github.com/KenSuenobu/objectified-commercial/issues/3347) |
| 2.1 | [#3348](https://github.com/KenSuenobu/objectified-commercial/issues/3348) |
| 2.2 | [#3349](https://github.com/KenSuenobu/objectified-commercial/issues/3349) |
| 2.3 | [#3350](https://github.com/KenSuenobu/objectified-commercial/issues/3350) |
| 2.4 | [#3351](https://github.com/KenSuenobu/objectified-commercial/issues/3351) |
| 2.5 | [#3352](https://github.com/KenSuenobu/objectified-commercial/issues/3352) |
| 3.1 | [#3353](https://github.com/KenSuenobu/objectified-commercial/issues/3353) |
| 3.2 | [#3354](https://github.com/KenSuenobu/objectified-commercial/issues/3354) |
| 3.3 | [#3355](https://github.com/KenSuenobu/objectified-commercial/issues/3355) |
| 3.4 | [#3356](https://github.com/KenSuenobu/objectified-commercial/issues/3356) |
| 3.5 | [#3357](https://github.com/KenSuenobu/objectified-commercial/issues/3357) |
| 4.1 | [#3358](https://github.com/KenSuenobu/objectified-commercial/issues/3358) |
| 4.2 | [#3359](https://github.com/KenSuenobu/objectified-commercial/issues/3359) |
| 4.3 | [#3360](https://github.com/KenSuenobu/objectified-commercial/issues/3360) |
| 4.4 | [#3361](https://github.com/KenSuenobu/objectified-commercial/issues/3361) |
| 4.5 | [#3362](https://github.com/KenSuenobu/objectified-commercial/issues/3362) |
| 4.6 | [#3363](https://github.com/KenSuenobu/objectified-commercial/issues/3363) |
| 5.1 | [#3364](https://github.com/KenSuenobu/objectified-commercial/issues/3364) |
| 5.2 | [#3366](https://github.com/KenSuenobu/objectified-commercial/issues/3366) |
| 5.3 | [#3367](https://github.com/KenSuenobu/objectified-commercial/issues/3367) |
| 5.4 | [#3368](https://github.com/KenSuenobu/objectified-commercial/issues/3368) |
| 5.5 | [#3369](https://github.com/KenSuenobu/objectified-commercial/issues/3369) |
| 5.6 | [#3370](https://github.com/KenSuenobu/objectified-commercial/issues/3370) |
| 6.1 | [#3371](https://github.com/KenSuenobu/objectified-commercial/issues/3371) |
| 6.2 | [#3372](https://github.com/KenSuenobu/objectified-commercial/issues/3372) |
| 6.3 | [#3373](https://github.com/KenSuenobu/objectified-commercial/issues/3373) |
| 6.4 | [#3374](https://github.com/KenSuenobu/objectified-commercial/issues/3374) |

---

## MVP Definition

- A user-toggled **Developer Mode** that swaps the Designer / Paths sections for code-first editor shells, hosted *inside* the Objectified app (not a separate IDE).
- Monaco-based **Schema Code editor** with bidirectional sync to the existing Designer canvas and an LSP that surfaces validation errors, IntelliSense, and quick-fixes for Objectified's JSON schema dialect.
- Monaco-based **Paths Code editor** with bidirectional sync to the existing Paths canvas, Spectral linting, and a mock-server probe.
- A **Unified Workspace** layout that replaces the split Designer/Paths sections with one project tree (domain-grouped), one canvas with three lenses (Schemas, Paths, Combined), an adaptive inspector, and a ⌘K command palette.
- Feature parity for create / read / update / delete on every artifact type reachable from the existing Designer and Paths sections.

## Out of MVP (v2)

- **SDK Playground** — sandboxed TypeScript notebooks with `@objectified/sdk` for programmatic, transactional codemods.
- Advanced editor capabilities: multi-file refactors, in-editor branch switcher, inline AI suggestions, editor plugin API.

---

## Epic Order (delivery sequence)

| # | Epic | Phase | Epic issue | Why this order |
|---|------|-------|:----------:|----------------|
| 1 | Developer Mode Foundation | MVP | [#3337](https://github.com/KenSuenobu/objectified-commercial/issues/3337) | Nothing else lights up until the toggle, shell, and virtual filesystem exist. |
| 2 | Schema Code Editor | MVP | [#3338](https://github.com/KenSuenobu/objectified-commercial/issues/3338) | Single highest-value surface; mirrors the centerpiece mockup `schema-editor.html`. |
| 3 | Paths Code Editor | MVP | [#3339](https://github.com/KenSuenobu/objectified-commercial/issues/3339) | Reuses Epic 2's editor shell + LSP scaffolding for OpenAPI YAML. |
| 4 | Unified Workspace Layout | MVP | [#3340](https://github.com/KenSuenobu/objectified-commercial/issues/3340) | Pulls Epics 1–3 together into the proposed Designer+Paths convergence. |
| 5 | SDK Playground | v2 | [#3341](https://github.com/KenSuenobu/objectified-commercial/issues/3341) | Builds on the SDK surface area exposed by Epics 2–4. |
| 6 | Advanced Editor Capabilities | v2 | [#3342](https://github.com/KenSuenobu/objectified-commercial/issues/3342) | Polish + power-user features that assume the foundation is mature. |

---

## Epic 1: Developer Mode Foundation  *(MVP)*

### Summary Table

| #    | Title                                  | Description                                                                            | Labels                                            | Parallel |
|------|----------------------------------------|----------------------------------------------------------------------------------------|---------------------------------------------------|----------|
| 1.1  | Developer Mode entitlement & toggle    | Per-user toggle gated by Pro entitlement; persisted server-side.                       | `enhancement`, `developer-mode`, `mvp`, `ui`      | No       |
| 1.2  | Editor shell & theming                 | Monaco host wired into the Objectified chrome; light/dark; font + key-binding presets. | `enhancement`, `developer-mode`, `mvp`, `ui`      | Yes      |
| 1.3  | Virtual project filesystem             | A read/write `obj://` filesystem that maps classes, paths, libraries to virtual files. | `enhancement`, `developer-mode`, `mvp`, `rest`    | Yes      |
| 1.4  | Developer-mode chrome (rail, tabs, status bar) | Left rail nav, file tree, breadcrumbs, tab bar, status bar — adapted from existing Designer chrome. | `enhancement`, `developer-mode`, `mvp`, `ui` | No       |
| 1.5  | Telemetry & feature flag wiring        | Track adoption, error rates, command usage; flag for staged rollout.                  | `enhancement`, `developer-mode`, `mvp`, `analytics` | Yes    |

### 1.1 — Developer Mode entitlement & toggle

Adds a per-user "Developer Mode" preference, surfaced in profile settings and as a one-click toggle in the top app bar. The toggle is gated by a Pro entitlement check (`GET /api/v1/entitlements/developer-mode`); free-tier users see a paywall card. Selection is persisted via `PUT /api/v1/users/me/preferences` and respected on next render through a server component wrapper.

```
  ┌────────────────────────────────────────────────────────┐
  │  TopHeader                                              │
  │  ┌────────┐ ┌────────────┐  ┌──────────────────┐  ⚙   │
  │  │ Logo   │ │ Project ▾  │  │ ◐ Developer Mode │      │
  │  └────────┘ └────────────┘  └────────┬─────────┘      │
  └──────────────────────────────────────┼─────────────────┘
                                          │ flips
                                          ▼
              ┌───────────────────────┐  ┌───────────────────────┐
              │  Designer (canvas)    │  │  Schema Code editor   │
              │  Paths    (canvas)    │  │  Paths    Code editor │
              └───────────────────────┘  └───────────────────────┘
                       (off)                     (on)
```

**Acceptance Criteria**
- Free-tier users see a Pro upsell instead of the toggle.
- Toggle state persists across sessions and devices.
- The chosen mode is honored by SSR (no client-side flicker).
- Telemetry event `developer_mode.toggled` fires with `from` / `to` values.

**Part of Epic: Developer Mode Foundation**

---

### 1.2 — Editor shell & theming

Embeds Monaco Editor as a reusable React component (`<ObjectifiedEditor>`) that respects Objectified's design tokens. Light/dark themes are derived from the existing Tailwind palette so the editor never visually clashes with the chrome. Key bindings default to VS Code (familiar) with an opt-in Vim mode via `monaco-vim`.

```
  ┌──────────────────────────────────────────────────────────┐
  │  <ObjectifiedEditor                                       │
  │     language="objectified-schema" | "openapi-yaml"        │
  │     model={vfsUri}                                        │
  │     theme={themeFromTailwind(isDark)}                     │
  │     keymap={"vscode" | "vim"}                             │
  │     diagnostics={fromLsp}  onSave={writeVfs}              │
  │  />                                                       │
  └──────────────────────────────────────────────────────────┘
```

**Acceptance Criteria**
- Monaco loads lazily (route-level dynamic import); first paint <300 ms p95 on cached load.
- Theme switches with the rest of the app and respects `prefers-color-scheme`.
- Vim mode togglable per user; persists in preferences.
- Editor exposes a stable `onSave` callback that the VFS layer subscribes to.

**Part of Epic: Developer Mode Foundation**

---

### 1.3 — Virtual project filesystem

Introduces an in-app `obj://` virtual filesystem that maps Objectified entities to addressable file URIs (`obj://customers/customer.objschema.json`, `obj://openapi.yaml`). The VFS is the canonical source the editor reads from and writes back to; it sits in front of the existing REST endpoints and translates writes into the appropriate PATCH/POST calls.

```
   Editor model              VFS layer                REST API
  ┌─────────────┐         ┌──────────────┐        ┌────────────────┐
  │ Monaco URI  │◀──────▶│  obj:// fs   │◀──────▶│  /api/v1/...   │
  │  read/write │         │  cache+ETag  │        │  classes/paths │
  └─────────────┘         └──────────────┘        └────────────────┘
                                 │
                                 ▼
                          conflict resolver
                          (server-wins, with toast)
```

**Acceptance Criteria**
- VFS exposes `readFile`, `writeFile`, `stat`, `watch`, `list`.
- Writes are debounced (500 ms) and coalesced into a single PATCH per entity.
- ETag-based conflict detection surfaces a Radix `AlertDialog` with "reload" / "overwrite" / "diff" actions.
- VFS contents are reflected in the file tree (Epic 1.4) and the project tree (Epic 4.1).

**Part of Epic: Developer Mode Foundation**

---

### 1.4 — Developer-mode chrome (rail, tabs, status bar)

Builds the chrome around the Monaco editor: a left rail with the existing Designer-style nav, a file tree, a multi-tab bar with breadcrumb path, and a bottom status bar for branch/runtime/diagnostics counts. Mirrors the structure used in the mockups.

```
  ┌────┬──────────┬───────────────────────────────────┐
  │ 🧭 │ files/   │ tab1.json × | tab2.yaml × | + │   │
  │ 🗄 │ ...      ├───────────────────────────────────┤
  │ 🔍 │          │  breadcrumbs                       │
  │ ⚙  │          ├───────────────────────────────────┤
  │    │          │  Monaco editor                     │
  │    │          │                                    │
  │    │          ├───────────────────────────────────┤
  │    │          │  ⎇ branch · 0 ⛔ · 2 ⚠ · UTF-8    │
  └────┴──────────┴───────────────────────────────────┘
```

**Acceptance Criteria**
- Tabs support reorder, dirty indicator, middle-click close, ⌘W close.
- File tree supports keyboard navigation (↑/↓/⌥→/⌥←) and follows Radix tree-view a11y.
- Status bar pulls live counts from the LSP diagnostic stream.

**Part of Epic: Developer Mode Foundation**

---

### 1.5 — Telemetry & feature flag wiring

Wires Developer Mode into the existing telemetry pipeline and feature-flag service so the rollout can be staged (10% → 50% → 100%) and adoption observed.

**Acceptance Criteria**
- Events: `dev_mode.toggled`, `dev_mode.editor_opened`, `dev_mode.command_invoked`, `dev_mode.error`.
- Flag `developer_mode.enabled` honored at edge and in the entitlement check.
- Dashboard tile in the existing analytics dashboard shows DAU + error rate.

**Part of Epic: Developer Mode Foundation**

---

## Epic 2: Schema Code Editor  *(MVP)*

### Summary Table

| #    | Title                                          | Description                                                                                              | Labels                                              | Parallel |
|------|------------------------------------------------|----------------------------------------------------------------------------------------------------------|-----------------------------------------------------|----------|
| 2.1  | Objectified-schema language definition         | Monaco language id + tokenizer + grammar for the JSON schema dialect.                                    | `enhancement`, `developer-mode`, `mvp`, `ui`        | Yes      |
| 2.2  | Schema LSP (web worker)                        | Diagnostics, hover, completion, go-to-def, rename for Objectified schemas.                              | `enhancement`, `developer-mode`, `mvp`, `rest`      | Yes      |
| 2.3  | Bidirectional canvas ↔ code sync               | Y.js-backed shared model so canvas edits and code edits converge.                                       | `enhancement`, `developer-mode`, `mvp`, `ui`        | No       |
| 2.4  | Split view (code + live canvas pane)           | The centerpiece view from `schema-editor.html`.                                                          | `enhancement`, `developer-mode`, `mvp`, `ui`        | No       |
| 2.5  | Quick-fixes & code actions                     | LSP-provided actions for dangling `$ref`, missing `required`, type mismatches.                           | `enhancement`, `developer-mode`, `mvp`, `rest`      | Yes      |

### 2.1 — Objectified-schema language definition

Registers a Monaco language `objectified-schema` that extends `json` with semantic tokens for `$ref` targets, Objectified-specific keywords (e.g. `objClass`, `objAlias`), and stricter validation against the canonical Objectified meta-schema. Ships the grammar as a JSON file consumed by Monaco's monarch tokenizer.

**Acceptance Criteria**
- Syntax highlighting matches the mockup (`schema-editor.html`).
- File-association rule: `*.objschema.json` → `objectified-schema`.
- Folding ranges, bracket matching, comment toggling all work.

**Part of Epic: Schema Code Editor**

---

### 2.2 — Schema LSP (web worker)

Implements a Language Server Protocol service that runs in a web worker and validates against Objectified's meta-schema plus tenant-installed property libraries. Provides diagnostics, hover tooltips with property docs, autocomplete for `$ref` targets and library properties, and rename across files.

```
       Editor (main)                Web Worker (LSP)
   ┌────────────────────┐       ┌──────────────────────┐
   │ Monaco model       │──────▶│ textDocument/didOpen │
   │   (didChange)      │       │ validate()           │
   │                    │◀──────│ publishDiagnostics   │
   │ hover / completion │──────▶│ resolve()            │
   └────────────────────┘       └──────────────────────┘
                                          │
                                          ▼
                                   property library
                                   meta-schema cache
```

**Acceptance Criteria**
- Diagnostics arrive within 250 ms p95 of a keystroke.
- Hover shows property name, type, description, source library, and example.
- Completion includes all classes, libraries, and primitive types reachable in the project.
- Rename is workspace-wide and previewed in a Radix `Dialog` before applying.

**Part of Epic: Schema Code Editor**

---

### 2.3 — Bidirectional canvas ↔ code sync

A Y.js shared model is the single source of truth backing both the Designer canvas and the Monaco editor. Edits in either view are CRDT-merged, debounced, and persisted via the VFS layer. Eliminates drift between code and canvas representations.

```
    Designer canvas               Monaco editor
   ┌────────────────┐            ┌────────────────┐
   │ React Flow     │            │ Monaco model   │
   └───────┬────────┘            └────────┬───────┘
           ▼                              ▼
        ┌──────────────────────────────────────┐
        │     Y.js shared doc (CRDT)           │
        │     ↳ classes, properties, refs      │
        └─────────────────┬────────────────────┘
                          ▼
                     VFS layer (1.3)
                          ▼
                       REST API
```

**Acceptance Criteria**
- Edit in either pane reflects in the other within 100 ms (no flicker, no jump).
- Concurrent edits from two browser tabs converge without data loss.
- Undo/redo stack is shared between panes.

**Part of Epic: Schema Code Editor**

---

### 2.4 — Split view (code + live canvas pane)

Replicates the centerpiece mockup: header toggle for `Canvas | Code | Split`, with Split rendering Monaco on the left and a read-only-but-interactive canvas pane on the right. Selecting a class in canvas scrolls the editor to its block; clicking a `$ref` in code highlights the target node in canvas.

**Acceptance Criteria**
- Toggle persists per file in user preferences.
- Selection sync is bidirectional and debounced.
- Splitter is draggable; min pane width 320 px.

**Part of Epic: Schema Code Editor**

---

### 2.5 — Quick-fixes & code actions

LSP `codeAction` provider that surfaces lightbulb fixes for common schema issues: dangling `$ref`, missing `required` entries that contradict declared properties, type mismatches between `$ref` source and target, and unused property-library imports.

**Acceptance Criteria**
- Quick-fixes are surfaced both in the gutter lightbulb and in the diagnostic toast (per `schema-editor.html`).
- Each fix is a single keystroke (⌘.) and reversible via undo.
- Telemetry tracks fix-acceptance rate per rule.

**Part of Epic: Schema Code Editor**

---

## Epic 3: Paths Code Editor  *(MVP)*

### Summary Table

| #    | Title                                       | Description                                                                                          | Labels                                              | Parallel |
|------|---------------------------------------------|------------------------------------------------------------------------------------------------------|-----------------------------------------------------|----------|
| 3.1  | OpenAPI YAML editor + VFS binding           | Monaco YAML mode bound to `obj://openapi.yaml`; reuses Epic 1 shell.                                | `enhancement`, `developer-mode`, `mvp`, `ui`        | Yes      |
| 3.2  | Spectral lint pipeline                      | Spectral runs in a worker; rules from the in-app lint config; results feed diagnostics.            | `enhancement`, `developer-mode`, `mvp`, `linting`   | Yes      |
| 3.3  | Live Paths canvas preview pane              | Read-only-but-navigable Paths canvas alongside the YAML, mirroring `paths-editor.html`.            | `enhancement`, `developer-mode`, `mvp`, `ui`        | No       |
| 3.4  | Mock-server probe panel                     | Inline panel that hits the existing mock server with the current operation; shows req/resp.       | `enhancement`, `developer-mode`, `mvp`, `mock`      | Yes      |
| 3.5  | Schema cross-references in YAML             | $ref completion + go-to-def hops from openapi.yaml into the Schema editor.                          | `enhancement`, `developer-mode`, `mvp`, `rest`      | Yes      |

### 3.1 — OpenAPI YAML editor + VFS binding

Reuses `<ObjectifiedEditor>` (Epic 1.2) with `language="openapi-yaml"`. The model is bound to a single `obj://openapi.yaml` VFS file that the server projects from the path artifacts.

**Acceptance Criteria**
- Edits persist via the VFS write path and round-trip back into the Paths canvas model.
- Yaml-language-server provides core syntax + structural validation.

**Part of Epic: Paths Code Editor**

---

### 3.2 — Spectral lint pipeline

Runs Spectral in a worker against the editor model on every change (debounced). Default rule set follows house style; tenants can edit `obj://lint/.spectral.yaml`. Lint findings flow into the same diagnostics stream as the LSP, so Monaco renders them identically.

```
  YAML model ──▶ debounce(300ms) ──▶ Spectral worker ──▶ diagnostics
                                          │
                                          ▼
                               .spectral.yaml (VFS)
```

**Acceptance Criteria**
- House rule set covers OpenAPI 3.1 best practices and Objectified naming conventions.
- Severity classification: `error`, `warn`, `info`, `hint`.
- Lint runs <500 ms p95 on a 200-operation spec.
- Per-tenant rule overrides are respected.

**Part of Epic: Paths Code Editor**

---

### 3.3 — Live Paths canvas preview pane

Embeds the existing Paths canvas (read-only, but selectable) next to the YAML so authors see swimlanes and method colors update as they type. Mirrors the layout from the `paths-editor.html` mockup.

**Acceptance Criteria**
- Hover/selection sync with the YAML cursor.
- Splitter behavior consistent with Epic 2.4.

**Part of Epic: Paths Code Editor**

---

### 3.4 — Mock-server probe panel

A side panel that builds a sample request from the current operation, fires it at the existing mock server, and shows the response with status, latency, and shape-validation result.

```
  ┌──────────────────────────────────────────────┐
  │  Probe · GET /customers                  ▶  │
  ├──────────────────────────────────────────────┤
  │  ?workspace_id=ws_demo&limit=2               │
  │                                               │
  │  ⏱ 41 ms   ✓ 200 OK   ✓ matches schema      │
  │  [ {id: "...", workspace_id: "ws_demo"} ]    │
  └──────────────────────────────────────────────┘
```

**Acceptance Criteria**
- Probe respects the user's auth context for the mock server.
- Response is validated against the declared response schema; mismatches are highlighted.
- Last 10 probes per operation are retained in session state.

**Part of Epic: Paths Code Editor**

---

### 3.5 — Schema cross-references in YAML

`$ref` completion in the YAML editor enumerates classes from Epic 2's schema editor. Cmd-click on a `$ref` opens the target schema file at the correct line.

**Acceptance Criteria**
- Completion lists all classes and components in the project with summary tooltips.
- Go-to-def works across files via the VFS.
- Renames performed in the schema editor invalidate stale `$ref` paths and surface them as diagnostics in YAML.

**Part of Epic: Paths Code Editor**

---

## Epic 4: Unified Workspace Layout  *(MVP)*

### Summary Table

| #    | Title                                            | Description                                                                                  | Labels                                              | Parallel |
|------|--------------------------------------------------|----------------------------------------------------------------------------------------------|-----------------------------------------------------|----------|
| 4.1  | Domain-grouped project tree                      | Single tree mixing schemas + paths grouped by domain folder.                                | `enhancement`, `new-layout`, `mvp`, `ui`            | Yes      |
| 4.2  | Lens switcher (Schemas / Paths / Combined)      | Top-of-canvas toggle that swaps the rendered view.                                          | `enhancement`, `new-layout`, `mvp`, `ui`            | Yes      |
| 4.3  | Combined-lens canvas with consumption edges     | React-Flow canvas that draws schemas, paths, and the edges between them.                    | `enhancement`, `new-layout`, `mvp`, `ui`            | No       |
| 4.4  | Adaptive inspector (right rail)                  | Single inspector that re-renders based on selection type (class, prop, path, param).       | `enhancement`, `new-layout`, `mvp`, `ui`            | Yes      |
| 4.5  | ⌘K command palette                               | Global palette for navigation, actions, and saved searches.                                 | `enhancement`, `new-layout`, `mvp`, `ui`            | Yes      |
| 4.6  | Migration of existing Designer/Paths routes     | Route both legacy URLs into the unified workspace; preserve deep links.                     | `enhancement`, `new-layout`, `mvp`, `ui`            | No       |

### 4.1 — Domain-grouped project tree

Today the Designer and Paths sections each have their own tree. This issue introduces a single project tree where the top level is **domain folders** (e.g. `customers/`, `billing/`), and each folder contains both the schemas and paths that belong to that domain.

```
  Today                          Proposed
  ┌──────────────┐               ┌──────────────────────────┐
  │ Designer     │               │ Project                   │
  │  ▸ Customer  │               │  ▾ customers/   3·4      │
  │  ▸ Address   │               │     ▸ Schemas (3)         │
  │  ▸ Invoice   │               │     ▸ Paths   (4)         │
  └──────────────┘               │  ▸ billing/     5·9      │
  ┌──────────────┐               │  ▸ webhooks/    2·3      │
  │ Paths        │               │  ▸ shared/        8       │
  │  GET /...    │               └──────────────────────────┘
  │  POST /...   │
  └──────────────┘
```

**Acceptance Criteria**
- Domain grouping is derived from a single `domain` field on each artifact (migrated from current namespace).
- Tree supports drag/drop between domains, Radix-tree a11y, and badge counts (`schemas·paths`).
- Default-open behavior follows last user expansion state per project.

**Part of Epic: Unified Workspace Layout**

---

### 4.2 — Lens switcher

A Radix `ToggleGroup` at the top of the canvas swaps between three rendered views over the same project tree. Selection persists per project.

```
  ┌────────────────────────────────────────────┐
  │ [ ▣ Schemas ] [ ⤳ Paths ] [ ◈ Combined* ]  │
  └────────────────────────────────────────────┘
```

**Acceptance Criteria**
- Schemas lens = today's Designer canvas, scoped to the selected domain.
- Paths lens = today's Paths canvas, scoped to the selected domain.
- Combined lens = Epic 4.3.
- Lens choice is reflected in the URL for shareable links.

**Part of Epic: Unified Workspace Layout**

---

### 4.3 — Combined-lens canvas with consumption edges

A React-Flow canvas with two columns (Schemas left, Paths right) and edges connecting each operation to the schemas it consumes. Direct usage = solid edge; nested usage (via parent class) = dashed.

```
   Schemas              Paths
   ┌──────────┐         ┌──────────────────────┐
   │ Customer │─────────│ GET  /customers      │
   │          │────┐    │ POST /customers      │
   └──────────┘    └────│ GET  /customers/{id} │
   ┌──────────┐         │ DEL  /customers/{id} │
   │ Address  │┄┄┄┄┄┄┄┄│ ↑ dashed = nested    │
   └──────────┘         └──────────────────────┘
```

**Acceptance Criteria**
- Edge rendering accounts for `$ref`, response schemas, request bodies, query params with `$ref`, and nested usage.
- Hovering an edge highlights the source/target nodes and dims the rest.
- "What breaks if I change this?" — selecting a class highlights every dependent operation.
- Performance budget: 60fps with 200 nodes / 800 edges.

**Part of Epic: Unified Workspace Layout**

---

### 4.4 — Adaptive inspector (right rail)

A single right-rail inspector that re-renders its tabs and form fields based on selection type. Same chrome, different content. Replaces the today-state where each section has its own bespoke inspector.

```
  selection: Class            selection: Path operation
  ┌───────────────────┐       ┌───────────────────┐
  │ Customer · v2.1   │       │ GET /customers    │
  │ [Props][Refs][..] │       │ [Req][Resp][...]  │
  └───────────────────┘       └───────────────────┘
```

**Acceptance Criteria**
- Renderers registered by selection-type id; new types pluggable without forking.
- All form writes go through the VFS layer for canvas/code parity.
- Validation surfaces inline (per the mockup).

**Part of Epic: Unified Workspace Layout**

---

### 4.5 — ⌘K command palette

A global Radix `Dialog` palette opened with ⌘K / Ctrl-K. Indexes classes, paths, properties, branches, and a curated set of actions ("Find every path that consumes X", "Open in split", "Switch lens to Combined").

**Acceptance Criteria**
- Index built incrementally on project load; refreshes on VFS writes.
- Keyboard nav (↑↓⏎, ⌘⏎ for split-open) and esc dismissal.
- Sub-200 ms response on a project with 5,000 entities.

**Part of Epic: Unified Workspace Layout**

---

### 4.6 — Migration of existing Designer/Paths routes

`/designer/*` and `/paths/*` URLs continue to work and deep-link into the unified workspace at the right node + lens. A short-lived in-app banner explains the change and links to a "what changed" doc.

**Acceptance Criteria**
- All existing deep links resolve to an equivalent state in the new workspace.
- Bookmarks and SDK-emitted links continue to function.
- Banner is dismissable per user.

**Part of Epic: Unified Workspace Layout**

---

## Epic 5: SDK Playground  *(v2)*

### Summary Table

| #   | Title                                      | Description                                                                                       | Labels                                                | Parallel |
|-----|--------------------------------------------|---------------------------------------------------------------------------------------------------|-------------------------------------------------------|----------|
| 5.1 | TS notebook runtime (sandboxed)            | esbuild-wasm + SES sandbox running TypeScript cells in a worker.                                  | `enhancement`, `developer-mode`, `v2`, `playground`   | Yes      |
| 5.2 | `@objectified/sdk` read API                | Typed read facade: `obj.classes.find()`, `obj.paths.byTag()`, `obj.lint.run()`.                  | `enhancement`, `developer-mode`, `v2`, `sdk`          | Yes      |
| 5.3 | Transactional codemod API + dry-run        | `tx(obj, async t => …)` building a plan; `plan.preview()` returns a structured diff.             | `enhancement`, `developer-mode`, `v2`, `sdk`          | No       |
| 5.4 | Diff preview & PR open                     | Render the plan diff inline; "Apply (commit)" or "Open as PR" actions.                            | `enhancement`, `developer-mode`, `v2`, `gitlike`      | No       |
| 5.5 | Notebook persistence & sharing             | Save notebooks per user/project; share read-only.                                                 | `enhancement`, `developer-mode`, `v2`, `playground`   | Yes      |
| 5.6 | Sandbox limits & quotas                    | Enforce 30 s execution, 5 k entities/tx, no network egress, no main-branch writes.                | `enhancement`, `developer-mode`, `v2`, `security`     | Yes      |

### 5.1 — TS notebook runtime (sandboxed)

A web worker that compiles TypeScript cells with `esbuild-wasm` and runs them inside a SES (Secure ECMAScript) realm. The runtime exposes only the `@objectified/sdk` global; all DOM/network/fs access is denied.

```
   notebook cell ──▶ esbuild-wasm ──▶ SES realm ──▶ result stream
                                          │
                                          ▼
                                    @objectified/sdk
```

**Acceptance Criteria**
- A cell can `import { objectified, tx } from "@objectified/sdk"` and run.
- Top-level `await` supported.
- Worker-isolated; main thread cannot be reached.

**Part of Epic: SDK Playground**

---

### 5.2 — `@objectified/sdk` read API

Typed read facade over the existing REST API. Methods used in the mockup (`obj.classes.find`, `obj.classes.get`, `obj.paths.byTag`, `obj.lint.run`, `obj.diff.preview`) plus pagination helpers and `Class[]` / `Path[]` types generated from the meta-schema.

**Acceptance Criteria**
- 100% of GET endpoints reachable via the SDK.
- Generated `.d.ts` shipped with the SDK package and consumed by the playground TS compiler.
- Auth uses the user's session; no extra credentials.

**Part of Epic: SDK Playground**

---

### 5.3 — Transactional codemod API + dry-run

`tx(obj, fn)` accumulates writes into a Plan without applying them. `plan.preview()` returns a structured diff (`adds`, `removes`, `renames` per file). Plans are atomic: `plan.commit()` applies in one server round-trip or rolls back completely.

**Acceptance Criteria**
- Operations covered: `renameProperty`, `addProperty`, `removeProperty`, `renameClass`, `renameQueryParam`, `addAlias`, `addMigration` (extensible).
- Commit is atomic at the project level.
- Plans serialize for cross-session sharing.

**Part of Epic: SDK Playground**

---

### 5.4 — Diff preview & PR open

`plan.preview()` returns a viewer that renders inline in the notebook output cell with line-level adds/removes (mirroring the playground mockup). "Open as PR" pushes the plan to a new branch and opens a PR via the existing git-like layer.

**Acceptance Criteria**
- Diff viewer is the same component used elsewhere in the app (single source of truth).
- PR flow respects the existing branch protection rules.

**Part of Epic: SDK Playground**

---

### 5.5 — Notebook persistence & sharing

Notebooks live in the VFS at `obj://notebooks/<name>.ts`. They can be shared with read-only links scoped to a project.

**Acceptance Criteria**
- Versioned via the same artifact pipeline as schemas and paths.
- Sharing respects project ACLs.

**Part of Epic: SDK Playground**

---

### 5.6 — Sandbox limits & quotas

Enforce the constraints called out in the mockup: 30 s execution cap, 5 000 entities per tx, no network egress, no direct writes to protected branches (`main`).

**Acceptance Criteria**
- Limits enforced both client-side (worker) and server-side (write path).
- Friendly error messages with documented escape hatches.

**Part of Epic: SDK Playground**

---

## Epic 6: Advanced Editor Capabilities  *(v2)*

### Summary Table

| #   | Title                                      | Description                                                                                  | Labels                                              | Parallel |
|-----|--------------------------------------------|----------------------------------------------------------------------------------------------|-----------------------------------------------------|----------|
| 6.1 | Multi-file refactor & find-and-replace     | Workspace-wide rename and regex find/replace across the VFS.                                | `enhancement`, `developer-mode`, `v2`, `ui`         | Yes      |
| 6.2 | In-editor branch switcher                  | Status-bar branch picker that switches the VFS view atomically.                             | `enhancement`, `developer-mode`, `v2`, `gitlike`    | Yes      |
| 6.3 | Inline AI suggestions                      | Ghost-text completions powered by the existing Copilot integration.                         | `enhancement`, `developer-mode`, `v2`, `ai`         | Yes      |
| 6.4 | Editor plugin API                          | Stable extension API for tenant-authored Monaco contributions.                              | `enhancement`, `developer-mode`, `v2`, `playground` | No       |

### 6.1 — Multi-file refactor & find-and-replace

A Radix `Sheet` panel that runs find/replace across the entire VFS with regex support, preview, and per-match opt-out.

**Acceptance Criteria**
- Preview shows all matches before apply.
- Operations executed via the codemod tx layer (Epic 5.3).

**Part of Epic: Advanced Editor Capabilities**

---

### 6.2 — In-editor branch switcher

Dropdown in the status bar that switches the active branch. The VFS swaps its backing store atomically; dirty-buffer protection prompts a save.

**Acceptance Criteria**
- Switch <200 ms p95.
- Conflict resolution UI for unsaved buffers.

**Part of Epic: Advanced Editor Capabilities**

---

### 6.3 — Inline AI suggestions

Ghost-text completions in the schema and YAML editors driven by the existing Copilot integration. Tab to accept; users can disable per-file.

**Acceptance Criteria**
- Completions respect the active project's vocabulary.
- Telemetry tracks acceptance rate.

**Part of Epic: Advanced Editor Capabilities**

---

### 6.4 — Editor plugin API

A stable, versioned extension API that lets tenants register Monaco contributions (commands, code-actions, hover providers) scoped to their projects. Plugins run in a sandboxed worker.

**Acceptance Criteria**
- `objectified-extension.json` manifest describes activation events and entry points.
- Plugins can call the read SDK (5.2) but not the write SDK without elevated grant.

**Part of Epic: Advanced Editor Capabilities**

---

## Cross-cutting Notes

- **Mockups → Code mapping**:
  - Epic 2 ↔ `mockups/developer/schema-editor.html`
  - Epic 3 ↔ `mockups/developer/paths-editor.html`
  - Epic 4 ↔ `mockups/new-layout/workspace.html`
  - Epic 5 ↔ `mockups/developer/sdk-playground.html`
- **Risk spikes** to schedule before MVP starts: (1) Y.js + Monaco bidirectional sync prototype; (2) SES sandbox feasibility for the v2 playground; (3) React Flow performance ceiling for the combined lens.
- **Rollout**: All MVP epics behind `developer_mode.enabled` flag, staged at 10% → 50% → 100% per workspace.

