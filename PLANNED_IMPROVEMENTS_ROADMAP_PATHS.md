# Paths Designer Improvements Roadmap

## Paths Designer Improvements (CONSOLIDATED)

> **Purpose**: All Paths Designer improvement features consolidated in one place for focused development.
> **Priority**: 🔴 High - Critical for developer-centered API design experience
> **Timeline**: Q1-Q3 2026
> **Status**: Mix of ✅ Implemented, 🚧 Partial, 📋 Planned
> **Audience**: Software engineers, API architects, platform teams

---

## Current State Summary

The Paths Designer is a fully implemented visual API design tool built on React Flow. It supports:

- ✅ Six node types: Operation, Parameter, Response, RequestBody, ResponseBody, Class
- ✅ Three-panel layout: Left Sidebar (280px) | Center Canvas | Right Properties Panel
- ✅ Drag-and-drop from sidebar library to canvas
- ✅ HTTP method color coding (GET=green, POST=blue, PUT=orange, PATCH=purple, DELETE=red)
- ✅ Status code color bands (2xx=green, 3xx=blue, 4xx=yellow, 5xx=red)
- ✅ Parameter location color coding (path=green, query=blue, header=purple, cookie=orange)
- ✅ Smart edge routing (straight, bezier, orthogonal, smart)
- ✅ Edge animations (flow, pulse, dash)
- ✅ Auto-layout algorithm (Sugiyama-style hierarchical)
- ✅ OpenAPI 3.1 compliance validation
- ✅ Schema binding via class references ($ref) and inline schemas
- ✅ Multi-content-type support (JSON, XML, multipart/form-data)
- ✅ Security scheme configuration (API Key, HTTP Bearer/Basic)
- ✅ Canvas background customization, grid snapping, themes

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `paths/page.tsx` | ~240 | Main page, three-panel layout orchestration |
| `PathsCanvasView.tsx` | ~3,800 | Canvas, React Flow, node creation, drag/drop, inline OperationNode |
| `PathsSidebar.tsx` | ~1,067 | Left sidebar with tabs (Paths, Operations, Classes, Properties, Security, Servers) |
| `OperationPropertiesPanel.tsx` | ~1,687 | Right panel for editing operations |
| `ParameterPropertiesPanel.tsx` | ~1,015 | Right panel for editing parameters |
| `ResponsePropertiesPanel.tsx` | ~1,498 | Right panel for editing responses |
| `PathRequestBodyNode.tsx` | ~1,250 | Request body node with schema editor |
| `PathResponseBodyNode.tsx` | ~778 | Response body node with schema editor |
| `PathResponseNode.tsx` | ~464 | Response node with status code colors |
| `PathParameterNode.tsx` | ~136 | Parameter node with location colors |
| `PathClassNode.tsx` | ~77 | Class reference node |
| `paths-operation-colors.ts` | ~33 | HTTP method color definitions |

---

---

## 1. Operation Focus Mode (Isolation View) 📋 PLANNED

[TODO] When an HTTP operation is selected on the canvas, all nodes **not** associated with that operation should fade to 20% opacity. Only the selected operation and its directly connected nodes (parameters, request body, responses, response bodies, referenced classes) remain fully visible. This dramatically improves readability for APIs with many endpoints.

### Core Behavior

- [TODO] **Click-to-Isolate**: Single-click an operation node to enter focus mode; all unrelated nodes and edges transition to 20% opacity over a 200ms CSS transition
- [TODO] **Connected Node Detection**: Automatically identify all nodes connected to the selected operation by traversing edges (parameters, request bodies, responses, response bodies, class references) at any depth
- [TODO] **Edge Dimming**: Edges not connected to the focused operation also dim to 20% opacity; focused edges remain at full opacity with a subtle glow effect
- [TODO] **Focused Node Highlight Ring**: The selected operation node gets a prominent colored ring (matching its HTTP method color) to clearly indicate it is the focus anchor
- [TODO] **Multi-Operation Focus**: Hold `Shift` and click additional operations to include them in the focus set (additive focus)
- [TODO] **Exit Focus Mode**: Press `Esc` or click empty canvas space to exit focus mode and restore all nodes to full opacity
- [TODO] **Focus Mode Indicator**: Show a small banner/pill at the top of the canvas reading "Focus: GET /users/{id}" with an X button to exit

### Visual Design

- [TODO] **Dimmed Node Style**: Non-focused nodes render at `opacity: 0.2` with `pointer-events: none` (cannot be clicked while dimmed)
- [TODO] **Dimmed Edge Style**: Non-focused edges render at `opacity: 0.15` with `stroke-dasharray: 4 4` to further de-emphasize
- [TODO] **Focused Edge Glow**: Focused edges receive a subtle `filter: drop-shadow(0 0 3px <methodColor>)` to trace the data flow path
- [TODO] **Smooth Transition**: All opacity changes use `transition: opacity 200ms ease-in-out` for a polished feel
- [TODO] **Background Dim**: Optionally darken the canvas background slightly (e.g., overlay at 5% black) to further draw attention to focused nodes

### Keyboard Integration

- [TODO] **Tab Cycling**: While in focus mode, `Tab` / `Shift+Tab` cycles through the focused nodes (operation → parameters → request body → responses)
- [TODO] **Arrow Navigation**: Arrow keys navigate between focused nodes in layout order
- [TODO] **Enter to Edit**: Press `Enter` on a focused node to open its editor overlay

---

## 2. Editor Overlay (Replace Sidebar Properties Panels) 📋 PLANNED

[TODO] Replace the current right-side properties panels (`OperationPropertiesPanel`, `ParameterPropertiesPanel`, `ResponsePropertiesPanel`) with a floating overlay/modal that appears when a node is clicked or double-clicked. This reclaims canvas real estate, centers the developer's attention on the editing context, and follows patterns familiar to developers from tools like Figma, Postman, and VS Code.

### Core Behavior

- [TODO] **Trigger**: Double-click (or `Enter` key on selected node) opens the editor overlay centered over the canvas
- [TODO] **Overlay Design**: A floating panel (not a full-screen modal) that covers approximately 60-70% of the canvas width and 70-80% of the canvas height, with a semi-transparent backdrop behind it
- [TODO] **Backdrop Click**: Clicking the backdrop dismisses the overlay and saves changes
- [TODO] **Close Button**: `X` button in the top-right corner; `Esc` key also closes
- [TODO] **Drag to Reposition**: The overlay title bar is draggable so developers can move it to see the canvas underneath
- [TODO] **Resize Handle**: Optional resize handle in the bottom-right corner to expand/shrink the overlay
- [TODO] **Auto-Save on Close**: All changes are persisted (debounced 300ms) as the user types; closing the overlay does not discard work
- [TODO] **Quick-Edit Mini Mode**: Single-click a node to show a compact floating toolbar (not the full overlay) with the most-used actions (e.g., change status code, toggle required, change type); double-click for the full editor

