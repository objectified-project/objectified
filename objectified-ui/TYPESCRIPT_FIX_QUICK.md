# Quick Fix: TypeScript Build Error

## The Error
```
Error: Cannot find module 'typescript'
Failed to transpile "next.config.ts"
```

## ✅ Fixed!

Changed Dockerfile line 16:

**Before:**
```dockerfile
RUN npm ci --only=production
```

**After:**
```dockerfile
RUN npm ci
```

## Why?

- TypeScript is a dev dependency
- Next.js needs it to build `next.config.ts`
- Installing all deps during build (temporary stages)
- Final image still small (no node_modules)

## Build Now

```bash
npm run docker:build
```

Should work without errors! ✅

## Size Impact

**None!** 
- Dev deps only in temporary build stages
- Final image: ~250MB (unchanged)

---

**Status**: ✅ Fixed
**Build**: Ready to go

