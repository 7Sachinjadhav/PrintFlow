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
