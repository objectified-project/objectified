# Docker Platform Compatibility Fix

## Problem

Error when pulling Docker image:
```
no matching manifest for linux/amd64 in the manifest list entries: 
no match for platform in manifest: not found
```

## Root Cause

This error occurs due to platform/architecture mismatch between:
1. The platform the image was built on (e.g., ARM64/Apple Silicon)
2. The platform trying to pull/run the image (e.g., AMD64/x86_64)

## Solution Applied

### 1. Updated Dockerfile

Added multi-platform support with `--platform` flags:

```dockerfile
FROM --platform=$BUILDPLATFORM node:20-alpine AS deps
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
FROM --platform=$TARGETPLATFORM node:20-alpine AS runner
```

**Changes:**
- `$BUILDPLATFORM` - Platform where the build happens
- `$TARGETPLATFORM` - Platform where the image will run (removed from runner - redundant)
- Fixed npm vs yarn (Alpine doesn't have yarn by default)
- Added proper CMD at the end
- **Fixed TypeScript missing error** - Install all dependencies (not just production)

### 2. Fixed TypeScript Build Error

**Before:**
```dockerfile
RUN npm ci --only=production --ignore-scripts
```

**After:**
```dockerfile
RUN npm ci --ignore-scripts
```

**Why:** TypeScript (a dev dependency) is needed to transpile `next.config.ts` during build. The final image still only contains the standalone output, so no size impact.

### 2. Updated build-docker.sh

Added automatic platform detection:

```bash
# Detects ARM64 or AMD64
local platform="linux/amd64"
if [[ "$(uname -m)" == "arm64" ]] || [[ "$(uname -m)" == "aarch64" ]]; then
    platform="linux/arm64"
fi
```

## How to Use

### Method 1: Build for Your Current Platform (Default)

```bash
npm run docker:build
```

This now automatically detects your platform and builds correctly.

### Method 2: Build for Specific Platform

```bash
# For AMD64 (Intel/most servers)
docker build --platform linux/amd64 -t objectified-ui:latest .

# For ARM64 (Apple Silicon/M1/M2)
docker build --platform linux/arm64 -t objectified-ui:latest .
```

### Method 3: Build for Multiple Platforms (Registry Push)

```bash
# Enable buildx if not already enabled
docker buildx create --use

# Build for both platforms and push
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myregistry.com/objectified-ui:latest \
  --push \
  .
```

## Platform-Specific Instructions

### If You're on Apple Silicon (M1/M2/M3)

**Building for deployment on AMD64 servers:**

```bash
# Option 1: Using build script (recommended)
PLATFORM=linux/amd64 npm run docker:build

# Option 2: Direct docker command
docker buildx build \
  --platform linux/amd64 \
  -t objectified-ui:latest \
  .
```

### If You're on Intel Mac or Linux AMD64

**Building normally:**

```bash
npm run docker:build
```

**Building for ARM64 (if needed):**

```bash
docker buildx build \
  --platform linux/arm64 \
  -t objectified-ui:latest \
  .
```

## Deployment Scenarios

### Scenario 1: Apple Silicon → AMD64 Server

```bash
# Build on Mac M1/M2
docker buildx build \
  --platform linux/amd64 \
  -t objectified-ui:latest \
  --load \
  .

# Save and transfer
docker save objectified-ui:latest | gzip > objectified-ui-amd64.tar.gz
scp objectified-ui-amd64.tar.gz user@server:/opt/

# On AMD64 server
gunzip -c objectified-ui-amd64.tar.gz | docker load
docker run -p 3000:3000 objectified-ui:latest
```

### Scenario 2: Build Multi-Platform with Registry

```bash
# Enable buildx
docker buildx create --name multiplatform --use

# Build and push for both platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myregistry.com/objectified-ui:latest \
  --push \
  .

# On any server (AMD64 or ARM64)
docker pull myregistry.com/objectified-ui:latest
# Automatically pulls correct platform
```

### Scenario 3: Local Development (Any Platform)

```bash
# Use updated build script
npm run docker:build

# Automatically detects and builds for your platform
```

## Verification

### Check Your Platform

```bash
# Check current architecture
uname -m

# Output meanings:
# x86_64 or amd64 = AMD64/Intel
# arm64 or aarch64 = ARM64/Apple Silicon
```

### Check Image Platform

```bash
# Inspect built image
docker image inspect objectified-ui:latest | grep Architecture

# Or more detailed
docker buildx imagetools inspect objectified-ui:latest
```

### Test Cross-Platform (if buildx enabled)

```bash
# Run AMD64 image on ARM64 (or vice versa)
docker run --platform linux/amd64 -p 3000:3000 objectified-ui:latest

# Note: May be slower due to emulation
```

## Common Issues & Solutions

### Issue 1: "buildx not found"

**Solution:**
```bash
# Update Docker to latest version
# Or install buildx plugin
docker buildx install
```

### Issue 2: "Multiple platform feature is currently not supported"

**Solution:**
```bash
# Use --load flag for single platform
docker buildx build \
  --platform linux/amd64 \
  -t objectified-ui:latest \
  --load \
  .
```

### Issue 3: Build succeeds but image won't run on server

**Solution:**
```bash
# Check platforms match
# On build machine:
docker image inspect objectified-ui:latest | grep Architecture

# On server:
uname -m

# Rebuild for correct platform if mismatch
```

### Issue 4: npm ci fails during build

**Solution:**
Already fixed in Dockerfile with fallback:
```dockerfile
RUN npm ci --only=production --ignore-scripts || npm install --only=production --ignore-scripts
```

## Best Practices

### For Local Development
```bash
npm run docker:build
```
Builds for your current platform automatically.

### For Production Deployment
```bash
# If registry available (recommended)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t registry.com/objectified-ui:latest \
  --push \
  .

# If no registry
docker buildx build \
  --platform linux/amd64 \
  -t objectified-ui:latest \
  --load \
  .
```

### For CI/CD
```bash
# GitHub Actions example
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2

- name: Build and push
  uses: docker/build-push-action@v4
  with:
    platforms: linux/amd64,linux/arm64
    push: true
    tags: ${{ env.REGISTRY }}/objectified-ui:latest
```

## Updated Build Script Usage

The build script now automatically handles platform detection:

```bash
# Basic build (auto-detects platform)
npm run docker:build

# Fast build
npm run docker:build:fast

# Create deployment package
npm run docker:build:package

# Build and push (multi-platform if buildx available)
npm run docker:build:push
```

## Migration Guide

### If You Have Existing Images

1. **Check existing image platform:**
   ```bash
   docker image inspect objectified-ui:latest | grep Architecture
   ```

2. **Rebuild for correct platform:**
   ```bash
   docker rmi objectified-ui:latest
   npm run docker:build
   ```

3. **Or build multi-platform:**
   ```bash
   docker buildx build \
     --platform linux/amd64,linux/arm64 \
     -t objectified-ui:latest \
     --load \
     .
   ```

## Quick Reference

| Platform | Build Command |
|----------|---------------|
| Auto-detect | `npm run docker:build` |
| AMD64 | `docker build --platform linux/amd64 -t objectified-ui:latest .` |
| ARM64 | `docker build --platform linux/arm64 -t objectified-ui:latest .` |
| Both | `docker buildx build --platform linux/amd64,linux/arm64 --push .` |

## Support

For issues:
1. Check platform: `uname -m`
2. Check Docker version: `docker --version`
3. Check buildx: `docker buildx version`
4. Rebuild: `npm run docker:build`

---

**Status**: ✅ Fixed
**Date**: December 6, 2024
**Dockerfile**: Updated with multi-platform support
**Build Script**: Updated with platform detection
**Compatible**: linux/amd64, linux/arm64

