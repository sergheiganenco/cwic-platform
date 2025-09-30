// src/proxy/dataServiceProxy.ts
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

const { dataService: target } = resolveUpstreams();

/**
 * FE → Gateway: /api/data-sources
 * Gateway → DataSvc: /data-sources  (strip the `/api` prefix)
 */
const options: Options<IncomingMessage, ServerResponse> = {
  target,
  changeOrigin: true,
  xfwd: true,
  secure: !isDev,
  proxyTimeout: 30_000,
  timeout: 30_000,
  pathRewrite: { "^/api": "" },

  on: {
    proxyReq: (proxyReq, req) => {
      maybeAttachDevAuth(proxyReq, req);
      propagateCommon(proxyReq, req);
      writeBodyIfAny(proxyReq, req);
      if (isDev) {
        const url = (proxyReq as any).path || "";
        // eslint-disable-next-line no-console
        console.debug(`[proxy→data] ${req.method} ${(req as any).url} → ${target}${url}`);
      }
    },
    proxyRes: (proxyRes, req) => {
      reflectCors(proxyRes as unknown as ServerResponse, req);
      if (isDev) {
        // eslint-disable-next-line no-console
        console.debug(`[proxy→data] ${req.method} ${(req as any).url} ⇐ ${proxyRes.statusCode}`);
      }
    },
    error: (err, req, res) => {
      // If raw socket (e.g., WS) just destroy
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
        error: "DATA_SERVICE_UNAVAILABLE",
        message: "Data service is currently unavailable",
        details: err.message,
        upstream: target,
        timestamp: new Date().toISOString()
      }));
    }
  }
};

export default createProxyMiddleware<IncomingMessage, ServerResponse>(options);
