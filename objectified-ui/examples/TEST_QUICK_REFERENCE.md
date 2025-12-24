# Property Deduplication Quick Test Reference

## Test Files Summary

| File | Schemas | Expected Properties | Key Test |
|------|---------|-------------------|----------|
| test-property-reuse-same.yaml | 4 | 9 | All reuse working |
| test-property-conflict-diff.yaml | 4 | 14 | All conflicts detected |
| test-property-mixed.yaml | 4 | 16 | Mix of both |
| test-property-edge-cases.yaml | 3 | 9 | Edge cases |

## Quick Verification

### Import Each File
```bash
yarn --cwd objectified/objectified-ui dev
# ADE → Dashboard → Import → Upload each YAML
```

### Check Import Log For:
```
CREATING_PROPERTIES: Creating X unique properties in library
```

Expected X values:
- test-property-reuse-same.yaml: **9**
- test-property-conflict-diff.yaml: **14**
- test-property-mixed.yaml: **16**
- test-property-edge-cases.yaml: **9**

### Quick Database Check
```sql
-- Count properties created
SELECT COUNT(*) FROM odb.properties 
WHERE project_id = '<project-id>';

-- See reuse pattern
SELECT name, COUNT(*) as uses 
FROM odb.properties p
JOIN odb.class_properties cp ON cp.property_id = p.id
WHERE p.project_id = '<project-id>'
GROUP BY name
ORDER BY uses DESC;
```

## Expected Results at a Glance

### Test 1: Reuse Same
```
✅ 9 properties total
✅ 4x: id, status, createdAt
✅ 3x: email
✅ 2x: name
✅ 1x: description, price, total, amount
```

### Test 2: Conflict Diff
```
✅ 14 properties total
✅ ALL 1x usage (no reuse)
✅ 3 variants of id
✅ 3 variants of name
✅ 4 variants of status
✅ 4 variants of metadata
```

### Test 3: Mixed
```
✅ 16 properties total
✅ 3x: id(uuid), email, tags(array)
✅ 2x: firstName(constrained), lastName(constrained)
✅ 1x: all others (11 properties)
```

### Test 4: Edge Cases
```
✅ 9 properties total
✅ 3x: content (SAME despite description diff)
✅ 2x: title (DIFFERENT constraints)
✅ 2x: author (DIFFERENT nested structure)
✅ 3x: comments (all DIFFERENT)
```

## Pass/Fail Criteria

| Test | Pass If | Fail If |
|------|---------|---------|
| Reuse Same | 9 properties, high reuse counts | 20+ properties OR all count=1 |
| Conflict Diff | 14 properties, all count=1 | <14 properties OR any reuse |
| Mixed | 16 properties, 5 reused | Wrong count OR wrong reuse pattern |
| Edge Cases | 9 properties, content reused 3x | content not reused OR wrong count |

## Common Issues

### Issue: Too Many Properties Created
**Symptom:** 20+ properties instead of 9-16
**Cause:** Description included in signature
**Check:** Look for duplicate properties with same definition but different descriptions

### Issue: Too Few Properties Created
**Symptom:** <9 properties when conflicts expected
**Cause:** Conflicts not detected properly
**Check:** Look for properties that should be separate but are being reused

### Issue: Wrong Reuse Pattern
**Symptom:** Correct count but wrong usage numbers
**Cause:** Signature matching edge case
**Check:** Compare property definitions in database vs expected

## Debug Log Keywords

Search Import Log for:
- `CREATING_PROPERTIES:` - Shows total count
- `DEBUG_PROPERTY: Creating property:` - Shows each creation with usage names
- `(used as: x, y, z)` - Shows which schema names use this property

## Files Location

```
/Users/kenji/Development/objectified/objectified-ui/examples/
├── test-property-reuse-same.yaml      # Test pure reuse
├── test-property-conflict-diff.yaml   # Test pure conflicts
├── test-property-mixed.yaml           # Test realistic mix
└── test-property-edge-cases.yaml      # Test edge cases
```

## Test Execution Time

⏱️ ~2-3 minutes per file to import and verify
⏱️ ~10 minutes total for full suite
⏱️ Add 5 minutes for database verification queries

## Status Check

After import, verify in Studio:
1. ✅ All classes appear on canvas
2. ✅ Properties visible in class nodes
3. ✅ Descriptions present in Code view
4. ✅ Can export back to OpenAPI successfully

