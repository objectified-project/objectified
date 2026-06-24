# Dockerfile for Objectified REST (FastAPI)
# Supports: linux/amd64, linux/arm64
#
# Build from the repository ROOT so the objectified-ui workspace is in the build context
# (the REST spec-import worker is a TypeScript script in objectified-ui, run via tsx):
#   docker build -f objectified-rest/Dockerfile .

# ── Stage 1: install the objectified-ui workspace deps (provides tsx + the worker's libs) ──
FROM node:20-bookworm-slim AS uideps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /repo
RUN corepack enable

# Root workspace metadata + every workspace manifest: yarn needs the whole graph to resolve,
# even though we only install (focus) the objectified-ui workspace below.
COPY package.json yarn.lock .yarnrc.yml ./
COPY objectified-cli/package.json ./objectified-cli/package.json
COPY objectified-db/package.json ./objectified-db/package.json
COPY objectified-mcp/package.json ./objectified-mcp/package.json
COPY objectified-ui/package.json ./objectified-ui/package.json
COPY objectified-browse/package.json ./objectified-browse/package.json
COPY objectified-web/package.json ./objectified-web/package.json
COPY objectified-rest/package.json ./objectified-rest/package.json

# Install only objectified-ui's dependency tree (includes the tsx dev dependency).
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn workspaces focus objectified-ui

# The worker script and the lib modules it imports (node_modules above is preserved;
# .dockerignore keeps any local node_modules/.next out of the build context).
COPY objectified-ui/ ./objectified-ui/

# ── Stage 2: runtime — Python REST API + a Node runtime to execute the TS import worker ──
FROM python:3.12-slim

WORKDIR /app

# libpq5 for psycopg; nodejs to run the tsx-based spec-import worker. Create the non-root
# user up front so the workspace copies below can be chowned in a single layer.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpq5 \
      libstdc++6 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 appuser

# Node.js runtime for the tsx spec-import worker. Copy the binary from the Node build stage
# (a real /usr/local/bin/node) rather than relying on Debian's nodejs package, whose layout
# (e.g. /usr/bin/nodejs vs /usr/bin/node) broke the worker's `#!/usr/bin/env node` shebang.
COPY --from=uideps /usr/local/bin/node /usr/local/bin/node

# Python dependencies (requirements.txt + extras from pyproject.toml)
COPY objectified-rest/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    bcrypt==4.2.0 \
    email-validator==2.2.0

# Lay the objectified-ui workspace out at "/" so it matches what spec_import_engine resolves:
# _REPO_ROOT = parents[3] of /app/src/app/spec_import_engine.py == "/", so ui_root == /objectified-ui.
# /node_modules holds the hoisted deps (incl. tsx); /objectified-ui/node_modules holds the
# workspace-local .bin/tsx symlink that the worker invocation below points at.
COPY --from=uideps --chown=appuser:appuser /repo/node_modules /node_modules
COPY --from=uideps --chown=appuser:appuser /repo/objectified-ui /objectified-ui

# Application
COPY --chown=appuser:appuser objectified-rest/src/ /app/src/

USER appuser

ENV PYTHONPATH=/app/src \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    # Pin the spec-import worker invocation (resolver's #1 choice) so it does not depend on
    # yarn/npm being on PATH or on workspace .bin symlink hoisting. cwd for this override is the
    # repo root ("/"): node resolves the bare `tsx` loader from /node_modules, and tsx resolves
    # the worker's relative imports against /objectified-ui and its tsconfig paths.
    SPEC_IMPORT_WORKER_ARGV='["node","--import","tsx","objectified-ui/scripts/rest-spec-import-worker.ts"]'

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
