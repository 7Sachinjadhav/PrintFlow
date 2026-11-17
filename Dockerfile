FROM node:20-alpine

# OpenSSL needed by Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# ── Backend deps ──────────────────────────────────────────────
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# ── Frontend deps ─────────────────────────────────────────────
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# ── Copy source ───────────────────────────────────────────────
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# ── Build frontend ────────────────────────────────────────────
RUN cd frontend && npm run build

# ── Build backend (schema.prisma is already MySQL) ────────────
RUN cd backend && npx prisma generate && npx tsc

# ── Put frontend dist where server expects it ─────────────────
RUN mkdir -p /app/frontend/dist

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

WORKDIR /app/backend

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
