# Canvas Roadmap Features

These are the features to do later. Enterprise improvements from the planned canvas roadmap have been incorporated into the sections below.

---

### 1. Looks

#### Navigation & Controls ✅ PARTIALLY COMPLETE
- **Canvas Layers**: Background, Node, Edge, Annotation, UI layers with toggle/lock
- **Node Visibility**: Hide/show nodes, "ghosts mode" for hidden nodes

#### Canvas Bookmarks & Waypoints 📋 PLANNED
- **Bookmarks** (`Cmd/Ctrl + 1-9`): Save up to 9 named viewport positions (x, y, zoom) per version
- Named bookmarks with thumbnail previews
- **Bookmark panel**: List all bookmarks with thumbnail previews
- **Jump to bookmark**: Smooth animated pan/zoom to bookmarked position
- **Bookmark sharing**: Bookmarks saved per-user but shareable as deep links
- **Auto-bookmarks**: Auto-create bookmarks for each group centroid
- Large schemas (50+ classes) benefit from spatial navigation beyond the minimap

#### Canvas Minimap Enhancements 📋 PLANNED
- **Group highlighting in minimap**: Color-code minimap regions by group
- **Minimap node badges**: Show tiny color indicators for validation warnings
- **Minimap click-to-zoom**: Click a region in the minimap to zoom into that area (currently pans only)
- **Minimap resizable**: Allow users to resize the minimap or dock it to a sidebar
- **Minimap toggle shortcut**: `M` key to show/hide minimap

---

### 6. Undo/Redo System 📋 PLANNED

> **Enterprise note**: The canvas currently has no undo/redo capability. Any accidental class deletion, edge removal, node move, or property edit is irreversible without reloading—critical for enterprise use.

#### Comprehensive Undo Buffer 📋 PLANNED
- **Undo stack** with configurable depth (default 50, max 500 operations)
- Track all canvas and schema modifications
- **Tracked operations**: Class create/delete/rename/move/resize, property add/edit/delete/reorder, edge create/delete, group operations, layout changes, visual (color, size, style), annotations
- **Operation coalescing**: Rapid sequential moves of the same node collapsed into a single undo entry
- **Persistent undo across sessions**: Optionally persist undo stack to database so changes survive page reload

| Ticket | Feature Description                  |
|--------|--------------------------------------|

#### Undo/Redo UI 📋 PLANNED
- **Keyboard shortcuts**: `Cmd/Ctrl + Z` (Undo), `Cmd/Ctrl + Shift + Z` (Redo)
- Toolbar buttons with dropdown showing last 10 actions
- Click any action to undo/redo to that point

| Ticket | Feature Description                  |
|--------|--------------------------------------|

#### History Panel 📋 PLANNED
- **Trigger**: `Cmd/Ctrl + H` opens dedicated history panel
- Visual timeline of all changes with ability to jump to any point
- Chronological list with visual timeline view
- Filter by action type, search history
- Before/after previews for each action

| Ticket | Feature Description                  |
|--------|--------------------------------------|

#### Advanced Features 📋 PLANNED
- Selective undo: Undo specific actions without undoing everything
- Branch history for collaborative editing
- Server-side backup and sync across devices

| Ticket | Feature Description                  |
|--------|--------------------------------------|

---

### 7. Copy/Paste & Duplicate Nodes 📋 PLANNED

> **Enterprise note**: Standard clipboard operations on the canvas are expected by enterprise users.

- **Copy** (`Cmd/Ctrl + C`): Copy selected class nodes to internal clipboard (including properties and schema)
- **Paste** (`Cmd/Ctrl + V`): Paste copied nodes at cursor position with de-duplicated names (e.g., "User" → "User (Copy)")
- **Duplicate** (`Cmd/Ctrl + D`): In-place duplicate of selected nodes offset by a small amount
- **Cross-version paste**: Copy a class from one version and paste into another
- **Multi-select copy**: Copy multiple classes with their inter-relationships preserved

| Ticket | Feature Description                  |
|--------|--------------------------------------|

---

### 8. Canvas Annotations & Comments 📋 PLANNED

> **Enterprise note**: Design reviews and architecture discussions require the ability to leave comments on the schema. No annotation or comment system currently exists on the canvas.

