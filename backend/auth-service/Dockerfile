# backend/auth-service/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -s package-lock.json ] && grep -q '"lockfileVersion"' package-lock.json; then \
    npm ci --no-audit --no-fund; \
    else \
    npm install --no-audit --no-fund; \
    fi

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# if your auth service is TS, build; if JS, this is harmless/no-op
RUN npm run build || true

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./

# Security: Run as non-root user
RUN chown -R node:node /app
USER node

EXPOSE 3001
# try dist first, fall back to src for JS-only projects
CMD [ "sh", "-c", "node dist/server.js 2>/dev/null || node src/server.js" ]
