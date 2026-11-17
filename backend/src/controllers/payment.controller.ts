import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { QueueService } from '../services/queue.service.js';
import { getSocketServer } from '../sockets/socket.handler.js';
import prisma from '../utils/prisma.js';

export class PaymentController {
  /**
   * Verify Razorpay Client Payment and Enqueue Order
   */
  static async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentMethod } = req.body;

      if (!orderId || !razorpayOrderId || !razorpayPaymentId) {
        res.status(400).json({ success: false, error: 'Missing required payment verification parameters' });
        return;
      }

      // 1. Verify cryptographic signature
      const isValid = PaymentService.verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature || ''
      );

      if (!isValid) {
        // Mark payment failed
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'PAYMENT_FAILED' },
        });

        res.status(400).json({ success: false, error: 'Invalid payment signature. Verification failed.' });
        return;
      }

      // 2. Mark order as PAID idempotently
      const paidOrder = await PaymentService.handlePaymentSuccess({
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        paymentMethod: paymentMethod || 'UPI',
      });

      // 3. Enqueue order print jobs into database FIFO queue
      await QueueService.enqueueOrderJobs(orderId);

      // 4. Broadcast live Socket.IO update
      const io = getSocketServer();
      if (io) {
        io.to(`order_${orderId}`).emit('order_status_updated', {
          orderId,
          status: 'QUEUED',
          tokenNumber: paidOrder.tokenNumber,
        });

        io.to(`shop_${paidOrder.shopId}`).emit('new_queue_job', {
          orderId,
          tokenNumber: paidOrder.tokenNumber,
        });
      }

      res.json({
        success: true,
        data: {
          orderId,
          tokenNumber: paidOrder.tokenNumber,
          status: 'QUEUED',
          message: 'Payment verified successfully. Order enqueued for printing.',
        },
      });
    } catch (err: any) {
      console.error('Payment verification error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Simulate Test Mode Payment (for local development & end-to-end tests)
   */
  static async simulateTestPayment(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, paymentMethod } = req.body;

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      const simPaymentId = `pay_sim_${Date.now()}`;
      const simOrderId = `order_sim_${orderId.substring(0, 8)}`;
      const simSignature = `sim_sig_${Date.now()}`;

      await PaymentService.handlePaymentSuccess({
        orderId,
        razorpayOrderId: simOrderId,
        razorpayPaymentId: simPaymentId,
        razorpaySignature: simSignature,
        paymentMethod: paymentMethod || 'UPI (Test Sandbox)',
      });

      await QueueService.enqueueOrderJobs(orderId);

      const io = getSocketServer();
      if (io) {
        io.to(`order_${orderId}`).emit('order_status_updated', {
          orderId,
          status: 'QUEUED',
          tokenNumber: order.tokenNumber,
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
          message: 'Test payment processed and order enqueued.',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Webhook Endpoint for Razorpay Server-to-Server callbacks
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = JSON.stringify(req.body);

      if (signature && !PaymentService.verifyWebhookSignature(rawBody, signature)) {
        res.status(400).send('Invalid webhook signature');
        return;
      }

      const event = req.body.event;
      const payload = req.body.payload;

      if (event === 'payment.captured') {
        const paymentEntity = payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;
        const razorpayPaymentId = paymentEntity.id;

        const paymentRecord = await prisma.payment.findUnique({
          where: { razorpayOrderId },
        });

        if (paymentRecord && paymentRecord.status !== 'SUCCESS') {
          await PaymentService.handlePaymentSuccess({
            orderId: paymentRecord.orderId,
            razorpayOrderId,
            razorpayPaymentId,
            paymentMethod: paymentEntity.method,
            rawPayload: rawBody,
          });

          await QueueService.enqueueOrderJobs(paymentRecord.orderId);
        }
      }

      res.json({ status: 'ok' });
    } catch (err: any) {
      console.error('Webhook error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
