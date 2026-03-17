# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc


# Stage 2: Production (no build tools needed — native modules already compiled)
FROM node:20-slim

WORKDIR /app

COPY package.json ./

# Copy pre-compiled node_modules and built output from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite (use Railway volumes for persistence)
RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]
