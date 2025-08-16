FROM node:18-alpine AS builder
WORKDIR /app

# install ALL deps (including typescript) to build
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S cwic -u 1001
# copy built app + only prod deps
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

USER cwic
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:8000/health || exit 1
CMD ["npm","run","dev"]
