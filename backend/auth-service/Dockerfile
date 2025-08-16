# ---------- Deps (prod only) ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- Build (needs dev deps) ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# ---------- Runtime (prod) ----------
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache dumb-init curl
ENV NODE_ENV=production

# run as non-root
USER node

# copy runtime bits
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -fsS http://localhost:8001/health || exit 1

ENTRYPOINT ["dumb-init","--"]
CMD ["node","--enable-source-maps","dist/server.js"]
