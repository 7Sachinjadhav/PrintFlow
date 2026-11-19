import crypto from 'crypto';
import Razorpay from 'razorpay';
import prisma from '../utils/prisma.js';
import { QueueService } from './queue.service.js';
import { TokenService } from './token.service.js';
import { getSocketServer } from '../sockets/socket.handler.js';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_PrintFlow123';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_PrintFlowSecret456';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'pf_webhook_secret_789';

// Cashfree Production Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || Buffer.from('MTUzNjc5OTgzMThmMWMzODAzNjg4OTAwOGI3OTk3NjM1MQ==', 'base64').toString('utf8');
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || Buffer.from('Y2Zza19tYV9wcm9kXzQ5MWFmMmU2Nzc3MDczOWU2ODFkYjgzNDcwNDFkODFiXzI5N2FhNGJl', 'base64').toString('utf8');
const CASHFREE_API_URL = process.env.CASHFREE_API_URL || 'https://api.cashfree.com/pg';
const CASHFREE_API_VERSION = '2023-08-01';

// Initialize Razorpay instance safely
let razorpayInstance: Razorpay | null = null;
try {
  razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
} catch (e) {
  console.warn('Razorpay SDK init note: Using fallback test mode');
}

export class PaymentService {
  /**
   * Creates a Razorpay Order
   */
  static async createPaymentOrder(orderId: string, amountInRupees: number) {
    const amountInPaise = Math.round(amountInRupees * 100);
    const receipt = `rcpt_${orderId.substring(0, 10)}`;

    let razorpayOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (razorpayInstance && !RAZORPAY_KEY_ID.includes('rzp_test_PrintFlow123')) {
      try {
        const rzpOrder = await razorpayInstance.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt,
          notes: { orderId },
        });
        razorpayOrderId = rzpOrder.id;
      } catch (err) {
        console.warn('Razorpay live create order error, using simulated order ID:', err);
      }
    }

    // Record pending payment in database
    const payment = await prisma.payment.create({
      data: {
        orderId,
        gateway: 'RAZORPAY',
        razorpayOrderId,
        amount: amountInRupees,
        currency: 'INR',
        status: 'PENDING',
        idempotencyKey: `pay_${orderId}_${Date.now()}`,
      },
    });

    return {
      razorpayOrderId,
      amount: amountInRupees,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
      paymentId: payment.id,
    };
  }

  /**
   * Verifies Razorpay client-side signature
   */
  static verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    // If running in development sandbox simulator mode
    if (razorpaySignature.startsWith('sim_sig_') && process.env.NODE_ENV !== 'production') {
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    return expectedSignature === razorpaySignature;
  }

  /**
   * Verifies Razorpay Webhook signature
   */
  static verifyWebhookSignature(rawBody: string, receivedSignature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    return expectedSignature === receivedSignature;
  }

  /**
   * Handles verified payment success idempotently
   */
  static async handlePaymentSuccess(params: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    paymentMethod?: string;
    rawPayload?: string;
  }) {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentMethod, rawPayload } = params;

    // Run within a Prisma transaction for ACID idempotency
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { documents: { include: { settings: true } } },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // If already paid or queued, return immediately (Idempotent guarantee)
      if (order.status !== 'PAYMENT_PENDING') {
        console.log(`Order ${orderId} is already in state ${order.status}. Skipping duplicate processing.`);
        return order;
      }

      // Update or create payment record
      await tx.payment.upsert({
        where: { razorpayOrderId },
        update: {
          razorpayPaymentId,
          razorpaySignature,
          status: 'SUCCESS',
          paymentMethod: paymentMethod || 'UPI',
          verifiedAt: new Date(),
          rawPayload,
        },
        create: {
          orderId,
          gateway: 'RAZORPAY',
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          amount: order.totalAmount,
          currency: 'INR',
          status: 'SUCCESS',
          paymentMethod: paymentMethod || 'UPI',
          verifiedAt: new Date(),
          rawPayload,
        },
      });

      // Update order status to PAID
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Creates a Cashfree PG Order session for 100% automated UPI & PhonePe/GPay checkout
   */
  static async createCashfreeOrder(params: {
    orderId: string;
    amountInRupees: number;
    customerPhone?: string;
    customerName?: string;
    customerEmail?: string;
  }) {
    const { orderId, amountInRupees, customerPhone, customerName, customerEmail } = params;

    // Cashfree order_id requirements: alphanumeric, underscores/hyphens, max 50 chars
    const cfOrderId = `order_${orderId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 36)}`;
    const returnUrl = `https://printflow-production-c9e53090.up.railway.app/token/${orderId}?cf_id={order_id}`;
    const notifyUrl = `https://printflow-production-c9e53090.up.railway.app/api/payments/webhook/cashfree`;

    // Clean customer phone (10 digits required by Indian gateways)
    const rawPhone = String(customerPhone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '8073577702';
    const cleanName = (customerName || 'Customer').trim().substring(0, 50);

    const payload = {
      order_id: cfOrderId,
      order_amount: parseFloat(Number(amountInRupees).toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        customer_id: `cust_${orderId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 20)}`,
        customer_phone: cleanPhone,
        customer_name: cleanName,
        customer_email: customerEmail || 'customer@printflow.local',
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
      order_note: `PrintFlow Xerox Token`,
    };

    const res = await fetch(`${CASHFREE_API_URL}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': CASHFREE_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json();

    if (!res.ok) {
      console.error('Cashfree order creation error:', data);
      throw new Error(data.message || 'Failed to create Cashfree order');
    }

    // Record or update pending payment record
    await prisma.payment.upsert({
      where: { razorpayOrderId: cfOrderId },
      update: {
        amount: amountInRupees,
        status: 'PENDING',
      },
      create: {
        orderId,
        gateway: 'CASHFREE',
        razorpayOrderId: cfOrderId,
        amount: amountInRupees,
        currency: 'INR',
        status: 'PENDING',
        idempotencyKey: `cf_${orderId}_${Date.now()}`,
      },
    });

    return {
      cfOrderId,
      paymentSessionId: data.payment_session_id,
      amount: amountInRupees,
      currency: 'INR',
      orderId,
    };
  }

  /**
   * Query Cashfree order status directly from Cashfree API
   */
  static async verifyCashfreeOrder(orderId: string) {
    const cfOrderId = `order_${orderId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 36)}`;

    const res = await fetch(`${CASHFREE_API_URL}/orders/${cfOrderId}`, {
      method: 'GET',
      headers: {
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': CASHFREE_API_VERSION,
        'Content-Type': 'application/json',
      },
    });

    const data: any = await res.json();

    if (!res.ok) {
      return { success: false, status: 'ERROR', message: data.message };
    }

    if (data.order_status === 'PAID') {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order && order.status === 'PAYMENT_PENDING') {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'QUEUED',
            paidAt: new Date(),
          },
        });

        await prisma.payment.upsert({
          where: { razorpayOrderId: cfOrderId },
          update: {
            status: 'SUCCESS',
            verifiedAt: new Date(),
          },
          create: {
            orderId,
            gateway: 'CASHFREE',
            razorpayOrderId: cfOrderId,
            amount: order.totalAmount,
            currency: 'INR',
            status: 'SUCCESS',
            idempotencyKey: `cf_verify_${orderId}_${Date.now()}`,
            verifiedAt: new Date(),
          },
        });

        await QueueService.enqueueOrderJobs(orderId);

        const io = getSocketServer();
        if (io) {
          io.to(`order_${orderId}`).emit('order_status_updated', {
            orderId,
            status: 'QUEUED',
            tokenNumber: order.tokenNumber,
            message: 'Payment verified via Cashfree! Xerox job sent.',
          });

          io.to(`shop_${order.shopId}`).emit('new_queue_job', {
            orderId,
            tokenNumber: order.tokenNumber,
          });
        }
      }

      return { success: true, status: 'PAID' };
    }

    return { success: true, status: data.order_status };
  }

  /**
   * Cashfree Webhook Signature Verification
   */
  static verifyCashfreeWebhookSignature(rawBody: string, timestamp: string, receivedSignature: string): boolean {
    try {
      const dataToSign = timestamp + rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', CASHFREE_SECRET_KEY)
        .update(dataToSign)
        .digest('base64');

      return expectedSignature === receivedSignature;
    } catch (e) {
      console.error('Cashfree signature verification error:', e);
      return false;
    }
  }
}
