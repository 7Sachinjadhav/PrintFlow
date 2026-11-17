import { Router } from 'express';
import multer from 'multer';
import { AuthController } from '../controllers/auth.controller.js';
import { DocumentController } from '../controllers/document.controller.js';
import { OrderController } from '../controllers/order.controller.js';
import { PaymentController } from '../controllers/payment.controller.js';
import { QueueController } from '../controllers/queue.controller.js';
import { PrinterController } from '../controllers/printer.controller.js';
import { PricingController } from '../controllers/pricing.controller.js';
import { AgentController } from '../controllers/agent.controller.js';
import { ReportController } from '../controllers/report.controller.js';
import { ShopController } from '../controllers/shop.controller.js';
import { requireAdminAuth, requireAgentAuth } from '../middlewares/auth.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB hard limit on upload buffer
  },
});

const router = Router();

// --- PUBLIC CUSTOMER ROUTES ---
router.get('/shop', ShopController.getPublicShopInfo);
router.get('/pricing', PricingController.getPricing);
router.post('/pricing/calculate', PricingController.calculate);

router.post('/documents/upload', upload.array('files', 10), DocumentController.upload);
router.get('/documents/preview/:filename', DocumentController.preview);

router.post('/orders', OrderController.createOrder);
router.get('/orders/:id', OrderController.getOrder);
router.get('/orders/:id/status', OrderController.getOrderStatus);
router.get('/orders/track/:tokenOrId', OrderController.trackByTokenOrId);

// Payments
router.post('/payments/verify', PaymentController.verifyPayment);
router.post('/payments/submit-utr', PaymentController.submitUtrPayment);
router.post('/payments/simulate-test', PaymentController.simulateTestPayment);
router.post('/payments/webhook', PaymentController.handleWebhook);

// --- ADMIN AUTH ROUTES ---
router.post('/admin/login', AuthController.login);
router.post('/admin/refresh', AuthController.refreshToken);
router.get('/admin/me', requireAdminAuth, AuthController.getMe);
router.post('/admin/logout', requireAdminAuth, AuthController.logout);

// --- ADMIN DASHBOARD & QUEUE ROUTES ---
router.get('/admin/reports/summary', requireAdminAuth, ReportController.getSummary);
router.get('/admin/reports/export', requireAdminAuth, ReportController.exportOrders);

router.get('/admin/queue', requireAdminAuth, QueueController.getQueue);
router.get('/admin/orders', requireAdminAuth, QueueController.getAllOrders);
router.post('/admin/queue/:jobId/retry', requireAdminAuth, QueueController.retryJob);
router.patch('/admin/orders/:orderId/status', requireAdminAuth, QueueController.updateOrderStatus);

// Printers Management
router.get('/admin/printers', requireAdminAuth, PrinterController.getPrinters);
router.post('/admin/printers', requireAdminAuth, PrinterController.createPrinter);
router.patch('/admin/printers/:id', requireAdminAuth, PrinterController.updatePrinter);
router.post('/admin/printers/:id/test', requireAdminAuth, PrinterController.testPrint);

// Pricing Management
router.get('/admin/pricing', requireAdminAuth, PricingController.getAdminPricing);
router.patch('/admin/pricing/rules/:id', requireAdminAuth, PricingController.updateRule);
router.patch('/admin/pricing/services/:id', requireAdminAuth, PricingController.updateService);

// Shop Settings
router.patch('/admin/shop', requireAdminAuth, ShopController.updateShop);

// --- WINDOWS LOCAL PRINT AGENT ROUTES ---
router.post('/agent/register', requireAgentAuth, AgentController.register);
router.post('/agent/heartbeat', requireAgentAuth, AgentController.heartbeat);
router.get('/agent/jobs/next', requireAgentAuth, AgentController.getNextJob);
router.post('/agent/jobs/:id/status', requireAgentAuth, AgentController.updateJobStatus);
router.post('/agent/printers/discovery', requireAgentAuth, AgentController.syncDiscoveredPrinters);
router.get('/agent/documents/:id/download', AgentController.downloadDocument);

export default router;
