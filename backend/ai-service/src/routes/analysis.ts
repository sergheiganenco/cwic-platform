import { AnalysisController } from '@/controllers/AnalysisController';
import { authenticateToken, optionalAuth } from '@/middleware/auth';
import { validateAnalysisRequest } from '@/middleware/validation';
import { Router } from 'express';

const router = Router();
const analysisController = new AnalysisController();

// Apply authentication middleware (use optionalAuth in development for easier testing)
const isDevelopment = process.env.NODE_ENV === 'development';
router.use(isDevelopment ? optionalAuth : authenticateToken);

// Analysis endpoints
router.post('/schema', validateAnalysisRequest, analysisController.analyzeSchema);
router.post('/data-sample', analysisController.analyzeDataSample);
router.post('/quality-check', analysisController.performQualityCheck);

export default router;