import { Router } from 'express';
import { TraceController } from '../controllers/TraceController';
import { optionalAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const r = Router();
const ctrl = new TraceController();

// Get trace evidence with sample pairs
r.get('/:edgeId', optionalAuthMiddleware, asyncHandler(ctrl.getTraceEvidence));

// Validate a join between tables
r.post('/validate', optionalAuthMiddleware, asyncHandler(ctrl.validateJoin));

// Analyze SQL for lineage extraction
r.post('/analyze-sql', optionalAuthMiddleware, asyncHandler(ctrl.analyzeSQL));

export default r;