### Overlay Layout

- [TODO] **Title Bar**: Shows the node type icon + name (e.g., "🟢 GET /users/{id}" or "📋 Parameter: userId") with the close button
- [TODO] **Tabbed Content**: For operations, organize editor into tabs:
  - [TODO] **General**: Summary, description (Markdown with live preview), operationId, tags, deprecated, x-private
  - [TODO] **Parameters**: Linked parameters table with add/edit/remove, schema type selectors
  - [TODO] **Request Body**: Content type tabs, schema builder, examples
  - [TODO] **Responses**: Response list with status codes, content types, schema builders, headers
  - [TODO] **Security**: Security scheme selector with scope configuration
  - [TODO] **Extensions**: Custom `x-*` extension key-value editor
- [TODO] **JSON/YAML Preview Tab**: A read-only Monaco editor tab showing the generated OpenAPI fragment for the current operation, updating in real-time as the user edits
- [TODO] **Breadcrumb Navigation**: When editing a nested element (e.g., a parameter within an operation), show breadcrumbs at the top so the user can navigate back without closing

### Remove Right Panel

- [TODO] **Remove `OperationPropertiesPanel`** from the three-panel layout; the overlay replaces it
- [TODO] **Remove `ParameterPropertiesPanel`** from the three-panel layout; the overlay replaces it
- [TODO] **Remove `ResponsePropertiesPanel`** from the three-panel layout; the overlay replaces it
- [TODO] **Expand Canvas**: With the right panel removed, the canvas area expands to fill the remaining space, giving developers a larger working surface

---

## 3. Professional Node Visual Redesign 📋 PLANNED

[TODO] The current operation nodes use basic colored headers with white/dark bodies. For an enterprise-grade developer tool, the nodes need a more refined, information-dense, and visually distinctive design inspired by tools like Insomnia, Stoplight Studio, and Swagger Editor.

### Operation Node Redesign

- [TODO] **Method Badge**: Replace the full-width colored header with a compact, pill-shaped HTTP method badge (e.g., `[GET]`, `[POST]`) in the top-left corner, saving vertical space
- [TODO] **Path Display**: Show the full path (e.g., `/users/{id}/posts`) in a monospace font next to the method badge, with path variables highlighted in a contrasting color
- [TODO] **Operation ID Subtext**: Show the `operationId` in a smaller, muted font below the path (e.g., `getUserPosts`)
- [TODO] **Summary Line**: If a summary is set, show it as a single line of truncated text below the operationId
- [TODO] **Compact Metadata Row**: A row of small icon badges showing:
  - [TODO] Parameter count badge (e.g., `📋 3` for 3 parameters)
  - [TODO] Response count badge (e.g., `📬 4` for 4 responses)
  - [TODO] Security indicator (🔒 if secured, 🔓 if not)
  - [TODO] Deprecated badge (⚠️ strikethrough if deprecated)
  - [TODO] Private badge (🔵 if x-private)
- [TODO] **Tags Row**: Display operation tags as tiny colored chips at the bottom of the node
- [TODO] **Content Type Indicators**: Small icons showing which content types the operation accepts/returns (JSON, XML, multipart)
- [TODO] **Node Width Standardization**: All operation nodes should have a consistent width (e.g., 320px) for visual alignment
- [TODO] **Subtle Drop Shadow**: Add `box-shadow: 0 2px 8px rgba(0,0,0,0.08)` for depth, increasing on hover to `0 4px 16px rgba(0,0,0,0.12)`

### Parameter Node Redesign

- [TODO] **Inline Parameter Chips**: Instead of separate parameter nodes connected by edges, display parameters as compact chips directly inside the operation node's body (collapsible section)
- [TODO] **Chip Layout**: `[location] name: type` format (e.g., `[query] page: integer`, `[path] id: string(uuid)`)
- [TODO] **Required Indicator**: Red asterisk `*` on required parameters; optional parameters in muted color
- [TODO] **Expand/Collapse**: Click the "Parameters" section header to toggle between chip view and detailed view showing descriptions and constraints

### Response Node Redesign

- [TODO] **Inline Response List**: Display responses as a collapsible list inside the operation node body, showing `[status] description` (e.g., `[200] Success`, `[404] Not Found`)
- [TODO] **Status Code Color Dots**: Small colored dots before each status code (green for 2xx, blue for 3xx, yellow for 4xx, red for 5xx) instead of large colored nodes
- [TODO] **Schema Preview**: On hover over a response, show a tooltip with the response schema structure
- [TODO] **Expand to External Nodes**: Toggle button to "explode" responses into separate connected nodes for detailed view (toggle between compact and expanded modes)

### Request Body Compact View

- [TODO] **Inline Request Body Section**: Show request body as a collapsible section within the operation node (for POST/PUT/PATCH) showing content type and schema name
- [TODO] **Schema Type Badge**: Show `$ref: Pet` or `inline: object (5 props)` as a compact badge
- [TODO] **Expand to External Node**: Toggle to explode the request body into a separate detailed node for complex schemas

---

## 4. Canvas Toolbar for Paths 📋 PLANNED

[TODO] The Paths Designer currently has no dedicated toolbar. A horizontal toolbar above the canvas provides quick access to common actions, consistent with professional API design tools.

### Toolbar Layout

- [TODO] **Position**: Fixed horizontal bar between the left sidebar and the canvas, spanning the canvas width
- [TODO] **Left Section** (actions):
  - [TODO] **Add Path** button (+ icon): Opens a quick dialog to create a new path
  - [TODO] **Add Operation** dropdown: Select HTTP method to add to the selected path
  - [TODO] **Auto-Layout** button: Apply hierarchical layout with dropdown for layout direction (TB, LR, BT, RL)
  - [TODO] **Fit View** button: Zoom to fit all nodes
- [TODO] **Center Section** (view controls):
  - [TODO] **View Mode Toggle**: Switch between "Full Canvas" (all nodes visible) and "Focused" (operation isolation) modes
  - [TODO] **Compact/Expanded Toggle**: Switch between compact (inline parameters/responses) and expanded (separate nodes) display modes
  - [TODO] **Show/Hide Classes** toggle: Toggle visibility of class reference nodes
- [TODO] **Right Section** (tools):
  - [TODO] **Search** (🔍): Open canvas search overlay (`Cmd+F`)
  - [TODO] **Validate** (✓): Run OpenAPI validation and show results panel
  - [TODO] **Export** dropdown: Export as OpenAPI JSON/YAML, PNG, SVG, PDF
  - [TODO] **Settings** (⚙️): Canvas settings (grid, snapping, edge style, animations)
  - [TODO] **Help** (?): Toggle keyboard shortcut overlay

### Toolbar Styling

