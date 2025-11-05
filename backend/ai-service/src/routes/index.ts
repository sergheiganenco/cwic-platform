import { HealthController } from '@/controllers/HealthController';
import { Router } from 'express';
import analysisRoutes from './analysis';
import classificationRoutes from './classification';
import discoveryRoutes from './discovery';
import fieldDiscoveryRoutes from './fieldDiscovery';

const router = Router();
const healthController = new HealthController();

// Health check routes
router.get('/health', healthController.checkHealth);
router.get('/health/ready', healthController.checkReadiness);
router.get('/health/live', healthController.checkLiveness);

// Feature routes
router.use('/discovery', discoveryRoutes);
router.use('/analysis', analysisRoutes);
router.use('/field-discovery', fieldDiscoveryRoutes);
router.use('/classification', classificationRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
  void req;
  res.json({
    service: 'CWIC AI Service',
    version: process.env.APP_VERSION || '1.0.0',
    description: 'AI-powered data discovery and governance service',
    endpoints: {
      discovery: {
        'POST /api/discovery': 'Start field discovery session',
        'GET /api/discovery/:sessionId': 'Get discovery status and results',
        'GET /api/discovery': 'List discovery sessions',
        'DELETE /api/discovery/:sessionId': 'Delete discovery session',
        'POST /api/discovery/query': 'Process natural language query',
        'POST /api/discovery/quality-rules': 'Generate quality rules',
        'POST /api/discovery/explain-violation': 'Explain data quality violation'
      },
      analysis: {
        'POST /api/analysis/schema': 'Analyze database schema',
        'POST /api/analysis/data-sample': 'Analyze data samples',
        'POST /api/analysis/quality-check': 'Perform quality analysis'
      },
      health: {
        'GET /api/health': 'Service health status',
        'GET /api/health/ready': 'Readiness check',
        'GET /api/health/live': 'Liveness check'
      }
    }
  });
});

export default router;
