import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { AuditService } from '../services/audit.service.js';

export class ShopController {
  /**
   * Public shop info for customer app
   */
  static async getPublicShopInfo(req: Request, res: Response): Promise<void> {
    try {
      const shop = await prisma.shop.findFirst({
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          address: true,
          phone: true,
          email: true,
          workingHours: true,
          isOpen: true,
          maxUploadSizeBytes: true,
          maxPageCount: true,
          supportedFormats: true,
        },
      });

      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not configured' });
        return;
      }

      res.json({ success: true, data: shop });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: Update shop profile & settings
   */
  static async updateShop(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, logoUrl, address, phone, email, workingHours, isOpen, maxUploadSizeBytes, retentionDays } = req.body;

      const shop = await prisma.shop.update({
        where: { id: shopId },
        data: {
          name: name !== undefined ? name : undefined,
          logoUrl: logoUrl !== undefined ? logoUrl : undefined,
          address: address !== undefined ? address : undefined,
          phone: phone !== undefined ? phone : undefined,
          email: email !== undefined ? email : undefined,
          workingHours: workingHours !== undefined ? workingHours : undefined,
          isOpen: isOpen !== undefined ? Boolean(isOpen) : undefined,
          maxUploadSizeBytes: maxUploadSizeBytes !== undefined ? parseInt(maxUploadSizeBytes, 10) : undefined,
          retentionDays: retentionDays !== undefined ? parseInt(retentionDays, 10) : undefined,
        },
      });

      await AuditService.log({
        shopId,
        adminId: req.admin?.adminId,
        action: 'SHOP_SETTINGS_UPDATED',
        details: { name: shop.name, isOpen: shop.isOpen },
      });

      res.json({ success: true, data: shop });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
