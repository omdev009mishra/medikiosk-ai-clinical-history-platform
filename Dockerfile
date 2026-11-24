# Stage 1: Build Frontend and Bundle Server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json* ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy source code and configs
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY server/ ./server/
COPY server.ts ./

# Build production bundle (Vite + esbuild)
RUN npm run build

# Prune dev dependencies for lean runner
RUN npm prune --production

# --------------------------------------------------------
# Stage 2: Production Minimal Runtime
# --------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/tmp/medikiosk-data

# Install curl for container health check
RUN apk add --no-cache curl

# Create non-root user and data directory for local document storage
RUN mkdir -p /tmp/medikiosk-data/uploads && chown -R node:node /tmp/medikiosk-data /app

# Copy built application and production dependencies from builder
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/api/ready || exit 1

CMD ["node", "dist/server.cjs"]