- [TODO] **Minimal Design**: Flat icons with tooltips, no text labels by default; hover reveals label
- [TODO] **Separator Lines**: Thin vertical separators between action groups
- [TODO] **Active State**: Active toggles (e.g., "Focused" mode) show a colored underline matching the theme accent
- [TODO] **Dark Mode**: Toolbar adapts to current theme (dark background with light icons in dark mode)
- [TODO] **Compact Height**: 40px tall to minimize canvas area loss

---

## 5. Paths Canvas Layout Improvements 📋 PLANNED

[TODO] The current canvas layout positions nodes in horizontal rows (operations at y=200, parameters at y=350, responses at y=500). This works for small APIs but becomes unwieldy for APIs with 10+ endpoints. The layout needs to be smarter and more developer-friendly.

### Layout Algorithms

- [TODO] **Vertical Swimlane Layout**: Each path gets a vertical column (swimlane). Within each column, the operation is at the top, parameters below, request body below that, and responses at the bottom. Swimlanes are separated by subtle vertical dividers
- [TODO] **Horizontal Flow Layout**: Operations flow left-to-right: `Operation → Parameters → Request Body → Responses → Response Bodies`. Each operation is a horizontal chain
- [TODO] **Grouped by Path Layout**: Group all operations for the same path together in a visual container (similar to the schema canvas groups), with the path name as the container header
- [TODO] **Grouped by Tag Layout**: Group operations by their OpenAPI tags into color-coded containers
- [TODO] **RESTful Resource Layout**: Group related CRUD operations (GET, POST, PUT, DELETE for the same resource) into a single "resource block" showing the full lifecycle
- [TODO] **Layout Selector**: Dropdown in the toolbar to switch between layout algorithms with live preview

### Path Grouping Containers

- [TODO] **Auto-Group by Path**: Automatically create visual containers for each unique path (e.g., `/users`, `/users/{id}`, `/products`)
- [TODO] **Container Header**: Shows the path pattern in monospace font with a colored left border
- [TODO] **Container Actions**: Collapse/expand, delete all operations in path, add operation to path
- [TODO] **Color by Resource**: Auto-assign colors to path groups based on the first path segment (e.g., all `/users/*` paths share one color, all `/products/*` share another)

### Spacing & Alignment

- [TODO] **Consistent Node Gaps**: Enforce minimum 40px horizontal gap and 30px vertical gap between nodes via layout algorithm
- [TODO] **Edge Routing Optimization**: After auto-layout, run an edge crossing minimization pass to reduce visual clutter
- [TODO] **Alignment Guides**: Smart guides (horizontal/vertical lines) appear when manually dragging nodes to align with other nodes

---

## 6. Developer-Centered Code Preview 📋 PLANNED

[TODO] Developers think in code, not just visual boxes. The Paths Designer should provide instant code previews for the operations they are designing.

### Real-Time OpenAPI Preview

- [TODO] **Split-View Mode**: Toggle a bottom panel (resizable, collapsible) showing the generated OpenAPI YAML/JSON for the currently selected operation, updating in real-time as the user edits
- [TODO] **Full Spec Preview**: Toggle to see the entire generated OpenAPI specification (all paths, components, security schemes)
- [TODO] **Monaco Editor**: Use Monaco Editor for the preview with syntax highlighting, folding, and search
- [TODO] **Copy to Clipboard**: One-click copy button for the preview content
- [TODO] **Format Toggle**: Switch between YAML and JSON with one click
- [TODO] **Diff Mode**: When making changes, show a diff view (green for added, red for removed) against the last saved state

### Code Snippet Generation

- [TODO] **cURL Preview**: Show a cURL command for the selected operation, auto-populated with example values from parameters and request body
- [TODO] **Language Snippets**: Dropdown to generate request code in:
  - [TODO] JavaScript (fetch, axios)
  - [TODO] Python (requests, httpx)
  - [TODO] Go (net/http)
  - [TODO] Java (OkHttp, HttpClient)
  - [TODO] C# (HttpClient)
  - [TODO] Rust (reqwest)
- [TODO] **Copy Snippet**: One-click copy for any generated snippet
- [TODO] **Snippet in Overlay**: Code snippets available as a tab in the editor overlay

### Schema Preview on Hover

- [TODO] **Schema Tooltip**: When hovering over a schema reference (`$ref: Pet`) anywhere on the canvas, show a floating tooltip with the full JSON Schema definition of the referenced class
- [TODO] **Property Tooltip**: When hovering over a parameter name, show its type, format, constraints, and description in a compact tooltip
- [TODO] **Response Preview Tooltip**: When hovering over a response status code badge, show the response body schema structure

---

## 7. Paths Canvas Search & Filter 📋 PLANNED

[TODO] The Paths Designer needs search and filter capabilities to help developers navigate large API surfaces.

### Search

- [TODO] **Canvas Search** (`Cmd/Ctrl+F`): Open a search overlay that searches across operation paths, operationIds, descriptions, parameter names, response descriptions
- [TODO] **Search Highlighting**: Matching nodes are highlighted with a bright ring; non-matching nodes dim to 30% opacity
- [TODO] **Navigate Results**: Up/Down arrows or `Enter` to cycle through search results, with the canvas auto-panning to center each result
- [TODO] **Search Scope**: Toggle search scope: All, Paths only, Operations only, Parameters only, Responses only

### Filter

- [TODO] **Filter by HTTP Method**: Toggle buttons (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) to show/hide operations by method
- [TODO] **Filter by Tag**: Dropdown to filter operations by OpenAPI tag
- [TODO] **Filter by Status**: Show only operations with validation errors/warnings
- [TODO] **Filter by Path Segment**: Text filter to show only paths matching a pattern (e.g., `/users*` shows all user-related paths)
- [TODO] **Active Filter Indicator**: When filters are active, show a colored badge on the filter button indicating how many items are hidden

### Operation Table View

- [TODO] **Table Toggle**: Button to switch from canvas view to a sortable table view showing all operations in a dense, spreadsheet-like format:
  - Columns: Method, Path, OperationId, Summary, Parameters, Responses, Security, Tags, Status (valid/warning/error)
  - Click any row to jump to that operation on the canvas (or open the editor overlay)
- [TODO] **Bulk Edit in Table**: Select multiple rows and batch-edit tags, security, deprecated status

---

## 8. Context Menu for Paths Nodes 📋 PLANNED

[TODO] Right-click context menus provide quick access to common actions without navigating toolbars or sidebars.

### Operation Node Context Menu

- [TODO] **Edit Operation**: Open editor overlay (same as double-click)
- [TODO] **Add Parameter**: Sub-menu: Query, Path, Header, Cookie
- [TODO] **Add Response**: Sub-menu: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Server Error
- [TODO] **Set Request Body**: Quick-add request body with default JSON content type
- [TODO] **Duplicate Operation**: Clone the operation (with new operationId)
- [TODO] **Move to Path**: Sub-menu listing all paths to move the operation to a different path
- [TODO] **Copy as cURL**: Copy a cURL command for this operation to clipboard
- [TODO] **Copy as OpenAPI**: Copy the OpenAPI YAML fragment for this operation to clipboard
- [TODO] **Generate Code**: Sub-menu with language options to generate a client request snippet
- [TODO] **Toggle Deprecated**: Quick-toggle the deprecated flag
- [TODO] **Delete Operation**: Delete with confirmation

