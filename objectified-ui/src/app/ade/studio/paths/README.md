# Paths Page Implementation

## Overview

The Paths page has been implemented with a three-panel layout design based on section 9.1 of the Feature Roadmap. This provides a visual interface for designing API paths using React Flow.

## Layout Structure

The page follows a three-panel design:

```
┌──────────────┬──────────────────────────────┬──────────────┐
│   Library    │      React Flow Canvas       │  Properties  │
│   Panel      │                              │    Panel     │
│   (240px)    │      (Flexible Width)        │   (320px)    │
└──────────────┴──────────────────────────────┴──────────────┘
```

### 1. Library Panel (Left)

- **Width**: 240px (fixed)
- **Background**: White (light mode), Gray-800 (dark mode)
- **Features**:
  - Search bar for filtering components
  - Collapsible sections for organization
  - Draggable components:
    - **Paths**: New Path button
    - **HTTP Methods**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
    - **Schemas**: List of schemas from Schema Designer (placeholder)
    - **Parameters**: Query, Header, Cookie parameters
    - **Responses**: Status code presets (200, 201, 400, 401, 404, 500)
    - **Security**: Bearer Token, API Key, OAuth2

### 2. React Flow Canvas (Center)

- **Width**: Flexible (fills remaining space)
- **Background**: Gray-50 (light mode), Gray-900 (dark mode)
- **Features**:
  - Infinite canvas with zoom and pan
  - Background grid pattern
  - Controls for zoom/pan navigation
  - Mini-map for overview (toggleable)
  - Status panel showing node count
  - Drop zone for draggable library items

### 3. Properties Panel (Right)

- **Width**: 320px (fixed)
- **Background**: White (light mode), Gray-800 (dark mode)
- **Features**:
  - Contextual configuration based on selected node
  - Scrollable content area
  - Empty state when no node selected
  - Path node properties:
    - Path pattern editor
    - Path variables configuration
    - Metadata (summary, description, tags)
    - Options (deprecated, override servers)
    - Delete action
  - Method node properties:
    - Operation ID editor
    - Request configuration
    - Response configuration
    - Delete action

## Components

### LibraryPanel.tsx
- Provides the left sidebar with draggable components
- Uses Radix UI Collapsible for sections
- Implements drag-and-drop with HTML5 Drag API
- Color-coded HTTP methods and response codes

### PathsCanvas.tsx
- Main React Flow canvas component
- Handles node and edge state management
- Includes controls and mini-map
- Supports drag-and-drop from library panel

### PropertiesPanel.tsx
- Contextual properties editor
- Uses Radix UI ScrollArea for smooth scrolling
- Supports different node types (path, method, etc.)
- Form inputs for editing node properties

## Theme Support

All components fully support both light and dark modes:
- Automatically switches based on system preferences
- Uses Tailwind dark: variants
- Consistent color palette across panels
- Proper contrast ratios for accessibility

## Dependencies

- `@xyflow/react` (v12.9.2): React Flow library for canvas
- `@radix-ui/react-collapsible`: Collapsible sections
- `@radix-ui/react-scroll-area`: Custom scrollbars
- `lucide-react`: Icon library
- `tailwindcss`: Styling

## File Structure

```
src/app/ade/studio/paths/
├── page.tsx                    # Main paths page
└── components/
    ├── LibraryPanel.tsx        # Left sidebar with components
    ├── PathsCanvas.tsx         # Center React Flow canvas
    └── PropertiesPanel.tsx     # Right properties editor
```

## Future Enhancements

1. **Node Types**: Implement custom node types (PathNode, MethodNode, etc.)
2. **Schema Integration**: Connect to Schema Designer for schema references
3. **Drag & Drop**: Complete drag-and-drop functionality from library to canvas
4. **Node Selection**: Implement node selection and properties editing
5. **OpenAPI Export**: Generate OpenAPI 3.1 specs from canvas
6. **Validation**: Real-time validation of API paths
7. **Persistence**: Save/load canvas state to database

## Design Reference

Implementation follows section 9.1 "Studio Layout Structure" from:
`/Users/kenji/Development/objectified/FEATURE_ROADMAP_PATHS.md`

The design includes:
- Three-panel layout with fixed sidebars and flexible canvas
- Visual node system with color-coded HTTP methods
- Library panel with draggable components
- Properties panel with contextual editing
- React Flow canvas with infinite workspace

