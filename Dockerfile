FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies
COPY package*.json ./
RUN npm install

# Install web dependencies
COPY web/package*.json ./web/
RUN npm --prefix web install

# Copy all source files
COPY . .

# Build TypeScript backend
RUN npx tsc

# Build web frontend into dist/public/
RUN npm --prefix web run build

# ── Production image ─────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create data dir (Railway volume mounts here for the SQLite DB)
RUN mkdir -p /app/data

EXPOSE 8080
CMD ["node", "dist/index.js"]
