# Docker Build Fix: TypeScript Missing Error

## Problem

Build failed with error:
```
Error: Cannot find module 'typescript'
Failed to transpile "next.config.ts"
```

## Root Cause

The Dockerfile was installing only **production dependencies** (`--only=production`), but TypeScript is a **dev dependency**. Next.js needs TypeScript to transpile `next.config.ts` during the build process.

## Solution Applied

### Changed in Dockerfile

**Before (Line 16):**
```dockerfile
RUN npm ci --only=production --ignore-scripts || npm install --only=production --ignore-scripts
```

**After:**
```dockerfile
# Install ALL dependencies (including dev deps) for build
# TypeScript is needed to transpile next.config.ts
RUN npm ci --ignore-scripts || npm install --ignore-scripts
```

### Why This Works

1. **Build Stage** - Installs ALL dependencies (including TypeScript)
2. **Build Process** - Next.js can now transpile next.config.ts
3. **Runtime Stage** - Only copies the built artifacts (not node_modules)
4. **Result** - Production image is still minimal (no dev dependencies in final image)

### Bonus Fix

Also removed redundant platform flag warning:
```dockerfile
# Before
FROM --platform=$TARGETPLATFORM node:20-alpine AS runner

# After (default behavior)
FROM node:20-alpine AS runner
```

## Multi-Stage Build Strategy

```
Stage 1: deps
├── Install ALL dependencies (dev + prod)
├── Includes TypeScript for config transpilation
└── Output: Complete node_modules

Stage 2: builder
├── Copy dependencies from Stage 1
├── Build Next.js (uses TypeScript)
└── Output: .next/standalone (minimal)

Stage 3: runner (Production)
├── Copy ONLY built files
├── No node_modules copied
└── Result: Minimal production image
```

## Image Size Impact

Despite installing dev dependencies during build:

- **Build Stages**: Include dev dependencies (larger, temporary)
- **Final Image**: Only includes standalone output (~250MB)
- **No Size Impact**: Dev dependencies not in final image

## How to Build Now

```bash
# Clean build
docker system prune -f
npm run docker:build

# Or with push
npm run docker:build:push
```

## Verification

After fix:
```bash
# Build should complete successfully
npm run docker:build

# Check image
docker images objectified-ui

# Test
docker run -p 3000:3000 \
  -e NEXTAUTH_SECRET="test" \
  -e ADMIN_PASSWORD="test" \
  objectified-ui:latest
```

## What Changed

| File | Line | Change |
|------|------|--------|
| Dockerfile | 16 | Removed `--only=production` flag |
| Dockerfile | 34 | Removed redundant `--platform=$TARGETPLATFORM` |

## Why Dev Dependencies Are Needed

Next.js requires these dev dependencies at build time:

- **typescript** - Transpile next.config.ts
- **@types/*** - Type checking
- **eslint** - Linting during build
- **tailwindcss** - CSS processing

Without them, the build fails.

## Common Misconception

**Myth**: "Dev dependencies make the image larger"

**Reality**: 
- Dev dependencies only exist in build stages
- Final image uses standalone output
- No node_modules in production image
- Image size unchanged

## Related Issues

If you see similar errors:

```
Cannot find module '@types/node'
Cannot find module 'tailwindcss'
Cannot find module 'eslint'
```

**Solution**: Same fix - install all dependencies during build.

## Quick Reference

```bash
# If build fails with missing module error:

# 1. Check Dockerfile has:
RUN npm ci --ignore-scripts

# Not:
RUN npm ci --only=production --ignore-scripts

# 2. Rebuild:
docker system prune -f
npm run docker:build

# 3. Verify:
docker run -p 3000:3000 objectified-ui:latest
```

---

**Status**: ✅ Fixed
**Date**: December 6, 2024
**Issue**: TypeScript missing during build
**Solution**: Install all dependencies in build stage
**Impact**: No change to final image size