- **Sticky notes**: Freeform text notes placeable anywhere on the canvas (distinct from class nodes)
- **Pin comments to nodes**: Attach a comment bubble to a specific class or property
- **Comment threads**: Reply to comments, mark as resolved
- **@Mentions**: Tag team members in comments to notify them
- **Rich text**: Markdown support in comments with code snippets
- **Comment visibility toggle**: Show/hide all annotations without deleting them
- **Comment export**: Include or exclude annotations when exporting canvas images

| Ticket | Feature Description                  |
|--------|--------------------------------------|

---

### 11. Developer Productivity Features

#### Quick Actions & Command Palette 📋 PLANNED
- **Trigger**: `Cmd/Ctrl + K` opens overlay search box (quick-access like VS Code)
- **Action index**: All canvas actions searchable by name (e.g., "Save Layout", "Export as PNG", "Auto-organize", "Toggle Grid", "Create Group", "Zoom to Fit")
- **Fuzzy matching**: Matches partial and out-of-order terms; search classes, properties, actions
- **Recent actions**: Show recently used commands at the top
- **Contextual commands**: Different commands based on selection (e.g., when a node is selected: "Delete Class", "Edit Properties", "Change Color")
- **Keyboard navigation**: Arrow keys to move, Enter to execute, Esc to dismiss
- Custom action shortcuts configuration
- Action categories: Navigate, Edit, View, Export, Layout

| Ticket | Feature |
|--------|---------|

#### Inline Documentation
- Rich markdown editor in property tooltips
- Code examples in documentation with syntax highlighting
- Documentation templates per property type
- Auto-generate documentation from property schema
- Documentation coverage indicators on nodes
- Bulk documentation editing mode

| Ticket | Feature |
|--------|---------|

#### Code Preview Integration 📋 PLANNED
- Hover over class to preview generated code (TypeScript, Python, Java, etc.)
- 📋 Split view: Canvas + Code side by side
- 📋 Real-time code generation as schema changes
- Code syntax highlighting with language selector
- Copy code snippets directly from preview
- Jump to relevant code section from class property

| Ticket | Feature                                     |
|--------|---------------------------------------------|
| #599   | Add side-by-side canvas and code view       |
| #600   | Real-time code generation as schema changes |

---

### 12. Enterprise Governance & Compliance

#### Access Control Visualization
- Visual indicators for permission levels:
    - 🔓 Open (full access)
    - 🔒 Read-only (view only)
    - 🚫 Restricted (no access, greyed out)
    - ⚠️ Pending approval
- Owner badges on classes/groups
- Team assignment visualization
- Permission inheritance from groups to classes

| Ticket | Feature |
|--------|---------|

#### Audit Trail Overlay 📋 PLANNED
- **Enterprise compliance**: Who changed what and when on the canvas
- **Change log per class**: Every create, update, delete, move recorded with timestamp + user
- **Change log per version**: Aggregated changelog across all classes in a version
- **Canvas diff playback**: Step through change history chronologically to see the canvas evolve
- **Blame view**: Color-code nodes by last editor (who touched it most recently)
- "History mode" showing change timeline on canvas
- Click class to see full change history
- Filter by author, date range, change type
- Animated replay of schema evolution
- Compliance annotations (who approved, when)
- **Export audit trail**: CSV/JSON export of all changes for compliance reporting
- **Retention policy**: Configurable how long audit entries are kept

| Ticket | Feature |
|--------|---------|

#### Schema Standards Enforcement & Canvas-Level Validation 📋 PLANNED
- Real-time validation indicators on canvas:
    - ✅ Compliant (green checkmark)
    - ⚠️ Warning (yellow triangle)
    - ❌ Violation (red X)
- **Dangling reference warnings**: Highlight properties that reference non-existent classes (red badge on edge)
- **Circular dependency detection**: When a circular reference is created, show warning toast and highlight the cycle on the canvas
- **Naming convention lint**: Warn when class or property names violate configurable rules (e.g., PascalCase for classes, camelCase for properties)
- **Unused class detection**: Dim or badge classes not referenced by any other class
- **Required property audit**: Badge classes where required properties have no description or no type
- **Schema complexity warnings**: Warn when a single class exceeds configurable property count threshold (e.g., 30+ suggests decomposition)
- **Lint panel**: Toggleable sidebar listing all lint warnings with click-to-navigate
- Click indicator to see violation details and fix suggestions
- Configurable rule sets (company standards, industry standards)
- Auto-fix suggestions with one-click apply
- Standards compliance score per class and overall

