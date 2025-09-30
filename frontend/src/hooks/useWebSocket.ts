// src/hooks/useWebSocket.ts
import { useCallback, useEffect, useRef, useState } from 'react';

type Ready = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type UseWebSocketOptions<TOut = any, TIn = any> = {
  onMessage?: (data: TOut, ev: MessageEvent) => void;
  onOpen?: (ev: Event) => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;

  enabled?: boolean;                 // default: false  ← important
  autoReconnect?: boolean;           // default: true
  maxReconnectAttempts?: number;     // default: 5
  backoffInitial?: number;           // default: 1500 ms
  backoffMax?: number;               // default: 30000 ms
  heartbeatMs?: number;              // default: 0 (off)
  queueBeforeOpen?: boolean;         // default: true
  queueLimit?: number;               // default: 100

  protocols?: string | string[];
  buildUrl?: (absoluteUrl: string) => string;

  parse?: (raw: string) => TOut;     // default: JSON.parse
  serialize?: (msg: TIn) => string;  // default: JSON.stringify

  disableInDev?: boolean;            // default: true
};

function isDev(): boolean {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    return !!(import.meta as any).env.DEV;
  }
  if (typeof window !== 'undefined') {
    return /localhost|127\.0\.0\.1/.test(window.location.hostname);
  }
  return false;
}

function toAbsoluteWsUrl(pathOrUrl: string): string {
  if (/^wss?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${proto}//${host}${path}`;
}

export function useWebSocket<TOut = any, TIn = any>(
  baseUrl: string,
  opts: UseWebSocketOptions<TOut, TIn> = {}
) {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    enabled = false,                 // 🔒 default OFF
    autoReconnect = true,
    maxReconnectAttempts = 5,
    backoffInitial = 1500,
    backoffMax = 30000,
    heartbeatMs = 0,
    queueBeforeOpen = true,
    queueLimit = 100,
    protocols,
    buildUrl,
    parse = JSON.parse,
    serialize = JSON.stringify,
    disableInDev = true,             // ⛔️ off in dev unless you opt-in
  } = opts;

  const dev = isDev();

  const [status, setStatus] = useState<Ready>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [lastMessage, setLastMessage] = useState<TOut | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);
  const manualCloseRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const currentUrlRef = useRef<string>('');

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || manualCloseRef.current) return;
    if (attemptRef.current >= maxReconnectAttempts) return;
    // Don't hammer in background tabs
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    attemptRef.current += 1;
    const base = Math.min(backoffInitial * 2 ** (attemptRef.current - 1), backoffMax);
    const jitter = base * (Math.random() * 0.2 - 0.1); // ±10%
    const delay = Math.max(300, Math.floor(base + jitter));

    reconnectTimerRef.current = setTimeout(() => connect(), delay);
  }, [autoReconnect, maxReconnectAttempts, backoffInitial, backoffMax]);

  const startHeartbeat = useCallback(() => {
    if (!heartbeatMs || heartbeatMs <= 0) return;
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send('{"type":"__ping"}'); } catch {}
      }
    }, heartbeatMs);
  }, [heartbeatMs]);

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (queueRef.current.length) {
      const payload = queueRef.current.shift()!;
      try {
        if (ws.bufferedAmount > 1_000_000) { // ~1MB backpressure
          queueRef.current.unshift(payload);
          break;
        }
        ws.send(payload);
      } catch {
        queueRef.current.unshift(payload);
        break;
      }
    }
  }, []);

  const connect = useCallback(() => {
    if ((disableInDev && dev) || !enabled) {
      setStatus('closed');
      setIsOpen(false);
      return;
    }

    // already connecting/open?
    const w = wsRef.current;
    if (w && (w.readyState === WebSocket.OPEN || w.readyState === WebSocket.CONNECTING)) return;

    try {
      setStatus('connecting');
      setLastError(null);

      let url = toAbsoluteWsUrl(baseUrl);
      if (buildUrl) url = buildUrl(url);
      currentUrlRef.current = url;

      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;

      ws.onopen = (ev) => {
        setStatus('open');
        setIsOpen(true);
        attemptRef.current = 0;
        onOpen?.(ev);
        startHeartbeat();
        flushQueue();
      };

      ws.onmessage = (ev) => {
        try {
          const data = typeof ev.data === 'string' ? parse(ev.data) : (ev.data as unknown as TOut);
          setLastMessage(data);
          onMessage?.(data, ev);
        } catch (e: any) {
          setLastError(`parse_error: ${e?.message || String(e)}`);
          onMessage?.((ev.data as unknown) as TOut, ev); // still forward raw
        }
      };

      ws.onerror = (ev) => {
        setStatus('error');
        setIsOpen(false);
        setLastError('socket_error');
        onError?.(ev);
      };

      ws.onclose = (ev) => {
        setStatus('closed');
        setIsOpen(false);
        onClose?.(ev);
        clearTimers();
        if (!manualCloseRef.current) scheduleReconnect();
      };
    } catch (e: any) {
      setStatus('error');
      setIsOpen(false);
      setLastError(e?.message || 'connect_failed');
      scheduleReconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, enabled, protocols, buildUrl, parse, onMessage, onOpen, onClose, onError, disableInDev, dev, startHeartbeat, flushQueue, scheduleReconnect, clearTimers]);

  const disconnect = useCallback((code?: number, reason?: string) => {
    manualCloseRef.current = true;
    clearTimers();
    const ws = wsRef.current;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      try { ws.close(code, reason); } catch {}
    }
    wsRef.current = null;
    setIsOpen(false);
    setStatus('closed');
  }, [clearTimers]);

  const send = useCallback((msg: TIn): boolean => {
    const payload = serialize(msg);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        if (ws.bufferedAmount > 1_000_000) return false;
        ws.send(payload);
        return true;
      } catch {
        return false;
      }
    }
    if (queueBeforeOpen) {
      if (queueRef.current.length >= queueLimit) queueRef.current.shift();
      queueRef.current.push(payload);
    }
    return false;
  }, [serialize, queueBeforeOpen, queueLimit]);

  // Online/offline awareness
  useEffect(() => {
    const onOnline = () => { if (!isOpen && enabled && !manualCloseRef.current) connect(); };
    const onOffline = () => { try { wsRef.current?.close(1001, 'offline'); } catch {} };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [connect, enabled, isOpen]);

  // Pause reconnects while hidden, resume on visible
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && enabled && !isOpen) connect();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [connect, enabled, isOpen]);

  useEffect(() => {
    manualCloseRef.current = false;
    if (enabled) connect(); else disconnect();
    return () => { disconnect(); queueRef.current = []; };
  }, [enabled, connect, disconnect]);

  return {
    status,
    isOpen,
    lastMessage,
    lastError,
    url: currentUrlRef.current,
    send,
    connect,
    disconnect,
    socket: wsRef.current as WebSocket | null,
  };
}
