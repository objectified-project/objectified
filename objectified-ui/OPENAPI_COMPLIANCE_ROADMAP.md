# OpenAPI 3.1.0 Schema Compliance Guide

## Overview

This document analyzes the Objectified UI application's current support for OpenAPI 3.1.0 Schema Object features and provides recommendations for achieving comprehensive compliance. The application is a visual schema designer focused on defining `components/schemas` definitions.

---

## Feature Compliance Matrix

### Legend

| Symbol  | Meaning               |
|---------|-----------------------|
| ✅       | Fully Implemented     |
| ⚠️      | Partially Implemented |
| ❌       | Not Implemented       |

---

## Info Object

| Feature              | Status  | Description                             |
|----------------------|---------|-----------------------------------------|
| `title`              | ✅       | Uses project name                       |
| `version`            | ✅       | Uses version ID                         |
| `description`        | ✅       | Uses version description                |
| `summary`            | ❌       | Short summary of the API                |
| `termsOfService`     | ❌       | URL to terms of service                 |
| `contact.name`       | ❌       | Contact person/organization name        |
| `contact.url`        | ❌       | Contact URL                             |
| `contact.email`      | ❌       | Contact email address                   |
| `license.name`       | ❌       | License name (required if license used) |
| `license.identifier` | ❌       | SPDX license identifier                 |
| `license.url`        | ❌       | URL to license text                     |

### Implementation Suggestions

**summary**: Add a "Summary" text field to the project or version settings. This should be a brief one-line description distinct from the longer description field.

**termsOfService**: Add a URL field in project settings for terms of service. Validate that it's a properly formatted URL.

**contact**: Create a "Contact Information" section in project settings with fields for name, URL, and email. Store as a JSON object in the project metadata.

**license**: Add a "License" section in project settings. Consider providing a dropdown of common SPDX identifiers (MIT, Apache-2.0, GPL-3.0, etc.) alongside a custom option. The identifier and URL are mutually exclusive per the spec.

---

## Schema Object - Core Types

| Feature                                  | Status  | Description            |
|------------------------------------------|---------|------------------------|
| `type: string`                           | ✅       | String data type       |
| `type: number`                           | ✅       | Floating-point number  |
| `type: integer`                          | ✅       | Integer number         |
| `type: boolean`                          | ✅       | True/false value       |
| `type: array`                            | ✅       | Array/list of items    |
| `type: object`                           | ✅       | Object with properties |
| `type: null`                             | ❌       | Explicit null type     |
| Type arrays (e.g., `['string', 'null']`) | ❌       | Multiple allowed types |

### Implementation Suggestions

**type: null**: Add "null" as a selectable type option in the property type dropdown. This is useful for representing optional fields that can explicitly be null.

**Type arrays**: In OpenAPI 3.1 (aligned with JSON Schema), nullable is expressed as a type array like `['string', 'null']`. Add a "Nullable" checkbox that, when combined with the selected type, outputs the type as an array. This replaces the deprecated `nullable: true` from OpenAPI 3.0.

---

## Schema Object - Metadata

| Feature        | Status  | Description                               |
|----------------|---------|-------------------------------------------|
| `title`        | ✅       | Human-readable name                       |
| `description`  | ✅       | Detailed description                      |
| `default`      | ✅       | Default value                             |
| `examples`     | ❌       | Array of example values                   |
| `deprecated`   | ❌       | Marks schema as deprecated                |
| `readOnly`     | ❌       | Value should not be sent in requests      |
| `writeOnly`    | ❌       | Value should not be returned in responses |
| `externalDocs` | ❌       | Link to external documentation            |
| `$comment`     | ❌       | Developer comments (not for users)        |

### Implementation Suggestions

**examples**: Add an "Examples" section in the property editor allowing users to add multiple example values. Display as a list with add/remove functionality. Examples help API consumers understand expected data formats.

**deprecated**: Add a "Deprecated" toggle at both the class and property level. When enabled, display a visual indicator (strikethrough or warning badge) on the canvas. Consider adding an optional deprecation message field.

