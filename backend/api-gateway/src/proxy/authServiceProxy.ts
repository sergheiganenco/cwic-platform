// src/proxy/authServiceProxy.ts
import type { IncomingMessage, ServerResponse } from "http";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";
import { resolveUpstreams } from "../config/upstreams.js";
import {
  isDev,
  maybeAttachDevAuth,
  propagateCommon,
  reflectCors,
  writeBodyIfAny
} from "./shared.js";

const { authService: target } = resolveUpstreams();

/**
 * Mounted at /api/auth
 * - /api/auth/health → /health  (auth exposes simple health at root)
 * - Everything else  → /auth/*  (most routes under /auth)
 * If your auth exposes /me at root, switch to { "^/api/auth": "" }.
 */
const options: Options<IncomingMessage, ServerResponse> = {
  target,
  changeOrigin: true,
  xfwd: true,
  secure: !isDev,
  proxyTimeout: 30_000,
  timeout: 30_000,

  pathRewrite: (path: string, _req: IncomingMessage) => {
    if (path === "/api/auth/health") return "/health";
    // default: prefix with /auth
    return path.replace(/^\/api\/auth/, "/auth");
  },

  on: {
    proxyReq: (proxyReq, req) => {
      maybeAttachDevAuth(proxyReq, req);
      propagateCommon(proxyReq, req);
      writeBodyIfAny(proxyReq, req);
      if (isDev) {
        const url = (proxyReq as any).path || "";
        // eslint-disable-next-line no-console
        console.debug(`[proxy→auth] ${req.method} ${(req as any).url} → ${target}${url}`);
      }
    },
    proxyRes: (proxyRes, req) => {
      reflectCors(proxyRes as unknown as ServerResponse, req);
      if (isDev) {
        // eslint-disable-next-line no-console
        console.debug(`[proxy→auth] ${req.method} ${(req as any).url} ⇐ ${proxyRes.statusCode}`);
      }
    },
    error: (err, req, res) => {
      if (typeof (res as any).destroy === "function" && !(res as any).setHeader) {
        try { (res as any).destroy(); } catch {}
        return;
      }
      const r = res as unknown as ServerResponse & { headersSent?: boolean };
      if ((r as any).headersSent) return;
      const origin = req.headers["origin"] as string | undefined;
      if (origin) {
        (r as any).setHeader?.("Access-Control-Allow-Origin", origin);
        (r as any).setHeader?.("Access-Control-Allow-Credentials", "true");
      }
      (r as any).statusCode = 502;
      (r as any).setHeader?.("content-type", "application/json; charset=utf-8");
      (r as any).end(JSON.stringify({
        success: false,
        error: "AUTH_SERVICE_UNAVAILABLE",
        message: "Auth service is currently unavailable",
        details: err.message,
        upstream: target,
        timestamp: new Date().toISOString()
      }));
    }
  }
};

export default createProxyMiddleware<IncomingMessage, ServerResponse>(options);
