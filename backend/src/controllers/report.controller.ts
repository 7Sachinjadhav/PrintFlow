import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class ReportController {
  /**
   * Summary overview metrics for admin dashboard
   */
  static async getSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;
      const todayStr = new Date().toISOString().split('T')[0];

      const [
        todayOrdersCount,
        todayRevenueAgg,
        pendingOrdersCount,
        printingOrdersCount,
        completedOrdersCount,
        failedOrdersCount,
        printersOnlineCount,
        totalPrintersCount,
        recentOrders,
      ] = await Promise.all([
        prisma.order.count({
          where: { shopId, tokenDate: todayStr },
        }),
        prisma.order.aggregate({
          where: { shopId, tokenDate: todayStr, status: { notIn: ['PAYMENT_PENDING', 'PAYMENT_FAILED', 'CANCELLED'] } },
          _sum: { totalAmount: true },
        }),
        prisma.order.count({
          where: { shopId, status: { in: ['PAID', 'QUEUED'] } },
        }),
        prisma.order.count({
          where: { shopId, status: { in: ['ASSIGNED', 'PRINTING'] } },
        }),
        prisma.order.count({
          where: { shopId, status: { in: ['PRINTED', 'READY_FOR_COLLECTION', 'COLLECTED'] } },
        }),
        prisma.order.count({
          where: { shopId, status: { in: ['PRINT_FAILED', 'PAYMENT_FAILED', 'REFUNDED'] } },
        }),
        prisma.printer.count({
          where: { shopId, isEnabled: true, status: { in: ['ONLINE', 'BUSY'] } },
        }),
        prisma.printer.count({
          where: { shopId, isEnabled: true },
        }),
        prisma.order.findMany({
          where: { shopId },
          include: { customer: true, documents: true },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
      ]);

      res.json({
        success: true,
        data: {
          todayOrders: todayOrdersCount,
          todayRevenue: todayRevenueAgg._sum.totalAmount || 0,
          pendingOrders: pendingOrdersCount,
          printingOrders: printingOrdersCount,
          completedOrders: completedOrdersCount,
          failedOrders: failedOrdersCount,
          printersOnline: printersOnlineCount,
          totalPrinters: totalPrintersCount,
          recentOrders,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Export orders report as CSV
   */
  static async exportOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;
      const orders = await prisma.order.findMany({
        where: { shopId },
        include: { customer: true, documents: { include: { settings: true } } },
        orderBy: { createdAt: 'desc' },
      });

      let csv = 'Token,Date,Customer,Total Amount,Status,Docs Count,Created At\n';

      for (const o of orders) {
        const custName = o.customer?.name || 'Walk-in';
        const docCount = o.documents.length;
        const line = `"${o.tokenNumber}","${o.tokenDate}","${custName}",${o.totalAmount},"${o.status}",${docCount},"${o.createdAt.toISOString()}"\n`;
        csv += line;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=printflow-orders-${Date.now()}.csv`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
