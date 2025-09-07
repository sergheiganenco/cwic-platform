import { Router } from 'express';
import { LineageController } from '../controllers/LineageController';
import { optionalAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const r = Router();
const ctrl = new LineageController();

r.get('/graph', optionalAuthMiddleware, asyncHandler(ctrl.graph));
export default r;