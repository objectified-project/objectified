# Troubleshooting Common Issues

## Module Resolution Errors

### Issue: `Module not found: Can't resolve '@/lib/db/helper'`

**Problem**: The TypeScript path alias `@/*` maps to `./src/*`, so `@/lib/db/helper` tries to resolve to `./src/lib/db/helper`, but the `lib` directory is at the project root.

**Solution**: Use relative imports for the `lib` directory:

```typescript
// ❌ Incorrect (will fail)
import { getPublicTenants } from "@/lib/db/helper";

// ✅ Correct (from src/app/page.tsx)
import { getPublicTenants } from "../../lib/db/helper";
```

**Path Reference Table**:

| From File | Import Path |
|-----------|-------------|
| `src/app/page.tsx` | `../../lib/db/helper` |
| `src/app/search/page.tsx` | `../../../lib/db/helper` |
| `src/app/tenant/[tenantSlug]/page.tsx` | `../../../../lib/db/helper` |
| `src/app/tenant/[tenantSlug]/[projectSlug]/page.tsx` | `../../../../../lib/db/helper` |
| `src/app/tenant/[tenantSlug]/[projectSlug]/[versionSlug]/page.tsx` | `../../../../../../lib/db/helper` |
| `src/app/tenant/[tenantSlug]/[projectSlug]/compare/page.tsx` | `../../../../../../lib/db/helper` |

**Alternative Solution**: Move the `lib` directory into `src`:

```bash
mv lib src/lib
```

Then update all imports to use `@/lib/db/helper`.

## Port Already in Use

### Issue: `Port 3000 is in use`

**Solution**: Kill the process using the port:

```bash
lsof -ti:3000 | xargs kill -9
# or use available port
npm run dev # will auto-select next available port
```

## Database Connection Issues

### Issue: `ECONNREFUSED` or connection timeout

**Solutions**:
1. Verify PostgreSQL is running:
   ```bash
   pg_isready -h localhost -p 5432
   ```

2. Check credentials in `.env.local`:
   ```env
   DATABASE_URL=postgresql://user:pass@host:port/db
   ```

3. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

## REST API Connection Issues

### Issue: Specifications fail to load

**Solutions**:
1. Verify REST API is running:
   ```bash
   curl http://localhost:8000/
   ```

2. Check environment variable:
   ```env
   NEXT_PUBLIC_REST_API_BASE_URL=http://localhost:8000/v1
   ```

3. Check browser console for CORS errors

## Build Errors

### Issue: TypeScript compilation errors

**Solutions**:
1. Clear `.next` directory:
   ```bash
   rm -rf .next
   ```

2. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Check tsconfig.json is correct

## Runtime Errors

### Issue: "Cannot find module" at runtime

**Solutions**:
1. Restart dev server
2. Check file paths are correct
3. Verify imports use correct casing (case-sensitive)

### Issue: Empty pages or no data

**Solutions**:
1. Check database has published public versions:
   ```sql
   SELECT COUNT(*) FROM odb.versions 
   WHERE published = true AND visibility = 'public';
   ```

2. Verify server-side functions are marked with `'use server'`
3. Check browser console for errors

## Lock File Issues

### Issue: Multiple lockfiles warning

**Solution**: Remove unnecessary lockfile:
```bash
# If using npm
rm yarn.lock pnpm-lock.yaml
# If using yarn
rm package-lock.json pnpm-lock.yaml
```

## Quick Fixes

```bash
# Complete reset
cd objectified-browse
rm -rf .next node_modules package-lock.json
npm install
npm run dev

# Just rebuild
rm -rf .next
npm run dev

# Check for syntax errors
npm run lint

# Build production to catch errors
npm run build
```

## Getting Help

If issues persist:
1. Check the error message carefully
2. Search the error in Next.js documentation
3. Verify all environment variables are set
4. Test database and REST API connections separately
5. Check file permissions

