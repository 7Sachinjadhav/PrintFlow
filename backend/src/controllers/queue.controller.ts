import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { QueueService } from '../services/queue.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { AuditService } from '../services/audit.service.js';
import { getSocketServer } from '../sockets/socket.handler.js';

export class QueueController {
  /**
   * Get active live queue items
   */
  static async getQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;

      const jobs = await prisma.printJob.findMany({
        where: {
          order: { shopId },
          status: { in: ['QUEUED', 'LEASED', 'ASSIGNED', 'PRINTING', 'SUBMITTED_TO_PRINTER', 'NEEDS_REVIEW', 'FAILED'] },
        },
        include: {
          order: {
            include: { customer: true },
          },
          document: {
            include: { settings: true },
          },
          printer: true,
          queueItem: true,
        },
        orderBy: [
          { status: 'asc' },
          { queueSequence: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      res.json({
        success: true,
        data: jobs,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get all orders with filtering and pagination
   */
  static async getAllOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;
      const { status, search, limit = '50', page = '1' } = req.query;

      const take = parseInt(limit as string, 10);
      const skip = (parseInt(page as string, 10) - 1) * take;

      const where: any = { shopId };

      if (status && status !== 'ALL') {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { tokenNumber: { contains: search as string } },
          { id: { contains: search as string } },
          { customer: { name: { contains: search as string } } },
          { customer: { phone: { contains: search as string } } },
        ];
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            customer: true,
            documents: { include: { settings: true } },
            payments: true,
            printJobs: { include: { printer: true } },
          },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.order.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          orders,
          total,
          page: parseInt(page as string, 10),
          totalPages: Math.ceil(total / take),
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Retry failed or needs_review job
   */
  static async retryJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const jobId = req.params.jobId as string;

      const job = await prisma.printJob.findUnique({
        where: { id: jobId },
        include: { order: true },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      const updatedJob = await prisma.printJob.update({
        where: { id: jobId },
        data: {
          status: 'QUEUED',
          leaseToken: null,
          leaseExpiresAt: null,
          printerId: null,
          errorCode: null,
          errorMessage: null,
        },
      });

      // Ensure in queue item
      await prisma.printQueueItem.upsert({
        where: { printJobId: jobId },
        update: { isPaused: false },
        create: {
          printJobId: jobId,
          priority: job.order.priority,
        },
      });

      // Update order status back to QUEUED
      await prisma.order.update({
        where: { id: job.orderId },
        data: { status: 'QUEUED' },
      });

      if (req.admin) {
        await AuditService.log({
          shopId: req.admin.shopId,
          adminId: req.admin.adminId,
          orderId: job.orderId,
          action: 'JOB_RETRY',
          details: { jobId },
        });
      }

      const io = getSocketServer();
      if (io) {
        io.to(`order_${job.orderId}`).emit('order_status_updated', {
          orderId: job.orderId,
          status: 'QUEUED',
        });
      }

      res.json({ success: true, data: updatedJob });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Get pending orders awaiting shopkeeper payment approval
   */
  static async getPendingApprovals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;
      const pendingOrders = await prisma.order.findMany({
        where: {
          shopId,
          status: 'PAYMENT_PENDING',
        },
        include: {
          customer: true,
          documents: { include: { settings: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      res.json({ success: true, data: pendingOrders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Shopkeeper 1-Click Approval: Verifies payment and immediately sends to Xerox machine
   */
  static async approveOrderPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId as string;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { documents: true },
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      // Mark order as PAID
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'QUEUED',
          paidAt: new Date(),
        },
      });

      // Record successful payment
      await prisma.payment.create({
        data: {
          orderId,
          gateway: 'PHONEPE_UPI_VERIFIED',
          amount: order.totalAmount,
          currency: 'INR',
          status: 'SUCCESS',
          paymentMethod: 'PhonePe / GPay Verified',
          idempotencyKey: `approve_${orderId}_${Date.now()}`,
          verifiedAt: new Date(),
        },
      });

      // Enqueue documents for Xerox machine
      await QueueService.enqueueOrderJobs(orderId);

      if (req.admin) {
        await AuditService.log({
          shopId: req.admin.shopId,
          adminId: req.admin.adminId,
          orderId,
          action: 'PAYMENT_APPROVED_BY_OWNER',
          details: { amount: order.totalAmount, tokenNumber: order.tokenNumber },
        });
      }

      // Live Socket.IO Broadcast to both customer phone and shop queue
      const io = getSocketServer();
      if (io) {
        io.to(`order_${orderId}`).emit('order_status_updated', {
          orderId,
          status: 'QUEUED',
          tokenNumber: order.tokenNumber,
          message: 'Payment approved by shopkeeper! Document queued for printing.',
        });

        io.to(`shop_${order.shopId}`).emit('new_queue_job', {
          orderId,
          tokenNumber: order.tokenNumber,
        });
      }

      res.json({
        success: true,
        data: {
          orderId,
          tokenNumber: order.tokenNumber,
          status: 'QUEUED',
          message: 'Payment approved successfully. Order released to Xerox print queue.',
        },
      });
    } catch (err: any) {
      console.error('Approval error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Shopkeeper 1-Click Reject: Rejects unpaid/fake order with zero loss
   */
  static async rejectOrderPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId as string;

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAYMENT_FAILED' },
      });

      if (req.admin) {
        await AuditService.log({
          shopId: req.admin.shopId,
          adminId: req.admin.adminId,
          orderId,
          action: 'PAYMENT_REJECTED_BY_OWNER',
          details: { reason: 'Payment not received in account' },
        });
      }

      const io = getSocketServer();
      if (io) {
        io.to(`order_${orderId}`).emit('order_status_updated', {
          orderId,
          status: 'PAYMENT_FAILED',
          message: 'Payment not detected in shop account. Please pay at counter.',
        });
      }

      res.json({ success: true, message: 'Order rejected. No print job created.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin manual status update (e.g. READY_FOR_COLLECTION, COLLECTED, CANCELLED)
   */
  static async updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId as string;
      const { status } = req.body;

      const updateData: any = { status };
      if (status === 'READY_FOR_COLLECTION') {
        updateData.completedAt = new Date();
      } else if (status === 'COLLECTED') {
        updateData.collectedAt = new Date();
      }

      const order = await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      if (req.admin) {
        await AuditService.log({
          shopId: req.admin.shopId,
          adminId: req.admin.adminId,
          orderId,
          action: 'ORDER_STATUS_CHANGED',
          details: { newStatus: status },
        });
      }

      const io = getSocketServer();
      if (io) {
        io.to(`order_${orderId}`).emit('order_status_updated', {
          orderId,
          status,
        });
      }

      res.json({ success: true, data: order });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
