# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production: build backend and serve everything
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ vips-dev

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
RUN npx tsc

COPY --from=frontend-builder /app/frontend/dist ./public

RUN mkdir -p /app/data /app/uploads/listings

EXPOSE 3001
CMD ["node", "dist/server.js"]