### Parameter Node Context Menu

- [TODO] **Edit Parameter**: Open editor overlay
- [TODO] **Change Location**: Sub-menu: Query, Path, Header, Cookie
- [TODO] **Toggle Required**: Quick-toggle required status
- [TODO] **Apply Primitive Template**: Apply a predefined schema type (UUID, email, pagination, etc.)
- [TODO] **Duplicate Parameter**: Clone the parameter
- [TODO] **Delete Parameter**: Delete with confirmation

### Response Node Context Menu

- [TODO] **Edit Response**: Open editor overlay
- [TODO] **Change Status Code**: Quick-change dropdown
- [TODO] **Add Content Type**: Sub-menu of common content types
- [TODO] **Bind Schema**: Quick-select a class to bind as the response schema
- [TODO] **Add Headers**: Sub-menu of common header templates (pagination, rate limit, CORS)
- [TODO] **Duplicate Response**: Clone the response
- [TODO] **Delete Response**: Delete with confirmation

### Canvas Background Context Menu

- [TODO] **Add Path**: Create a new path
- [TODO] **Add Operation**: Sub-menu with HTTP methods
- [TODO] **Paste Operation**: If an operation was copied, paste it here
- [TODO] **Auto-Layout**: Apply auto-layout
- [TODO] **Fit View**: Zoom to fit all nodes
- [TODO] **Toggle Grid**: Show/hide grid
- [TODO] **Canvas Settings**: Open settings

---

## 9. Keyboard Shortcuts for Paths 📋 PLANNED

[TODO] Developer-focused tools must be keyboard-first. The Paths Designer should support a comprehensive set of keyboard shortcuts.

### Navigation

| Shortcut | Action | Status |
|----------|--------|--------|
| `Cmd/Ctrl + F` | [TODO] Open canvas search | 📋 |
| `Cmd/Ctrl + K` | [TODO] Open command palette | 📋 |
| `Space + Drag` | Pan canvas | ✅ |
| `Scroll` | Zoom in/out | ✅ |
| `Cmd/Ctrl + 0` | [TODO] Reset zoom to 100% | 📋 |
| `Cmd/Ctrl + Shift + 0` | [TODO] Fit all nodes in view | 📋 |
| `Esc` | [TODO] Exit focus mode / close overlay / close search | 📋 |
| `Tab` | [TODO] Cycle through nodes (in focus mode: cycle focused nodes) | 📋 |
| `M` | [TODO] Toggle minimap | 📋 |

### Editing

| Shortcut | Action | Status |
|----------|--------|--------|
| `Enter` | [TODO] Open editor overlay for selected node | 📋 |
| `Delete` / `Backspace` | [TODO] Delete selected node with confirmation | 📋 |
| `Cmd/Ctrl + D` | [TODO] Duplicate selected node | 📋 |
| `Cmd/Ctrl + C` | [TODO] Copy selected node(s) | 📋 |
| `Cmd/Ctrl + V` | [TODO] Paste copied node(s) at cursor | 📋 |
| `Cmd/Ctrl + Z` | [TODO] Undo | 📋 |
| `Cmd/Ctrl + Shift + Z` | [TODO] Redo | 📋 |
| `Cmd/Ctrl + S` | [TODO] Save / persist changes | 📋 |

### Quick-Add (when an operation is selected)

| Shortcut | Action | Status |
|----------|--------|--------|
| `G` | [TODO] Add GET operation to selected path | 📋 |
| `P` | [TODO] Add POST operation to selected path | 📋 |
| `U` | [TODO] Add PUT operation to selected path | 📋 |
| `A` | [TODO] Add PATCH operation to selected path | 📋 |
| `X` | [TODO] Add DELETE operation to selected path | 📋 |
| `Q` | [TODO] Add query parameter to selected operation | 📋 |
| `H` | [TODO] Add header parameter to selected operation | 📋 |
| `B` | [TODO] Add/focus request body for selected operation | 📋 |
| `2` | [TODO] Add 200 OK response | 📋 |
| `4` | [TODO] Add 400 Bad Request response | 📋 |
| `5` | [TODO] Add 500 Server Error response | 📋 |

### Display

| Shortcut | Action | Status |
|----------|--------|--------|
| `Cmd/Ctrl + Shift + L` | [TODO] Toggle auto-layout | 📋 |
| `Cmd/Ctrl + Shift + E` | [TODO] Open export dialog | 📋 |
| `Cmd/Ctrl + Shift + V` | [TODO] Toggle OpenAPI preview panel | 📋 |
| `Cmd/Ctrl + .` | [TODO] Toggle compact/expanded node mode | 📋 |
| `?` | [TODO] Show keyboard shortcut overlay | 📋 |

---

## 10. Undo/Redo for Paths Canvas 📋 PLANNED

[TODO] The Paths canvas currently has no undo/redo capability. Any accidental deletion or edit is irreversible.

- [TODO] **Undo Stack**: Configurable depth (default 50, max 500 operations)
- [TODO] **Tracked Operations**: Operation CRUD, parameter add/edit/delete, response add/edit/delete, request body changes, node moves, edge changes, layout changes
- [TODO] **Keyboard Shortcuts**: `Cmd/Ctrl + Z` (Undo), `Cmd/Ctrl + Shift + Z` (Redo)
- [TODO] **History Panel**: Visual timeline of all changes with the ability to jump to any point
- [TODO] **Operation Coalescing**: Rapid sequential moves of the same node collapse into a single undo entry
- [TODO] **Persistent Undo**: Optionally persist undo stack to database so changes survive page reload
- [TODO] **Visual Feedback**: Brief toast notification on undo/redo showing what was undone/redone (e.g., "Undone: Delete GET /users")

---

## 11. Edge & Connection Visual Improvements 📋 PLANNED

[TODO] Edges in the Paths Designer carry semantic meaning (parameter binding, response linking, schema reference). They should be more informative and visually distinct.

### Edge Labels

- [TODO] **Parameter Edge Labels**: Show parameter location and name on the edge (e.g., "query: page")
- [TODO] **Response Edge Labels**: Show status code on the edge (e.g., "200", "404")
- [TODO] **Schema Binding Labels**: Show the schema type on edges connecting to classes (e.g., "$ref: Pet")
- [TODO] **Content Type Labels**: Show content type on request/response body edges (e.g., "application/json")
- [TODO] **Label Background**: Semi-transparent pill background on edge labels for readability against canvas backgrounds

### Edge Routing

