import { AnalysisController } from '@/controllers/AnalysisController';
import { authenticateToken } from '@/middleware/auth';
import { validateAnalysisRequest } from '@/middleware/validation';
import { Router } from 'express';

const router = Router();
const analysisController = new AnalysisController();

// All analysis routes require authentication
router.use(authenticateToken);

// Analysis endpoints
router.post('/schema', validateAnalysisRequest, analysisController.analyzeSchema);
router.post('/data-sample', analysisController.analyzeDataSample);
router.post('/quality-check', analysisController.performQualityCheck);

export default router;