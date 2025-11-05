// backend/quality-engine/src/index.ts
// Event-Driven Real-Time Data Quality Monitoring Engine

import express from 'express';
import { initializeOpenTelemetry } from './observability/tracing';
import { QualityEventProcessor } from './services/QualityEventProcessor';
import { MLAnomalyDetector } from './services/MLAnomalyDetector';
import { SmartProfiler } from './services/SmartProfiler';
import { CostAwareScheduler } from './services/CostAwareScheduler';
import { PredictiveQualityEngine } from './services/PredictiveQualityEngine';
import { AutoHealingService } from './services/AutoHealingService';
import { EventStreamManager } from './events/EventStreamManager';
import { MetricsCollector } from './observability/MetricsCollector';
import { logger } from './utils/logger';
import { config } from './config';

// Initialize OpenTelemetry first for distributed tracing
initializeOpenTelemetry('quality-engine');

async function startQualityEngine() {
  try {
    logger.info('🚀 Starting Quality Engine v2.0 - Event-Driven Architecture');

    // Initialize core services
    const eventStream = new EventStreamManager();
    const mlDetector = new MLAnomalyDetector();
    const smartProfiler = new SmartProfiler();
    const costScheduler = new CostAwareScheduler();
    const predictiveEngine = new PredictiveQualityEngine();
    const autoHealer = new AutoHealingService();
    const metricsCollector = new MetricsCollector();

    // Initialize event processor with all services
    const qualityProcessor = new QualityEventProcessor({
      eventStream,
      mlDetector,
      smartProfiler,
      costScheduler,
      predictiveEngine,
      autoHealer,
      metricsCollector
    });

    // Start services
    await eventStream.connect();
    await mlDetector.initialize();
    await smartProfiler.initialize();
    await predictiveEngine.loadModels();
    await qualityProcessor.start();

    // Create Express app for health checks and metrics
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'quality-engine',
        version: '2.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Metrics endpoint for Prometheus
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', metricsCollector.getContentType());
      res.end(await metricsCollector.getMetrics());
    });

    // Manual trigger endpoint for testing
    app.post('/api/quality/check', async (req, res) => {
      try {
        const { assetId, ruleId, immediate } = req.body;

        const result = await qualityProcessor.runQualityCheck({
          assetId,
          ruleId,
          immediate: immediate || false,
          source: 'manual',
          timestamp: new Date()
        });

        res.json({
          success: true,
          data: result
        });
      } catch (error: any) {
        logger.error('Manual quality check failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Anomaly detection endpoint
    app.post('/api/quality/anomaly/detect', async (req, res) => {
      try {
        const { assetId, metrics } = req.body;

        const anomalies = await mlDetector.detectAnomalies(assetId, metrics);

        res.json({
          success: true,
          data: {
            assetId,
            anomalies,
            timestamp: new Date()
          }
        });
      } catch (error: any) {
        logger.error('Anomaly detection failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Predictive quality endpoint
    app.post('/api/quality/predict', async (req, res) => {
      try {
        const { assetId, horizon } = req.body;

        const predictions = await predictiveEngine.predictQuality(
          assetId,
          horizon || 7 // Default 7 days ahead
        );

        res.json({
          success: true,
          data: predictions
        });
      } catch (error: any) {
        logger.error('Quality prediction failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Cost estimation endpoint
    app.post('/api/quality/cost/estimate', async (req, res) => {
      try {
        const { ruleId } = req.body;

        const estimate = await costScheduler.estimateRuleCost(ruleId);

        res.json({
          success: true,
          data: estimate
        });
      } catch (error: any) {
        logger.error('Cost estimation failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Auto-healing status endpoint
    app.get('/api/quality/healing/status', async (req, res) => {
      const status = await autoHealer.getHealingStatus();
      res.json({
        success: true,
        data: status
      });
    });

    const PORT = process.env.QUALITY_ENGINE_PORT || 3010;
    app.listen(PORT, () => {
      logger.info(`✅ Quality Engine running on port ${PORT}`);
      logger.info('📊 Metrics available at /metrics');
      logger.info('🔍 Distributed tracing enabled');
      logger.info('🚀 Real-time event processing active');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await qualityProcessor.stop();
      await eventStream.disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start Quality Engine:', error);
    process.exit(1);
  }
}

// Start the engine
startQualityEngine();