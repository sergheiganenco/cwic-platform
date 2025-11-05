/**
 * React Hook for Real-Time Quality Monitoring
 * Provides live quality metrics and alerts via WebSocket
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
export interface QualityMetric {
  assetId: string;
  assetName: string;
  metricType: 'score' | 'issues' | 'profiling' | 'lineage';
  previousValue: number | null;
  currentValue: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface QualityAlert {
  id: string;
  assetId: string;
  assetName: string;
  alertType: 'threshold_breach' | 'sudden_drop' | 'new_issues' | 'profiling_complete';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface QualityStats {
  totalAssets: number;
  avgQualityScore: number;
  openIssues: number;
  alertsBySeverity: Record<string, number>;
  recentlyMonitored: number;
  timestamp: Date;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp?: string;
}

interface UseRealtimeQualityOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  subscriptions?: string[]; // Asset IDs to subscribe to, or 'all'
}

interface UseRealtimeQualityReturn {
  // Connection state
  connected: boolean;
  connecting: boolean;
  error: Error | null;

  // Data
  metrics: QualityMetric[];
  alerts: QualityAlert[];
  stats: QualityStats | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  subscribe: (assetId: string | string[]) => void;
  unsubscribe: (assetId: string | string[]) => void;
  acknowledgeAlert: (alertId: string) => void;
  refreshStats: () => Promise<void>;
}

const WS_URL = 'ws://localhost:3002/ws/quality';
const API_BASE = 'http://localhost:3002/api/quality/realtime';

export function useRealtimeQuality(options: UseRealtimeQualityOptions = {}): UseRealtimeQualityReturn {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    subscriptions = ['all'],
  } = options;

  // State
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [alerts, setAlerts] = useState<QualityAlert[]>([]);
  const [stats, setStats] = useState<QualityStats | null>(null);

  // Refs
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnect = useRef(false);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'connected':
          console.log('✅ Connected to real-time quality monitoring');
          setConnected(true);
          setConnecting(false);
          setError(null);
          break;

        case 'metric_change':
          const metric = message.payload as QualityMetric;
          setMetrics(prev => [metric, ...prev.slice(0, 99)]); // Keep last 100
          console.log('📊 Metric update:', metric);
          break;

        case 'alert':
          const alert = message.payload as QualityAlert;
          setAlerts(prev => [alert, ...prev]);
          console.log('🔔 New alert:', alert);

          // Show browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Quality Alert: ${alert.severity}`, {
              body: alert.message,
              icon: '/favicon.ico',
            });
          }
          break;

        case 'alert_status_changed':
          // Update alert status in local state
          const { alertId, status } = message.payload;
          setAlerts(prev =>
            prev.map(a => a.id === alertId ? { ...a, status } : a)
          );
          break;

        case 'pong':
          // Heartbeat response
          break;

        case 'error':
          console.error('WebSocket error:', message.payload);
          setError(new Error(message.payload.message));
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log('Already connected');
      return;
    }

    if (connecting) {
      console.log('Connection already in progress');
      return;
    }

    setConnecting(true);
    setError(null);
    isManualDisconnect.current = false;

    try {
      console.log('🔌 Connecting to WebSocket:', WS_URL);
      const socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnected(true);
        setConnecting(false);

        // Subscribe to initial subscriptions
        if (subscriptions.length > 0) {
          socket.send(JSON.stringify({
            type: 'subscribe',
            payload: {
              assetIds: subscriptions,
            },
          }));
        }
      };

      socket.onmessage = handleMessage;

      socket.onerror = (event) => {
        console.error('❌ WebSocket error:', event);
        setError(new Error('WebSocket connection error'));
        setConnecting(false);
      };

      socket.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setConnected(false);
        setConnecting(false);
        ws.current = null;

        // Auto-reconnect unless manually disconnected
        if (!isManualDisconnect.current) {
          console.log(`Reconnecting in ${reconnectInterval}ms...`);
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.current = socket;
    } catch (err: any) {
      console.error('Failed to create WebSocket:', err);
      setError(err);
      setConnecting(false);
    }
  }, [connecting, handleMessage, reconnectInterval, subscriptions]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;

    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    setConnected(false);
    setConnecting(false);
  }, []);

  /**
   * Subscribe to asset updates
   */
  const subscribe = useCallback((assetId: string | string[]) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe: not connected');
      return;
    }

    const assetIds = Array.isArray(assetId) ? assetId : [assetId];

    ws.current.send(JSON.stringify({
      type: 'subscribe',
      payload: { assetIds },
    }));

    console.log('📡 Subscribed to:', assetIds);
  }, []);

  /**
   * Unsubscribe from asset updates
   */
  const unsubscribe = useCallback((assetId: string | string[]) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot unsubscribe: not connected');
      return;
    }

    const assetIds = Array.isArray(assetId) ? assetId : [assetId];

    ws.current.send(JSON.stringify({
      type: 'unsubscribe',
      payload: { assetIds },
    }));

    console.log('📡 Unsubscribed from:', assetIds);
  }, []);

  /**
   * Acknowledge an alert
   */
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'current-user' }),
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }

      // Update local state
      setAlerts(prev =>
        prev.map(a => a.id === alertId ? { ...a, status: 'acknowledged' as any } : a)
      );

      console.log('✅ Alert acknowledged:', alertId);
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
      setError(err);
    }
  }, []);

  /**
   * Refresh quality statistics
   */
  const refreshStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/stats`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Fetch initial stats
    refreshStats();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect, refreshStats]);

  /**
   * Send heartbeat ping every 30 seconds
   */
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [connected]);

  return {
    // Connection state
    connected,
    connecting,
    error,

    // Data
    metrics,
    alerts,
    stats,

    // Actions
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    acknowledgeAlert,
    refreshStats,
  };
}
