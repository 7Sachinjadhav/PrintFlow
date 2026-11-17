import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial PrintFlow data...');

  // 1. Create or update Default Shop
  const shop = await prisma.shop.upsert({
    where: { slug: 'printflow-express' },
    update: {},
    create: {
      name: 'PrintFlow Express Xerox & Digital Print',
      slug: 'printflow-express',
      logoUrl: '/logo.svg',
      address: 'Shop #4, University Metro Plaza, Main Road',
      phone: '+91 98765 43210',
      email: 'support@printflow.local',
      workingHours: '8:00 AM - 10:00 PM (Mon - Sun)',
      isOpen: true,
      maxUploadSizeBytes: 26214400, // 25 MB
      maxPageCount: 500,
      supportedFormats: 'pdf,jpg,jpeg,png',
      retentionDays: 7,
      autoDeleteDocs: true,
    },
  });

  console.log(`Shop configured: ${shop.name} (${shop.id})`);

  // 2. Create Default Admin
  const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@printflow.com' },
    update: { passwordHash },
    create: {
      shopId: shop.id,
      email: 'admin@printflow.com',
      passwordHash,
      name: 'Shop Owner (Admin)',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`Admin configured: ${admin.email} (Password: AdminPassword123!)`);

  // 3. Configure Initial Printers (Section 2 of requirements)
  // Device 1: Konica 251 (IP 192.168.1.251)
  const printer1 = await prisma.printer.upsert({
    where: { id: 'printer-konica-251' },
    update: {},
    create: {
      id: 'printer-konica-251',
      shopId: shop.id,
      name: 'Konica 251',
      modelNumber: 'Konica Minolta bizhub 251',
      ipAddress: '192.168.1.251',
      windowsQueueName: 'EPSON L3250 Series', // matches installed local printer for instant test printing
      assignedCapability: 'BOTH', // Color & BW
      supportedPaperSizes: 'A4,A3,LEGAL',
      status: 'ONLINE',
      isDefault: true,
      isEnabled: true,
      routingPriority: 2,
    },
  });

  // Device 2: Canon 240 (IP 192.168.1.240)
  const printer2 = await prisma.printer.upsert({
    where: { id: 'printer-canon-240' },
    update: {},
    create: {
      id: 'printer-canon-240',
      shopId: shop.id,
      name: 'Canon 240',
      modelNumber: 'Canon imageRUNNER 240',
      ipAddress: '192.168.1.240',
      windowsQueueName: 'Microsoft Print to PDF', // matches virtual Windows queue
      assignedCapability: 'BW',
      supportedPaperSizes: 'A4,LEGAL',
      status: 'ONLINE',
      isDefault: false,
      isEnabled: true,
      routingPriority: 1,
    },
  });

  console.log(`Printers configured: ${printer1.name} and ${printer2.name}`);

  // 4. Seed Pricing Rules
  const pricingRules = [
    { category: 'PRINT_BW', itemKey: 'A4_BW', unitPrice: 2.0, description: 'A4 Black & White single side' },
    { category: 'PRINT_BW', itemKey: 'A3_BW', unitPrice: 5.0, description: 'A3 Black & White single side' },
    { category: 'PRINT_BW', itemKey: 'LEGAL_BW', unitPrice: 3.0, description: 'Legal Black & White single side' },
    { category: 'PRINT_COLOR', itemKey: 'A4_COLOR', unitPrice: 10.0, description: 'A4 Full Color single side' },
    { category: 'PRINT_COLOR', itemKey: 'A3_COLOR', unitPrice: 20.0, description: 'A3 Full Color single side' },
    { category: 'PRINT_COLOR', itemKey: 'LEGAL_COLOR', unitPrice: 12.0, description: 'Legal Full Color single side' },
    { category: 'DUPLEX_DISCOUNT', itemKey: 'DOUBLE_SIDED_DISCOUNT', unitPrice: 0.5, description: 'Discount per double-sided sheet' },
  ];

  for (const rule of pricingRules) {
    await prisma.pricingRule.upsert({
      where: {
        shopId_category_itemKey: {
          shopId: shop.id,
          category: rule.category,
          itemKey: rule.itemKey,
        },
      },
      update: { unitPrice: rule.unitPrice },
      create: {
        shopId: shop.id,
        category: rule.category,
        itemKey: rule.itemKey,
        unitPrice: rule.unitPrice,
        description: rule.description,
        isActive: true,
      },
    });
  }

  // 5. Seed Additional Services
  const services = [
    { serviceKey: 'SPIRAL_BINDING', name: 'Spiral Binding (Plastic Coil)', basePath: 40.0, unitType: 'PER_DOCUMENT' },
    { serviceKey: 'STAPLING', name: 'Corner / Edge Stapling', basePath: 5.0, unitType: 'PER_DOCUMENT' },
    { serviceKey: 'LAMINATION', name: 'Gloss / Matte Lamination', basePath: 20.0, unitType: 'PER_SHEET' },
    { serviceKey: 'SCANNING', name: 'High-Res Document Scanning', basePath: 10.0, unitType: 'PER_PAGE' },
  ];

  for (const svc of services) {
    await prisma.service.upsert({
      where: {
        shopId_serviceKey: {
          shopId: shop.id,
          serviceKey: svc.serviceKey,
        },
      },
      update: { basePrice: svc.basePath },
      create: {
        shopId: shop.id,
        serviceKey: svc.serviceKey,
        name: svc.name,
        basePrice: svc.basePath,
        unitType: svc.unitType,
        isEnabled: true,
      },
    });
  }

  // 6. Seed Windows Print Agent registration
  const agentKeyHash = await bcrypt.hash('pf_agent_secret_win11_2026_key', 10);
  await prisma.printAgent.upsert({
    where: { id: 'agent-shop-win11' },
    update: {},
    create: {
      id: 'agent-shop-win11',
      shopId: shop.id,
      agentName: 'Shop-Win11-Host',
      apiKeyHash: agentKeyHash,
      operatingSystem: 'Windows 11',
      simulationMode: true,
      isOnline: true,
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
