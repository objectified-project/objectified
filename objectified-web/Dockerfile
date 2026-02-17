# # Dockerfile for Objectified Web (Next.js Marketing Site)
# # Supports: linux/amd64, linux/arm64

# # Stage 1: Dependencies
# FROM --platform=$BUILDPLATFORM node:20-alpine AS deps
# WORKDIR /app

# # Install dependencies for native modules
# RUN apk add --no-cache libc6-compat python3 make g++

# # Copy package files
# COPY package.json ./

# # Install ALL dependencies (including dev deps) for build
# # TypeScript is needed to transpile next.config.ts
# RUN yarn install

# # Stage 2: Builder
# FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
# WORKDIR /app

# # Copy dependencies from deps stage
# COPY --from=deps /app/node_modules ./node_modules

# # Copy application code
# COPY . .

# # Set environment variables for build
# ENV NEXT_TELEMETRY_DISABLED=1

# # Build Next.js application
# RUN yarn build

# # Stage 3: Runner (Production)
# FROM node:20-alpine AS runner
# WORKDIR /app

# # Set to production environment
# ENV NODE_ENV=production
# ENV NEXT_TELEMETRY_DISABLED=1

# # Create non-root user for security
# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs

# # Copy package files for yarn start command
# COPY --from=builder /app/package.json ./package.json

# # Copy node_modules (production dependencies)
# COPY --from=builder /app/node_modules ./node_modules

# # Copy Next.js build output
# COPY --from=builder /app/.next ./.next

# # Copy public directory
# COPY --from=builder /app/public ./public

# # Copy next.config.ts
# COPY --from=builder /app/next.config.ts* ./

# # Set ownership to non-root user
# RUN chown -R nextjs:nodejs /app

# # Switch to non-root user
# USER nextjs

# # Expose port
# EXPOSE 3002

# # Bind to 0.0.0.0 so connections from outside the container are accepted
# ENV HOSTNAME="0.0.0.0"
# ENV PORT=3002

# # Start the application (explicit -H 0.0.0.0 for Docker/remote connections)
# CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3002", "-H", "0.0.0.0"]

# Dockerfile for Objectified UI (Next.js)
# Supports: linux/amd64, linux/arm64

# Stage 1: Dependencies
FROM --platform=$BUILDPLATFORM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for native modules (bcrypt, pg)
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files only
COPY package.json ./

# Install ALL dependencies (including dev deps) for build
# Using npm to avoid yarn workspace complications
RUN npm install


# Stage 2: Builder
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application
RUN npm run build

# Stage 3: Runner (Production)
FROM node:20-alpine AS runner
WORKDIR /app

# Set to production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Set ownership to non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3002

# Set hostname to allow external connections
ENV HOSTNAME="0.0.0.0"
ENV PORT=3002

# Start the application (standalone uses server.js)
CMD ["node", "server.js"]

