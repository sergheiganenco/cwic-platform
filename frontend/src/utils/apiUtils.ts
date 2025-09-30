/* eslint-disable @typescript-eslint/no-explicit-any */
// src/utils/apiUtils.ts

type Primitive = string | number | boolean | null | undefined;
type Queryable = Record<string, Primitive | Primitive[] | Record<string, any>>;

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '');

const getEnv = () => (import.meta as any)?.env ?? {};

export function getApiBase(): string {
  const env = getEnv();
  const fromEnv = (env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);
  if (env.PROD) return ''; // same-origin behind gateway in prod
  return 'http://localhost:8000'; // dev default -> run your gateway on 8000
}

export const API_BASE = getApiBase();

/** Convert { a:1, b:[x,y], dateRange:{from,to} } → ?a=1&b=x,y&dateRange={"from":"..."} */
function paramsToQuery(params?: Queryable) {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(','));
      continue;
    }
    if (typeof v === 'object') {
      q.set(k, JSON.stringify(v));
      continue;
    }
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function apiUrl(path: string, params?: Queryable) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}${paramsToQuery(params)}`;
}

function withTimeout(ms: number, parentSignal?: AbortSignal | null) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);

  const onAbort = () => ctrl.abort();
  if (parentSignal) {
    if (parentSignal.aborted) ctrl.abort();
    else parentSignal.addEventListener('abort', onAbort, { once: true });
  }

  return {
    signal: ctrl.signal,
    clear: () => {
      clearTimeout(id);
      parentSignal?.removeEventListener?.('abort', onAbort);
    },
  };
}

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: any;
  constructor(message: string, status = 500, code?: string, payload?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

async function coreFetch<T>(
  path: string,
  init: RequestInit & {
    timeoutMs?: number;
    params?: Queryable;
  } = {}
): Promise<T> {
  const url = apiUrl(path, init.params);
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');

  // Optional bearer from storage
  const token =
    (typeof window !== 'undefined' &&
      (localStorage.getItem('authToken') || sessionStorage.getItem('authToken'))) ||
    '';
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);
  }

  const { signal, clear } = withTimeout(init.timeoutMs ?? 30_000, init.signal as AbortSignal | null);

  try {
    const resp = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
      signal,
    });

    if (!resp.ok) {
      let body: any = null;
      try {
        body = await resp.json();
      } catch {
        /* ignore */
      }
      const msg = body?.message || `${resp.status} ${resp.statusText}`;
      const err = new ApiError(msg, resp.status, body?.code, body);
      throw err;
    }

    const ct = resp.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) return (await resp.json()) as T;
    if (ct.startsWith('text/')) return (await resp.text()) as unknown as T;
    return (await resp.blob()) as unknown as T;
  } finally {
    clear();
  }
}

async function getWithRetry<T>(
  path: string,
  opts: { params?: Queryable; tries?: number; signal?: AbortSignal } = {}
): Promise<T> {
  const { params, tries = 2, signal } = opts;
  let attempt = 0;
  const base = 800;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await coreFetch<T>(path, { method: 'GET', params, signal });
    } catch (e: any) {
      attempt++;
      const is4xx = e instanceof ApiError && e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status);
      if (attempt > tries || is4xx) throw e;
      const jitter = Math.random() * 200;
      const delay = Math.min(3000, base * Math.pow(2, attempt - 1)) + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export const api = {
  get: <T>(path: string, params?: Queryable, signal?: AbortSignal) =>
    getWithRetry<T>(path, { params, signal }),
  post: <T>(path: string, body?: any, init: RequestInit = {}) =>
    coreFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...init }),
  patch: <T>(path: string, body?: any, init: RequestInit = {}) =>
    coreFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, ...init }),
  del:  <T>(path: string, init: RequestInit = {}) =>
    coreFetch<T>(path, { method: 'DELETE', ...init }),
};

/** Build ws(s):// URL that matches API_BASE host */
export function wsUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  try {
    if (API_BASE) {
      const u = new URL(API_BASE);
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${u.host}${p}`;
    }
  } catch { /* ignore */ }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${p}`;
}