**readOnly**: Add a "Read Only" checkbox in property settings. Useful for computed fields, timestamps, or IDs that are returned but shouldn't be submitted. Show a lock icon on the canvas for read-only properties.

**writeOnly**: Add a "Write Only" checkbox in property settings. Common use case is password fields that are submitted but never returned. Show an eye-slash icon on the canvas for write-only properties.

**externalDocs**: Add optional "External Documentation" fields (URL and description) at both class and property level. This links to additional documentation outside the spec.

**$comment**: Add an optional "Developer Comment" field that appears in the schema but is intended for schema maintainers, not API consumers.

---

## Schema Object - String Constraints

| Feature            | Status  | Description                |
|--------------------|---------|----------------------------|
| `minLength`        | ✅       | Minimum string length      |
| `maxLength`        | ✅       | Maximum string length      |
| `pattern`          | ✅       | Regex pattern constraint   |
| `format`           | ✅       | Semantic format hint       |
| `contentEncoding`  | ❌       | Encoding (e.g., base64)    |
| `contentMediaType` | ❌       | Media type of content      |
| `contentSchema`    | ❌       | Schema for decoded content |

### Implementation Suggestions

**contentEncoding**: Add a "Content Encoding" dropdown with options like "base64", "base64url", "quoted-printable". This indicates how binary data is encoded as a string.

**contentMediaType**: Add a "Content Media Type" field (e.g., "application/json", "image/png") that describes the media type of the decoded content. This is used together with contentEncoding for embedded binary data.

**contentSchema**: When contentMediaType indicates structured data (like JSON), allow specifying a schema reference for the decoded content. This enables nested schema validation for encoded payloads.

---

## Schema Object - Numeric Constraints

| Feature            | Status  | Description                    |
|--------------------|---------|--------------------------------|
| `minimum`          | ✅       | Minimum value (inclusive)      |
| `maximum`          | ✅       | Maximum value (inclusive)      |
| `exclusiveMinimum` | ❌       | Minimum value (exclusive)      |
| `exclusiveMaximum` | ❌       | Maximum value (exclusive)      |
| `multipleOf`       | ❌       | Value must be multiple of this |

### Implementation Suggestions

**exclusiveMinimum / exclusiveMaximum**: In OpenAPI 3.1 (JSON Schema draft 2020-12), these are numeric values, not booleans. Add radio button options for minimum/maximum: "Inclusive (≥)" vs "Exclusive (>)". When exclusive is selected, output `exclusiveMinimum` instead of `minimum`.

**multipleOf**: Add a "Multiple Of" numeric field. Useful for currency (multipleOf: 0.01), time intervals, or other stepped values. Validate that values divide evenly.

---

## Schema Object - Array Constraints

| Feature            | Status  | Description                  |
|--------------------|---------|------------------------------|
| `items`            | ✅       | Schema for array items       |
| `minItems`         | ✅       | Minimum array length         |
| `maxItems`         | ✅       | Maximum array length         |
| `uniqueItems`      | ✅       | All items must be unique     |
| `prefixItems`      | ❌       | Schemas for tuple positions  |
| `contains`         | ❌       | At least one item must match |
| `minContains`      | ❌       | Minimum matching items       |
| `maxContains`      | ❌       | Maximum matching items       |
| `unevaluatedItems` | ❌       | Schema for items not covered |

### Implementation Suggestions

**prefixItems**: Add a "Tuple Mode" toggle for array properties. When enabled, allow defining ordered schemas for specific positions (e.g., first item is string, second is number). Items beyond the prefix use the `items` schema.

**contains**: Add a "Contains" schema option that specifies at least one array item must match a particular schema. This is useful for validation without constraining all items.

**minContains / maxContains**: When `contains` is specified, optionally allow setting minimum and maximum counts for matching items. For example, "array must contain at least 2 items matching this schema."

**unevaluatedItems**: Advanced feature for controlling items not matched by `prefixItems`, `items`, or `contains`. Add as an advanced option with choices: allow any, disallow, or specify schema.

