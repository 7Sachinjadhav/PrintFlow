import prisma from '../utils/prisma.js';

export class AuditService {
  static async log(params: {
    shopId: string;
    action: string;
    adminId?: string;
    orderId?: string;
    details?: any;
    ipAddress?: string;
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          shopId: params.shopId,
          action: params.action,
          adminId: params.adminId || null,
          orderId: params.orderId || null,
          details: params.details ? JSON.stringify(params.details) : null,
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (e) {
      console.error('Failed to write audit log:', e);
    }
  }
}
