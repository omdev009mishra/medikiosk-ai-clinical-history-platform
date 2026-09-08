import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { apiRouter } from './server/routes/api';
import { liveVoiceSessionManager } from './server/services/liveVoiceSession';

dotenv.config();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // JSON & URL-encoded body parser with large payload limit for document image scans
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Basic security and CORS headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
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
    console.log(`[MediKiosk Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[MediKiosk Live Voice] WebSocket endpoint mounted at ws://0.0.0.0:${PORT}/api/live-voice`);
  });
}

startServer().catch((err) => {
  console.error('[MediKiosk Server Fatal Error]:', err);
});
