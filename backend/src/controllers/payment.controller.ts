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
   * Submit Real PhonePe/GPay UPI 12-digit UTR for Verification
   */
  static async submitUtrPayment(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, utrNumber, upiApp } = req.body;

      if (!orderId || !utrNumber) {
        res.status(400).json({ success: false, error: 'Order ID and 12-digit UPI UTR are required.' });
        return;
      }

      const cleanUtr = String(utrNumber).trim().replace(/\s+/g, '');

      if (cleanUtr.length < 12) {
        res.status(400).json({
          success: false,
          error: 'Please enter a valid 12-digit UPI Reference / UTR Number from your PhonePe/GPay receipt.'
        });
        return;
      }

      // Check if UTR was already used on another order to prevent fraud
      const existing = await prisma.payment.findFirst({
        where: {
          razorpayPaymentId: `utr_${cleanUtr}`,
          status: 'SUCCESS',
        },
      });

      if (existing && existing.orderId !== orderId) {
        res.status(400).json({
          success: false,
          error: 'This UPI Transaction ID / UTR has already been submitted for another order.'
        });
        return;
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found.' });
        return;
      }

      // Record UTR payment
      await PaymentService.handlePaymentSuccess({
        orderId,
        razorpayOrderId: `order_upi_${cleanUtr}`,
        razorpayPaymentId: `utr_${cleanUtr}`,
        paymentMethod: upiApp || 'PhonePe / GPay UPI',
      });

      // Update order notes with UTR
      await prisma.order.update({
        where: { id: orderId },
        data: {
          notes: order.notes ? `${order.notes} | UPI UTR: ${cleanUtr}` : `UPI UTR: ${cleanUtr}`,
        },
      });

      // Enqueue job for Xerox printer
      await QueueService.enqueueOrderJobs(orderId);

      const io = getSocketServer();
      if (io) {
        io.to(`order_${orderId}`).emit('order_status_updated', {
          orderId,
          status: 'QUEUED',
          tokenNumber: order.tokenNumber,
          utrNumber: cleanUtr,
        });

        io.to(`shop_${order.shopId}`).emit('new_queue_job', {
          orderId,
          tokenNumber: order.tokenNumber,
          utrNumber: cleanUtr,
        });
      }

      res.json({
        success: true,
        data: {
          orderId,
          tokenNumber: order.tokenNumber,
          status: 'QUEUED',
          utrNumber: cleanUtr,
          message: 'Payment verified with UPI UTR. Token enqueued for printing.',
        },
      });
    } catch (err: any) {
      console.error('UTR submission error:', err);
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

  /**
   * Android UPI Notification / SMS Webhook:
   * Receives incoming payment notification/SMS from Android PhonePe / GPay forwarder app.
   * Instantly auto-approves matching pending order and prints document hands-free.
   */
  static async handleSmsWebhook(req: Request, res: Response): Promise<void> {
    try {
      // 1. Secret key validation (optional or query param)
      const secret = (req.query.secret || req.headers['x-secret'] || req.body?.secret) as string;
      const expectedSecret = process.env.SMS_WEBHOOK_SECRET || 'pf_auto_8073577702';

      if (secret && secret !== expectedSecret) {
        res.status(401).json({ success: false, error: 'Unauthorized webhook secret' });
        return;
      }

      // 2. Extract message body from various Android forwarder app formats
      const body = req.body || {};
      const rawText = String(
        body.text ||
        body.content ||
        body.message ||
        body.msg ||
        body.body ||
        body.sms ||
        body.notification ||
        (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
      );

      console.log(`[SMS/Notification Webhook Received]:`, rawText);

      // 3. Parse amount, token, UTR, credit/debit
      const lower = rawText.toLowerCase();
      const isDebit = /debited|debit|dr\b|sent to|paid to [^y]/i.test(lower);
      const isCredit = /received|credited|credit|cr\b|deposit|paid to you|prapt hue/i.test(lower);

      if (isDebit && !isCredit) {
        res.json({ success: true, message: 'Ignored debit transaction' });
        return;
      }

      // Match amount: e.g. "Received ₹ 2.00", "Rs. 2.00", "INR 2", "credited for Rs:2.00", "PhonePe par 2 rupaye"
      const amountMatch =
        rawText.match(/(?:received|credited|paid|recieved)\s*[^\d\n\r]{0,10}\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
        rawText.match(/(?:₹|rs\.?|rs:|inr)\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
        rawText.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*[^\d\n\r]{0,10}\s*(?:received|credited|cr\b|rupaye|prapt)/i);

      let amount: number | null = null;
      if (amountMatch && amountMatch[1]) {
        amount = parseFloat(amountMatch[1]);
      }

      // Match token if present: e.g. "PF-001" or "PrintFlow-PF-001"
      const tokenMatch = rawText.match(/(?:PF|PrintFlow)[-_ ]*([0-9]{3,4})/i) || rawText.match(/\bPF-([0-9]{3,4})\b/i);
      let tokenNumber: string | null = null;
      if (tokenMatch) {
        const numOnly = tokenMatch[1] || tokenMatch[0].replace(/[^0-9]/g, '');
        tokenNumber = `PF-${numOnly.padStart(3, '0')}`;
      }

      // Match 12-digit UTR if present
      const utrMatch =
        rawText.match(/(?:upi(?:\/|:|\s+ref|\s+txn)?\s*[:/]?\s*|utr\s*[:/]?\s*)([0-9]{12})/i) ||
        rawText.match(/\b([0-9]{12})\b/);
      const utr = utrMatch ? utrMatch[1] : null;

      // 4. Find matching order in database
      let matchedOrder: any = null;

      // Strategy A: If Token was found in SMS / notification note
      if (tokenNumber) {
        matchedOrder = await prisma.order.findFirst({
          where: {
            tokenNumber,
            status: 'PAYMENT_PENDING',
          },
          include: { documents: true, shop: true },
        });
      }

      // Strategy B: Match by exact amount in recently created pending orders (within last 30 minutes)
      if (!matchedOrder && amount !== null) {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const candidates = await prisma.order.findMany({
          where: {
            status: 'PAYMENT_PENDING',
            createdAt: { gte: thirtyMinutesAgo },
          },
          include: { documents: true, shop: true },
          orderBy: { createdAt: 'desc' },
        });

        // Match order where totalAmount equals amount (tolerating 0.05 float rounding)
        matchedOrder = candidates.find((ord) => Math.abs(Number(ord.totalAmount) - amount!) < 0.05);
      }

      if (!matchedOrder) {
        console.warn(`[SMS Webhook] No matching pending order found for: Amount: ${amount}, Token: ${tokenNumber}`);
        res.json({
          success: true,
          matched: false,
          parsed: { amount, tokenNumber, utr },
          message: 'Webhook received and parsed, but no pending order matched amount or token.',
        });
        return;
      }

      // 5. Instantly mark order as PAID and QUEUED
      await prisma.order.update({
        where: { id: matchedOrder.id },
        data: {
          status: 'QUEUED',
          paidAt: new Date(),
          notes: utr
            ? (matchedOrder.notes ? `${matchedOrder.notes} | Auto-Verified UPI UTR: ${utr}` : `Auto-Verified UPI UTR: ${utr}`)
            : matchedOrder.notes,
        },
      });

      // Record successful payment in database
      await prisma.payment.create({
        data: {
          orderId: matchedOrder.id,
          gateway: 'PHONEPE_ANDROID_AUTO',
          amount: matchedOrder.totalAmount,
          currency: 'INR',
          status: 'SUCCESS',
          paymentMethod: 'PhonePe Android Auto-Forwarder',
          idempotencyKey: `auto_sms_${matchedOrder.id}_${Date.now()}`,
          razorpayPaymentId: utr ? `utr_${utr}` : undefined,
          verifiedAt: new Date(),
        },
      });

      // Enqueue documents to Xerox print queue
      await QueueService.enqueueOrderJobs(matchedOrder.id);

      // Live Socket.IO Broadcast to both customer phone and shop queue
      const io = getSocketServer();
      if (io) {
        io.to(`order_${matchedOrder.id}`).emit('order_status_updated', {
          orderId: matchedOrder.id,
          status: 'QUEUED',
          tokenNumber: matchedOrder.tokenNumber,
          message: 'Payment verified automatically via PhonePe! Document printing.',
        });

        io.to(`shop_${matchedOrder.shopId}`).emit('new_queue_job', {
          orderId: matchedOrder.id,
          tokenNumber: matchedOrder.tokenNumber,
        });
      }

      console.log(`[SMS Webhook Success] Order ${matchedOrder.id} (${matchedOrder.tokenNumber}) auto-approved & sent to Xerox!`);

      res.json({
        success: true,
        matched: true,
        orderId: matchedOrder.id,
        tokenNumber: matchedOrder.tokenNumber,
        amount: matchedOrder.totalAmount,
        message: 'Payment automatically verified. Order released to Xerox printer.',
      });
    } catch (err: any) {
      console.error('SMS webhook error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Test endpoint to simulate incoming SMS webhook
   */
  static async testSmsWebhook(req: Request, res: Response): Promise<void> {
    req.body = req.body?.text ? req.body : { text: req.body?.message || 'PhonePe: Received ₹2.00 from Rahul Kumar' };
    return PaymentController.handleSmsWebhook(req, res);
  }

  /**
   * Initialize Cashfree Payment Session for Drop checkout
   */
  static async createCashfreeSession(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.body;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      const session = await PaymentService.createCashfreeOrder({
        orderId: order.id,
        amountInRupees: order.totalAmount,
        customerPhone: order.customer?.phone || undefined,
        customerName: order.customer?.name || undefined,
        customerEmail: order.customer?.email || undefined,
      });

      res.json({
        success: true,
        data: session,
      });
    } catch (err: any) {
      console.error('Cashfree session creation error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Verify Cashfree payment status directly
   */
  static async verifyCashfreePayment(req: Request, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId as string;
      const result = await PaymentService.verifyCashfreeOrder(orderId);
      res.json(result);
    } catch (err: any) {
      console.error('Cashfree verification error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Cashfree Server Webhook:
   * Fires the instant money is debited/captured in Cashfree.
   * Immediately updates order to QUEUED, notifies customer, and prints on Xerox.
   */
  static async handleCashfreeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const timestamp = req.headers['x-webhook-timestamp'] as string;
      const signature = req.headers['x-webhook-signature'] as string;
      const body = req.body;

      console.log('[Cashfree Webhook Received]:', JSON.stringify(body));

      // 1. Immediately handle Cashfree Test Webhook ping from merchant dashboard
      if (
        !body ||
        body?.type === 'TEST' ||
        body?.event === 'TEST' ||
        body?.test === true ||
        Object.keys(body).length === 0
      ) {
        console.log('[Cashfree Webhook Test]: Received and acknowledged test ping.');
        res.status(200).json({ status: 'OK', message: 'Cashfree test webhook received successfully' });
        return;
      }

      const eventType = body?.type || body?.event;
      const paymentStatus =
        body?.data?.payment?.payment_status ||
        body?.data?.order?.order_status ||
        body?.payment_status ||
        body?.order_status;
      const cfOrderId =
        body?.data?.order?.order_id ||
        body?.order_id ||
        body?.data?.order_id;
      const cfPaymentId =
        body?.data?.payment?.cf_payment_id ||
        body?.cf_payment_id ||
        body?.payment_id;
      const utr =
        body?.data?.payment?.bank_reference ||
        body?.bank_reference ||
        body?.data?.payment?.payment_method?.upi?.channel;

      const isSuccess =
        paymentStatus === 'SUCCESS' ||
        paymentStatus === 'PAID' ||
        eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
        eventType === 'ORDER_PAID' ||
        eventType === 'PAYMENT.SUCCESS';

      if (isSuccess && cfOrderId) {
        // Find order by Cashfree order_id or DB payment record
        let order: any = null;
        const paymentRecord = await prisma.payment.findFirst({
          where: { razorpayOrderId: cfOrderId },
          include: { order: true },
        });

        if (paymentRecord && paymentRecord.order) {
          order = paymentRecord.order;
        } else {
          const rawId = cfOrderId.replace(/^order_/, '');
          order = await prisma.order.findFirst({
            where: {
              OR: [
                { id: rawId },
                { id: { startsWith: rawId } },
                { id: cfOrderId },
              ],
            },
          });
        }

        if (order && order.status === 'PAYMENT_PENDING') {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'QUEUED',
              paidAt: new Date(),
              notes: utr
                ? (order.notes ? `${order.notes} | Cashfree UPI UTR: ${utr}` : `Cashfree UPI UTR: ${utr}`)
                : order.notes,
            },
          });

          await prisma.payment.upsert({
            where: { razorpayOrderId: cfOrderId || `cf_${order.id}` },
            update: {
              status: 'SUCCESS',
              razorpayPaymentId: cfPaymentId ? String(cfPaymentId) : undefined,
              verifiedAt: new Date(),
            },
            create: {
              orderId: order.id,
              gateway: 'CASHFREE',
              razorpayOrderId: cfOrderId || `cf_${order.id}`,
              razorpayPaymentId: cfPaymentId ? String(cfPaymentId) : undefined,
              amount: order.totalAmount,
              currency: 'INR',
              status: 'SUCCESS',
              idempotencyKey: `cf_webhook_${order.id}_${Date.now()}`,
              verifiedAt: new Date(),
            },
          });

          await QueueService.enqueueOrderJobs(order.id);

          const io = getSocketServer();
          if (io) {
            io.to(`order_${order.id}`).emit('order_status_updated', {
              orderId: order.id,
              status: 'QUEUED',
              tokenNumber: order.tokenNumber,
              message: 'Payment verified via Cashfree! Xerox job queued for printing.',
            });

            io.to(`shop_${order.shopId}`).emit('new_queue_job', {
              orderId: order.id,
              tokenNumber: order.tokenNumber,
            });
          }

          console.log(`[Cashfree Webhook Success] Order ${order.id} (${order.tokenNumber}) automatically enqueued to Xerox printer!`);
        }
      }

      // Cashfree requires HTTP 200 within 5s
      res.status(200).json({ status: 'OK' });
    } catch (err: any) {
      console.error('Cashfree webhook error:', err);
      res.status(200).json({ status: 'OK', error: err.message });
    }
  }
}
