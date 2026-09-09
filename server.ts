import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { apiRouter } from './server/routes/api';
import { liveVoiceSessionManager } from './server/services/liveVoiceSession';
import { logger } from './server/utils/logger';

dotenv.config();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;
  const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || 'LOCAL_HOSPITAL';

  // Trust Cloudflare and reverse-proxy X-Forwarded-* headers
  app.set('trust proxy', 1);

  // Allowed Origins Configuration
  const defaultAllowedOrigins = [
    'https://medikioskai.online',
    'https://www.medikioskai.online',
    'http://medikioskai.online',
    'http://www.medikioskai.online',
    'http://13.203.204.160:3000',
    'http://13.203.204.160',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOriginsSet = new Set([...defaultAllowedOrigins, ...envOrigins]);

  const isOriginPermitted = (origin: string): boolean => {
    if (allowedOriginsSet.has(origin)) return true;
    if (DEPLOYMENT_MODE === 'LOCAL_HOSPITAL' || process.env.NODE_ENV !== 'production') return true;
    // Allow private / hospital LAN networks
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return true;
    }
    return false;
  };

  // Request ID and structured tracing middleware
  app.use((req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    res.setHeader('X-Request-Id', requestId);
    (req as any).id = requestId;
    next();
  });

  // JSON & URL-encoded body parser with large payload limit for document image scans
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Production security, CORS and CSP headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const origin = req.headers.origin;
    if (origin) {
      if (isOriginPermitted(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      } else {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-Id, Idempotency-Key, Cookie, X-Access-Token, X-Sync-Secret'
    );

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Root-level health check redirects for ALB, Cloudflare, Docker probes
  app.get('/health', (req, res) => {
    res.redirect(307, '/api/health');
  });
  app.get('/ready', (req, res) => {
    res.redirect(307, '/api/ready');
  });

  // API routes MUST be mounted first
  app.use('/api', apiRouter);

  // Mount WebSocket server for Gemini Live full-duplex voice streaming
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host || 'localhost';
      const isHttps = request.headers['x-forwarded-proto'] === 'https' || (request.socket as any).encrypted;
      const protocol = isHttps ? 'https' : 'http';
      const url = new URL(request.url || '', `${protocol}://${host}`);
      if (url.pathname === '/api/live-voice') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
      // Note: If not /api/live-voice, leave socket intact so Vite HMR can handle it
    } catch (err) {
      console.error('[WebSocket Upgrade Error]:', err);
    }
  });

  wss.on('connection', (ws, request) => {
    liveVoiceSessionManager.handleConnection(ws, request);
  });

  // Vite middleware in development or static serve in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`MediKiosk Server online`, {
      port: PORT,
      mode: DEPLOYMENT_MODE,
      nodeEnv: process.env.NODE_ENV || 'development',
    });
    console.log(`[MediKiosk Server] Mode: ${DEPLOYMENT_MODE} | Running on http://0.0.0.0:${PORT}`);
    console.log(`[MediKiosk Live Voice] WebSocket endpoint mounted at ws://0.0.0.0:${PORT}/api/live-voice`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('[MediKiosk Server] Shutting down gracefully...');
    wss.close();
    server.close(() => {
      console.log('[MediKiosk Server] Closed all connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[MediKiosk Server Fatal Error]:', err);
});
