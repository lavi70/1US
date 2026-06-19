# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --production=false
COPY backend/ ./
RUN npm run build

# Production: backend serves everything
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache vips-dev python3 make g++

COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./package.json
COPY --from=frontend-builder /app/frontend/dist ./public

RUN mkdir -p /app/data /app/uploads/listings

EXPOSE 3001
CMD ["node", "dist/server.js"]
