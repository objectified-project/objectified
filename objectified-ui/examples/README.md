# OpenAPI Import Test Examples

This directory contains comprehensive test examples for validating the OpenAPI importer's property deduplication logic.

## Overview

The importer must correctly handle:
1. **Property Reuse** - Same property name + same definition → One library property, reused across classes
2. **Property Conflicts** - Same property name + different definition → Separate library properties
3. **Mixed Scenarios** - Realistic combination of reuse and conflicts
4. **Edge Cases** - Subtle differences that should or shouldn't trigger separate properties

## Test Files

### 1. 📄 test-property-reuse-same.yaml
**Test Focus:** Property reuse with identical definitions

**Scenario:** 4 schemas (User, Product, Order, Invoice) share common properties like `id`, `status`, `email` with identical types and constraints.

**Expected Outcome:**
- ✅ 9 properties in library (not 20+)
- ✅ Properties reused 2-4 times each
- ✅ Import log shows: `Creating property: id (used as: id)`

**What This Tests:**
- Basic deduplication working
- Same signature = same property
- Proper library creation

---

### 2. 📄 test-property-conflict-diff.yaml
**Test Focus:** Property conflicts with different definitions

**Scenario:** 4 schemas (Customer, Transaction, Shipment, Document) use properties with the same name but completely different definitions.

Examples:
- `id`: UUID vs int64 vs patterned string
- `status`: Different enum values
- `metadata`: Object vs string vs array

**Expected Outcome:**
- ✅ 14 properties in library
- ✅ All usage counts = 1 (no reuse)
- ✅ Each variant creates separate library entry

**What This Tests:**
- Conflict detection working
- Different signature = separate property
- Type/constraint differences handled

---

### 3. 📄 test-property-mixed.yaml
**Test Focus:** Realistic mix of reuse and conflicts

**Scenario:** 4 schemas (Person, Employee, Contract, Vendor) with some shared properties (uuid id, email) and some conflicts (different id types, age constraints).

**Expected Outcome:**
- ✅ 16 properties in library
- ✅ 5 properties reused (2-3 times each)
- ✅ 11 properties unique (1 time each)

**What This Tests:**
- Combined scenario handling
- Correct identification of reuse vs conflict
- Most realistic use case

---

### 4. 📄 test-property-edge-cases.yaml
**Test Focus:** Subtle edge cases

**Scenario:** 3 schemas (Article, NewsPost, VideoPost) testing:
- Description differences (should NOT create separate properties)
- Constraint differences (should create separate properties)
- Nested structure differences (should create separate properties)

**Expected Outcome:**
- ✅ 9 properties in library
- ✅ `content` reused 3x (despite description differences)
- ✅ `title` variants separate (different maxLength)
- ✅ Nested `author` variants separate

**What This Tests:**
- Description metadata vs schema definition
- Constraint sensitivity
- Nested object handling

---

## Quick Start

### Run All Tests

```bash
# 1. Start the application
yarn --cwd objectified/objectified-ui dev

# 2. Navigate to: ADE → Dashboard → Projects → Import

# 3. Import each test file:
#    - 28-test-property-reuse-same.yaml
#    - 25-test-property-conflict-diff.yaml
#    - 27-test-property-mixed.yaml
#    - 26-test-property-edge-cases.yaml

# 4. For each import:
#    a. Upload YAML file
#    b. Review analysis
#    c. Select all schemas in preview
#    d. Click "Import →"
#    e. Monitor Live Progress and Import Log
```

### Expected Import Log Output

**For test-property-reuse-same.yaml:**
```
CREATING_PROPERTIES: Creating 9 unique properties in library
DEBUG_PROPERTY: Creating property: id (used as: id)
DEBUG_PROPERTY: Creating property: name (used as: name)
DEBUG_PROPERTY: Creating property: email (used as: email)
...
CLASS_CREATED: Imported class: User
CLASS_CREATED: Imported class: Product
CLASS_CREATED: Imported class: Order
CLASS_CREATED: Imported class: Invoice
```

