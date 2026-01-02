#!/bin/bash

# Path Tags Wiring Verification Script
# Checks that all components are properly connected

echo "============================================"
echo "PATH TAGS WIRING VERIFICATION"
echo "============================================"
echo ""

ERRORS=0
WARNINGS=0

# Check helper-paths.ts functions
echo "1. Checking helper-paths.ts..."
if grep -q "export async function getTagsForPath" objectified-ui/lib/db/helper-paths.ts; then
    echo "   ✓ getTagsForPath function exists"
else
    echo "   ✗ getTagsForPath function missing"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "export async function setPathTags" objectified-ui/lib/db/helper-paths.ts; then
    echo "   ✓ setPathTags function exists"
else
    echo "   ✗ setPathTags function missing"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "export async function assignTagToPath" objectified-ui/lib/db/helper-paths.ts; then
    echo "   ✓ assignTagToPath function exists"
else
    echo "   ✗ assignTagToPath function missing"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "export async function removeTagFromPath" objectified-ui/lib/db/helper-paths.ts; then
    echo "   ✓ removeTagFromPath function exists"
else
    echo "   ✗ removeTagFromPath function missing"
    ERRORS=$((ERRORS + 1))
fi

# Check actions.ts exports
echo ""
echo "2. Checking actions.ts..."
if grep -q "export async function getTagsForPathAction" objectified-ui/src/app/ade/studio/paths/actions.ts; then
    echo "   ✓ getTagsForPathAction exported"
else
    echo "   ✗ getTagsForPathAction not exported"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "export async function setPathTagsAction" objectified-ui/src/app/ade/studio/paths/actions.ts; then
    echo "   ✓ setPathTagsAction exported"
else
    echo "   ✗ setPathTagsAction not exported"
    ERRORS=$((ERRORS + 1))
fi

# Check PropertiesPanel imports
echo ""
echo "3. Checking PropertiesPanel.tsx..."
if grep -q "setPathTagsAction" objectified-ui/src/app/ade/studio/paths/components/PropertiesPanel.tsx | head -1; then
    echo "   ✓ setPathTagsAction imported"
else
    echo "   ✗ setPathTagsAction not imported"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "await setPathTagsAction" objectified-ui/src/app/ade/studio/paths/components/PropertiesPanel.tsx; then
    echo "   ✓ setPathTagsAction called in handleSave"
else
    echo "   ✗ setPathTagsAction not called"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "selectedTags" objectified-ui/src/app/ade/studio/paths/components/PropertiesPanel.tsx | head -1; then
    echo "   ✓ selectedTags state exists"
else
    echo "   ✗ selectedTags state missing"
    ERRORS=$((ERRORS + 1))
fi

# Check PathsCanvas loading
echo ""
echo "4. Checking PathsCanvas.tsx..."
if grep -q "getTagsForPathAction" objectified-ui/src/app/ade/studio/paths/components/PathsCanvas.tsx | head -1; then
    echo "   ✓ getTagsForPathAction imported"
else
    echo "   ✗ getTagsForPathAction not imported"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "await getTagsForPathAction" objectified-ui/src/app/ade/studio/paths/components/PathsCanvas.tsx; then
    echo "   ✓ getTagsForPathAction called during load"
else
    echo "   ✗ getTagsForPathAction not called"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "pathTagIds" objectified-ui/src/app/ade/studio/paths/components/PathsCanvas.tsx; then
    echo "   ✓ pathTagIds variable exists"
else
    echo "   ✗ pathTagIds variable missing"
    ERRORS=$((ERRORS + 1))
fi

# Check PathNode interface
echo ""
echo "5. Checking PathNode.tsx..."
if grep -q "tags.*:" objectified-ui/src/app/components/ade/paths/PathNode.tsx; then
    echo "   ✓ tags field in PathNodeData interface"
else
    echo "   ⚠ tags field might be missing from PathNodeData"
    WARNINGS=$((WARNINGS + 1))
fi

# Check database migration
echo ""
echo "6. Checking database migration..."
if [ -f "objectified-db/scripts/20260101-120000.sql" ]; then
    echo "   ✓ Migration file exists"
    if grep -q "CREATE TABLE.*path_tags" objectified-db/scripts/20260101-120000.sql; then
        echo "   ✓ path_tags table creation script found"
    else
        echo "   ✗ path_tags table not in migration"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "   ✗ Migration file missing"
    ERRORS=$((ERRORS + 1))
fi

# Check test file
echo ""
echo "7. Checking test files..."
if [ -f "objectified-ui/tests/path-tags-test.sql" ]; then
    echo "   ✓ Test SQL file exists"
else
    echo "   ⚠ Test SQL file missing"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "objectified-ui/docs/PATH_TAGS_TESTING.md" ]; then
    echo "   ✓ Documentation file exists"
else
    echo "   ⚠ Documentation file missing"
    WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "============================================"
echo "VERIFICATION SUMMARY"
echo "============================================"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo "✓ All critical checks passed!"
    echo ""
    echo "Next steps:"
    echo "1. Apply database migration: psql -f objectified-db/scripts/20260101-120000.sql"
    echo "2. Run tests: psql -f objectified-ui/tests/path-tags-test.sql"
    echo "3. Restart the application"
    echo "4. Test in the UI"
    exit 0
else
    echo "✗ Verification failed with $ERRORS errors"
    echo ""
    echo "Please fix the errors above before proceeding."
    exit 1
fi

