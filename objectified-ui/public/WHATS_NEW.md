# Objectified 01-2026

We continue to improve the platform based on your feedback with improvements and new features!

---

## New Features and Improvements

- Even more look and feel improvements
- Fixed Mermaid PNG generation issue
- Property enumerations can now be:
  - Sorted in ascending or descending order
  - Repositioned as desired within the enumeration list
- Added GitLab support for linked accounts and repositories
- Enhanced class editing layout
  - Double-clicking a class node now edits the node instead of displaying it as code
  - Moved the JSON/YAML and example generation to the edit form
- Added new publication endpoints:
  - /v1/arazzo now generates Arazzo
  - /v1/json now generates JSON Schema
- Added new layout options for the canvas:
  - **Hierarchical** (Top-Down, Left-Right, Bottom-Top, Right-Left) - Organized hierarchy with dependency flow
  - **Force-Directed** - Physics-based organic layout with natural clustering
  - **Circular** - Nodes arranged in a circle, ideal for cyclic dependencies
  - **Grid** - Clean grid pattern with alphabetical ordering
  - **Layered** - Horizontal layers based on dependency depth
  - Smooth animations between layout transitions for professional polish
- Additional Canvas Updates:
  - Added the ability to tag classes
  - Class nodes now display tag names alongside the class name for better visual organization
- **New: TypeScript DTO Generation** in the Generate tab:
  - Generate TypeScript interfaces and types alongside Python Pydantic models
  - Language selector dropdown to switch between Python and TypeScript output
  - Full feature parity with Python generator:
    - TypeScript interfaces for all classes
    - Nested interfaces for inline object properties with consistent naming
    - Union literal types for enumerations
    - Intersection types (allOf) and union types (oneOf/anyOf) for composition
    - Optional vs required property markers based on schema
    - JSDoc comments with descriptions and validation constraints
    - Reference type support for class relationships
  - Instant code switching with cached generation for performance
  - Export to .ts files ready for use in TypeScript projects
  - Monaco Editor with TypeScript syntax highlighting

View our YouTube channel [here](https://www.youtube.com/@objectifieddev) for detailed tutorials and walkthroughs!

---

## Feedback

We'd love to hear your thoughts! Your feedback helps us make Objectified better.

---

**Thank you for using Objectified!**

*Last updated: December 7, 2025*

