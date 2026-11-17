import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma.js';
import { ColorMode, PaperSize } from '../types/index.js';

export class QueueService {
  /**
   * Enqueues all documents of a paid order into the print_queue
   */
  static async enqueueOrderJobs(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        documents: {
          include: { settings: true },
        },
      },
    });

    if (!order) throw new Error(`Order ${orderId} not found`);

    const createdJobs = [];

    for (let i = 0; i < order.documents.length; i++) {
      const doc = order.documents[i];
      const idempotencyKey = `job_${orderId}_doc_${doc.id}`;

      // Check if job already exists
      let printJob = await prisma.printJob.findUnique({
        where: { idempotencyKey },
      });

      if (!printJob) {
        printJob = await prisma.printJob.create({
          data: {
            orderId,
            documentId: doc.id,
            queueSequence: i + 1,
            status: 'QUEUED',
            idempotencyKey,
          },
        });

        // Add to print_queue table
        await prisma.printQueueItem.create({
          data: {
            printJobId: printJob.id,
            priority: order.priority,
          },
        });
      }

      createdJobs.push(printJob);
    }

    // Update order status to QUEUED
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'QUEUED' },
    });

    return createdJobs;
  }

  /**
   * Finds the best compatible online printer for a job
   */
  static async findCompatiblePrinter(
    shopId: string,
    colorMode: string,
    paperSize: string
  ) {
    const printers = await prisma.printer.findMany({
      where: {
        shopId,
        isEnabled: true,
        status: { in: ['ONLINE', 'IDLE'] },
      },
      orderBy: {
        routingPriority: 'desc',
      },
    });

    for (const printer of printers) {
      // Check color capability
      const cap = printer.assignedCapability; // BW, COLOR, BOTH
      if (colorMode === 'COLOR' && cap === 'BW') {
        continue;
      }

      // Check paper size capability
      const supportedSizes = printer.supportedPaperSizes.split(',').map((s) => s.trim().toUpperCase());
      if (!supportedSizes.includes(paperSize.toUpperCase())) {
        continue;
      }

      // Check if printer currently has an active job
      const activeJob = await prisma.printJob.findFirst({
        where: {
          printerId: printer.id,
          status: { in: ['ASSIGNED', 'PRINTING', 'LEASED'] },
        },
      });

      if (!activeJob) {
        return printer;
      }
    }

    return null;
  }

  /**
   * Atomically claims the next compatible job for a print agent or printer
   */
  static async claimNextJob(shopId: string, specificPrinterId?: string) {
    const leaseDurationMs = 2 * 60 * 1000; // 2 minutes
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    const leaseToken = uuidv4();

    // 1. Recover expired leases back to QUEUED
    await prisma.printJob.updateMany({
      where: {
        status: 'LEASED',
        leaseExpiresAt: { lt: now },
      },
      data: {
        status: 'QUEUED',
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });

    // 2. Fetch candidates from FIFO queue
    const queuedItems = await prisma.printQueueItem.findMany({
      where: {
        isPaused: false,
        printJob: {
          status: 'QUEUED',
          order: { shopId },
        },
      },
      include: {
        printJob: {
          include: {
            order: true,
            document: { include: { settings: true } },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { enqueuedAt: 'asc' },
      ],
      take: 20,
    });

    for (const item of queuedItems) {
      const job = item.printJob;
      const settings = job.document.settings;
      const colorMode = settings?.colorMode || 'BW';
      const paperSize = settings?.paperSize || 'A4';

      let printer = null;

      if (specificPrinterId) {
        printer = await prisma.printer.findFirst({
          where: {
            id: specificPrinterId,
            shopId,
            isEnabled: true,
          },
        });
      } else {
        printer = await this.findCompatiblePrinter(shopId, colorMode, paperSize);
      }

      if (!printer) {
        // No free compatible printer right now, keep in queue
        continue;
      }

      // Attempt atomic lease lock
      try {
        const claimedJob = await prisma.printJob.update({
          where: {
            id: job.id,
            status: 'QUEUED', // Concurrency guard
          },
          data: {
            status: 'LEASED',
            printerId: printer.id,
            leaseToken,
            leaseExpiresAt,
            attemptCount: { increment: 1 },
            startedAt: now,
          },
          include: {
            order: true,
            document: { include: { settings: true } },
            printer: true,
          },
        });

        // Update printer status
        await prisma.printer.update({
          where: { id: printer.id },
          data: { status: 'BUSY', currentJobId: claimedJob.id },
        });

        // Update overall order status to ASSIGNED or PRINTING
        await prisma.order.update({
          where: { id: claimedJob.orderId },
          data: { status: 'PRINTING' },
        });

        return { job: claimedJob, leaseToken };
      } catch (concurrencyErr) {
        // Race condition: Another worker claimed this job, try next
        continue;
      }
    }

    return null;
  }

  /**
   * Updates job status from agent or admin
   */
  static async updateJobStatus(params: {
    jobId: string;
    status: 'PRINTING' | 'PRINTED' | 'SUBMITTED_TO_PRINTER' | 'NEEDS_REVIEW' | 'FAILED' | 'CANCELLED';
    leaseToken?: string;
    spoolerJobId?: number;
    errorCode?: string;
    errorMessage?: string;
  }) {
    const { jobId, status, spoolerJobId, errorCode, errorMessage } = params;

    const job = await prisma.printJob.findUnique({
      where: { id: jobId },
      include: { order: true, printer: true },
    });

    if (!job) throw new Error(`Print job ${jobId} not found`);

    const updateData: any = {
      status,
      spoolerJobId: spoolerJobId !== undefined ? spoolerJobId : job.spoolerJobId,
      errorCode: errorCode || null,
      errorMessage: errorMessage || null,
    };

    if (['PRINTED', 'SUBMITTED_TO_PRINTER'].includes(status)) {
      updateData.completedAt = new Date();
      updateData.leaseToken = null;
      updateData.leaseExpiresAt = null;
    }

    const updatedJob = await prisma.printJob.update({
      where: { id: jobId },
      data: updateData,
      include: { order: true },
    });

    // If job finished, free up the printer
    if (job.printerId && ['PRINTED', 'SUBMITTED_TO_PRINTER', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW'].includes(status)) {
      await prisma.printer.update({
        where: { id: job.printerId },
        data: {
          status: 'ONLINE',
          currentJobId: null,
          errorMessage: status === 'FAILED' ? errorMessage : null,
        },
      });

      // Remove from active queue table
      await prisma.printQueueItem.deleteMany({
        where: { printJobId: jobId },
      });
    }

    // Check if all jobs in this order are completed
    const remainingJobs = await prisma.printJob.count({
      where: {
        orderId: job.orderId,
        status: { in: ['QUEUED', 'LEASED', 'ASSIGNED', 'PRINTING'] },
      },
    });

    if (remainingJobs === 0) {
      const anyFailed = await prisma.printJob.count({
        where: {
          orderId: job.orderId,
          status: { in: ['FAILED', 'NEEDS_REVIEW'] },
        },
      });

      const finalStatus = anyFailed > 0 ? 'PRINT_FAILED' : 'READY_FOR_COLLECTION';

      await prisma.order.update({
        where: { id: job.orderId },
        data: {
          status: finalStatus,
          completedAt: new Date(),
        },
      });
    }

    return updatedJob;
  }
}
