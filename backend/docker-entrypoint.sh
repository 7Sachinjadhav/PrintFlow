#!/bin/sh
set -e

echo "🚀 Starting PrintFlow Cloud Service..."

if echo "$DATABASE_URL" | grep -q "mysql"; then
  echo "📡 Detected MySQL database connection. Applying MySQL schema..."
  cp prisma/schema.mysql.prisma prisma/schema.prisma
  npx prisma generate
  npx prisma db push --accept-data-loss
else
  echo "📁 Using SQLite database..."
  npx prisma db push
fi

echo "🌱 Ensuring initial shop & admin data..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function seed() {
  const count = await prisma.shop.count();
  if (count === 0) {
    const shop = await prisma.shop.create({
      data: {
        name: 'PrintFlow Express Xerox & Digital Print',
        slug: 'printflow-express',
        address: 'Shop #4, Metro Station Plaza',
        phone: '+91 98765 43210',
        workingHours: '8:00 AM - 10:00 PM',
        isOpen: true,
      }
    });
    const hash = await bcrypt.hash('AdminPassword123!', 10);
    await prisma.admin.create({
      data: {
        shopId: shop.id,
        email: 'admin@printflow.com',
        passwordHash: hash,
        name: 'Shop Owner (Admin)',
        role: 'SUPER_ADMIN'
      }
    });
    console.log('✅ Default Shop & Admin created!');
  }
}
seed().catch(console.error).finally(() => prisma.\$disconnect());
" || true

echo "🌐 Starting PrintFlow Web & Queue Server..."
exec node dist/server.js