**For test-property-conflict-diff.yaml:**
```
CREATING_PROPERTIES: Creating 14 unique properties in library
DEBUG_PROPERTY: Creating property: id (used as: id)
DEBUG_PROPERTY: Creating property: id (used as: id)
DEBUG_PROPERTY: Creating property: id (used as: id)
...
(14 separate property creations)
```

---

## Verification

### Method 1: Check Import Log

Look for the `CREATING_PROPERTIES` event:
```
✅ test-property-reuse-same.yaml → "Creating 9 unique properties"
✅ test-property-conflict-diff.yaml → "Creating 14 unique properties"
✅ test-property-mixed.yaml → "Creating 16 unique properties"
✅ test-property-edge-cases.yaml → "Creating 9 unique properties"
```

### Method 2: Database Query

```sql
-- Count properties in library
SELECT COUNT(*) FROM odb.properties 
WHERE project_id = '<imported-project-id>';

-- See reuse pattern
SELECT 
  p.name,
  p.description,
  COUNT(cp.id) as usage_count
FROM odb.properties p
LEFT JOIN odb.class_properties cp ON cp.property_id = p.id
WHERE p.project_id = '<imported-project-id>'
GROUP BY p.id, p.name, p.description
ORDER BY usage_count DESC, p.name;
```

### Method 3: Studio Code View

1. Open imported project in Studio
2. Switch to "Code" view
3. Select "OpenAPI Specification"
4. Verify properties have descriptions
5. Check that identical properties appear the same across schemas

---

## Test Results Reference

| Test File | Expected Properties | Key Validation |
|-----------|-------------------|----------------|
| reuse-same | 9 | High reuse counts (2-4x) |
| conflict-diff | 14 | All count=1, no reuse |
| mixed | 16 | 5 reused, 11 unique |
| edge-cases | 9 | content reused 3x |

---

## Common Issues & Solutions

### ❌ Issue: Too many properties created
**Symptom:** 20+ properties instead of 9
**Cause:** Descriptions included in signature matching
**Solution:** Verify signature generation excludes description field

### ❌ Issue: Properties not reused when they should be
**Symptom:** All usage counts = 1
**Cause:** Signature matching too strict or inconsistent
**Solution:** Check JSON.stringify produces consistent output

### ❌ Issue: Conflicts not detected
**Symptom:** Different definitions being reused
**Cause:** Signature matching too loose
**Solution:** Ensure all relevant fields included in signature

---

## Additional Resources

- **Comprehensive Test Guide:** `../docs/PROPERTY_DEDUPLICATION_TEST_SUITE.md`
- **Quick Reference:** `TEST_QUICK_REFERENCE.md`
- **Implementation Docs:** `../docs/PROPERTY_LIBRARY_NAMING.md`

---

## Test Status

| Date | Test | Result | Notes |
|------|------|--------|-------|
| 2024-12-24 | Initial Creation | ⏳ Pending | Test files created |
| | reuse-same | ⏳ | Awaiting execution |
| | conflict-diff | ⏳ | Awaiting execution |
| | mixed | ⏳ | Awaiting execution |
| | edge-cases | ⏳ | Awaiting execution |

---

## Contributing

When adding new test cases:

1. **Name clearly:** `test-property-<scenario>.yaml`
2. **Document expected behavior** in file comments
3. **Add to this README** with expected counts
4. **Update test guide** with verification steps
5. **Run and document results**

---

## Success Criteria

All tests pass when:
- ✅ Property counts match expected values
- ✅ Reuse patterns match expected patterns
- ✅ No import errors in logs
- ✅ Descriptions preserved
- ✅ Round-trip (import → export → import) maintains integrity
- ✅ Studio Code view generates correct OpenAPI spec

---

Generated: December 24, 2024