- [TODO] **Operation-Scoped Routing**: When in focus mode, routes edges for the focused operation using orthogonal routing to avoid overlap with dimmed nodes
- [TODO] **Edge Bundling**: When multiple edges share a similar path (e.g., multiple parameters from one operation), bundle them into a single trunk that splits near the target nodes
- [TODO] **Hover Highlight**: Hovering over an edge highlights both the source and target nodes with a colored ring
- [TODO] **Click to Select**: Clicking an edge selects it and shows its details in a mini tooltip (source, target, relationship type)

### Edge Animation for Data Flow

- [TODO] **Request Flow Animation**: When "Animate Data Flow" is enabled, show animated dots flowing from parameters → operation → request body (representing the request lifecycle)
- [TODO] **Response Flow Animation**: Animated dots flowing from operation → responses (representing the response lifecycle)
- [TODO] **Animation Direction**: Dots flow in the direction of data movement (inbound for request, outbound for response)
- [TODO] **Animation Speed Control**: Adjustable animation speed in canvas settings

---

## 12. Left Sidebar Improvements 📋 PLANNED

[TODO] The left sidebar provides access to paths, operations, classes, properties, security, and servers. Several improvements would make it more developer-friendly.

### Sidebar Tabs Redesign

- [TODO] **Icon-Only Tabs**: Replace text tabs with icon-only tabs (with tooltips) to save vertical space: 🛤️ Paths, ⚡ Operations, 📦 Classes, 🔑 Security, 🌐 Servers
- [TODO] **Collapsible Sidebar**: Collapse the sidebar to a thin icon rail (~48px) with tooltips, maximizing canvas space; expand on click or `Cmd+B`
- [TODO] **Pinned Sidebar**: Toggle to pin/unpin the sidebar; when unpinned, it auto-collapses when the canvas is clicked

### Path Tree View

- [TODO] **Hierarchical Path Tree**: Display paths as a tree structure grouped by path segments:
  ```
  📁 /users
    ├─ GET  /users (listUsers)
    ├─ POST /users (createUser)
    └─ 📁 /{id}
       ├─ GET    /users/{id} (getUser)
       ├─ PUT    /users/{id} (updateUser)
       ├─ DELETE /users/{id} (deleteUser)
       └─ 📁 /posts
          └─ GET /users/{id}/posts (getUserPosts)
  📁 /products
    ├─ GET  /products (listProducts)
    └─ ...
  ```
- [TODO] **Method Color Badges**: Show HTTP method as a colored badge next to each operation in the tree
- [TODO] **Validation Status Icons**: Show ✅ / ⚠️ / ❌ icons next to operations with validation issues
- [TODO] **Click to Navigate**: Click an operation in the tree to pan the canvas to that node and select it
- [TODO] **Double-Click to Edit**: Double-click to open the editor overlay directly

### Drag-and-Drop Improvements

- [TODO] **Drag Preview**: Show a ghost preview of the node being dragged, with its method color and path
- [TODO] **Drop Zone Highlighting**: Highlight valid drop targets on the canvas when dragging (e.g., highlight an operation node when dragging a parameter to indicate it can be dropped on that operation)
- [TODO] **Invalid Drop Feedback**: Red flash/shake animation when dropping on an invalid target
- [TODO] **Smart Drop**: Dropping a class onto an operation node automatically opens a dialog asking where to bind it (request body, response body, or parameter type)

---

## 13. OpenAPI Spec Quality Panel 📋 PLANNED

[TODO] Provide real-time feedback on API design quality directly within the Paths Designer, helping developers catch issues before export.

### Validation Panel

- [TODO] **Validation Sidebar Tab**: Add a "Validation" tab to the left sidebar showing all current OpenAPI spec issues
- [TODO] **Issue Categories**:
  - [TODO] Errors (red): Missing required fields, invalid status codes, broken $ref, duplicate operationIds
  - [TODO] Warnings (yellow): Missing descriptions, operations without tags, missing examples, no security
  - [TODO] Info (blue): Best practice suggestions, documentation coverage, consistency notes
- [TODO] **Click to Navigate**: Click any issue to pan the canvas to the affected node and highlight it
- [TODO] **Auto-Fix Suggestions**: For common issues (missing operationId, missing description), offer one-click auto-fix
- [TODO] **Issue Count Badge**: Show total issue count on the Validation tab icon
- [TODO] **Issue Suppression**: Right-click an issue to suppress it (with comment explaining why)

### API Design Linting

- [TODO] **Naming Convention Check**: Warn when paths don't follow REST conventions (e.g., `/getUser` instead of `/users/{id}`)
- [TODO] **Consistent Pluralization**: Flag inconsistent pluralization (e.g., `/user` vs. `/products`)
- [TODO] **HTTP Method Semantics**: Warn when GET operations have request bodies, DELETE operations return 201, etc.
- [TODO] **Response Completeness**: Warn when operations are missing standard error responses (400, 401, 404, 500)
- [TODO] **Security Coverage**: Highlight operations that have no security requirements defined
- [TODO] **Versioning Check**: Detect path-based versioning patterns (e.g., `/v1/users`) and flag inconsistencies

### Quality Score

- [TODO] **Spec Quality Score**: Display an overall quality score (0-100) in the toolbar, calculated from:
  - Documentation coverage (descriptions, examples)
  - Security coverage (% of operations with security)
  - Validation compliance (0 errors, 0 warnings)
  - Consistency (naming, patterns)
  - Completeness (responses, parameters defined)
- [TODO] **Score Breakdown Tooltip**: Hover over the score to see a breakdown by category
- [TODO] **Score Trend**: Track the score over time and show whether it's improving or declining

---

## 14. Minimap for Paths Canvas 📋 PLANNED

[TODO] The Paths canvas needs a minimap for navigating APIs with many endpoints.

- [TODO] **Minimap Component**: Small bird's-eye view in the bottom-right corner showing all operation nodes as colored dots (method color)
- [TODO] **Viewport Rectangle**: Show the current visible area as a draggable rectangle on the minimap
- [TODO] **Click to Navigate**: Click anywhere on the minimap to pan the canvas to that position
- [TODO] **Path Group Regions**: Color-code minimap regions by path group/resource
- [TODO] **Toggle Visibility**: `M` key or toolbar button to show/hide the minimap
- [TODO] **Resizable**: Drag the minimap corner to resize it

---

## 15. Paths Canvas Export Enhancements 📋 PLANNED

[TODO] Extend the canvas export capabilities specific to the Paths Designer.

### OpenAPI Export

- [TODO] **Export Dialog**: Modal with options for OpenAPI export:
  - [TODO] Format: JSON or YAML
  - [TODO] Version: OpenAPI 3.1 (default), OpenAPI 3.0, Swagger 2.0
  - [TODO] Bundling: Inline schemas vs. $ref references
  - [TODO] Include/exclude: Examples, descriptions, extensions, deprecated operations
  - [TODO] Server URLs: Add/edit server configurations before export
