# ---------- BUILD STAGE ----------
FROM node:20-alpine3.20 AS build
WORKDIR /app

# Copy manifest files
COPY package*.json ./
COPY tsconfig.json ./

# Install deps (works with or without lockfile)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy sources
COPY src ./src

# Build TS and rewrite path aliases (requires: "build:prod": "tsc && tsc-alias && npm run copy-assets")
RUN npm run build:prod

# ---------- RUNTIME STAGE ----------
FROM node:20-alpine3.20 AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8003
ENV HOST=0.0.0.0

# Apply security updates and install a tiny init
RUN apk --no-cache upgrade && apk add --no-cache dumb-init

# Copy only what's needed to run
COPY package*.json ./
# Install production deps (works with or without lockfile)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --from=build /app/dist ./dist

# Run as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S cwic -u 1001
USER cwic

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+ (process.env.PORT||8003) +'/health', r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init","--"]
CMD ["node","dist/server.js"]
