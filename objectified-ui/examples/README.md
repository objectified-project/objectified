# OpenAPI 3.1 Example Specifications

This directory contains comprehensive OpenAPI 3.1 specification examples demonstrating all the advanced features supported by Objectified. These examples are designed for UI/UX testing and import validation.

---

## Example Files Overview

### 1. Numeric Constraints (`01-numeric-constraints.yaml`)
Demonstrates OpenAPI 3.1 numeric constraints:
- **Inclusive ranges**: `minimum`, `maximum` (≥, ≤)
- **Exclusive ranges**: `exclusiveMinimum`, `exclusiveMaximum` (>, <)
- **multipleOf**: Value must be a multiple of specified number
- **Use case**: Temperature measurements, ratings, quantities

### 2. Array Contains (`02-array-contains.yaml`)
Demonstrates array validation constraints:
- **contains**: Schema that array items must contain
- **minContains**: Minimum items matching contains schema
- **maxContains**: Maximum items matching contains schema
- **Use case**: Product tags, categorization

### 3. Object Properties (`03-object-properties.yaml`)
Demonstrates object property constraints:
- **minProperties**: Minimum number of properties
- **maxProperties**: Maximum number of properties
- **patternProperties**: Properties matching regex patterns
- **Use case**: Configuration objects, settings

### 4. Constant and Not (`04-constant-not.yaml`)
Demonstrates constant and negation constraints:
- **const**: Property must have exact constant value
- **not**: Value must NOT match specified schema
- **Use case**: API versions, status validation

### 5. Dependent Schemas (`05-dependent-schemas.yaml`)
Demonstrates conditional validation:
- **dependentSchemas**: Apply schemas when trigger property present
- **if/then/else**: Conditional schema application
- **Use case**: Payment methods, credit card validation

### 6. Dependent Required (`06-dependent-required.yaml`)
Demonstrates dependent field requirements:
- **dependentRequired**: Properties required when trigger present
- **Use case**: Billing addresses, shipping information

### 7. Nullable Types (`07-nullable-types.yaml`)
Demonstrates OpenAPI 3.1 nullable types:
- **Type arrays**: `type: [string, "null"]` format
- Replaces deprecated `nullable: true` from OpenAPI 3.0
- **Visual indicator**: Shows "?" in UI
- **Use case**: Optional user profile fields

### 8. Multiple Examples (`08-multiple-examples.yaml`)
Demonstrates multiple examples per property:
- **examples**: Array of example values
- **Auto-generation**: Schema-based example generation
- **Use case**: Product catalog, varied data samples

### 9. Unevaluated Properties (`09-unevaluated-properties.yaml`)
Demonstrates advanced inheritance control:
- **unevaluatedProperties**: Control for properties not matched by:
  - `properties`
  - `patternProperties`
  - Inherited schemas (allOf, oneOf, anyOf)
- **Use case**: Strict inheritance, flexible extensions

### 10. If-Then-Else (`10-if-then-else.yaml`)
Demonstrates conditional schema composition:
- **if/then/else**: Nested conditional validation
- **Complex conditions**: Multiple condition branches
- **Use case**: Vehicle types, conditional requirements

### 11. Unevaluated Items (`11-unevaluated-items.yaml`)
Demonstrates array item validation:
- **unevaluatedItems**: Control items beyond prefixItems
- **Strict tuples**: No additional items allowed
- **Flexible tuples**: Typed additional items
- **Use case**: Coordinates, structured arrays

### 12. Additional Properties with References (`12-additional-properties-ref.yaml`)
Demonstrates schema references in additionalProperties:
- **additionalProperties**: Schema references via `$ref`
- **Typed dictionaries**: All properties match schema
- **Use case**: Metadata objects, dynamic properties

### 13. Property Name Constraints (`13-property-name-constraints.yaml`)
Demonstrates property name validation:
- **propertyNames**: Schema for property names
- **format**: Email, UUID, etc.
- **pattern**: Regex validation
- **minLength/maxLength**: Name length constraints
- **Use case**: Email-keyed objects, UUID keys

