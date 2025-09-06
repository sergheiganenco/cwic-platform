// backend/api-gateway/src/proxy/authServiceProxy.ts
import type { Request, Response } from "express";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";
import type { Socket } from "node:net";
import { resolveUpstreams } from "../config/upstreams.js";

const { authService: target } = resolveUpstreams();
const isDev = process.env.NODE_ENV !== "production";

const options: Options<Request, Response> = {
  target,
  changeOrigin: true,
  xfwd: true,
  secure: !isDev,
  proxyTimeout: 30_000,
  timeout: 30_000,
  // Gateway mount: /api/auth → upstream exposes /auth/*
  pathRewrite: (_path, req) => `/auth${req.url}`,

  on: {
    proxyReq: (_proxyReq: any, req: Request) => {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.debug(
          `[proxy→auth] ${req.method} ${req.originalUrl} → ${target}/auth${req.url}`
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
          error: "AUTH_SERVICE_UNAVAILABLE",
          message: "Auth service is currently unavailable",
          details: err.message,
          upstream: target,
          timestamp: new Date().toISOString(),
        });
      }
    },
  },
};

export default createProxyMiddleware(options);
