import crypto from 'crypto';
import Razorpay from 'razorpay';
import prisma from '../utils/prisma.js';
import { QueueService } from './queue.service.js';
import { TokenService } from './token.service.js';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_PrintFlow123';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_PrintFlowSecret456';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'pf_webhook_secret_789';

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
}