---

## Schema Object - Object Constraints

| Feature                 | Status  | Description                  |
|-------------------------|---------|------------------------------|
| `properties`            | ✅       | Property definitions         |
| `required`              | ⚠️      | List of required properties  |
| `additionalProperties`  | ❌       | Schema for extra properties  |
| `patternProperties`     | ❌       | Properties matching patterns |
| `propertyNames`         | ❌       | Schema for property names    |
| `minProperties`         | ❌       | Minimum property count       |
| `maxProperties`         | ❌       | Maximum property count       |
| `unevaluatedProperties` | ❌       | Schema for unevaluated props |

### Implementation Suggestions

**required**: Currently properties have individual `required` flags. Ensure these are properly aggregated into a `required` array at the class level during export. The required array should list all property names where required is true.

**additionalProperties**: Add an "Additional Properties" setting at the class level with options: "Allow Any" (true), "Disallow" (false), or "Must Match Schema" (reference to another class). This controls whether objects can have properties beyond those explicitly defined.

**patternProperties**: Add a "Pattern Properties" section allowing regex patterns mapped to schemas. For example, properties matching `^x-` could all be strings. This is useful for extension properties or dynamic keys.

**propertyNames**: Add a "Property Name Constraints" section with string validation (pattern, minLength, maxLength). This constrains what property names are allowed, not their values.

**minProperties / maxProperties**: Add numeric fields to constrain the total number of properties an object can have. Useful for dictionaries or maps with size limits.

**unevaluatedProperties**: Advanced feature for inheritance scenarios. Controls properties not matched by `properties`, `patternProperties`, or inherited schemas.

---

## Schema Object - Enumeration & Constants

| Feature  | Status  | Description            |
|----------|---------|------------------------|
| `enum`   | ✅       | List of allowed values |
| `const`  | ❌       | Single allowed value   |

### Implementation Suggestions

**const**: Add a "Constant Value" field as an alternative to enum. When a property should only ever have one specific value, use const instead of a single-item enum. This is clearer semantically and useful for discriminator values or fixed configuration.

---

## Schema Object - Composition

| Feature             | Status  | Description                         |
|---------------------|---------|-------------------------------------|
| `allOf`             | ✅       | Must match all schemas              |
| `anyOf`             | ✅       | Must match at least one             |
| `oneOf`             | ✅       | Must match exactly one              |
| `not`               | ❌       | Must not match schema               |
| `if`                | ❌       | Conditional evaluation              |
| `then`              | ❌       | Applied if `if` matches             |
| `else`              | ❌       | Applied if `if` doesn't match       |
| `dependentSchemas`  | ❌       | Schemas applied based on properties |
| `dependentRequired` | ❌       | Required properties based on others |

### Implementation Suggestions

**not**: Add a "NOT" composition option that specifies a schema the data must not match. Useful for exclusion rules like "not an empty string" or "not a specific subtype."

**if / then / else**: Add a "Conditional Schema" builder allowing rules like "if property X equals Y, then require property Z." This enables complex validation logic. Consider a visual builder showing the condition flow.

**dependentSchemas**: Add a "Dependent Schemas" section where selecting a trigger property causes additional schema constraints to apply. For example, if "paymentMethod" is present, apply credit card validation schema.

**dependentRequired**: Simpler than dependentSchemas - add a "Dependent Required" section where presence of one property requires others. For example, if "billingAddress" is present, "billingCity" and "billingZip" become required.

---

## Schema Object - Polymorphism

| Feature                      | Status  | Description                   |
|------------------------------|---------|-------------------------------|
| `discriminator.propertyName` | ❌       | Property that identifies type |
| `discriminator.mapping`      | ❌       | Value-to-schema mapping       |
| `discriminator.x-*`          | ❌       | Extension properties          |

### Implementation Suggestions

**discriminator**: When using `oneOf` or `anyOf`, add a "Discriminator" configuration section. Allow selecting which property distinguishes between types (e.g., "type" or "kind"). Optionally provide explicit mapping from property values to schema references (e.g., "dog" → "#/components/schemas/Dog").

