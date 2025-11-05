/**
 * Routes for Real-Time Quality Monitoring API
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { RealtimeQualityController } from '../controllers/RealtimeQualityController';

export function createRealtimeQualityRoutes(pool: Pool): Router {
  const router = Router();
  const controller = new RealtimeQualityController(pool);

  // Get current quality metrics
  router.get('/metrics', controller.getMetrics);

  // Get active alerts
  router.get('/alerts', controller.getAlerts);

  // Acknowledge an alert
  router.post('/alerts/:id/acknowledge', controller.acknowledgeAlert);

  // Resolve an alert
  router.post('/alerts/:id/resolve', controller.resolveAlert);

  // Get quality score trends
  router.get('/trends', controller.getTrends);

  // Get multi-dimensional quality scores
  router.get('/dimensions', controller.getDimensionScores);

  // Get overall quality statistics
  router.get('/stats', controller.getStats);

  // Get WebSocket connection statistics
  router.get('/ws/stats', controller.getWebSocketStats);

  return router;
}
