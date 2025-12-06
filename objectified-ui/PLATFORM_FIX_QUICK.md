# Quick Fix: Platform Compatibility Error

## The Error You Saw
```
no matching manifest for linux/amd64 in the manifest list entries
```

## ✅ Fixed!

The Dockerfile and build script have been updated to handle multi-platform builds correctly.

## How to Use Now

### Option 1: Use Build Script (Easiest)
```bash
npm run docker:build
```
Now automatically detects your platform and builds correctly!

### Option 2: Specify Platform Explicitly
```bash
# For AMD64 (Intel/most servers)
docker build --platform linux/amd64 -t objectified-ui:latest .

# For ARM64 (Apple Silicon)
docker build --platform linux/arm64 -t objectified-ui:latest .
```

### Option 3: Build for Multiple Platforms
```bash
# Build for both AMD64 and ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t objectified-ui:latest \
  --load \
  .
```

## Common Scenarios

### I'm on Apple Silicon (M1/M2/M3), deploying to AMD64 server
```bash
# Build for AMD64
docker build --platform linux/amd64 -t objectified-ui:latest .

# Or use the build script (it detects this)
npm run docker:build
```

### I want to push to a registry for any platform
```bash
# Enable buildx
docker buildx create --use --name multiplatform

# Build and push for both platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myregistry.com/objectified-ui:latest \
  --push \
  .
```

## What Was Fixed

1. ✅ **Dockerfile** - Added `--platform` flags to all FROM statements
2. ✅ **Build Script** - Added automatic platform detection
3. ✅ **npm commands** - Changed from `yarn` to `npm` (Alpine compatibility)
4. ✅ **CMD** - Added proper startup command

## Verify It Works

```bash
# Check your platform
uname -m

# Build the image
npm run docker:build

# Test it
docker run -p 3000:3000 objectified-ui:latest
```

## Need More Help?

See `DOCKER_PLATFORM_FIX.md` for detailed documentation.

---

**Status**: ✅ Fixed and Ready
**Your Next Step**: Run `npm run docker:build`