### 14. Custom Extensions (`14-custom-extensions.yaml`)
Demonstrates custom x- tags:
- **Schema-level**: `x-version`, `x-team-owner`
- **Property-level**: `x-database-column`, `x-indexed`
- **Metadata**: Custom business logic annotations
- **Use case**: Database mapping, internal metadata

### 15. External Documentation (`15-external-docs.yaml`)
Demonstrates external documentation links:
- **Schema-level**: Documentation portals
- **Property-level**: Field-specific guides
- **externalDocs**: URL and description
- **Use case**: API documentation, reference materials

### 16. Discriminator Mapping (`16-discriminator-mapping.yaml`)
Demonstrates polymorphism with discriminators:
- **discriminator**: Type discrimination
- **propertyName**: Discriminator field
- **mapping**: Type to schema mappings
- **x- extensions**: Custom discriminator metadata
- **Use case**: Pet types, vehicle inheritance

### 17. Deprecated Features (`17-deprecated-features.yaml`)
Demonstrates deprecation marking:
- **Schema deprecation**: Entire schemas marked deprecated
- **Property deprecation**: Individual fields
- **x-deprecated-since**: Custom deprecation metadata
- **x-migration-guide**: Migration documentation
- **Use case**: Legacy API versions, field migration

### 18. Prefix Items (Tuples) (`18-prefix-items-tuples.yaml`)
Demonstrates ordered array schemas:
- **prefixItems**: Define schemas for specific positions
- **Tuple mode**: `[string, number, boolean]`
- **Position-specific types**: Each index has its schema
- **items**: Control additional items beyond prefix
- **Use cases**:
  - Coordinates (2D, 3D)
  - CSV rows
  - Function arguments
  - Database rows

### 19. Enumeration Sorting (`19-enumeration-sorting.yaml`)
Demonstrates enumeration orderings:
- **Ascending order**: Priority levels, sizes
- **Descending order**: Reverse alphabetical
- **Logical order**: Status workflows, months
- **Numeric enums**: Sorted numbers
- **Use case**: Dropdown options, status values

### 20. Comprehensive Features (`20-comprehensive-features.yaml`)
Demonstrates multiple features in one schema:
- Combines 15+ different constraint types
- Complex nested validation
- Multiple conditional schemas
- Real-world order processing example
- **Use case**: Complete integration testing

---

## Usage

### Importing Examples
1. Navigate to Objectified Studio
2. Click "Import" or "Open"
3. Select any example file
4. Schema will be loaded into canvas

### Testing Features
Each example is designed to test specific UI/UX features:
- Property constraints visualization
- Nullable type indicators ("?")
- Multiple examples display
- Deprecation warnings
- External documentation links
- Custom x- tag display

### Validation Testing
Use these examples to validate:
- Import functionality
- Schema rendering
- Constraint enforcement
- Export accuracy (OpenAPI, JSON Schema, Arazzo)
- Code generation

---

## OpenAPI 3.1 Feature Coverage

| Feature | Example File(s) | Status |
|---------|----------------|--------|
| Numeric constraints (inclusive) | 01, 20 | ✅ |
| Numeric constraints (exclusive) | 01, 20 | ✅ |
| multipleOf | 01, 20 | ✅ |
| Array contains | 02, 20 | ✅ |
| minContains/maxContains | 02, 20 | ✅ |
| minProperties/maxProperties | 03, 20 | ✅ |
| const | 04, 20 | ✅ |
| not | 04, 20 | ✅ |
| patternProperties | 03, 20 | ✅ |
| dependentSchemas | 05, 20 | ✅ |
| dependentRequired | 06, 20 | ✅ |
| Nullable types (type array) | 07, 20 | ✅ |
| Multiple examples | 08, 20 | ✅ |
| unevaluatedProperties | 09, 20 | ✅ |
| if/then/else | 10, 20 | ✅ |
| unevaluatedItems | 11, 20 | ✅ |
| additionalProperties with $ref | 12, 20 | ✅ |
| propertyNames constraints | 13, 20 | ✅ |
| Custom x- extensions | 14, 20 | ✅ |
| External documentation | 15, 20 | ✅ |
| Discriminator mapping | 16 | ✅ |
| Deprecated schemas | 17 | ✅ |
| Deprecated properties | 17, 20 | ✅ |
| prefixItems (tuples) | 18, 20 | ✅ |
| Enumeration ordering | 19, 20 | ✅ |

