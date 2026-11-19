import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { PricingService } from '../services/pricing.service.js';
import { TokenService } from './../services/token.service.js';
import { PaymentService } from '../services/payment.service.js';
import { getSocketServer } from '../sockets/socket.handler.js';

export class OrderController {
  /**
   * Create an order with uploaded documents and print settings
   */
  static async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const { customer, items, notes } = req.body;

      const shop = await prisma.shop.findFirst();
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'Order must contain at least one document' });
        return;
      }

      // 1. Calculate final price from backend pricing engine
      const priceCalculation = await PricingService.calculateOrderPrice(shop.id, items);

      // 2. Generate daily sequential token (e.g. PF-001)
      const { tokenNumber, tokenDate } = await TokenService.generateDailyToken(shop.id);

      // 3. Create or find customer if details provided
      let customerRecord = null;
      if (customer && (customer.phone || customer.email || customer.name)) {
        customerRecord = await prisma.customer.create({
          data: {
            phone: customer.phone || null,
            email: customer.email || null,
            name: customer.name || 'Guest Customer',
          },
        });
      }

      // 4. Save Order and Documents in database transaction
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            shopId: shop.id,
            customerId: customerRecord?.id,
            tokenNumber,
            tokenDate,
            status: 'PAYMENT_PENDING',
            totalAmount: priceCalculation.totalAmount,
            taxAmount: priceCalculation.taxAmount,
            discountAmount: priceCalculation.discountAmount,
            notes: notes || null,
          },
        });

        // Insert documents and settings
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const calculatedItem = priceCalculation.items[i];

          const doc = await tx.document.create({
            data: {
              orderId: newOrder.id,
              originalFilename: item.originalFilename,
              storedFilename: item.storedFilename,
              filePath: `./storage/${item.storedFilename}`,
              fileSizeBytes: item.fileSizeBytes || 0,
              mimeType: item.mimeType || 'application/pdf',
              pageCount: item.pageCount || 1,
            },
          });

          await tx.printSetting.create({
            data: {
              documentId: doc.id,
              colorMode: item.setting.colorMode || 'BW',
              paperSize: item.setting.paperSize || 'A4',
              duplexMode: item.setting.duplexMode || 'SINGLE',
              orientation: item.setting.orientation || 'PORTRAIT',
              copies: item.setting.copies || 1,
              pageRangeType: item.setting.pageRangeType || 'ALL',
              customRange: item.setting.customRange || null,
              billablePages: calculatedItem.billablePages,
              bindingService: item.setting.bindingService || 'NONE',
              laminationService: item.setting.laminationService || false,
              calculatedPrice: calculatedItem.documentTotal,
            },
          });
        }

        return newOrder;
      });

      // 5. Initialize payment intent
      const paymentIntent = await PaymentService.createPaymentOrder(order.id, priceCalculation.totalAmount);

      // Broadcast new pending payment order to shopkeeper dashboard in real-time
      const io = getSocketServer();
      if (io) {
        io.to(`shop_${shop.id}`).emit('new_pending_payment', {
          orderId: order.id,
          tokenNumber: order.tokenNumber,
          totalAmount: order.totalAmount,
          customerName: customer?.name || 'Customer',
        });
      }

      res.status(201).json({
        success: true,
        data: {
          orderId: order.id,
          tokenNumber: order.tokenNumber,
          totalAmount: order.totalAmount,
          currency: 'INR',
          status: order.status,
          pricing: priceCalculation,
          payment: paymentIntent,
        },
      });
    } catch (err: any) {
      console.error('Order creation error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get complete order details by ID
   */
  static async getOrder(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          documents: {
            include: { settings: true },
          },
          payments: true,
          printJobs: {
            include: { printer: true },
          },
          shop: {
            select: { name: true, phone: true, address: true },
          },
        },
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      // Calculate queue position if in queue
      let queuePosition: number | null = null;
      if (['QUEUED', 'ASSIGNED', 'PRINTING'].includes(order.status)) {
        queuePosition = await prisma.order.count({
          where: {
            shopId: order.shopId,
            status: { in: ['QUEUED', 'ASSIGNED', 'PRINTING'] },
            createdAt: { lt: order.createdAt },
          },
        }) + 1;
      }

      res.json({
        success: true,
        data: {
          ...order,
          queuePosition,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get status only (for polling/fast tracker)
   */
  static async getOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const order = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          tokenNumber: true,
          status: true,
          paidAt: true,
          completedAt: true,
          collectedAt: true,
          shopId: true,
          createdAt: true,
        },
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      let queuePosition: number | null = null;
      if (['QUEUED', 'ASSIGNED', 'PRINTING'].includes(order.status)) {
        queuePosition = await prisma.order.count({
          where: {
            shopId: order.shopId,
            status: { in: ['QUEUED', 'ASSIGNED', 'PRINTING'] },
            createdAt: { lt: order.createdAt },
          },
        }) + 1;
      }

      res.json({
        success: true,
        data: {
          ...order,
          queuePosition,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Search and track order by token number or ID
   */
  static async trackByTokenOrId(req: Request, res: Response): Promise<void> {
    try {
      const tokenOrId = req.params.tokenOrId as string;
      const term = tokenOrId.trim();

      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: term },
            { tokenNumber: { equals: term } },
            { tokenNumber: { equals: term.toUpperCase() } },
          ],
        },
        include: {
          documents: {
            include: { settings: true },
          },
          shop: {
            select: { name: true, phone: true, address: true },
          },
        },
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'No order found with this Token or ID' });
        return;
      }

      let queuePosition: number | null = null;
      if (['QUEUED', 'ASSIGNED', 'PRINTING'].includes(order.status)) {
        queuePosition = await prisma.order.count({
          where: {
            shopId: order.shopId,
            status: { in: ['QUEUED', 'ASSIGNED', 'PRINTING'] },
            createdAt: { lt: order.createdAt },
          },
        }) + 1;
      }

      res.json({
        success: true,
        data: {
          ...order,
          queuePosition,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
