
# Dockerfile
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# =====================================================

FROM node:18-alpine AS runtime

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cwic -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=cwic:nodejs /app/dist ./
COPY --from=builder --chown=cwic:nodejs /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p logs && chown cwic:nodejs logs

# Switch to non-root user
USER cwic

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8002/health', (res) => { \
    if (res.statusCode === 200) process.exit(0); else process.exit(1); \
    }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "server.js"]
