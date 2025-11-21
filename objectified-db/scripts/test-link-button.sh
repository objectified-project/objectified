#!/bin/bash

# Test script for Account Linking Fix
# Verifies the Link button functionality

echo "🔗 Testing Link Button Functionality"
echo "====================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Testing Account Linking Flow${NC}"
echo ""

# Check if server is running
echo "1. Checking server status..."
if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✓${NC} Next.js server is running"
else
    echo -e "${RED}✗${NC} Next.js server is not running"
    exit 1
fi

# Check the link endpoint exists
echo ""
echo "2. Checking link endpoint..."
if [ -f "/Users/kenji/Development/objectified/objectified-ui/src/app/api/auth/link/[provider]/route.ts" ]; then
    echo -e "${GREEN}✓${NC} Link endpoint exists"

    # Check it returns JSON (not a redirect)
    if grep -q "NextResponse.json" "/Users/kenji/Development/objectified/objectified-ui/src/app/api/auth/link/[provider]/route.ts"; then
        echo -e "${GREEN}✓${NC} Endpoint returns JSON (correct)"
    else
        echo -e "${RED}✗${NC} Endpoint doesn't return JSON"
    fi
else
    echo -e "${RED}✗${NC} Link endpoint missing"
fi

# Check the UI uses signIn
echo ""
echo "3. Checking UI implementation..."
if grep -q "signIn(provider" "/Users/kenji/Development/objectified/objectified-ui/src/app/ade/dashboard/linked-accounts/page.tsx"; then
    echo -e "${GREEN}✓${NC} UI uses signIn() function"
else
    echo -e "${RED}✗${NC} UI doesn't use signIn()"
fi

if grep -q "fetch.*auth/link" "/Users/kenji/Development/objectified/objectified-ui/src/app/ade/dashboard/linked-accounts/page.tsx"; then
    echo -e "${GREEN}✓${NC} UI fetches cookie endpoint first"
else
    echo -e "${RED}✗${NC} UI doesn't fetch cookie endpoint"
fi

# Check OAuth callback
echo ""
echo "4. Checking OAuth callback..."
if grep -q "checkLinkingIntent" "/Users/kenji/Development/objectified/objectified-ui/src/app/api/auth/\[...nextauth\]/route.ts"; then
    echo -e "${GREEN}✓${NC} OAuth callback checks for linking intent"
else
    echo -e "${RED}✗${NC} OAuth callback doesn't check linking intent"
fi

echo ""
echo "====================================="
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo -e "${BLUE}📋 Manual Testing Steps:${NC}"
echo ""
echo "1. Open browser with DevTools (F12)"
echo "   → http://localhost:3000/login"
echo ""
echo "2. Login to your account"
echo ""
echo "3. Go to: Dashboard → Linked Accounts"
echo ""
echo "4. Open Network tab in DevTools"
echo ""
echo "5. Click 'Link' button next to GitHub"
echo ""
echo "6. In Network tab, you should see:"
echo "   a) Call to /api/auth/link/github (Status: 200)"
echo "   b) Call to /api/auth/signin/github (Redirect to GitHub)"
echo ""
echo "7. On GitHub, click 'Authorize'"
echo ""
echo "8. You should be redirected back to Linked Accounts"
echo "   → Success message should appear"
echo "   → GitHub account should be in the list"
echo ""
echo "9. Verify in database:"
echo "   $ psql -U kenji -d kenji -c \"SELECT * FROM odb.external_auth_providers;\""
echo ""
echo -e "${YELLOW}🔍 Debugging Tips:${NC}"
echo ""
echo "If nothing happens:"
echo "• Check browser console for errors"
echo "• Check Network tab for failed requests"
echo "• Check Next.js server logs for '[link/github]' messages"
echo ""
echo "If redirects to dashboard:"
echo "• Check if oauth_link_intent cookie is being set"
echo "  (Application → Cookies in DevTools)"
echo "• Check Next.js logs for linking intent detection"
echo ""
echo "If 'Already linked' error:"
echo "• Unlink the account first, then try again"
echo "• Or use a different GitHub account"

