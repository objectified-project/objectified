# Objectified v0.4.1

We continue to improve the platform based on your feedback with improvements and new features!

---

## New Features and Improvements

- More consistent look and feel in dark and light mode across the board
- Enhanced button styling with consistent text transformation across the application
- New project support improvements
  - Ability to import projects from SSO with a columnar navigation interface
  - Added support for Personal Access Tokens (PAT) for repository access
    - Add/Update/Delete PAT tokens directly from the UI
    - Currently supports GitHub
    - PAT tokens require "read" permissions for API and repositories to avoid 401 Unauthorized errors
    - Provider-specific instructions provided for creating tokens with proper permissions
  - Repository browser enhancements:
    - Lists all repositories available, sorted alphabetically
    - Private repositories are marked with a lock icon for easy identification
    - Search functionality to quickly find repositories by name or description
- Modified canvas layout to improve visibility and usability
  - Auto layout buttons are now more concise and compact
  - Automatically returns to canvas view when changing projects or versions
  - Canvas now displays current tenant name instead of project/version in upper right corner
- Enhanced Code view with display format selector
  - OpenAPI format selected by default
  - Added Arazzo 1.0.1 generation support
  - **New:** Added JSON Schema (Draft 2020-12) generation support
  - Format selector dropdown for easy switching between OpenAPI, Arazzo, and JSON Schema formats
- Properties form enhancements:
  - Added the ability to test regular expressions directly within the form
  - Small improvements to the layouts and spacing for better readability
  - Editing a property of type "object" now gives visibility into its nested properties
  - Added the ability to auto-generate an example value based on the property's schema
  - **New:** Extract object properties to reusable classes
    - Convert inline object properties into standalone classes that can be referenced using $ref
    - Works with both direct object types and arrays of objects
    - Automatically copies nested properties (references and library properties) to the new class
    - Prevents duplicate class names with validation
    - Updates original property to use $ref upon creation
    - Sidebar and canvas automatically refresh with proper layout to display the new class
- Class management improvements:
  - **New:** Automatic reference updates when renaming classes
    - When a class is renamed, all properties that reference it are automatically updated
    - Updates both direct references and array item references
    - Maintains data integrity by updating all `$ref` paths throughout the version
    - Ensures OpenAPI specifications remain valid after class renames
- Mermaid mode improvements:
  - Now adds display of the Mermaid diagram as an image by default
  - Adds SVG and PNG downloadability of the Mermaid diagram
  - Diagram preview is now scrollable for large diagrams
  - Added zoom controls (Zoom In, Zoom Out, Reset) for better diagram viewing
  - Supports zoom levels from 25% to 400%
- Canvas toolbar enhancements:
  - **New:** Added "Generate" view mode (coming soon)
    - New tab positioned between Code and Mermaid for easy access
    - Dedicated page showcasing the upcoming DTO generation feature
    - Will enable automatic DTO generation from project definitions
    - Planned support for multiple languages (TypeScript, Java, C#, Python, Go, Rust, and more)
    - Future features include customizable output formats, validation annotations, framework integration, and flexible export options

View our YouTube channel [here](https://www.youtube.com/@objectifieddev) for detailed tutorials and walkthroughs!

---

## Feedback

We'd love to hear your thoughts! Your feedback helps us make Objectified better.

---

**Thank you for using Objectified!**

*Last updated: December 3, 2025*

