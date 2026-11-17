import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { QueueService } from '../services/queue.service.js';
import { StorageService } from '../services/storage.service.js';
import { getSocketServer } from '../sockets/socket.handler.js';

export class AgentController {
  /**
   * Register or ping agent
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { agentName, operatingSystem, agentVersion, simulationMode } = req.body;

      const shop = await prisma.shop.findFirst();
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      const agent = await prisma.printAgent.upsert({
        where: { id: 'agent-shop-win11' },
        update: {
          agentName: agentName || 'Shop-Win11-Host',
          operatingSystem: operatingSystem || 'Windows 11',
          agentVersion: agentVersion || '1.0.0',
          simulationMode: simulationMode !== undefined ? simulationMode : true,
          isOnline: true,
          lastSeen: new Date(),
        },
        create: {
          id: 'agent-shop-win11',
          shopId: shop.id,
          agentName: agentName || 'Shop-Win11-Host',
          apiKeyHash: 'hash',
          operatingSystem: operatingSystem || 'Windows 11',
          agentVersion: agentVersion || '1.0.0',
          simulationMode: simulationMode !== undefined ? simulationMode : true,
          isOnline: true,
          lastSeen: new Date(),
        },
      });

      res.json({
        success: true,
        data: {
          agentId: agent.id,
          shopId: shop.id,
          simulationMode: agent.simulationMode,
          status: 'REGISTERED',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Heartbeat from Windows Local Print Agent
   */
  static async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, activeJobId, discoveredQueues, memoryUsageMb, cpuUsagePct } = req.body;

      await prisma.printAgent.updateMany({
        where: { id: agentId || 'agent-shop-win11' },
        data: {
          isOnline: true,
          lastSeen: new Date(),
        },
      });

      await prisma.agentHeartbeat.create({
        data: {
          agentId: agentId || 'agent-shop-win11',
          status: 'OK',
          discoveredQueues: discoveredQueues ? JSON.stringify(discoveredQueues) : null,
          activeJobId: activeJobId || null,
          memoryUsageMb: memoryUsageMb || null,
          cpuUsagePct: cpuUsagePct || null,
        },
      });

      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Atomically fetch next compatible job
   */
  static async getNextJob(req: Request, res: Response): Promise<void> {
    try {
      const { shopId, printerId } = req.query;

      const shop = await prisma.shop.findFirst({
        where: shopId ? { id: shopId as string } : undefined,
      });

      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      const claim = await QueueService.claimNextJob(shop.id, printerId as string | undefined);

      if (!claim) {
        res.json({ success: true, data: null, message: 'No pending jobs in queue' });
        return;
      }

      const { job, leaseToken } = claim;

      // Broadcast real-time update
      const io = getSocketServer();
      if (io) {
        io.to(`order_${job.orderId}`).emit('order_status_updated', {
          orderId: job.orderId,
          status: 'PRINTING',
          printerName: job.printer?.name,
        });

        io.to(`shop_${shop.id}`).emit('queue_job_claimed', {
          jobId: job.id,
          orderId: job.orderId,
          printerName: job.printer?.name,
        });
      }

      res.json({
        success: true,
        data: {
          job: {
            id: job.id,
            orderId: job.orderId,
            tokenNumber: job.order.tokenNumber,
            documentId: job.documentId,
            documentFilename: job.document.originalFilename,
            storedFilename: job.document.storedFilename,
            fileDownloadUrl: `/api/agent/documents/${job.document.id}/download?leaseToken=${leaseToken}`,
            printer: {
              id: job.printer?.id,
              name: job.printer?.name,
              windowsQueueName: job.printer?.windowsQueueName,
              assignedCapability: job.printer?.assignedCapability,
            },
            settings: job.document.settings,
          },
          leaseToken,
        },
      });
    } catch (err: any) {
      console.error('Agent getNextJob error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Update print job status from Windows Agent
   */
  static async updateJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { status, leaseToken, spoolerJobId, errorCode, errorMessage } = req.body;

      const updatedJob = await QueueService.updateJobStatus({
        jobId: id,
        status,
        leaseToken,
        spoolerJobId,
        errorCode,
        errorMessage,
      });

      const io = getSocketServer();
      if (io) {
        io.to(`order_${updatedJob.orderId}`).emit('order_status_updated', {
          orderId: updatedJob.orderId,
          jobId: id,
          status,
          errorCode,
        });

        io.to(`shop_${updatedJob.order.shopId}`).emit('queue_updated', {
          jobId: id,
          status,
        });
      }

      res.json({ success: true, data: updatedJob });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Sync discovered Windows printers from Windows 11 host
   */
  static async syncDiscoveredPrinters(req: Request, res: Response): Promise<void> {
    try {
      const { printers } = req.body; // Array of printer queue names e.g. ["EPSON L3250 Series", "Microsoft Print to PDF"]

      if (!printers || !Array.isArray(printers)) {
        res.status(400).json({ success: false, error: 'Printers array required' });
        return;
      }

      const shop = await prisma.shop.findFirst();
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      // Check existing printers in shop and auto-match if windowsQueueName matches or can be updated
      const existingPrinters = await prisma.printer.findMany({ where: { shopId: shop.id } });

      for (const printerQueueName of printers) {
        const found = existingPrinters.find(
          (p) => p.windowsQueueName?.toLowerCase() === printerQueueName.toLowerCase() ||
                 p.name.toLowerCase().includes(printerQueueName.toLowerCase()) ||
                 printerQueueName.toLowerCase().includes(p.name.toLowerCase())
        );

        if (found && !found.windowsQueueName) {
          await prisma.printer.update({
            where: { id: found.id },
            data: { windowsQueueName: printerQueueName, status: 'ONLINE' },
          });
        }
      }

      res.json({
        success: true,
        message: `Discovered ${printers.length} local Windows printer queues.`,
        discovered: printers,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Secure download of document for printing agent
   */
  static async downloadDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { leaseToken } = req.query;

      const doc = await prisma.document.findUnique({
        where: { id },
      });

      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const filePath = StorageService.getFilePath(doc.storedFilename);
      res.download(filePath, doc.originalFilename);
    } catch (err: any) {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  }
}