| Ticket | Feature |
|--------|---------|

---

### 12.1 Real-Time Collaboration 📋 PLANNED

> **Enterprise note**: The canvas has no multi-user collaboration support. Concurrent editing is expected for enterprise teams.

- **Presence indicators**: Show avatar badges of users currently viewing the canvas
- **Live cursors**: Display other users' cursor positions on the canvas in real time
- **Operational Transform or CRDT**: Conflict-free concurrent edits to nodes, edges, and properties
- **Change attribution**: Show who last modified each class (tooltip or badge)
- **Conflict resolution UI**: When two users edit the same class simultaneously, present a merge dialog
- **Activity feed**: Sidebar showing a live stream of canvas changes by all users
- **Follow mode**: Click a user's avatar to lock your viewport to their position

| Ticket | Feature |
|--------|---------|

---

### 13. Large Schema Optimization

#### Smart Clustering
- Automatic detection of related class clusters
- One-click collapse clusters to single node
- Cluster summary (class count, relationship count)
- Expand cluster in-place or in separate view
- Cross-cluster relationship visualization
- Machine learning-based clustering suggestions

| Ticket | Feature |
|--------|---------|

#### Multi-Canvas Views
- Open multiple canvas tabs for same schema
- Different views: Overview, Detail, Relationships, Dependencies
- Synchronized selection across views
- Split canvas: Two views side by side
- Pin important classes to sidebar for quick access
- Recent classes list for quick navigation

| Ticket | Feature |
|--------|---------|

#### Progressive Loading
- Load visible area first, then expand
- Skeleton placeholders for loading nodes
- Priority loading based on importance/connections
- Lazy load property details on demand
- Background loading with progress indicator
- Cancel loading for navigated-away areas

| Ticket | Feature |
|--------|---------|

---

### 14. Integration & Extensibility

#### External Tool Integration
- Embed canvas in Confluence/Notion pages
- Slack integration for canvas snapshots
- JIRA integration: Link classes to tickets
- GitHub/GitLab: Canvas diff in PR reviews
- IDE plugins: Jump from code to canvas class
- Webhook triggers on canvas changes

| Ticket | Feature |
|--------|---------|

#### Canvas Import from External Tools 📋 PLANNED
- **Enterprise note**: Teams migrate from existing diagramming tools. Support importing canvas layouts from common formats.
- **Import from Draw.io / diagrams.net**: Parse `.drawio` XML and create classes + relationships on canvas
- **Import from Lucidchart**: Parse exported JSON/CSV and map to canvas nodes
- **Import from Mermaid**: Parse Mermaid class diagram syntax and create corresponding schema
- **Import from PlantUML**: Parse PlantUML class diagram and create corresponding schema
- **Import from ERD tools** (dbdiagram.io, pgModeler): Parse SQL DDL or DBML and map to classes

| Ticket | Feature |
|--------|---------|

#### Canvas API & SDK
- Programmatic canvas manipulation API
- Custom node renderers via plugins
- Event hooks (onNodeClick, onLayoutChange, etc.)
- Batch operations API for automation
- Canvas state serialization/deserialization
- Third-party visualization library integration

| Ticket | Feature |
|--------|---------|

#### Print & Documentation Generation
- Print-optimized canvas layout
- Multi-page PDF with table of contents
- Auto-generated schema documentation site
- Include canvas diagrams in OpenAPI export
- Confluence/Wiki page auto-generation
- Custom branding/watermarks for exports

| Ticket | Feature |
|--------|---------|

---

### 15. Accessibility & Internationalization

#### Accessibility (a11y) 📋 PLANNED
- **Enterprise note**: Products are expected to meet WCAG 2.1 AA accessibility standards.
- **Keyboard-only navigation**: Tab/Shift+Tab to cycle through nodes, arrow keys to move selected node, Enter to open edit dialog
- **Screen reader announcements**: ARIA live regions for canvas state changes (node created, deleted, moved)
- **High-contrast edge colors**: Ensure all edge colors meet 4.5:1 contrast ratio in both light and dark modes
- **Focus ring indicators**: Visible focus outlines on selected nodes and edges for keyboard users
- **Reduced motion mode**: Respect `prefers-reduced-motion` OS setting; disable edge animations and LOD transitions
- **Zoom with keyboard**: `+` / `-` keys to zoom in/out, `0` to reset zoom
- Full keyboard navigation for all canvas operations
- Screen reader support with ARIA labels
- High contrast mode with configurable colors
- Focus indicators for all interactive elements
- Voice control integration (basic commands)
- Tab order optimization for logical flow

