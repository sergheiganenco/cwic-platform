import { Router } from 'express';
import { LineageController } from '../controllers/LineageController';
import { optionalAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const r = Router();
const ctrl = new LineageController();

// Original lineage endpoints
r.get('/graph', optionalAuthMiddleware, asyncHandler(ctrl.graph));

// AI-powered endpoints
r.post('/ai/suggestions', optionalAuthMiddleware, asyncHandler(ctrl.aiSuggestions));
r.get('/ai/insights/:tableName', optionalAuthMiddleware, asyncHandler(ctrl.aiInsights));

export default r;