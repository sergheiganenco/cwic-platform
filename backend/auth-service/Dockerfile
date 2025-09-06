# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
# Copy ONLY manifests first for better caching
COPY package*.json ./
# Lockfile may not exist in dev — fall back to npm i
RUN if [ -f package-lock.json ]; then \
    npm ci --no-audit --no-fund; \
    else \
    npm i --no-audit --no-fund; \
    fi

# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
# Bring node_modules from deps layer (already installed)
COPY --from=deps /app/node_modules ./node_modules
# Copy manifests + tsconfig for build metadata
COPY package*.json tsconfig.json ./
# Copy source
COPY src ./src
# Build: use script if present, otherwise fallback to tsc
RUN npm run build || npx tsc -p tsconfig.json

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Minimal utilities (init + health probe)
RUN apk add --no-cache dumb-init curl
# Non-root user for safety
USER node
# Copy runtime bits
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist        ./dist
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -fsS http://localhost:8001/health || exit 1
ENTRYPOINT ["dumb-init","--"]
CMD ["node","--enable-source-maps","dist/server.js"]