The discriminator helps code generators and documentation tools understand polymorphic types. It's especially important for oneOf where exactly one schema must match.

---

## Schema Object - References

| Feature          | Status  | Description                  |
|------------------|---------|------------------------------|
| `$ref`           | ✅       | Reference to another schema  |
| `$dynamicRef`    | ❌       | Dynamic reference resolution |
| `$anchor`        | ❌       | Named anchor for references  |
| `$dynamicAnchor` | ❌       | Dynamic anchor definition    |

### Implementation Suggestions

**$anchor**: Allow classes to define named anchors that can be referenced with `$ref: "#anchor-name"` instead of the full path. This creates stable reference points that survive refactoring.

**$dynamicRef / $dynamicAnchor**: These enable advanced recursive schema patterns where the reference target can change based on evaluation context. This is primarily useful for deeply recursive structures like tree nodes. Consider adding as an advanced feature for power users.

---

## Schema Object - Format Values

| Feature                 | Status  | Description                |
|-------------------------|---------|----------------------------|
| `date-time`             | ✅       | RFC 3339 date-time         |
| `date`                  | ✅       | RFC 3339 full-date         |
| `time`                  | ✅       | RFC 3339 full-time         |
| `duration`              | ❌       | RFC 3339 duration          |
| `email`                 | ✅       | Email address              |
| `idn-email`             | ❌       | Internationalized email    |
| `hostname`              | ❌       | Internet hostname          |
| `idn-hostname`          | ❌       | Internationalized hostname |
| `ipv4`                  | ❌       | IPv4 address               |
| `ipv6`                  | ❌       | IPv6 address               |
| `uri`                   | ✅       | URI per RFC 3986           |
| `uri-reference`         | ❌       | URI reference              |
| `uri-template`          | ❌       | URI template (RFC 6570)    |
| `iri`                   | ❌       | Internationalized URI      |
| `iri-reference`         | ❌       | Internationalized URI ref  |
| `uuid`                  | ✅       | UUID per RFC 4122          |
| `json-pointer`          | ❌       | JSON Pointer (RFC 6901)    |
| `relative-json-pointer` | ❌       | Relative JSON Pointer      |
| `regex`                 | ❌       | Regular expression         |
| `int32`                 | ❌       | Signed 32-bit integer      |
| `int64`                 | ❌       | Signed 64-bit integer      |
| `float`                 | ❌       | Single precision float     |
| `double`                | ❌       | Double precision float     |
| `password`              | ❌       | Hint for sensitive data    |
| `byte`                  | ❌       | Base64 encoded data        |
| `binary`                | ❌       | Binary data                |

### Implementation Suggestions

Add the missing format values to the format dropdown, organized by category:

**Date/Time Formats**: Add `duration` for ISO 8601 duration strings (e.g., "P3Y6M4DT12H30M5S").

**Network Formats**: Add `hostname`, `idn-hostname`, `ipv4`, `ipv6` for network identifiers. These are common in infrastructure and networking APIs.

**URI Formats**: Add `uri-reference`, `uri-template`, `iri`, `iri-reference` for various URL/URI patterns. URI templates are especially useful for hypermedia APIs.

**Identifier Formats**: Add `json-pointer` and `relative-json-pointer` for referencing within JSON documents.

**String Formats**: Add `regex` to indicate the string is a regular expression pattern, and `idn-email` for internationalized email addresses.

**Numeric Formats**: Add `int32`, `int64`, `float`, `double` to specify numeric precision. These help code generators choose appropriate data types.

**Binary Formats**: Add `byte` (base64 encoded), `binary` (raw binary), and `password` (sensitive, should be masked in UI).

Consider organizing the format dropdown into categories for easier selection.

---

## Extension Properties

| Feature                 | Status  | Description              |
|-------------------------|---------|--------------------------|
| `x-*` custom extensions | ❌       | Vendor/custom extensions |

### Implementation Suggestions

