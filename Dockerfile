# Build stage — bun for install + bundle
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and typecheck
COPY src ./src
COPY tsconfig.json ./
RUN bun run typecheck

# Bundle to Node-compatible JS in /app/dist
RUN bun run build

# Production stage — pure node runtime
FROM node:24-slim

WORKDIR /app

# curl is only needed for the healthcheck below
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only the bundled output
COPY --from=builder /app/dist ./dist
COPY package.json ./

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
