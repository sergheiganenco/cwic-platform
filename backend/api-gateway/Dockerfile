FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -s package-lock.json ] && grep -q '"lockfileVersion"' package-lock.json; then \
    npm ci --only=production --no-audit --no-fund; \
    else \
    npm install --only=production --no-audit --no-fund; \
    fi

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8000
CMD ["node", "dist/server.js"]
