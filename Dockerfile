FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM node:20-alpine AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production=false
COPY backend .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/package.json ./
COPY --from=frontend-build /frontend/dist /frontend/dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
