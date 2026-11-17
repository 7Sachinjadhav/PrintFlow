import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { AuditService } from '../services/audit.service.js';

export class AuthController {
  /**
   * Admin Login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ success: false, error: 'Email and password are required' });
        return;
      }

      const admin = await prisma.admin.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: { shop: true },
      });

      if (!admin || !admin.isActive) {
        res.status(401).json({ success: false, error: 'Invalid credentials or inactive account' });
        return;
      }

      const isMatch = await bcrypt.compare(password, admin.passwordHash);
      if (!isMatch) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      const tokenPayload = {
        adminId: admin.id,
        shopId: admin.shopId,
        email: admin.email,
        role: admin.role,
      };

      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken({ adminId: admin.id });

      // Audit log login
      await AuditService.log({
        shopId: admin.shopId,
        adminId: admin.id,
        action: 'ADMIN_LOGIN',
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            shop: {
              id: admin.shop.id,
              name: admin.shop.name,
              slug: admin.shop.slug,
            },
          },
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Refresh Token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ success: false, error: 'Refresh token is required' });
        return;
      }

      const decoded = verifyRefreshToken(refreshToken);
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.adminId },
        include: { shop: true },
      });

      if (!admin || !admin.isActive) {
        res.status(401).json({ success: false, error: 'Invalid or inactive user session' });
        return;
      }

      const newAccessToken = signAccessToken({
        adminId: admin.id,
        shopId: admin.shopId,
        email: admin.email,
        role: admin.role,
      });

      res.json({
        success: true,
        data: { accessToken: newAccessToken },
      });
    } catch (err: any) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }
  }

  /**
   * Get current admin profile
   */
  static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.admin) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const admin = await prisma.admin.findUnique({
        where: { id: req.admin.adminId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              address: true,
              phone: true,
              workingHours: true,
              isOpen: true,
            },
          },
        },
      });

      if (!admin) {
        res.status(404).json({ success: false, error: 'Admin not found' });
        return;
      }

      res.json({ success: true, data: admin });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Logout
   */
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.admin) {
      await AuditService.log({
        shopId: req.admin.shopId,
        adminId: req.admin.adminId,
        action: 'ADMIN_LOGOUT',
        ipAddress: req.ip,
      });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  }
}