- [TODO] **Live Preview**: Show the generated spec in a Monaco editor within the export dialog
- [TODO] **Validation Gate**: Run full validation before export; block export if errors exist (with override option)
- [TODO] **Download or Copy**: Buttons for both downloading as file and copying to clipboard
- [TODO] **Export to Git**: Push the generated spec directly to a configured Git repository
- [TODO] **Export History**: Track past exports with timestamp, format, and user

### Visual Export

- [TODO] **Export Canvas as PNG/SVG/PDF**: Same as the schema canvas export wizard, adapted for the Paths canvas
- [TODO] **Export Focused View**: When in focus mode, export only the focused operation and its connected nodes
- [TODO] **Export as Mermaid Sequence Diagram**: Generate a Mermaid sequence diagram showing the request/response flow for the selected operation
- [TODO] **Export API Map**: Generate a visual API map showing all endpoints organized by resource/tag as a printable poster format

---

# Completed Features Reference

The following features are fully implemented in the Paths Designer:

### Canvas Core ✅ IMPLEMENTED
- ✅ React Flow canvas with custom node types and edge types
- ✅ Drag-and-drop from sidebar to canvas
- ✅ Node creation, deletion, and selection
- ✅ Edge creation and routing (straight, bezier, orthogonal, smart)
- ✅ Canvas background customization (solid, gradient, image, texture, grid)
- ✅ Grid snapping with adjustable size
- ✅ Fit view and zoom controls
- ✅ Auto-layout (Sugiyama-style hierarchical)
- ✅ Dark mode support

### Node Types ✅ IMPLEMENTED
- ✅ Operation nodes with HTTP method color coding
- ✅ Parameter nodes with location color coding
- ✅ Response nodes with status code color bands
- ✅ Request body nodes with multi-content-type support
- ✅ Response body nodes with schema binding
- ✅ Class reference nodes

### Editing ✅ IMPLEMENTED
- ✅ Operation properties: summary, description, operationId, tags, deprecated, x-private, external docs, extensions
- ✅ Parameter properties: name, location, schema type/format/constraints, serialization, required
- ✅ Response properties: status code, description, content types, schema modes, headers, links
- ✅ Request body: content types, inline schema editor, class reference binding, examples
- ✅ Security scheme configuration (API Key, HTTP Bearer/Basic)
- ✅ Drag-and-drop schema binding (drop class onto operation, request body, or response)

### Validation ✅ IMPLEMENTED
- ✅ Unique operation IDs
- ✅ Valid path variable syntax
- ✅ Path variable parameter definitions
- ✅ Required request body content types
- ✅ Valid HTTP status codes
- ✅ Schema reference validation
- ✅ Circular dependency detection
- ✅ Security scheme validation
- ✅ Example value conformance

### Sidebar ✅ IMPLEMENTED
- ✅ Tabbed sidebar: Paths, Operations, Classes, Properties, Security, Servers
- ✅ Path CRUD operations
- ✅ Draggable operations, classes, and properties
- ✅ Search and filter within tabs
- ✅ Auto-create CRUD operations

---

---

## Suggested Enterprise Improvements

> The following features were identified by reviewing the current Paths Designer implementation against enterprise developer expectations, cross-referencing with the canvas improvements roadmap, and analyzing competitive gaps in API design tools (Stoplight Studio, Swagger Editor, Insomnia, Postman). They are organized by priority and impact.

---

### P1. Command Palette for Paths 📋 PLANNED

[TODO] A quick-access command palette (like VS Code `Cmd+K`) to search and execute any Paths Designer action by name, maximizing keyboard-driven developer workflows.

- [TODO] **Trigger**: `Cmd/Ctrl + K` opens a search overlay centered on the canvas
- [TODO] **Action Index**: All actions searchable by name:
  - Navigation: "Go to GET /users", "Go to operation createUser", "Go to path /products/{id}"
  - Creation: "Add path", "Add GET operation", "Add query parameter", "Add 200 response"
  - View: "Fit view", "Toggle minimap", "Toggle compact mode", "Toggle focus mode"
  - Export: "Export OpenAPI YAML", "Export OpenAPI JSON", "Copy as cURL"
  - Layout: "Auto-layout top-to-bottom", "Auto-layout left-to-right"
  - Settings: "Toggle grid", "Toggle snap-to-grid", "Change edge style"
- [TODO] **Fuzzy Matching**: Matches partial and out-of-order terms (e.g., "get user" matches "Go to GET /users/{id}")
- [TODO] **Recent Actions**: Show recently used commands at the top
- [TODO] **Contextual Commands**: When a node is selected, show relevant commands first (e.g., "Add parameter", "Edit operation", "Delete")
- [TODO] **Keyboard Navigation**: Arrow keys to move, Enter to execute, Esc to dismiss

---

### P2. Integrated API Testing Panel 📋 PLANNED

[TODO] Developers need to test their API designs without leaving the Paths Designer. An integrated testing panel eliminates context-switching to external tools.

- [TODO] **Test Button on Nodes**: Each operation node has a "▶ Test" button (or right-click → "Test This Operation")
- [TODO] **Test Panel**: A bottom panel (resizable) opens with:
  - [TODO] Server selector dropdown (populated from OpenAPI servers array)
  - [TODO] Auto-populated request: URL, method, headers, query params, path params, request body from the operation definition
  - [TODO] Editable fields: Modify any parameter/header/body value before sending
  - [TODO] Authentication: Auto-apply security scheme credentials (API key, bearer token)
  - [TODO] Send button with loading indicator
  - [TODO] Response viewer: Status code, headers, body (syntax-highlighted JSON/XML), response time, size
- [TODO] **Environment Variables**: Define variables (e.g., `{{baseUrl}}`, `{{apiKey}}`) and use them across test requests
- [TODO] **Request History**: Log of past test requests with replay button
- [TODO] **cURL Export**: Copy the test request as a cURL command
- [TODO] **Response Validation**: Automatically validate the actual response against the defined response schema; highlight mismatches

---

### P3. Paths Diff & Version Comparison 📋 PLANNED

[TODO] Enterprise teams need to compare API definitions across versions to understand what changed.

- [TODO] **Version Selector**: Dropdown in the toolbar to select a comparison version
- [TODO] **Side-by-Side Diff**: Split the canvas into two linked panels (current version left, comparison version right) that pan/zoom together
- [TODO] **Diff Badges on Nodes**: Each operation shows a badge: "Added" (green), "Modified" (yellow), "Removed" (red), "Unchanged" (no badge)
- [TODO] **Property-Level Diff**: Expand a modified operation to see which parameters, responses, or schemas changed (inline green/red/yellow)
- [TODO] **Diff Navigation**: "Next change" / "Previous change" buttons to jump between differences
- [TODO] **Breaking Change Detection**: Flag changes that are breaking (removed operation, removed required parameter, changed response schema) with a red "BREAKING" badge
- [TODO] **Changelog Generation**: Auto-generate a human-readable changelog from the diff (e.g., "Added POST /users, Modified GET /products response schema, Removed DELETE /legacy-endpoint")
- [TODO] **Cherry-Pick Merge**: Select individual changes from the comparison version to apply to the current version

