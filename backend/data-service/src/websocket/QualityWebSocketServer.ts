/**
 * WebSocket Server for Real-Time Quality Updates
 * Provides live quality metrics and alerts to connected clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { Pool } from 'pg';
import { RealtimeQualityMonitor, QualityMetric, QualityAlert } from '../services/RealtimeQualityMonitor';
import { v4 as uuidv4 } from 'uuid';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>; // Asset IDs or 'all'
  isAlive: boolean;
  connectedAt: Date;
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'get_metrics' | 'get_alerts' | 'acknowledge_alert';
  payload?: any;
}

export class QualityWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private monitor: RealtimeQualityMonitor;
  private pool: Pool;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server, pool: Pool, redisUrl?: string) {
    this.pool = pool;
    this.wss = new WebSocketServer({
      server,
      path: '/ws/quality'
    });

    // Initialize real-time monitor
    this.monitor = new RealtimeQualityMonitor(pool, redisUrl);

    // Set up event listeners
    this.setupMonitorListeners();
    this.setupWebSocketServer();
    this.startHeartbeat();

    console.log('✅ Quality WebSocket server initialized on /ws/quality');
  }

  /**
   * Set up listeners on the quality monitor
   */
  private setupMonitorListeners(): void {
    // Listen for metric changes
    this.monitor.on('metricChange', (metric: QualityMetric) => {
      this.broadcastMetricChange(metric);
    });

    // Listen for alerts
    this.monitor.on('alert', (alert: QualityAlert) => {
      this.broadcastAlert(alert);
    });

    // Listen for errors
    this.monitor.on('error', (error: Error) => {
      console.error('❌ Monitor error:', error);
    });
  }

  /**
   * Set up WebSocket server handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = uuidv4();
      const userId = this.extractUserId(req);

      const client: ClientConnection = {
        id: clientId,
        ws,
        userId,
        subscriptions: new Set(['all']), // Default: subscribe to all
        isAlive: true,
        connectedAt: new Date(),
      };

      this.clients.set(clientId, client);

      console.log(`📡 Client connected: ${clientId} (User: ${userId || 'anonymous'})`);
      console.log(`   Total connections: ${this.clients.size}`);

      // Store session in database
      this.storeSession(client).catch(err =>
        console.error('Failed to store session:', err)
      );

      // Send welcome message
      this.sendToClient(client, {
        type: 'connected',
        payload: {
          clientId,
          message: 'Connected to real-time quality monitoring',
          timestamp: new Date(),
        },
      });

      // Set up message handler
      ws.on('message', (data: Buffer) => {
        this.handleClientMessage(client, data);
      });

      // Set up pong handler for heartbeat
      ws.on('pong', () => {
        client.isAlive = true;
      });

      // Handle disconnect
      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, error);
      });
    });
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(client: ClientConnection, data: Buffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(client, message.payload);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(client, message.payload);
          break;

        case 'ping':
          this.sendToClient(client, { type: 'pong', payload: { timestamp: new Date() } });
          break;

        case 'get_metrics':
          this.handleGetMetrics(client, message.payload);
          break;

        case 'get_alerts':
          this.handleGetAlerts(client, message.payload);
          break;

        case 'acknowledge_alert':
          this.handleAcknowledgeAlert(client, message.payload);
          break;

        default:
          this.sendToClient(client, {
            type: 'error',
            payload: { message: `Unknown message type: ${message.type}` },
          });
      }
    } catch (error: any) {
      console.error('Error handling client message:', error);
      this.sendToClient(client, {
        type: 'error',
        payload: { message: error.message },
      });
    }
  }

  /**
   * Handle subscribe requests
   */
  private handleSubscribe(client: ClientConnection, payload: any): void {
    const { assetId, assetIds } = payload || {};

    if (assetId) {
      client.subscriptions.add(assetId);
    } else if (assetIds && Array.isArray(assetIds)) {
      assetIds.forEach(id => client.subscriptions.add(id));
    } else {
      client.subscriptions.add('all');
    }

    this.sendToClient(client, {
      type: 'subscribed',
      payload: {
        subscriptions: Array.from(client.subscriptions),
        message: 'Subscription updated',
      },
    });

    console.log(`📡 Client ${client.id} subscribed to:`, Array.from(client.subscriptions));
  }

  /**
   * Handle unsubscribe requests
   */
  private handleUnsubscribe(client: ClientConnection, payload: any): void {
    const { assetId, assetIds } = payload || {};

    if (assetId) {
      client.subscriptions.delete(assetId);
    } else if (assetIds && Array.isArray(assetIds)) {
      assetIds.forEach(id => client.subscriptions.delete(id));
    }

    this.sendToClient(client, {
      type: 'unsubscribed',
      payload: {
        subscriptions: Array.from(client.subscriptions),
        message: 'Subscription updated',
      },
    });
  }

  /**
   * Handle get metrics requests
   */
  private async handleGetMetrics(client: ClientConnection, payload: any): Promise<void> {
    const { assetId, metricType } = payload || {};

    if (assetId && metricType) {
      const metric = await this.monitor.getCachedMetric(assetId, metricType);
      this.sendToClient(client, {
        type: 'metric',
        payload: metric,
      });
    }
  }

  /**
   * Handle get alerts requests
   */
  private async handleGetAlerts(client: ClientConnection, payload: any): Promise<void> {
    const { limit = 50 } = payload || {};

    const alerts = await this.monitor.getActiveAlerts(limit);
    this.sendToClient(client, {
      type: 'alerts',
      payload: { alerts },
    });
  }

  /**
   * Handle acknowledge alert requests
   */
  private async handleAcknowledgeAlert(client: ClientConnection, payload: any): Promise<void> {
    const { alertId } = payload || {};

    if (!alertId) {
      this.sendToClient(client, {
        type: 'error',
        payload: { message: 'Alert ID required' },
      });
      return;
    }

    try {
      await this.pool.query(
        `UPDATE quality_alerts_realtime
         SET status = 'acknowledged',
             acknowledged_at = NOW(),
             acknowledged_by = $1
         WHERE id = $2`,
        [client.userId || 'anonymous', alertId]
      );

      this.sendToClient(client, {
        type: 'alert_acknowledged',
        payload: { alertId, status: 'acknowledged' },
      });

      // Broadcast to all clients
      this.broadcast({
        type: 'alert_status_changed',
        payload: { alertId, status: 'acknowledged', acknowledgedBy: client.userId },
      });
    } catch (error: any) {
      console.error('Error acknowledging alert:', error);
      this.sendToClient(client, {
        type: 'error',
        payload: { message: 'Failed to acknowledge alert' },
      });
    }
  }

  /**
   * Broadcast metric change to subscribed clients
   */
  private broadcastMetricChange(metric: QualityMetric): void {
    const message = {
      type: 'metric_change',
      payload: metric,
      timestamp: new Date(),
    };

    this.clients.forEach(client => {
      if (
        client.subscriptions.has('all') ||
        client.subscriptions.has(metric.assetId)
      ) {
        this.sendToClient(client, message);
      }
    });
  }

  /**
   * Broadcast alert to subscribed clients
   */
  private broadcastAlert(alert: QualityAlert): void {
    const message = {
      type: 'alert',
      payload: alert,
      timestamp: new Date(),
    };

    this.clients.forEach(client => {
      if (
        client.subscriptions.has('all') ||
        client.subscriptions.has(alert.assetId)
      ) {
        this.sendToClient(client, message);
      }
    });

    console.log(`🔔 Alert broadcasted: ${alert.severity} - ${alert.message}`);
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: any): void {
    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: ClientConnection, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${client.id}:`, error);
      }
    }
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`📡 Client disconnected: ${clientId}`);
      this.clients.delete(clientId);

      // Clean up session in database
      this.removeSession(clientId).catch(err =>
        console.error('Failed to remove session:', err)
      );
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          console.log(`💀 Terminating dead connection: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Extract user ID from request (from JWT or session)
   */
  private extractUserId(req: any): string | undefined {
    // TODO: Extract from JWT token or session
    // For now, return undefined (anonymous)
    return undefined;
  }

  /**
   * Store WebSocket session in database
   */
  private async storeSession(client: ClientConnection): Promise<void> {
    await this.pool.query(
      `INSERT INTO websocket_sessions (id, user_id, connection_id, connected_at, last_ping_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (connection_id) DO UPDATE
       SET last_ping_at = EXCLUDED.last_ping_at`,
      [client.id, client.userId, client.id, client.connectedAt, new Date()]
    );
  }

  /**
   * Remove WebSocket session from database
   */
  private async removeSession(clientId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM websocket_sessions WHERE id = $1`,
      [clientId]
    );
  }

  /**
   * Start the quality monitoring system
   */
  public async start(): Promise<void> {
    console.log('🚀 Starting real-time quality monitoring...');
    await this.monitor.start(30000); // Scan every 30 seconds
    console.log('✅ Real-time quality monitoring active');
  }

  /**
   * Stop the quality monitoring system
   */
  public async stop(): Promise<void> {
    console.log('🛑 Stopping real-time quality monitoring...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    this.clients.forEach(client => {
      this.sendToClient(client, {
        type: 'server_shutdown',
        payload: { message: 'Server is shutting down' },
      });
      client.ws.close();
    });

    // Stop monitor
    this.monitor.stop();
    await this.monitor.cleanup();

    // Close WebSocket server
    this.wss.close();

    console.log('✅ Real-time quality monitoring stopped');
  }

  /**
   * Get connection statistics
   */
  public getStats(): any {
    return {
      totalConnections: this.clients.size,
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        userId: c.userId,
        subscriptions: Array.from(c.subscriptions),
        connectedAt: c.connectedAt,
        isAlive: c.isAlive,
      })),
    };
  }
}
