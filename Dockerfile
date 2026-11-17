# ============================================================
# PrintFlow - Production Dockerfile for Railway
# Uses MySQL schema at build time (no runtime schema swap needed)
# ============================================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend (with MySQL schema pre-applied)
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
# Replace default SQLite schema with MySQL schema BEFORE generating prisma client
RUN cp prisma/schema.mysql.prisma prisma/schema.prisma
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine
WORKDIR /app/backend

# Install production deps
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy built artifacts
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma

# Copy frontend static files
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create storage directory
RUN mkdir -p storage

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Inline startup script (no shell file needed - avoids CRLF issues)
CMD ["sh", "-c", "\
  echo '🚀 Starting PrintFlow...' && \
  echo '📡 Running DB migrations...' && \
  npx prisma db push --accept-data-loss && \
  echo '🌱 Seeding initial data...' && \
  node -e \"\
    const {PrismaClient}=require('@prisma/client');\
    const bcrypt=require('bcryptjs');\
    const p=new PrismaClient();\
    async function s(){\
      const c=await p.shop.count();\
      if(c===0){\
        const shop=await p.shop.create({data:{name:'PrintFlow Express',slug:'printflow-express',address:'Shop #4, Metro Station Plaza',phone:'+91 98765 43210',workingHours:'8:00 AM - 10:00 PM',isOpen:true}});\
        const h=await bcrypt.hash('AdminPassword123!',10);\
        await p.admin.create({data:{shopId:shop.id,email:'admin@printflow.com',passwordHash:h,name:'Shop Owner',role:'SUPER_ADMIN'}});\
        console.log('Shop and admin created');\
      } else { console.log('Data already exists, skipping seed'); }\
    }\
    s().catch(console.error).finally(()=>p.\$disconnect());\
  \" && \
  echo '🌐 Starting server...' && \
  node dist/server.js \
"]
