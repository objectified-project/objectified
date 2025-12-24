# Advanced Composition Examples - Testing Guide

## Overview
Created four advanced OpenAPI 3.1 specification examples specifically for testing the import functionality's handling of schema composition patterns (allOf, oneOf, anyOf).

## Date Created
December 23, 2024

## Purpose
These examples are designed to:
1. **Test composition detection** - Verify the analyzer correctly identifies allOf/oneOf/anyOf
2. **Test import handling** - Ensure schemas with composition import correctly
3. **Validate UI display** - Check that composition badges and metrics appear
4. **Verify Monaco Editor** - Test syntax highlighting with complex schemas
5. **Demonstrate patterns** - Show real-world composition use cases

## Files Created

### 1. `21-advanced-allof-inheritance.yaml` (Inheritance Pattern)

**Focus:** allOf for inheritance and extension

**Key Schemas:**
- `BaseEntity` - Common base with id, timestamps
- `AuditableEntity` - Extends BaseEntity with audit fields
- `Animal` → `Pet` → `Dog`/`Cat` - Multi-level inheritance
- `Vaccination` - Nested composition
- `User` with nested `Address` and `EmergencyContact`
- `MedicalDocument` - Complex allOf with multiple schemas

**Metrics:**
- **Total Schemas:** 12
- **allOf Usage:** 8+ schemas use allOf
- **Inheritance Depth:** Up to 4 levels
- **Real-World Domain:** Veterinary clinic management

**What It Tests:**
- ✅ Multi-level inheritance detection
- ✅ Base class extraction
- ✅ Property merging from multiple schemas
- ✅ Nested composition (allOf within allOf)
- ✅ Reference resolution in inheritance chains

**Expected Analysis Results:**
```
Schema Composition: [allOf: 8]
Schemas: 12
Properties: 80+
References: 15+
```

---

### 2. `22-advanced-oneof-polymorphism.yaml` (Polymorphism Pattern)

**Focus:** oneOf for exclusive choice and variants

**Key Schemas:**
- `Payment` with oneOf:
  - `CreditCardPayment`
  - `BankTransferPayment`
  - `PayPalPayment`
  - `CryptocurrencyPayment`
- `Notification` with oneOf:
  - `EmailNotification`
  - `SMSNotification`
  - `PushNotification`
  - `WebhookNotification`
- `Document` with oneOf:
  - `TextDocument`
  - `ImageDocument`
  - `VideoDocument`
  - `AudioDocument`

**Metrics:**
- **Total Schemas:** 16
- **oneOf Usage:** 4+ schemas use oneOf (each with 4 variants)
- **Discriminators:** 3 discriminated unions
- **Real-World Domain:** Payment processing and notifications

**What It Tests:**
- ✅ Polymorphism detection
- ✅ Discriminator field recognition
- ✅ Variant type handling
- ✅ Exclusive choice validation
- ✅ Const value discrimination

**Expected Analysis Results:**
```
Schema Composition: [oneOf: 4]
Schemas: 16
Properties: 90+
References: 12+
```

---

### 3. `23-advanced-anyof-flexible.yaml` (Flexible Matching Pattern)

**Focus:** anyOf for optional combinations and multi-format support

**Key Schemas:**
- `ContactInfo` with anyOf:
  - `EmailContact`
  - `PhoneContact`
  - `AddressContact`
  - `SocialMediaContact`
- `SearchCriteria` with anyOf required fields
- `Product` with anyOf:
  - `FixedPricing`
  - `TieredPricing`
  - `SubscriptionPricing`
  - `AuctionPricing`
- `MediaContent` with anyOf formats
- `UserProfile` with anyOf verifications

**Metrics:**
- **Total Schemas:** 24
- **anyOf Usage:** 5+ schemas use anyOf
- **Flexible Patterns:** Multiple valid combinations
- **Real-World Domain:** Contact management and e-commerce

**What It Tests:**
- ✅ Flexible validation detection
- ✅ Optional combination handling
- ✅ Multi-format support
- ✅ At-least-one-required validation
- ✅ Multiple simultaneous matches

