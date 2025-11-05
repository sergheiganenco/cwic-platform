# backend/quality-engine/Dockerfile
FROM node:20-alpine

# Install Python and build dependencies for TensorFlow
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev && \
    npm cache clean --force

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source code
COPY src ./src

# Install dev dependencies for building
RUN npm install --save-dev typescript ts-node @types/node

# Build the application
RUN npm run build || npx tsc

# Verify dist folder exists
RUN ls -la dist/

# Expose port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "dist/index.js"]