---

### P4. Paths Annotations & Comments 📋 PLANNED

[TODO] Enterprise design reviews and architecture discussions require the ability to leave comments on API operations.

- [TODO] **Sticky Notes**: Freeform text notes placeable anywhere on the Paths canvas
- [TODO] **Pin Comments to Operations**: Attach a comment bubble to a specific operation node; the bubble moves with the node
- [TODO] **Comment Threads**: Reply to comments, mark as resolved; unresolved comments show a badge on the operation node
- [TODO] **@Mentions**: Tag team members in comments to trigger notifications
- [TODO] **Rich Text**: Markdown support with code blocks for discussing request/response examples
- [TODO] **Comment Filter**: Toggle to show/hide all annotations; filter by resolved/unresolved, by author
- [TODO] **Review Mode**: A dedicated "Review" mode where the canvas is read-only and users can only add/resolve comments
- [TODO] **Comment Export**: Include comments in export reports for offline review

---

### P5. Real-Time Collaboration on Paths 📋 PLANNED

[TODO] Enterprise teams need concurrent editing support on the Paths Designer.

- [TODO] **Presence Indicators**: Show avatar badges of users currently viewing the Paths canvas
- [TODO] **Live Cursors**: Display other users' cursor/selection positions on the canvas in real time
- [TODO] **Conflict-Free Editing**: Use CRDT or operational transform to handle concurrent edits to the same operation
- [TODO] **Change Attribution**: Show who last modified each operation (tooltip or badge)
- [TODO] **Activity Feed**: Sidebar showing a live stream of changes by all users
- [TODO] **Follow Mode**: Click a user's avatar to lock your viewport to their position
- [TODO] **Editing Lock Indicator**: When another user has the editor overlay open for an operation, show a lock icon on that operation node for others

---

### P6. Paths Audit Trail 📋 PLANNED

[TODO] Enterprise compliance requires knowing who changed what and when in the API design.

- [TODO] **Change Log Per Operation**: Every create, update, delete recorded with timestamp + user
- [TODO] **Change Log Per Path**: Aggregated changelog across all operations in a path
- [TODO] **Diff Playback**: Step through the change history chronologically to see the API design evolve
- [TODO] **Blame View**: Color-code operation nodes by last editor
- [TODO] **Export Audit Trail**: CSV/JSON export of all changes for compliance reporting
- [TODO] **Retention Policy**: Configurable retention period for audit entries

---

### P7. Paths Performance Optimization 📋 PLANNED

[TODO] The `PathsCanvasView.tsx` is approximately 3,800 lines. For APIs with 50+ operations, performance and maintainability improvements are critical.

- [TODO] **Extract Custom Hooks**: Move interaction handlers into dedicated hooks:
  - `usePathsOperations` — operation CRUD and state
  - `usePathsDragDrop` — drag-and-drop handlers
  - `usePathsKeyboard` — keyboard shortcut handlers
  - `usePathsFocusMode` — focus/isolation logic
  - `usePathsLayout` — layout algorithm and node positioning
  - `usePathsEdges` — edge creation and routing
- [TODO] **Extract Sub-Components**: Break the render into smaller components:
  - `PathsToolbar` — toolbar above canvas
  - `PathsSearchOverlay` — search functionality
  - `PathsEditorOverlay` — floating editor panel
  - `PathsCodePreview` — OpenAPI preview panel
  - `PathsStatusBar` — bottom status bar
- [TODO] **Lazy-Load Dialogs**: Code-split the editor overlay, export dialog, and import dialog
- [TODO] **Virtualized Node Rendering**: For APIs with 100+ operation nodes, render only visible nodes using React Flow's built-in viewport culling
- [TODO] **Memoize Node Components**: Wrap node components with `React.memo` and memoize expensive data transformations
- [TODO] **Debounce State Updates**: Ensure all API calls and database writes are debounced (300ms) to prevent rapid-fire updates during drag operations

---

### P8. Paths Import Enhancements 📋 PLANNED

[TODO] Importing existing OpenAPI specs into the Paths Designer should be seamless and support more source formats.

- [TODO] **Import from Existing Project Schemas**: Right-click a class on the schema canvas → "Generate CRUD Endpoints" to create paths in the Paths Designer
- [TODO] **Import Postman Collection**: Parse Postman Collection v2.1 and create paths, operations, parameters, request bodies, and responses
- [TODO] **Import Insomnia Workspace**: Parse Insomnia export and map to Paths Designer nodes
- [TODO] **Import HAR File**: Parse HTTP Archive (HAR) files from browser DevTools and reverse-engineer path definitions from recorded traffic
- [TODO] **Import from API Gateway**: Fetch endpoint definitions from AWS API Gateway, Azure APIM, or Kong and create corresponding paths
- [TODO] **Selective Import**: Choose which paths/operations to import from the source (not all-or-nothing)
- [TODO] **Merge Import**: Import into an existing Paths canvas, merging with existing operations and resolving conflicts

---

### P9. Operation Grouping & Resource View 📋 PLANNED

[TODO] Enterprise APIs with 50+ endpoints need visual organization beyond flat lists of nodes.

- [TODO] **Resource Groups**: Automatically group operations by resource (first path segment) into collapsible containers with a colored header (e.g., "Users", "Products", "Orders")
- [TODO] **Tag-Based Groups**: Alternatively group by OpenAPI tags
- [TODO] **Manual Groups**: Drag operations into custom named groups
- [TODO] **Collapsed Group View**: When collapsed, a resource group shows: resource name, operation count, HTTP method pills (e.g., "Users (5 ops) [GET] [POST] [PUT] [DELETE]")
- [TODO] **Group-Level Actions**: Right-click a group for: Expand/Collapse, Add Operation, Delete All Operations, Move Group, Set Tag, Export Group as OpenAPI fragment
- [TODO] **Nested Resources**: Show sub-resources as nested groups (e.g., `/users/{id}/posts` appears as a child group under `/users`)
- [TODO] **Resource Color Coding**: Auto-assign colors to resource groups; persist color choices

---

### P10. Integrated Mock Server 📋 PLANNED

[TODO] Frontend developers need to work against the API design before the backend is built. An integrated mock server eliminates the need for external mock tools.