**Expected Analysis Results:**
```
Schema Composition: [anyOf: 5]
Schemas: 24
Properties: 120+
References: 20+
```

---

### 4. `24-advanced-combined-composition.yaml` (All Patterns Combined)

**Focus:** All three patterns working together in a realistic system

**Key Schemas:**
- **allOf** for inheritance:
  - `Product` extends `BaseEntity`
  - `ElectronicsProduct`/`ClothingProduct` extend `Product`
  - `Customer` extends `BaseEntity`
  - `Order` extends `BaseEntity`

- **oneOf** for exclusive choices:
  - Payment methods (CreditCard, PayPal, BankTransfer)
  - Shipping methods (Standard, Express, Overnight)
  - Loyalty tiers (Bronze, Silver, Gold, Platinum)

- **anyOf** for flexible options:
  - Availability states (InStock, PreOrder, BackOrder)
  - Contact preferences (Email, SMS, Push)

**Metrics:**
- **Total Schemas:** 30+
- **allOf Usage:** 5+
- **oneOf Usage:** 8+
- **anyOf Usage:** 2+
- **Real-World Domain:** Complete e-commerce system

**What It Tests:**
- ✅ All three patterns in one spec
- ✅ Complex nested composition
- ✅ Multiple pattern types in single schema
- ✅ Real-world complexity
- ✅ Complete system modeling

**Expected Analysis Results:**
```
Schema Composition: [allOf: 5] [oneOf: 8] [anyOf: 2]
Schemas: 30+
Properties: 150+
References: 30+
```

---

## Testing Workflow

### Step 1: Import Analysis
1. Open Objectified UI
2. Click "Import" button
3. Select one of the advanced examples (21-24)
4. Upload the file
5. Click "Analyze →"

### Step 2: Verify Detection
**Check Analysis Screen:**
- ✅ "Schema Composition" row appears
- ✅ Correct badge counts displayed
- ✅ Blue badge (allOf) for inheritance examples
- ✅ Purple badge (oneOf) for polymorphism examples
- ✅ Indigo badge (anyOf) for flexible examples
- ✅ All three badges for combined example

**Example Expected Display:**
```
┌─── Specification Analysis ────────────┐
│ [12 Schemas] [87 Props] [24 Refs]    │
│                                       │
│ Schema Composition:                   │
│ [allOf: 8] [oneOf: 0] [anyOf: 0]    │
└───────────────────────────────────────┘
```

### Step 3: Preview Schemas
1. Click "Next →" to reach Preview step
2. Notice the 1:3 layout (list vs preview)
3. Select a schema that uses composition
4. Verify composition shown in Summary view

**For allOf schemas:**
- Should show: "Composition: allOf: X schema(s)"

**For oneOf schemas:**
- Should show: "Composition: oneOf: X schema(s)"

**For anyOf schemas:**
- Should show: "Composition: anyOf: X schema(s)"

### Step 4: Test Monaco Editor
1. Click JSON button - verify syntax highlighting
2. Check for composition keywords highlighted
3. Click YAML button - verify YAML rendering
4. Check line numbers and code folding work

**Look for:**
- ✅ `allOf:` highlighted in different color
- ✅ `oneOf:` highlighted in different color
- ✅ `anyOf:` highlighted in different color
- ✅ `$ref:` highlighted
- ✅ Line numbers visible
- ✅ Code folding icons present

### Step 5: Import Execution
1. Verify project name populated
2. Check version from specification
3. Ensure schemas selected
4. Click "Import →"
5. Monitor console for import options logged

**Expected Console Output:**
```javascript
Starting import with options: {
  projectName: "Advanced Composition Example",
  versionSource: "spec",
  targetVersion: "1.0.0",
  selectedSchemas: ["BaseEntity", "Animal", "Pet", ...],
  // ...
}
```

---

## Validation Checklist

### For Each Example:

#### Example 21 (allOf):
- [ ] Analysis shows "allOf: 8" badge
- [ ] BaseEntity schema imports
- [ ] AuditableEntity shows allOf in preview
- [ ] Dog/Cat show inheritance chain
- [ ] Multi-level inheritance preserved
- [ ] All 12 schemas import successfully