---

## Test Scenarios

### Basic Import Test
```bash
# Import each example file
for file in examples/*.yaml; do
  echo "Testing: $file"
  # Import via UI or API
done
```

### Feature Validation Test
1. **Nullable Types**: Check for "?" indicator in UI
2. **Multiple Examples**: Verify example carousel/list
3. **Deprecation**: Verify warning badges/strikethrough
4. **External Docs**: Check for documentation links
5. **Custom x-**: Verify custom tags display

### Export Validation Test
1. Import example
2. Export as OpenAPI
3. Compare with original
4. Export as JSON Schema
5. Validate against JSON Schema Draft 2020-12

### Canvas Rendering Test
1. Import comprehensive example (20)
2. Verify all classes render
3. Check property display
4. Validate relationships
5. Test layout algorithms

---

## Example Complexity Matrix

| Example | Lines | Schemas | Features | Complexity |
|---------|-------|---------|----------|------------|
| 01 | 30 | 1 | 3 | Simple |
| 02 | 40 | 1 | 3 | Simple |
| 03 | 45 | 1 | 3 | Simple |
| 04 | 50 | 1 | 2 | Simple |
| 05 | 75 | 1 | 2 | Medium |
| 06 | 50 | 1 | 1 | Simple |
| 07 | 55 | 1 | 1 | Simple |
| 08 | 60 | 1 | 1 | Simple |
| 09 | 65 | 3 | 2 | Medium |
| 10 | 70 | 1 | 1 | Medium |
| 11 | 60 | 3 | 1 | Medium |
| 12 | 70 | 3 | 1 | Medium |
| 13 | 75 | 3 | 4 | Medium |
| 14 | 65 | 1 | 10+ | Medium |
| 15 | 80 | 1 | 1 | Simple |
| 16 | 100 | 4 | 3 | Complex |
| 17 | 90 | 2 | 2 | Simple |
| 18 | 160 | 5 | 1 | Complex |
| 19 | 75 | 1 | 7 | Simple |
| 20 | 250+ | 1 | 15+ | Very Complex |

---

## Best Practices

### When Creating Examples
1. **Keep it simple**: One or two features per example
2. **Use realistic names**: "Product", "Order", "User"
3. **Include multiple examples**: Show variety in data
4. **Add descriptions**: Explain what's being demonstrated
5. **Test edge cases**: Min/max values, nulls, empty arrays

### When Using Examples
1. **Start simple**: Test basic features first
2. **Validate thoroughly**: Check all constraints work
3. **Test export**: Ensure round-trip accuracy
4. **Check UI**: Verify proper rendering
5. **Document issues**: Report any problems found

---

## Contributing

To add new examples:
1. Create new `.yaml` file with sequential number
2. Focus on specific feature(s)
3. Include comprehensive examples
4. Add documentation to this README
5. Test import/export thoroughly

---

## Related Documentation

- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [Objectified Documentation](https://docs.example.com)
- [YouTube Tutorials](https://www.youtube.com/@objectifieddev)

---

**Last Updated**: December 21, 2025

**Total Examples**: 20 files  
**Total Features Covered**: 20+ OpenAPI 3.1 features  
**Use Cases**: Testing, validation, learning, documentation

