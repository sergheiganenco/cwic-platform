import type { Request, Response } from "express";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";
import type { Socket } from "node:net";
import { resolveUpstreams } from "../config/upstreams.js";

const { dataService: upstreamBase } = resolveUpstreams(); // e.g. http://localhost:3002
const isDev = process.env.NODE_ENV !== "production";
const devBearer = process.env.DEV_BEARER ?? "";

/**
 * We STRIP the /api prefix here because the data-service mounts routes WITHOUT /api.
 * FE → Gateway:        /api/data-sources
 * Gateway → data-svc:  /data-sources
 */
const options: Options<Request, Response> = {
  target: upstreamBase,
  changeOrigin: true,
  xfwd: true,
  secure: !isDev,
  proxyTimeout: 30_000,
  timeout: 30_000,

  // 🔑 KEY FIX: remove `/api` before forwarding
  pathRewrite: { "^/api": "" },

  on: {
    proxyReq: (proxyReq: any, req: Request) => {
      // Dev bearer injection (only if client didn’t send one)
      if (!req.headers.authorization && isDev && devBearer) {
        proxyReq.setHeader(
          "authorization",
          devBearer.startsWith("Bearer ") ? devBearer : `Bearer ${devBearer}`
        );
        proxyReq.setHeader("x-dev-auth", "gateway");
      } else if (req.headers.authorization) {
        proxyReq.setHeader("authorization", req.headers.authorization);
      }

      // Trace headers
      const rid = (req.headers["x-request-id"] as string) || "";
      if (rid) proxyReq.setHeader("x-request-id", rid);

      // Forward cookies if present
      const cookie = req.headers["cookie"];
      if (cookie) proxyReq.setHeader("cookie", cookie);

      // Reflect request body for non-GET
      if (req.method !== "GET" && req.method !== "HEAD" && (req as any).body) {
        const ct =
          String(
            proxyReq.getHeader("content-type") ||
              proxyReq.getHeader("Content-Type") ||
              ""
          ).toLowerCase();

        if (ct.includes("application/json")) {
          const body = JSON.stringify((req as any).body);
          proxyReq.setHeader("content-length", Buffer.byteLength(body));
          proxyReq.write(body);
        } else if (ct.includes("application/x-www-form-urlencoded")) {
          const body = new URLSearchParams(
            (req as any).body as Record<string, string>
          ).toString();
          proxyReq.setHeader("content-length", Buffer.byteLength(body));
          proxyReq.write(body);
        }
      }

      if (isDev) {
        // proxyReq.path is AFTER pathRewrite; helpful to see final upstream URL
        console.debug(
          `[proxy→data] ${req.method} ${req.originalUrl} → ${upstreamBase}${proxyReq.path}`
        );
      }
    },

    proxyRes: (proxyRes, req: Request) => {
      // Keep CORS aligned with gateway decision (reflect the Origin)
      const origin = req.headers.origin;
      if (origin) {
        proxyRes.headers["access-control-allow-origin"] = origin;
        proxyRes.headers["access-control-allow-credentials"] = "true";
      }

      if (isDev) {
        console.debug(
          `[proxy→data] ${req.method} ${req.originalUrl} ⇐ ${proxyRes.statusCode}`
        );
      }
    },

    error: (err: Error, req: Request, res: Response | Socket) => {
      console.error(
        `[proxy→data] Error for ${req.method} ${req.originalUrl}:`,
        err.message
      );

      // If it's a raw socket (e.g., WS) just destroy
      if (typeof (res as Socket).destroy === "function" && !(res as any).setHeader) {
        try {
          (res as Socket).destroy();
        } catch {}
        return;
      }

      const r = res as Response;
      if (!r.headersSent) {
        const origin = req.headers.origin;
        if (origin) {
          r.setHeader("Access-Control-Allow-Origin", origin);
          r.setHeader("Access-Control-Allow-Credentials", "true");
        }
        r.status(502).json({
          success: false,
          error: "DATA_SERVICE_UNAVAILABLE",
          message: "Data service is currently unavailable",
          details: err.message,
          upstream: upstreamBase,
          timestamp: new Date().toISOString(),
        });
      }
    },
  },
};

export default createProxyMiddleware(options);