- [TODO] **One-Click Mock Server**: Button in the toolbar to start a local mock server serving all defined operations
- [TODO] **Example-Based Responses**: Serve example values defined in the spec; fall back to auto-generated data from schemas
- [TODO] **Configurable Latency**: Slider to add artificial response delay (0-5000ms) for realistic testing
- [TODO] **Error Simulation**: Toggle to randomly return error responses (4xx, 5xx) at a configurable rate
- [TODO] **Request Validation**: Validate incoming requests against the defined parameters and request body schemas; return 400 with details on mismatch
- [TODO] **Mock Server URL**: Display the mock server URL (e.g., `http://localhost:4010`) in the toolbar for copying
- [TODO] **Request Log**: Show incoming requests and outgoing responses in a live log panel
- [TODO] **Dynamic Mock Rules**: Define custom response rules (e.g., "If `userId` is 999, return 404")

---

### P11. Paths Accessibility 📋 PLANNED

[TODO] Enterprise products must meet WCAG 2.1 AA accessibility standards.

- [TODO] **Keyboard-Only Navigation**: Tab/Shift+Tab to cycle through nodes; arrow keys to move selected node; Enter to open editor
- [TODO] **Screen Reader Announcements**: ARIA live regions for canvas state changes (operation added, deleted, selected)
- [TODO] **High-Contrast Method Colors**: Ensure HTTP method colors meet 4.5:1 contrast ratio in all themes
- [TODO] **Focus Ring Indicators**: Visible focus outlines on selected operation nodes for keyboard users
- [TODO] **Reduced Motion Mode**: Respect `prefers-reduced-motion` OS setting; disable edge animations and transitions
- [TODO] **Zoom with Keyboard**: `+` / `-` keys to zoom, `0` to reset
- [TODO] **Alt Text for Nodes**: All node elements have descriptive `aria-label` attributes (e.g., "GET /users operation node with 3 parameters and 2 responses")

---

### P12. Dark IDE Theme Integration 📋 PLANNED

[TODO] Developers overwhelmingly prefer dark themes. The Paths Designer should have a first-class dark mode that feels native to dark IDEs.

- [TODO] **Node Colors in Dark Mode**: Adjust HTTP method colors for dark backgrounds (lighter/more saturated variants that maintain contrast)
- [TODO] **Edge Colors in Dark Mode**: Lighter edge colors with higher opacity for visibility on dark canvas
- [TODO] **Code Previews**: Monaco editor in dark theme (VS Code Dark+, Monokai, Dracula)
- [TODO] **Sidebar Dark Theme**: Dark gradient sidebar with subtle borders instead of shadows
- [TODO] **Overlay Dark Theme**: Editor overlay with dark background, light text, colored accents for HTTP methods
- [TODO] **Toolbar Dark Theme**: Dark toolbar with light icons and subtle hover states
- [TODO] **Consistent Theming**: All new components (command palette, search overlay, context menus, tooltips) must respect the current theme
- [TODO] **Blueprint Theme for Paths**: A dedicated "API Blueprint" theme with dark navy background, cyan grid, and neon-accented nodes (developer-aesthetic)

---

### P13. OpenAPI Extension Support 📋 PLANNED

[TODO] Enterprise teams use custom `x-*` OpenAPI extensions for API gateway configuration, documentation metadata, and internal tooling.

- [TODO] **Extension Editor**: In the editor overlay, a dedicated "Extensions" tab with a key-value editor for `x-*` extensions on operations, parameters, and responses
- [TODO] **Common Extension Templates**: Pre-built templates for popular extensions:
  - [TODO] `x-rateLimit` — Rate limiting (requests/second, burst)
  - [TODO] `x-cache` — Caching configuration (TTL, vary-by)
  - [TODO] `x-internal` — Mark operation as internal-only
  - [TODO] `x-stability` — API stability level (alpha, beta, stable)
  - [TODO] `x-permissions` — Required permissions/scopes
  - [TODO] `x-codegen-request-body-name` — OpenAPI Generator hint
  - [TODO] `x-amazon-apigateway-integration` — AWS API Gateway integration
- [TODO] **Extension Visualization**: Show extension badges on operation nodes (e.g., a "Rate Limited" badge when `x-rateLimit` is set)
- [TODO] **Organization Extension Library**: Define organization-wide custom extension schemas that are available across all projects
- [TODO] **Extension Validation**: Validate extension values against their defined schemas

---

### P14. API Metrics & Analytics 📋 PLANNED

[TODO] Provide real-time analytics about the API design to help architects make informed decisions.

- [TODO] **API Surface Area Metrics**:
  - [TODO] Total paths, operations, parameters, responses
  - [TODO] Operations per HTTP method distribution (pie/bar chart)
  - [TODO] Average parameters per operation
  - [TODO] Response coverage (% of operations with 2xx, 4xx, 5xx responses)
  - [TODO] Security coverage (% of operations with security requirements)
- [TODO] **Complexity Score**: Per-operation complexity based on parameter count, response count, schema depth, and content type variety
- [TODO] **Documentation Coverage**: % of operations with descriptions, % of parameters with descriptions, % of responses with examples
- [TODO] **Naming Consistency Score**: Analysis of operationId patterns, path naming conventions, parameter naming patterns
- [TODO] **Metrics Panel**: Collapsible bottom panel or sidebar tab showing all metrics with visual charts
- [TODO] **Metrics Export**: Export metrics as a JSON/CSV report

---

### P15. Swagger UI / ReDoc Preview Panel 📋 PLANNED

[TODO] Developers want to see how their API documentation will look to consumers without leaving the designer.

- [TODO] **Embedded Preview Tab**: A tab in the bottom panel or a split-view option showing a live Swagger UI or ReDoc rendering of the current API spec
- [TODO] **Auto-Refresh**: The preview updates in real-time as the user edits operations, parameters, and responses
- [TODO] **Try It Out**: The embedded Swagger UI "Try It Out" functionality works against the integrated mock server (see P10) or a configured real server
- [TODO] **Toggle Between Swagger UI and ReDoc**: Let developers choose their preferred documentation renderer
- [TODO] **Standalone Preview URL**: Generate a shareable URL that renders the current spec as read-only API documentation (useful for sharing with stakeholders)

---

### P16. Multi-Spec Support & Microservice Coordination 📋 PLANNED

[TODO] Enterprise architectures often involve multiple microservices, each with their own OpenAPI spec. The Paths Designer should support working with multiple specs and understanding cross-service dependencies.

- [TODO] **Multi-Spec Canvas**: Display operations from multiple project versions on the same canvas, color-coded by service
- [TODO] **Cross-Service References**: Visualize when one service's operation references a schema owned by another service
- [TODO] **Service Dependency Map**: A high-level view showing which services depend on which (based on shared schemas and cross-references)
- [TODO] **Unified Search**: Search across all services' operations from a single search box
- [TODO] **Merged Export**: Export a unified OpenAPI spec that combines operations from multiple services (with namespace prefixes to avoid conflicts)
- [TODO] **Gateway View**: Show all operations as they appear through an API gateway (aggregated from multiple microservice specs)