| Ticket | Feature |
|--------|---------|

#### Internationalization (i18n)
- RTL (Right-to-Left) layout support
- Localized UI elements and tooltips
- Unicode class/property name support
- Locale-aware date/time formatting
- Translated keyboard shortcut hints

| Ticket | Feature |
|--------|---------|

---

### Updated Keyboard Shortcuts Reference

| Shortcut               | Action                        |
|------------------------|-------------------------------|
| `Cmd/Ctrl + Z`         | Undo                          |
| `Cmd/Ctrl + Shift + Z` | Redo                          |
| `Cmd/Ctrl + F`         | Search canvas                 |
| `Cmd/Ctrl + K`         | Command palette               |
| `Cmd/Ctrl + H`         | Toggle history panel          |
| `Cmd/Ctrl + D`         | Toggle dependency view        |
| `Cmd/Ctrl + M`         | Toggle metrics overlay        |
| `Cmd/Ctrl + P`         | Preview generated code        |
| `M`                    | Toggle minimap                |
| `Cmd/Ctrl + 1-9`       | Jump to bookmark              |
| `Space + Drag`         | Pan canvas                    |
| `Scroll`               | Zoom in/out                   |
| `Esc`                  | Exit focus mode               |
| `Delete`               | Delete selected               |
| `Cmd/Ctrl + C`         | Copy selected nodes           |
| `Cmd/Ctrl + V`         | Paste nodes                   |
| `Cmd/Ctrl + D`         | Duplicate selected            |
| `Cmd/Ctrl + G`         | Group selected nodes          |
| `Cmd/Ctrl + Shift + G` | Ungroup                       |
| `Cmd/Ctrl + E`         | Quick export menu             |
| `Cmd/Ctrl + .`         | Show context menu             |
| `Tab`                  | Next node                     |
| `Shift + Tab`          | Previous node                 |
| `Arrow Keys`           | Navigate between nodes        |
| `Enter`                | Edit selected node            |

---

### 16. Improved Editor Page Architecture 📋 PLANNED

> **Enterprise note**: The main editor page is very large (~5,100+ lines), which hurts maintainability, code review velocity, and bundle splitting.

- **Extract custom hooks**: Move canvas interaction handlers into dedicated hooks (`useCanvasInteractions`, `useCanvasSearch`, `useCanvasGroups`, `useCanvasLayout`, `useCanvasKeyboard`)
- **Extract sub-components**: Break the render into smaller components (`CanvasToolbar`, `CanvasSearchPanel`, `CanvasSettingsSheet`, `CanvasStatusBar`)
- **Lazy-load dialogs**: Code-split heavy dialogs (export wizard, settings, class edit) so they do not bloat the initial canvas bundle
- **Reduce re-renders**: Audit `useEffect` dependency arrays and memoize expensive computations (large dependency arrays may trigger unnecessary re-renders)
- **Performance profiling**: Add React DevTools Profiler markers for layout calculations, node rendering, and search filtering to identify bottlenecks on large canvases

| Ticket | Feature |
|--------|---------|

---

### 17. Version Comparison on Canvas 📋 PLANNED

> **Enterprise note**: Version comparison currently works as a side-by-side code diff. Enterprise users need a visual diff directly on the canvas.

- **Canvas overlay diff**: Overlay two versions on the same canvas with added nodes in green, removed in red, modified in yellow
- **Side-by-side canvas diff**: Two linked canvases (left = old version, right = new) that pan/zoom together
- **Diff badges on nodes**: Per-class badge showing "Added", "Modified", "Removed"
- **Property-level diff**: Expand a modified class to see which properties changed (inline green/red/yellow)
- **Diff navigation**: "Next change" / "Previous change" buttons to jump between differences
- **Cherry-pick merge**: Select individual changes from a diff to apply to the current version

| Ticket | Feature |
|--------|---------|

