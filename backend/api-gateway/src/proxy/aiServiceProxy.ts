// backend/api-gateway/src/proxy/aiServiceProxy.ts
import type { Request, Response } from "express";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";
import type { Socket } from "node:net";
import { resolveUpstreams } from "../config/upstreams.js";

const { aiService: target } = resolveUpstreams();
const isDev = process.env.NODE_ENV !== "production";
const devBearer = process.env.DEV_BEARER ?? "";

/**
 * Mount path: /api/ai
 * Upstream exposes /api/* → trim the /api/ai prefix down to /api
 *   req.url:          '/health'
 *   originalUrl:      '/api/ai/health'
 *   proxied path ->   '/api/health'
 */
const options: Options<Request, Response> = {
  target,
  changeOrigin: true,
  xfwd: true,
  secure: !isDev,
  proxyTimeout: 30_000,
  timeout: 30_000,
  pathRewrite: (_path, req) => `/api${req.url}`,

  on: {
    proxyReq: (proxyReq: any, req: Request) => {
      if (isDev && devBearer && !req.headers.authorization) {
        proxyReq.setHeader(
          "authorization",
          devBearer.startsWith("Bearer ") ? devBearer : `Bearer ${devBearer}`
        );
        proxyReq.setHeader("x-dev-auth", "gateway");
      } else if (req.headers.authorization) {
        proxyReq.setHeader("authorization", req.headers.authorization);
      }

      const rid = (req.headers["x-request-id"] as string) || "";
      if (rid) proxyReq.setHeader("x-request-id", rid);

      if (isDev) {
        // eslint-disable-next-line no-console
        console.debug(
          `[proxy→ai] ${req.method} ${req.originalUrl} → ${target}/api${req.url}`
        );
      }
    },

    proxyRes: (proxyRes, req: Request) => {
      const origin = req.headers.origin as string | undefined;
      if (origin) {
        proxyRes.headers["access-control-allow-origin"] = origin;
        proxyRes.headers["access-control-allow-credentials"] = "true";
      }
      if (isDev) {
        // eslint-disable-next-line no-console
        console.debug(
          `[proxy→ai] ${req.method} ${req.originalUrl} ⇐ ${proxyRes.statusCode}`
        );
      }
    },

    error: (err: Error, req: Request, res: Response | Socket) => {
      if (typeof (res as Socket).destroy === "function" && !(res as any).setHeader) {
        try {
          (res as Socket).destroy();
        } catch {}
        return;
      }
      const r = res as Response;
      if (!r.headersSent) {
        r.status(502).json({
          success: false,
          error: "AI_SERVICE_UNAVAILABLE",
          message: "AI service is currently unavailable",
          details: err.message,
          upstream: target,
          timestamp: new Date().toISOString(),
        });
      }
    },
  },
};

export default createProxyMiddleware(options);
