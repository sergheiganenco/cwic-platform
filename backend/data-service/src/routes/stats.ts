import { Router } from 'express';
import { StatsController } from '../controllers/StatsController';
import { optionalAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const r = Router();
const ctrl = new StatsController();

// Main stats endpoint
r.get('/', optionalAuthMiddleware, asyncHandler(ctrl.get));

export default r;