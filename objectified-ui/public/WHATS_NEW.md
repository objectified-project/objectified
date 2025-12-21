# Objectified 01-2026

We continue to improve the platform based on your feedback with improvements and new features!

---

## New Features and Improvements

- Even more look and feel improvements
  - Converting from Material UI to Radix UI
- Numerous bug fixes and performance enhancements
- Improved canvas performance for large schemas
- Properties form and editor have an improved layout
- **Nested Properties Visibility**: When editing an object property, you can now see all nested properties
  - Displays property name, type, required status, and deprecated status
  - Shows description on hover
  - Clear indication of how many nested properties exist
  - Helpful guidance on how to edit nested properties
- Properties options have been improved:
  - Numeric constraints now use OpenAPI 3.1 / JSON Schema draft 2020-12 format
  - Added radio button options for minimum/maximum constraints: Inclusive (≥/≤) vs Exclusive (>/<)
  - Adds multipleOf constraint for numeric properties
  - All property constraints are now properly preserved when dragging properties to classes
  - Boolean and null types now show "No additional constraints" message in the Constraints section
  - Array types now support "contains" schema
  - Added "minContains" and "maxContains" fields - specify minimum/maximum number of items that must match the contains schema
  - Added "minProperties" and "maxProperties" fields for object types
  - Added "constant" field for properties
  - Added "not" support for properties - define schemas that must not be matched
  - Added "patternProperties" allowing for regex patterns mapped to schemas
  - Added "dependentSchemas" composition support - when a trigger property is present, apply additional schema constraints (e.g., if "paymentMethod" is present, require credit card validation schema)
  - Added "dependentRequired" support - when a trigger property is present, other properties become required (e.g., if "billingAddress" is present, "billingCity" and "billingZip" become required)
  - Added "Nullable" checkbox (OpenAPI 3.1) - outputs type as an array like `['string', 'null']` instead of the deprecated `nullable: true` from OpenAPI 3.0
    - Nullable now shows as a "?" indicator in the type field when displayed in classes and properties
  - Changed "Example" to "Examples" - now supports multiple examples per property
    - Add multiple JSON examples for each property
    - Auto-generate examples based on schema with one click
    - Examples are stored as an array in OpenAPI 3.1 format
  - Added "unevaluatedProperties" for object properties - advanced control for inheritance scenarios (controls properties not matched by properties, patternProperties, or inherited schemas)
  - Added "if/then/else" class composition support
  - Added "unevaluatedItems" support
  - Added "unevaluatedProperties" support
  - Updated "additionalProperties" handling to support matching of a schema by reference
  - Added support for property name constraints using a format, min/max length, and regex pattern
  - Added support for custom "x-" tags and values to classes and properties
  - Added support for external documentation on a class and property level
  - Added support for discriminator mapping to x- tags, propertyName, and values
  - Corrected "required" handling for dragged properties to classes
  - Marking for deprecation is now available for properties and classes
  - prefixItems:
    - Define ordered schemas for specific array positions (e.g., `[string, number, boolean]`)
    - Enable "Tuple Mode" checkbox in array properties
    - Add/remove/reorder prefix items with drag-and-drop
    - Each position can have its own type and constraints
    - Control additional items beyond prefix with custom schema
    - Perfect for coordinates, CSV-like data, function arguments, and database rows
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
  - Added an export button in the upper right-hand corner of the canvas header
    - Export canvas as PNG image
    - Export canvas as SVG image
    - Export canvas as JPG image
    - Export canvas as PDF document
    - Export canvas as PlantUML document
    - Export canvas as GraphML document

View our YouTube channel [here](https://www.youtube.com/@objectifieddev) for detailed tutorials and walkthroughs!

---

## Feedback

We'd love to hear your thoughts! Your feedback helps us make Objectified better.

---

**Thank you for using Objectified!**

*Last updated: December 14, 2025*

