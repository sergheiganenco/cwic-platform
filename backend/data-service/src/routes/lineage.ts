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
// Demo graph from assets (existing endpoint)
r.get('/graph', optionalAuthMiddleware, asyncHandler(ctrl.graph));

// Get lineage graph with filters
r.get('/', optionalAuthMiddleware, asyncHandler(ctrl.getGraph));

// Column-level lineage
r.get('/column/:assetId/:columnName', optionalAuthMiddleware, asyncHandler(ctrl.columnLineage));

// Impact analysis
r.get('/impact/:nodeId', optionalAuthMiddleware, asyncHandler(ctrl.impactAnalysis));

// Statistics
r.get('/stats', optionalAuthMiddleware, asyncHandler(ctrl.stats));

export default r;