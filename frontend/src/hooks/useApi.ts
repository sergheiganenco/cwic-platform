// src/hooks/useApi.ts
import { useMemo } from 'react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiOptions {
  base?: string;
  headers?: Record<string, string>;
  authToken?: string | null;
}

export interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function useApi(opts: ApiOptions = {}) {
  const base = (opts.base ?? (import.meta.env.VITE_API_BASE ?? '')).replace(/\/+$/, '');
  const defaultHeaders = opts.headers ?? {};
  const debug = String(import.meta.env.VITE_DEBUG_HTTP ?? '0') !== '0';

  // Use caller token or dev bearer (dev only)
  const envToken = (import.meta.env.VITE_DEV_BEARER as string | undefined)?.trim() || null;
  const authToken = opts.authToken ?? (import.meta.env.MODE === 'development' ? envToken : null);

  async function request<T>(
    method: HttpMethod,
    path: string,
    {
      body,
      signal,
      headers,
      retries = 1,
      backoff = 500,
    }: {
      body?: any;
      signal?: AbortSignal;
      headers?: Record<string, string>;
      retries?: number;
      backoff?: number;
    } = {}
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${base}${path}`;
    const h: Record<string, string> = {
      accept: 'application/json',
      ...defaultHeaders,
      ...headers,
    };
    if (body && !(body instanceof FormData)) h['content-type'] = 'application/json';
    if (authToken) h['authorization'] = `Bearer ${authToken}`;

    try {
      debug && console.info('[api]', method, url, { body, headers: h });
      const res = await fetch(url, {
        method,
        headers: h,
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
        signal,
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      if (!res.ok) {
        const err: ApiError = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        err.body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
        throw err;
      }
      const result = (isJson ? await res.json() : ((await res.text()) as any)) as T;
      debug && console.info('[api:ok]', method, url, { status: res.status });
      return result;
    } catch (e: any) {
      const transient = e?.name === 'TypeError' || e?.status === 429 || (e?.status ?? 0) >= 500;
      if (retries > 0 && transient) {
        await sleep(backoff);
        return request<T>(method, path, { body, signal, headers, retries: retries - 1, backoff: backoff * 2 });
      }
      debug && console.warn('[api:err]', method, url, e);
      throw e;
    }
  }

  return useMemo(
    () => ({
      base,
      get:  <T>(p: string, o?: Parameters<typeof request<T>>[2]) => request<T>('GET', p, o),
      post: <T>(p: string, body?: any, o?: Omit<Parameters<typeof request<T>>[2], 'body'>) => request<T>('POST', p, { ...o, body }),
      put:  <T>(p: string, body?: any, o?: Omit<Parameters<typeof request<T>>[2], 'body'>) => request<T>('PUT',  p, { ...o, body }),
      patch:<T>(p: string, body?: any, o?: Omit<Parameters<typeof request<T>>[2], 'body'>) => request<T>('PATCH',p, { ...o, body }),
      del:  <T>(p: string, o?: Parameters<typeof request<T>>[2]) => request<T>('DELETE', p, o),
    }),
    [base, defaultHeaders, authToken, debug]
  );
}
