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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, Idempotency-Key');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // API routes MUST be mounted first
  app.use('/api', apiRouter);

  // Mount WebSocket server for Gemini Live full-duplex voice streaming
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', 'http://localhost');
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
