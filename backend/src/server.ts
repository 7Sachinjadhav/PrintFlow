import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/api.routes.js';
import { initSocket } from './sockets/socket.handler.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import { ensureDatabaseSeeded } from './services/seed.service.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Security & Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  process.env.CORS_ORIGIN || '',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, print agent)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.')) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev to allow mobile Wi-Fi QR testing
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static storage for previews
const storageDir = path.resolve(process.env.STORAGE_DIR || './storage');
app.use('/storage', express.static(storageDir));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PrintFlow Core Backend',
    timestamp: new Date().toISOString(),
  });
});

// Setup seed endpoint (callable anytime)
app.post('/api/setup/seed', async (req, res) => {
  try {
    await ensureDatabaseSeeded();
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Routes
app.use('/api', apiRouter);

// Serve Frontend Static Build if present (Production / Cloud Deployment)
const frontendDist = path.resolve('../frontend/dist');
const altFrontendDist = path.resolve('./frontend/dist');
const activeFrontendDist = fs.existsSync(frontendDist) ? frontendDist : (fs.existsSync(altFrontendDist) ? altFrontendDist : null);

if (activeFrontendDist) {
  app.use(express.static(activeFrontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/storage') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.resolve(activeFrontendDist, 'index.html'));
  });
}

// Central error handler
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '5000', 10);

server.listen(PORT, async () => {
  console.log(`=================================================`);
  console.log(`🚀 PrintFlow Backend Server running on port ${PORT}`);
  console.log(`🌐 Local API:     http://localhost:${PORT}/api`);
  console.log(`📡 Health Check:  http://localhost:${PORT}/health`);
  console.log(`=================================================`);
  await ensureDatabaseSeeded();
});

export { app, server };
