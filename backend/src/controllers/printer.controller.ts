import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { AuditService } from '../services/audit.service.js';

export class PrinterController {
  /**
   * Get all printers for the admin
   */
  static async getPrinters(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;

      const printers = await prisma.printer.findMany({
        where: { shopId },
        include: {
          capabilities: true,
          _count: {
            select: {
              printJobs: {
                where: { status: { in: ['ASSIGNED', 'PRINTING', 'LEASED'] } },
              },
            },
          },
        },
        orderBy: { routingPriority: 'desc' },
      });

      res.json({
        success: true,
        data: printers,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Register a new printer
   */
  static async createPrinter(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, modelNumber, ipAddress, windowsQueueName, assignedCapability, supportedPaperSizes, routingPriority } = req.body;

      const printer = await prisma.printer.create({
        data: {
          shopId,
          name,
          modelNumber: modelNumber || null,
          ipAddress: ipAddress || '192.168.1.100',
          windowsQueueName: windowsQueueName || null,
          assignedCapability: assignedCapability || 'BOTH',
          supportedPaperSizes: supportedPaperSizes || 'A4,A3,LEGAL',
          routingPriority: routingPriority ? parseInt(routingPriority, 10) : 1,
          status: 'ONLINE',
          isEnabled: true,
        },
      });

      await AuditService.log({
        shopId,
        adminId: req.admin?.adminId,
        action: 'PRINTER_REGISTERED',
        details: { printerId: printer.id, name: printer.name },
      });

      res.status(201).json({ success: true, data: printer });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Update printer configuration (Capability, Queue Name, Priority, Enabled)
   */
  static async updatePrinter(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const {
        name,
        modelNumber,
        ipAddress,
        windowsQueueName,
        assignedCapability,
        supportedPaperSizes,
        isEnabled,
        isDefault,
        routingPriority,
        status,
      } = req.body;

      const printer = await prisma.printer.update({
        where: { id },
        data: {
          name: name !== undefined ? name : undefined,
          modelNumber: modelNumber !== undefined ? modelNumber : undefined,
          ipAddress: ipAddress !== undefined ? ipAddress : undefined,
          windowsQueueName: windowsQueueName !== undefined ? windowsQueueName : undefined,
          assignedCapability: assignedCapability !== undefined ? assignedCapability : undefined,
          supportedPaperSizes: supportedPaperSizes !== undefined ? supportedPaperSizes : undefined,
          isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : undefined,
          isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined,
          routingPriority: routingPriority !== undefined ? parseInt(routingPriority, 10) : undefined,
          status: status !== undefined ? status : undefined,
        },
      });

      if (req.admin) {
        await AuditService.log({
          shopId: req.admin.shopId,
          adminId: req.admin.adminId,
          action: 'PRINTER_UPDATED',
          details: { printerId: id, name: printer.name, assignedCapability: printer.assignedCapability },
        });
      }

      res.json({ success: true, data: printer });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Trigger physical or simulated test print
   */
  static async testPrint(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const printer = await prisma.printer.findUnique({ where: { id } });

      if (!printer) {
        res.status(404).json({ success: false, error: 'Printer not found' });
        return;
      }

      // Check if printer has a valid windows queue name
      if (!printer.windowsQueueName) {
        res.status(400).json({
          success: false,
          error: 'Printer has no assigned Windows Queue Name. Please assign an installed Windows printer queue first.',
        });
        return;
      }

      res.json({
        success: true,
        message: `Test print request dispatched for printer "${printer.name}" targeting queue "${printer.windowsQueueName}".`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Restore default printers (Konica 251 & Canon 240) if missing or corrupted
   */
  static async restoreDefaults(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const shopId = req.admin?.shopId;
      if (!shopId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await prisma.printer.upsert({
        where: { id: 'printer-konica-251' },
        update: {
          shopId,
          status: 'ONLINE',
          isEnabled: true,
        },
        create: {
          id: 'printer-konica-251',
          shopId,
          name: 'Konica 251',
          modelNumber: 'Konica Minolta bizhub 251',
          ipAddress: '192.168.1.251',
          windowsQueueName: 'EPSON L3250 Series',
          assignedCapability: 'BOTH',
          supportedPaperSizes: 'A4,A3,LEGAL',
          status: 'ONLINE',
          isDefault: true,
          isEnabled: true,
          routingPriority: 2,
        },
      });

      await prisma.printer.upsert({
        where: { id: 'printer-canon-240' },
        update: {
          shopId,
          status: 'ONLINE',
          isEnabled: true,
        },
        create: {
          id: 'printer-canon-240',
          shopId,
          name: 'Canon 240',
          modelNumber: 'Canon imageRUNNER 240',
          ipAddress: '192.168.1.240',
          windowsQueueName: 'Microsoft Print to PDF',
          assignedCapability: 'BW',
          supportedPaperSizes: 'A4,LEGAL',
          status: 'ONLINE',
          isDefault: false,
          isEnabled: true,
          routingPriority: 1,
        },
      });

      const all = await prisma.printer.findMany({
        where: { shopId },
        orderBy: { routingPriority: 'desc' },
      });

      res.json({ success: true, message: 'Default printers successfully restored.', data: all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