#### Example 22 (oneOf):
- [ ] Analysis shows "oneOf: 4" badge
- [ ] Payment schema shows oneOf variants
- [ ] Discriminator fields detected
- [ ] CreditCardPayment imports with const
- [ ] Notification variants import
- [ ] All 16 schemas import successfully

#### Example 23 (anyOf):
- [ ] Analysis shows "anyOf: 5" badge
- [ ] ContactInfo shows flexible validation
- [ ] SearchCriteria shows anyOf required
- [ ] Product pricing variants import
- [ ] MediaContent formats detected
- [ ] All 24 schemas import successfully

#### Example 24 (Combined):
- [ ] Analysis shows all three badges
- [ ] allOf, oneOf, anyOf all detected
- [ ] Product hierarchy imports
- [ ] Order with oneOf payment/shipping
- [ ] Customer with mixed composition
- [ ] All 30+ schemas import successfully

---

## Known Edge Cases

### Edge Case 1: Deeply Nested Composition
**Example:** Dog extends Pet extends Animal extends BaseEntity (4 levels)
**Expected:** All levels detected and imported
**Test:** Check Dog schema includes all inherited properties

### Edge Case 2: Multiple Composition Types
**Example:** Customer uses allOf (base), anyOf (preferences), oneOf (tier)
**Expected:** All three patterns recognized simultaneously
**Test:** Verify all composition types shown in analysis

### Edge Case 3: Circular References
**Example:** Pet → Vaccination → AuditableEntity → BaseEntity
**Expected:** Circular reference detection triggers
**Test:** Check "Circular References" section for warnings

### Edge Case 4: Discriminator Fields
**Example:** Payment with discriminator propertyName
**Expected:** Const values in variants recognized
**Test:** Verify discriminator used for type identification

---

## Troubleshooting

### Issue: Composition badges not showing
**Check:**
- File uploaded successfully?
- Analysis completed without errors?
- Schema actually uses allOf/oneOf/anyOf?

**Fix:**
- Re-upload file
- Check console for errors
- Verify YAML/JSON syntax

### Issue: Wrong composition count
**Check:**
- Are nested compositions counted?
- Are empty allOf/oneOf/anyOf arrays ignored?

**Expected:**
- Only schemas with non-empty composition arrays counted
- Nested compositions count each schema once

### Issue: Monaco Editor not highlighting
**Check:**
- Monaco loaded successfully?
- Dark theme applied?
- Language set to JSON/YAML?

**Fix:**
- Refresh page
- Check browser console
- Verify Monaco Editor installation

---

## Success Criteria

### Minimum Requirements:
✅ All 4 examples upload without errors
✅ Composition badges appear in analysis
✅ Correct counts for each composition type
✅ Schemas preview correctly
✅ Monaco Editor syntax highlights composition
✅ All schemas can be imported

### Optimal Results:
✅ All 4 examples import in <5 seconds each
✅ All composition patterns detected correctly
✅ All inheritance chains preserved
✅ All polymorphic variants imported
✅ All flexible validations maintained
✅ No warnings or errors during import

---

## Documentation References

- [ENHANCEMENT_COMPOSITION_DETECTION.md](./ENHANCEMENT_COMPOSITION_DETECTION.md) - Composition detection implementation
- [ENHANCEMENT_SCHEMA_VIEW_MODES.md](./ENHANCEMENT_SCHEMA_VIEW_MODES.md) - Monaco Editor integration
- [IMPORT_STEP3_IMPLEMENTATION.md](./IMPORT_STEP3_IMPLEMENTATION.md) - Preview step implementation
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/latest.html#composition-and-inheritance-polymorphism)

---

## Future Enhancements

Potential improvements for composition handling:
- [ ] Visualize inheritance hierarchies as tree diagrams
- [ ] Show discriminator mappings in UI
- [ ] Detect and warn about composition conflicts
- [ ] Suggest composition patterns during editing
- [ ] Auto-generate composition from existing schemas
- [ ] Flatten composition for code generation
- [ ] Validate discriminator consistency

---

**Created:** December 23, 2024
**Purpose:** Import functionality testing for composition patterns
**Status:** Ready for testing

