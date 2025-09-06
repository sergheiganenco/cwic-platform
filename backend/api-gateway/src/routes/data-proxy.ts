import { Request, Response, Router } from 'express';
import { createProxyMiddleware, type Options } from 'http-proxy-middleware';

const router = Router();

// Compose sets DATA_SERVICE_URL=http://data-service:3002
const base = (process.env.DATA_SERVICE_URL || 'http://data-service:3002').replace(/\/+$/, '');
const target = `${base}/api`; // upstream base includes /api

function attachBody(proxyReq: any, req: Request): void {
  const ct = String(proxyReq.getHeader('Content-Type') || '');
  if (!req.body || req.method === 'GET' || req.method === 'HEAD') return;

  if (ct.includes('application/json')) {
    const body = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
    proxyReq.write(body);
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    const body = new URLSearchParams(req.body as Record<string, string>).toString();
    proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
    proxyReq.write(body);
  }
}

const options: Options<Request, Response> = {
  target,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => attachBody(proxyReq, req as Request),
    error: (err, _req, res) => {
      const r = res as Response;
      if (!r.headersSent) {
        r.status(502).json({
          success: false,
          error: 'BAD_GATEWAY',
          message: (err as Error).message,
          upstream: target,
        });
      }
    },
    proxyRes: (_proxyRes, req, _res) => {
      // lightweight trace in your logs
      (req as any).log?.debug?.(`Proxied ${req.method} ${req.originalUrl} -> ${target}${req.url}`);
    },
  },
};

// Handle both /api and /api/*
const proxyMw = createProxyMiddleware(options);
router.all('/', proxyMw as any);
router.all('/*', proxyMw as any);

export default router;
