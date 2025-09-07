import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { RequestsController } from '../controllers/RequestsController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createRateLimit } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';

const r = Router();
const ctrl = new RequestsController();

r.get(
  '/',
  optionalAuthMiddleware,
  query('status').optional().isString(),
  query('type').optional().isString(),
  validateRequest,
  createRateLimit({ windowMs: 60_000, max: 120 }),
  asyncHandler(ctrl.list),
);

r.post(
  '/',
  authMiddleware,
  body('title').isString().isLength({ min: 3, max: 255 }),
  body('type').optional().isIn(['access','change','incident']),
  body('payload').optional().isObject(),
  validateRequest,
  createRateLimit({ windowMs: 60_000, max: 30 }),
  asyncHandler(ctrl.create),
);

r.put(
  '/:id',
  authMiddleware,
  param('id').isString(),
  body('status').optional().isIn(['open','approved','rejected','closed']),
  validateRequest,
  createRateLimit({ windowMs: 60_000, max: 60 }),
  asyncHandler(ctrl.update),
);

export default r;
