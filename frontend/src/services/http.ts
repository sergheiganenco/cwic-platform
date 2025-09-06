// frontend/src/services/http.ts
import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { toUserMessage } from "./httpError";

/* ── Base URL & Utils ───────────────────────────────────────────────────── */
function computeBaseURL(): string {
  // Preferred: explicit base from env (no trailing slash; ensure /api suffix)
  const fromEnv = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv.endsWith("/api") ? fromEnv : `${fromEnv}/api`;

  // Fallback: same origin (e.g., behind a reverse proxy)
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/+$/, "");
    return `${origin}/api`;
  }

  // Last resort: localhost gateway
  return "http://localhost:8000/api";
}

function uuid(): string {
  try {
    // @ts-ignore optional in older libdom
    return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/* ── Token store (legacy key compatible) + events ───────────────────────── */
const TOKEN_KEYS = ["authToken", "access_token"] as const;
type TokenKey = (typeof TOKEN_KEYS)[number];

function readStoredToken():
  | { key: TokenKey; storage: Storage; value: string }
  | null {
  for (const key of TOKEN_KEYS) {
    const vLocal = localStorage.getItem(key);
    if (vLocal) return { key, storage: localStorage, value: vLocal };
    const vSession = sessionStorage.getItem(key);
    if (vSession) return { key, storage: sessionStorage, value: vSession };
  }
  return null;
}

function writeStoredToken(token: string | null) {
  const existing = readStoredToken();
  const targetKey: TokenKey = existing?.key ?? "authToken";
  const targetStore = existing?.storage ?? localStorage;
  if (token) targetStore.setItem(targetKey, token);
  else {
    for (const k of TOKEN_KEYS) {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }
  }
}

const tokenListeners = new Set<(t: string | null) => void>();
const unauthorizedListeners = new Set<() => void>();

export function getAuthToken(): string | null {
  return (
    localStorage.getItem("authToken") ??
    sessionStorage.getItem("authToken") ??
    localStorage.getItem("access_token") ??
    sessionStorage.getItem("access_token") ??
    null
  );
}

export function setAuthToken(t: string | null) {
  writeStoredToken(t);
  for (const cb of tokenListeners) cb(t);
}

export function clearAuthToken() {
  setAuthToken(null);
}

export function onAuthTokenChange(cb: (t: string | null) => void) {
  tokenListeners.add(cb);
  return () => tokenListeners.delete(cb);
}

export function onUnauthorized(cb: () => void) {
  unauthorizedListeners.add(cb);
  return () => unauthorizedListeners.delete(cb);
}

function notifyUnauthorized() {
  for (const cb of unauthorizedListeners) cb();
}

/* ── Axios instance ─────────────────────────────────────────────────────── */
const http: AxiosInstance = axios.create({
  baseURL: computeBaseURL(),
  timeout: 30_000,
  withCredentials: false, // regular calls; refresh uses cookies explicitly
  // validateStatus: (s) => s >= 200 && s < 300, // default
});

// Debug logging for development
const isDebugMode =
  import.meta.env.VITE_DEBUG_HTTP === "true" ||
  import.meta.env.MODE === "development";

if (isDebugMode) {
  console.log("[HTTP] Base URL:", computeBaseURL());
  console.log("[HTTP] Environment:", import.meta.env.MODE);
  console.log("[HTTP] VITE_API_URL:", import.meta.env.VITE_API_URL);
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function headersToObject(h: any) {
  if (!h) return {};
  try {
    if (typeof h.toJSON === "function") return h.toJSON();
    if (typeof h.forEach === "function") {
      const o: Record<string, any> = {};
      h.forEach((v: any, k: string) => {
        o[k] = v;
      });
      return o;
    }
    return { ...h };
  } catch {
    return {};
  }
}

function isIdempotent(config?: AxiosRequestConfig) {
  const m = ((config?.method as string) || "get").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

function shouldRetryStatus(status?: number) {
  // Transient-ish statuses
  return (
    status === 408 || // Request Timeout
    status === 425 || // Too Early (rare)
    status === 429 || // Rate limited
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function parseRetryAfterSeconds(h?: string | number): number | null {
  if (!h && h !== 0) return null;
  if (typeof h === "number") return h;
  const s = Number(h);
  if (!Number.isNaN(s)) return s;
  // HTTP-date not handled; keep simple
  return null;
}

function backoffDelay(attempt: number, baseMs = 250, maxMs = 5_000) {
  const jitter = Math.random() * 200;
  return Math.min(baseMs * 2 ** (attempt - 1) + jitter, maxMs);
}

/* ── Refresh-on-401 (single-flight) ─────────────────────────────────────── */
let isRefreshing = false;
let refreshQueue: {
  resolve: (v?: unknown) => void;
  reject: (e: any) => void;
  config: AxiosRequestConfig;
}[] = [];
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

function flushRefreshQueue(error: any) {
  refreshQueue
    .splice(0)
    .forEach(({ resolve, reject, config }) =>
      error ? reject(error) : resolve(http(config))
    );
}

// bare axios for refresh to avoid interceptor recursion
const naked = axios.create();
async function refreshAccessToken() {
  // Gateway expects cookie on /api/auth/refresh → baseURL computed above
  return naked.post(
    "/auth/refresh",
    {},
    { baseURL: computeBaseURL(), withCredentials: true, timeout: 10_000 }
  );
}

/* ── Interceptors ───────────────────────────────────────────────────────── */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const reqHeaders = AxiosHeaders.from((config.headers as any) ?? {});

  // Defaults (only set if absent)
  if (!reqHeaders.get("Accept")) reqHeaders.set("Accept", "application/json");
  if (!reqHeaders.get("Content-Type"))
    reqHeaders.set("Content-Type", "application/json");

  // Request ID for tracing
  if (!reqHeaders.get("X-Request-Id")) reqHeaders.set("X-Request-Id", uuid());

  // Client meta (match your gateway's allowed headers)
  if (import.meta.env.MODE)
    reqHeaders.set("X-Client-Env", String(import.meta.env.MODE));
  if (import.meta.env.VITE_APP_VERSION)
    reqHeaders.set("X-Client-Version", String(import.meta.env.VITE_APP_VERSION));
  reqHeaders.set("X-Client-Type", "web");
  reqHeaders.set("X-Platform", "cwic-frontend");

  // Auth
  const t = getAuthToken();
  if (t) reqHeaders.set("Authorization", `Bearer ${t}`);

  // Write back to config
  config.headers = reqHeaders;

  // track retries for backoff on this request
  (config as any).__retryCount ??= 0;

  if (isDebugMode) {
    let printableHeaders: any = {};
    try {
      printableHeaders = (reqHeaders as any).toJSON
        ? (reqHeaders as any).toJSON()
        : reqHeaders;
    } catch {
      printableHeaders = {};
    }

    console.log(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`, {
      baseURL: config.baseURL,
      headers: printableHeaders,
      params: config.params,
    });
  }

  return config;
});

http.interceptors.response.use(
  (res) => {
    if (isDebugMode) {
      console.log(`[HTTP] ${res.status} ${res.config.url}`, res.data);
    }
    return res;
  },
  async (err: AxiosError) => {
    const cfg = err.config as
      | (AxiosRequestConfig & { _retry?: boolean; __retryCount?: number })
      | undefined;

    const status = err.response?.status;

    // Quick detection for CORS / network layer problems
    if (err.message?.includes("CORS") || err.code === "ERR_NETWORK") {
      console.error("[HTTP] CORS/Network Error:", {
        message: err.message,
        code: err.code,
        url: cfg?.url,
        method: cfg?.method,
        baseURL: cfg?.baseURL || computeBaseURL(),
        headers: headersToObject(cfg?.headers),
      });
    }

    // 401/419 → refresh token flow (single-flight)
    if ((status === 401 || status === 419) && cfg && !cfg._retry) {
      cfg._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) =>
          refreshQueue.push({ resolve, reject, config: cfg })
        );
      }

      try {
        isRefreshing = true;
        if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
          throw new Error("Max refresh attempts exceeded");
        }
        refreshAttempts++;

        const { data } = await refreshAccessToken();
        const newAccess: string | undefined = (data as any)?.accessToken;
        if (!newAccess) throw new Error("No access token in refresh response");

        setAuthToken(newAccess);
        flushRefreshQueue(null);

        // Retry original with fresh token
        const retryHeaders = AxiosHeaders.from((cfg.headers as any) ?? {});
        retryHeaders.set("Authorization", `Bearer ${newAccess}`);
        cfg.headers = retryHeaders;

        return http(cfg);
      } catch (refreshErr) {
        flushRefreshQueue(refreshErr);
        clearAuthToken();
        notifyUnauthorized();
      } finally {
        isRefreshing = false;
      }
    }

    // Idempotent retry with exponential backoff on transient errors
    const isNetwork = !err.response; // e.g., timeouts/connection resets
    if (cfg && cfg.url && (isNetwork || shouldRetryStatus(status)) && isIdempotent(cfg)) {
      const retryAfter =
        parseRetryAfterSeconds(err.response?.headers?.["retry-after"] as any) ??
        0;
      const current = Number((cfg as any).__retryCount ?? 0);

      if (current < 3) {
        (cfg as any).__retryCount = current + 1;
        const delay = Math.max(retryAfter * 1000, backoffDelay(current + 1));
        await new Promise((r) => setTimeout(r, delay));
        return http(cfg);
      }
    }

    // Normalize/log and propagate
    const msg = toUserMessage(err);
    if (err?.response) {
      console.warn(
        `[HTTP ${err.response.status}] ${cfg?.method?.toUpperCase()} ${cfg?.url} :: ${msg}`,
        err.response.data
      );
    } else {
      console.warn("[HTTP] Network/Proxy error ::", msg, {
        code: err.code,
        message: err.message,
        config: {
          url: cfg?.url,
          method: cfg?.method,
          baseURL: cfg?.baseURL,
        },
      });
    }

    return Promise.reject(new Error(msg));
  }
);

/* ── Exports (default + legacy shims) ───────────────────────────────────── */
export default http;
// Legacy shims so old imports keep working:
export { http }; // allows: import { http } from "@services/http"
export const api = http; // allows: import { api } from "@services/http"
// Small token facade for callers that need it:
export const token = { get: getAuthToken, set: setAuthToken, clear: clearAuthToken };
