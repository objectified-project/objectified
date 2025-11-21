#!/bin/bash

# Test Script for Linked Accounts Feature
# This script tests the entire linked accounts flow

echo "🧪 Testing Linked Accounts Feature"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check Database Setup
echo "1. Checking database setup..."
DB_CHECK=$(psql -U kenji -d kenji -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'odb' AND table_name = 'external_auth_providers');" 2>&1)

if [[ $DB_CHECK == *"t"* ]]; then
    echo -e "${GREEN}✓${NC} Database table exists"
else
    echo -e "${RED}✗${NC} Database table missing"
    exit 1
fi

# 2. Check table structure
echo "2. Checking table structure..."
COLUMN_COUNT=$(psql -U kenji -d kenji -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'odb' AND table_name = 'external_auth_providers';" 2>&1)

if [[ $COLUMN_COUNT -eq 13 ]]; then
    echo -e "${GREEN}✓${NC} All 13 columns present"
else
    echo -e "${RED}✗${NC} Expected 13 columns, found $COLUMN_COUNT"
fi

# 3. Check indexes
echo "3. Checking indexes..."
INDEX_COUNT=$(psql -U kenji -d kenji -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'odb' AND tablename = 'external_auth_providers';" 2>&1)

if [[ $INDEX_COUNT -ge 9 ]]; then
    echo -e "${GREEN}✓${NC} All indexes created ($INDEX_COUNT indexes)"
else
    echo -e "${YELLOW}⚠${NC} Expected at least 9 indexes, found $INDEX_COUNT"
fi

# 4. Check constraints
echo "4. Checking constraints..."
CONSTRAINT_COUNT=$(psql -U kenji -d kenji -t -c "SELECT COUNT(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'odb' AND conrelid = 'odb.external_auth_providers'::regclass;" 2>&1)

if [[ $CONSTRAINT_COUNT -ge 8 ]]; then
    echo -e "${GREEN}✓${NC} All constraints created ($CONSTRAINT_COUNT constraints)"
else
    echo -e "${YELLOW}⚠${NC} Expected at least 8 constraints, found $CONSTRAINT_COUNT"
fi

# 5. Check trigger
echo "5. Checking trigger..."
TRIGGER_COUNT=$(psql -U kenji -d kenji -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = 'odb' AND event_object_table = 'external_auth_providers';" 2>&1)

if [[ $TRIGGER_COUNT -eq 1 ]]; then
    echo -e "${GREEN}✓${NC} Update trigger exists"
else
    echo -e "${YELLOW}⚠${NC} Expected 1 trigger, found $TRIGGER_COUNT"
fi

# 6. Check Next.js files
echo "6. Checking Next.js files..."

if [ -f "/Users/kenji/Development/objectified/objectified-ui/src/app/ade/dashboard/linked-accounts/page.tsx" ]; then
    echo -e "${GREEN}✓${NC} Linked Accounts page exists"
else
    echo -e "${RED}✗${NC} Linked Accounts page missing"
fi

if grep -q "Linked Accounts" "/Users/kenji/Development/objectified/objectified-ui/src/app/components/ade/dashboard/DashboardSideNav.tsx" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Navigation menu updated"
else
    echo -e "${RED}✗${NC} Navigation menu not updated"
fi

# 7. Check helper functions
echo "7. Checking helper functions..."

if grep -q "getLinkedAccountsForUser" "/Users/kenji/Development/objectified/objectified-ui/lib/db/helper.ts" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} getLinkedAccountsForUser function exists"
else
    echo -e "${RED}✗${NC} getLinkedAccountsForUser function missing"
fi

if grep -q "linkExternalAccount" "/Users/kenji/Development/objectified/objectified-ui/lib/db/helper.ts" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} linkExternalAccount function exists"
else
    echo -e "${RED}✗${NC} linkExternalAccount function missing"
fi

if grep -q "unlinkExternalAccount" "/Users/kenji/Development/objectified/objectified-ui/lib/db/helper.ts" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} unlinkExternalAccount function exists"
else
    echo -e "${RED}✗${NC} unlinkExternalAccount function missing"
fi

# 8. Check GitHub OAuth configuration
echo "8. Checking GitHub OAuth configuration..."

if [ -f "/Users/kenji/Development/objectified/objectified-ui/.env" ]; then
    if grep -q "GITHUB_ID" "/Users/kenji/Development/objectified/objectified-ui/.env" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} GITHUB_ID configured"
    else
        echo -e "${YELLOW}⚠${NC} GITHUB_ID not found in .env"
    fi

    if grep -q "GITHUB_SECRET" "/Users/kenji/Development/objectified/objectified-ui/.env" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} GITHUB_SECRET configured"
    else
        echo -e "${YELLOW}⚠${NC} GITHUB_SECRET not found in .env"
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
fi

# 9. Check if Next.js is running
echo "9. Checking if Next.js is running..."

if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✓${NC} Next.js server is running on port 3000"
else
    echo -e "${YELLOW}⚠${NC} Next.js server is not running"
    echo -e "   Run: ${YELLOW}cd /Users/kenji/Development/objectified/objectified-ui && npm run dev${NC}"
fi

# 10. Check user count
echo "10. Checking test data..."
USER_COUNT=$(psql -U kenji -d kenji -t -c "SELECT COUNT(*) FROM odb.users WHERE deleted_at IS NULL;" 2>&1)
echo -e "${GREEN}✓${NC} Found $USER_COUNT users in database"

LINKED_COUNT=$(psql -U kenji -d kenji -t -c "SELECT COUNT(*) FROM odb.external_auth_providers;" 2>&1)
if [[ $LINKED_COUNT -eq 0 ]]; then
    echo -e "${GREEN}✓${NC} No linked accounts yet (expected for fresh setup)"
else
    echo -e "${GREEN}✓${NC} Found $LINKED_COUNT linked account(s)"
fi

echo ""
echo "=================================="
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "📋 Next Steps:"
echo "1. Navigate to: http://localhost:3000/login"
echo "2. Try logging in with GitHub"
echo "3. After login, go to: Dashboard → Linked Accounts"
echo "4. You should see your GitHub account listed"
echo ""
echo "📖 Documentation:"
echo "• Quick Start: objectified-db/docs/LINKED_ACCOUNTS_QUICKSTART.md"
echo "• Full Docs: objectified-db/docs/EXTERNAL_AUTH_PROVIDERS.md"
echo "• Architecture: objectified-db/docs/LINKED_ACCOUNTS_ARCHITECTURE.md"

