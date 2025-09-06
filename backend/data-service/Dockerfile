# ---------- base versions ----------
ARG NODE_VERSION=20.15.1

# ---------- deps: install dev deps using lockfile ----------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

# Make sure OS has openssl for pg and friends
RUN apk add --no-cache libc6-compat

# Copy only what npm needs to resolve dependencies
COPY package.json package-lock.json ./

# Use npm ci because we have a lockfile
RUN npm ci

# ---------- builder: compile TS ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Typescript -> dist
RUN npm run build

# ---------- prod-deps: prune to production only ----------
FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- runner: minimal image ----------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3002 \
    TZ=UTC

# Add a non-root user
RUN addgroup -S nodegrp && adduser -S nodeusr -G nodegrp

# Copy compiled code and production deps
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/dist ./dist
COPY package.json ./

USER nodeusr

EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "dist/server.js"]
