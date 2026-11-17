# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine
WORKDIR /app

# Setup Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Setup Frontend static dist
WORKDIR /app/frontend
COPY --from=frontend-builder /app/frontend/dist ./dist

# Storage directory
WORKDIR /app/backend
RUN mkdir -p storage

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["/bin/sh", "./docker-entrypoint.sh"]
