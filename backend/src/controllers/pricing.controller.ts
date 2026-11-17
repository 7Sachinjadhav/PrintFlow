import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { PricingService } from '../services/pricing.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { AuditService } from '../services/audit.service.js';

export class PricingController {
  /**
   * Public pricing rules and services for shop
   */
  static async getPricing(req: Request, res: Response): Promise<void> {
    try {
      const shop = await prisma.shop.findFirst();
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      const [rules, services] = await Promise.all([
        prisma.pricingRule.findMany({
          where: { shopId: shop.id, isActive: true },
          select: { category: true, itemKey: true, unitPrice: true, description: true },
        }),
        prisma.service.findMany({
          where: { shopId: shop.id, isEnabled: true },
          select: { serviceKey: true, name: true, basePrice: true, unitType: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          rules,
          services,
          currency: 'INR',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Calculate price preview
   */
  static async calculate(req: Request, res: Response): Promise<void> {
    try {
      const { items } = req.body;
      const shop = await prisma.shop.findFirst();
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'Items array is required' });
        return;
      }

      const calculation = await PricingService.calculateOrderPrice(shop.id, items);

      res.json({
        success: true,
        data: calculation,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: Get all pricing settings
   */
  static async getAdminPricing(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;
      const [rules, services] = await Promise.all([
        prisma.pricingRule.findMany({ where: { shopId } }),
        prisma.service.findMany({ where: { shopId } }),
      ]);

      res.json({
        success: true,
        data: { rules, services },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: Update pricing rule
   */
  static async updateRule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { unitPrice, isActive, description } = req.body;

      const rule = await prisma.pricingRule.update({
        where: { id },
        data: {
          unitPrice: unitPrice !== undefined ? parseFloat(unitPrice) : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          description: description !== undefined ? description : undefined,
          updatedByAdminId: req.admin?.adminId,
        },
      });

      if (req.admin) {
        await AuditService.log({
          shopId: req.admin.shopId,
          adminId: req.admin.adminId,
          action: 'PRICING_UPDATED',
          details: { ruleId: id, unitPrice, itemKey: rule.itemKey },
        });
      }

      res.json({ success: true, data: rule });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: Update service
   */
  static async updateService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { basePrice, isEnabled, name } = req.body;

      const service = await prisma.service.update({
        where: { id },
        data: {
          basePrice: basePrice !== undefined ? parseFloat(basePrice) : undefined,
          isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : undefined,
          name: name !== undefined ? name : undefined,
        },
      });

      if (req.admin) {
        await AuditService.log({
          shopId: req.admin.shopId,
          adminId: req.admin.adminId,
          action: 'SERVICE_UPDATED',
          details: { serviceId: id, basePrice, isEnabled },
        });
      }

      res.json({ success: true, data: service });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
