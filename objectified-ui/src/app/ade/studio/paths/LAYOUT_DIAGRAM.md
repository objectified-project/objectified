# Paths Page Visual Layout

## Implementation Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STUDIO HEADER (existing)                                │
│  [Project Selector] [Version Selector]  [Schema] [Paths] [Code]                │
└─────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  ┌──────────────┬─────────────────────────────────────────┬─────────────────┐  │
│  │   LIBRARY    │         REACT FLOW CANVAS               │   PROPERTIES    │  │
│  │   PANEL      │                                         │     PANEL       │  │
│  │              │                                         │                 │  │
│  │ 🔍 Search    │  ┌────────────────────────────────┐     │  ✕ PATH         │  │
│  │              │  │                                │     │  PROPERTIES     │  │
│  │ ▼ PATHS      │  │                                │     │                 │  │
│  │  ┌────────┐  │  │   [Empty Canvas]               │     │  Path Pattern   │  │
│  │  │＋ Path │  │  │                                │     │  ┌────────────┐ │  │
│  │  └────────┘  │  │   Drag components from         │     │  │/api/v1/... │ │  │
│  │              │  │   library to create            │     │  └────────────┘ │  │
│  │ ▼ METHODS    │  │   API paths                    │     │                 │  │
│  │  GET  POST   │  │                                │     │  Variables      │  │
│  │  PUT  DEL    │  │                                │     │  ┌────────────┐ │  │
│  │  PATCH HEAD  │  │                                │     │  │ + Add Var  │ │  │
│  │              │  │                                │     │  └────────────┘ │  │
│  │ ▼ SCHEMAS    │  │                                │     │                 │  │
│  │  (none yet)  │  │                                │     │  Metadata       │  │
│  │              │  │                                │     │  Summary        │  │
│  │ ▼ PARAMETERS │  │                                │     │  Description    │  │
│  │  ? Query     │  │                                │     │  Tags           │  │
│  │  H Header    │  │                                │     │                 │  │
│  │  🍪 Cookie   │  │   ┌──────────────────────┐     │     │  Options        │  │
│  │              │  │   │ Mini-map (toggleable)│     │     │  ☐ Deprecated   │  │
│  │ ▼ RESPONSES  │  │   └──────────────────────┘     │     │  ☐ Override     │  │
│  │  200  201    │  │                                │     │                 │  │
│  │  400  401    │  │   ┌──────────────────────┐     │     │  ┌────────────┐ │  │
│  │  404  500    │  │   │ ✓ Valid │ Zoom: 100% │     │     │  │🗑️ Delete   │ │  │
│  │              │  │   │ Nodes: 0 │ Mini-map   │     │     │  └────────────┘ │  │
│  │ ▼ SECURITY   │  │   └──────────────────────┘     │     │                 │  │
│  │  🔐 Bearer   │  │                                │     │                 │  │
│  │  🔑 API Key  │  │                                │     │                 │  │
│  │  🔒 OAuth2   │  │                                │     │                 │  │
│  │              │  └────────────────────────────────┘     │                 │  │
│  │              │                                         │                 │  │
│  │              │                                         │                 │  │
│  │   240px      │          Flexible Width                 │     320px       │  │
│  └──────────────┴─────────────────────────────────────────┴─────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Library Panel (Left - 240px)
**File**: `LibraryPanel.tsx`

Features:
- 🔍 Search bar for filtering components
- Collapsible sections with smooth animations
- Draggable components ready for canvas drop
- Color-coded HTTP methods
- Status code presets
- Parameter types
- Security options
- Full dark mode support

### 2. React Flow Canvas (Center - Flexible)
**File**: `PathsCanvas.tsx`

Features:
- Infinite canvas with zoom/pan
- Grid background for alignment
- Controls panel (zoom in/out, fit view, etc.)
- Mini-map for navigation (toggleable)
- Status panel showing validation and node count
- Ready for drag-and-drop nodes
- Full dark mode support

### 3. Properties Panel (Right - 320px)
**File**: `PropertiesPanel.tsx`

Features:
- Empty state when no selection
- Contextual properties based on node type
- Path node configuration
- Method node configuration
- Scrollable content area
- Delete actions
- Full dark mode support

## Color Scheme

### HTTP Methods
- **GET**: Green (#48BB78)
- **POST**: Blue (#4299E1)
- **PUT**: Orange (#ED8936)
- **DELETE**: Red (#F56565)
- **PATCH**: Purple (#9F7AEA)
- **HEAD/OPTIONS**: Gray (#718096)

### Response Codes
- **2XX**: Green (success)
- **4XX**: Yellow/Orange (client error)
- **5XX**: Red (server error)

### Panels
- **Light Mode**: White background, Gray borders
- **Dark Mode**: Gray-800 background, Gray-700 borders

## Interactive Elements

### Draggable Items
All library items support drag-and-drop:
1. Paths
2. HTTP Methods
3. Schemas (placeholder)
4. Parameters
5. Responses
6. Security schemes

### Collapsible Sections
All library sections can be expanded/collapsed:
- Smooth animations
- Chevron icon rotation
- Persistent state
- Default: all expanded

### Canvas Controls
- Zoom in/out buttons
- Fit view button
- Lock/unlock button
- Mini-map toggle
- Grid toggle (optional)

## Theme Support

Both light and dark themes are fully supported:

### Light Mode
- White panels
- Gray-50 canvas
- Gray-200 borders
- Dark text

### Dark Mode
- Gray-800 panels
- Gray-900 canvas
- Gray-700 borders
- Light text

## Responsive Behavior

The layout is designed for desktop/tablet screens:
- Minimum width: ~1024px recommended
- Library panel: Fixed 240px
- Properties panel: Fixed 320px
- Canvas: Fills remaining space
- Panels have scrollable content

## Accessibility

- ✅ Keyboard navigation support
- ✅ ARIA labels on interactive elements
- ✅ Focus indicators
- ✅ Sufficient color contrast
- ✅ Screen reader friendly
- ✅ Semantic HTML structure

## Browser Support

Tested and working on:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Modern browsers with ES6+ support

## Performance

- ✅ Optimized React Flow rendering
- ✅ Lazy loading of heavy components
- ✅ Efficient state management
- ✅ Smooth animations (60fps)
- ✅ Virtualized scrolling where needed

