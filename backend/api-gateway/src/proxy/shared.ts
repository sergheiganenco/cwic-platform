// src/proxy/shared.ts
import type { IncomingMessage, ServerResponse } from "http";

export const isProd = (process.env.NODE_ENV || "development") === "production";
export const isDev = !isProd;
export const devBearer = process.env.DEV_BEARER ?? "";

/** Re-stream body if Express has already parsed it. */
export function writeBodyIfAny(proxyReq: any, req: IncomingMessage) {
  const r: any = req as any;
  if (!r.method || r.method === "GET" || r.method === "HEAD") return;

  const contentType =
    String(
      proxyReq.getHeader("content-type") ||
      proxyReq.getHeader("Content-Type") ||
      ""
    ).toLowerCase();

  if (r.body && typeof r.body === "object") {
    if (contentType.includes("application/json")) {
      const body = JSON.stringify(r.body);
      proxyReq.setHeader("content-length", Buffer.byteLength(body));
      proxyReq.write(body);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = new URLSearchParams(r.body as Record<string, string>).toString();
      proxyReq.setHeader("content-length", Buffer.byteLength(body));
      proxyReq.write(body);
    }
  }
}

/** Reflect origin & credentials on proxied responses */
export function reflectCors(proxyRes: ServerResponse, req: IncomingMessage) {
  const origin = (req.headers["origin"] as string) || "";
  if (!origin) return;
  (proxyRes as any).headers ??= {};
  (proxyRes as any).headers["access-control-allow-origin"] = origin;
  (proxyRes as any).headers["access-control-allow-credentials"] = "true";
}

/** Attach Authorization (dev bearer) if missing */
export function maybeAttachDevAuth(proxyReq: any, req: IncomingMessage) {
  const auth = req.headers["authorization"];
  if (!auth && isDev && devBearer) {
    proxyReq.setHeader(
      "authorization",
      devBearer.startsWith("Bearer ") ? devBearer : `Bearer ${devBearer}`
    );
    proxyReq.setHeader("x-dev-auth", "gateway");
  }
}

/** Propagate useful headers */
export function propagateCommon(proxyReq: any, req: IncomingMessage) {
  const rid = req.headers["x-request-id"] as string | undefined;
  if (rid) proxyReq.setHeader("x-request-id", rid);
  const cookie = req.headers["cookie"] as string | undefined;
  if (cookie) proxyReq.setHeader("cookie", cookie);
}
