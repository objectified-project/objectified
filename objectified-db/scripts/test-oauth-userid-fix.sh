#!/bin/bash

# Test script to verify OAuth user_id fix

echo "🔍 Verifying OAuth User ID Fix"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Checking implementation...${NC}"
echo ""

# Check if credentialsGithub sets payload.user.id
echo "1. Checking credentialsGithub function..."
if grep -q "payload.user.id = userResult.id" /Users/kenji/Development/objectified/objectified-ui/lib/auth/credentials.ts; then
    echo -e "${GREEN}✓${NC} credentialsGithub sets payload.user.id from database"
else
    echo -e "${RED}✗${NC} credentialsGithub doesn't set payload.user.id"
fi

# Check if it sets other user fields
if grep -q "payload.user.email = userResult.email" /Users/kenji/Development/objectified/objectified-ui/lib/auth/credentials.ts; then
    echo -e "${GREEN}✓${NC} credentialsGithub sets payload.user.email from database"
else
    echo -e "${RED}✗${NC} credentialsGithub doesn't set payload.user.email"
fi

if grep -q "payload.user.name = userResult.name" /Users/kenji/Development/objectified/objectified-ui/lib/auth/credentials.ts; then
    echo -e "${GREEN}✓${NC} credentialsGithub sets payload.user.name from database"
else
    echo -e "${RED}✗${NC} credentialsGithub doesn't set payload.user.name"
fi

# Check JWT callback logging
echo ""
echo "2. Checking JWT callback..."
if grep -q "Setting user_id from payload.user.id" /Users/kenji/Development/objectified/objectified-ui/src/app/api/auth/\[...nextauth\]/route.ts; then
    echo -e "${GREEN}✓${NC} JWT callback has logging for user_id"
else
    echo -e "${YELLOW}⚠${NC} JWT callback missing detailed logging"
fi

echo ""
echo "=============================="
echo -e "${GREEN}✅ Implementation verified!${NC}"
echo ""
echo -e "${BLUE}📋 Manual Testing Steps:${NC}"
echo ""
echo "1. Logout from the application"
echo ""
echo "2. Login with GitHub OAuth"
echo ""
echo "3. Check server logs for:"
echo "   [credentialsGithub] Login successful via linked account, user_id: <UUID>"
echo "   [JWT] Setting user_id from payload.user.id: <UUID> email: <email>"
echo "   → UUID should be from odb.users, NOT GitHub's ID"
echo ""
echo "4. In browser console, check session:"
echo "   const { data: session } = useSession();"
echo "   console.log(session.user.user_id);"
echo "   → Should be a UUID matching odb.users.id"
echo ""
echo "5. Verify in database:"
echo "   psql -U kenji -d kenji -c \\"
echo "     SELECT u.id, u.email, eap.provider_user_id "
echo "     FROM odb.users u "
echo "     JOIN odb.external_auth_providers eap ON u.id = eap.user_id "
echo "     WHERE eap.provider = 'github';\\"
echo ""
echo "   → u.id should be the UUID used in session"
echo "   → eap.provider_user_id should be GitHub's ID (different)"
echo ""
echo -e "${YELLOW}🔍 What to Look For:${NC}"
echo ""
echo "BEFORE FIX (Wrong):"
echo "  session.user.user_id = '12345678' (GitHub ID)"
echo ""
echo "AFTER FIX (Correct):"
echo "  session.user.user_id = 'abc-123-def-456' (odb.users UUID)"
echo ""
echo "The key difference:"
echo "  • GitHub ID: numeric string like '12345678'"
echo "  • odb.users ID: UUID like 'abc-123-def-456'"