**Extension Properties**: Add an "Extensions" section allowing arbitrary `x-` prefixed properties at both class and property levels. Provide a key-value editor where keys must start with "x-".

Common uses include:
- `x-deprecated-since`: Version when deprecated
- `x-internal`: Mark as internal-only
- `x-tags`: Additional categorization
- Tool-specific hints for code generators

Store as a JSON object and merge into the schema output.

---

## Tags (Schema-Level)

| Feature          | Status  | Description               |
|------------------|---------|---------------------------|
| Tags on schemas  | ⚠️      | Exist in UI, not exported |
| Tag descriptions | ⚠️      | Exist in UI, not exported |
| Tag externalDocs | ❌       | External docs per tag     |

### Implementation Suggestions

**Tag Export**: Currently tags exist in the UI for organizing classes but aren't included in the OpenAPI output. Collect unique tags from all classes and add to the root `tags` array with their descriptions.

**Tag externalDocs**: Enhance the tag management to include an optional external documentation URL and description per tag.

---

## Implementation Priority

### High Priority (Core Compliance)

1. **Type arrays / Nullable** - Essential for proper null handling in 3.1
2. **required array aggregation** - Ensure proper output format
3. **additionalProperties** - Common schema constraint
4. **const** - Important for discriminators and fixed values
5. **deprecated** - Standard lifecycle indicator
6. **exclusiveMinimum / exclusiveMaximum** - Complete numeric constraints

### Medium Priority (Enhanced Schemas)

7. **readOnly / writeOnly** - Important for request/response differentiation
8. **examples** - Improves documentation quality
9. **discriminator** - Essential for polymorphic APIs
10. **multipleOf** - Common numeric constraint
11. **Additional format values** - Better type hints for generators
12. **Tag export** - Utilize existing feature

### Lower Priority (Advanced Features)

13. **not composition** - Less commonly used
14. **if / then / else** - Complex conditional logic
15. **dependentSchemas / dependentRequired** - Advanced dependencies
16. **prefixItems (tuples)** - Specialized array handling
17. **contains / minContains / maxContains** - Advanced array validation
18. **patternProperties** - Dynamic property keys
19. **contentEncoding / contentMediaType** - Binary/encoded content
20. **XML support** - Only if XML APIs are needed
21. **$anchor / $dynamicRef** - Advanced referencing

### Optional (Metadata)

22. **Info object extensions** - contact, license, terms
23. **externalDocs** - External documentation links
24. **$comment** - Developer notes
25. **Extension properties (x-*)** - Vendor extensions

---

## Summary Statistics

| Category            | Implemented  | Partial  | Not Implemented  | Total   |
|---------------------|--------------|----------|------------------|---------|
| Info Object         | 3            | 0        | 8                | 11      |
| Core Types          | 6            | 0        | 2                | 8       |
| Metadata            | 3            | 0        | 6                | 9       |
| String Constraints  | 4            | 0        | 3                | 7       |
| Numeric Constraints | 2            | 0        | 3                | 5       |
| Array Constraints   | 4            | 0        | 5                | 9       |
| Object Constraints  | 1            | 1        | 6                | 8       |
| Enumeration         | 1            | 0        | 1                | 2       |
| Composition         | 3            | 0        | 6                | 9       |
| Polymorphism        | 0            | 0        | 3                | 3       |
| References          | 1            | 0        | 3                | 4       |
| Formats             | 7            | 0        | 18               | 25      |
| XML                 | 0            | 0        | 5                | 5       |
| Extensions          | 0            | 0        | 1                | 1       |
| Tags                | 0            | 2        | 1                | 3       |
| **TOTAL**           | **35**       | **3**    | **71**           | **109** |

**Current Compliance: ~35%**

---

## References

- [OpenAPI Specification 3.1.0](https://spec.openapis.org/oas/v3.1.0)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [JSON Schema Validation](https://json-schema.org/draft/2020-12/json-schema-validation.html)
- [SPDX License List](https://spdx.org/licenses/)

---

*Document prepared for Objectified UI Schema Designer*