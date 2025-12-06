# Cross-Platform Building Guide

## Building for Different Platforms

The build script now supports three methods to specify the target platform:

### Method 1: Environment Variable `PLATFORM` (Highest Priority)

```bash
PLATFORM="linux/amd64" npm run docker:build
```

### Method 2: Environment Variable `BUILDPLATFORM` (Medium Priority)

```bash
BUILDPLATFORM="linux/amd64" npm run docker:build
```

### Method 3: Auto-Detection (Default)

```bash
# Automatically detects your current platform
npm run docker:build
```

## Priority Order

The script uses this priority:
1. `PLATFORM` environment variable (if set)
2. `BUILDPLATFORM` environment variable (if set)
3. Auto-detection based on `uname -m`

## Common Use Cases

### On Apple Silicon (M1/M2/M3) - Build for AMD64 Server

```bash
# Method 1: Using PLATFORM
PLATFORM="linux/amd64" npm run docker:build

# Method 2: Using BUILDPLATFORM
BUILDPLATFORM="linux/amd64" npm run docker:build

# Method 3: Direct docker command
docker build --platform linux/amd64 -t objectified-ui:latest .
```

### Build and Push for AMD64 Server

```bash
PLATFORM="linux/amd64" \
DOCKER_REGISTRY="registry.objectified.dev" \
npm run docker:build:push
```

Or with yarn:

```bash
PLATFORM="linux/amd64" \
DOCKER_REGISTRY="registry.objectified.dev" \
yarn docker:build:push
```

### Build for Multiple Platforms

```bash
# Build for both platforms using buildx
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t registry.objectified.dev/objectified-ui:latest \
  --push \
  .
```

## Verification

### Check What Platform Will Be Used

```bash
# Your current platform
uname -m

# With PLATFORM set
PLATFORM="linux/amd64" npm run docker:build
# Output: [INFO] Using PLATFORM environment variable: linux/amd64

# With BUILDPLATFORM set
BUILDPLATFORM="linux/amd64" npm run docker:build
# Output: [INFO] Using BUILDPLATFORM environment variable: linux/amd64

# Auto-detected
npm run docker:build
# Output: [INFO] Auto-detected ARM64 platform (or AMD64)
```

### Check Built Image Platform

```bash
# After building
docker image inspect objectified-ui:latest | grep Architecture

# Should show:
# "Architecture": "amd64"  (for linux/amd64)
# or
# "Architecture": "arm64"  (for linux/arm64)
```

## Examples

### Example 1: Build on M1 Mac for AMD64 Server

```bash
# Set platform and registry
PLATFORM="linux/amd64" \
DOCKER_REGISTRY="registry.objectified.dev" \
npm run docker:build:push

# On the server (AMD64)
docker pull registry.objectified.dev/objectified-ui:latest
docker run -p 3000:3000 registry.objectified.dev/objectified-ui:latest
```

### Example 2: Build Package for Specific Platform

```bash
# Build for AMD64 and create deployment package
PLATFORM="linux/amd64" npm run docker:build:package

# Creates: objectified-ui-deploy-YYYYMMDD-HHMMSS.tar.gz
# Transfer to AMD64 server
```

### Example 3: Test Build for Different Platform

```bash
# Build for AMD64 (even on ARM64 Mac)
PLATFORM="linux/amd64" npm run docker:build:fast

# Test with emulation (may be slower)
docker run -p 3000:3000 objectified-ui:latest
```

## Platform Values

| Platform Value | Architecture | Use For |
|----------------|--------------|---------|
| `linux/amd64` | x86_64/Intel | Most cloud servers, Intel Macs |
| `linux/arm64` | ARM64/aarch64 | Apple Silicon, AWS Graviton |
| `linux/arm/v7` | ARMv7 | Raspberry Pi 3/4 |
| `linux/386` | x86 (32-bit) | Legacy systems |

## Troubleshooting

### Issue: Platform Override Not Working

**Problem:**
```bash
BUILDPLATFORM="linux/amd64" npm run docker:build
# Still shows: [INFO] Auto-detected ARM64 platform
```

**Solution:**
Use `PLATFORM` instead (higher priority):
```bash
PLATFORM="linux/amd64" npm run docker:build
```

### Issue: Build Fails with Platform Error

**Problem:**
```
ERROR: Multi-platform build is not supported
```

**Solution:**
Use Docker buildx:
```bash
docker buildx create --use
PLATFORM="linux/amd64" npm run docker:build
```

### Issue: Image Won't Run on Server

**Problem:**
Built on M1 Mac, won't run on AMD64 server.

**Solution:**
Specify platform explicitly:
```bash
PLATFORM="linux/amd64" npm run docker:build
```

## CI/CD Examples

### GitHub Actions

```yaml
name: Build Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build for AMD64
        env:
          PLATFORM: linux/amd64
          DOCKER_REGISTRY: ${{ secrets.DOCKER_REGISTRY }}
        run: |
          cd objectified-ui
          npm run docker:build:push
```

### GitLab CI

```yaml
build-docker:
  stage: build
  variables:
    PLATFORM: "linux/amd64"
    DOCKER_REGISTRY: "registry.objectified.dev"
  script:
    - cd objectified-ui
    - npm run docker:build:push
```

## Quick Reference

```bash
# Build for current platform (auto-detect)
npm run docker:build

# Build for AMD64 explicitly
PLATFORM="linux/amd64" npm run docker:build

# Build for ARM64 explicitly
PLATFORM="linux/arm64" npm run docker:build

# Build and push for AMD64
PLATFORM="linux/amd64" \
DOCKER_REGISTRY="registry.objectified.dev" \
npm run docker:build:push

# Build both platforms with buildx
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t registry.objectified.dev/objectified-ui:latest \
  --push .
```

---

**Updated**: December 6, 2024
**Script Version**: 1.1
**Supports**: PLATFORM, BUILDPLATFORM env vars
**Default**: Auto-detection

