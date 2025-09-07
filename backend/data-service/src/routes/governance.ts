import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { GovernanceController } from '../controllers/GovernanceController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createRateLimit } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';

const r = Router();
const ctrl = new GovernanceController();
const listLimit = createRateLimit({ windowMs: 60_000, max: 120 });
const writeLimit = createRateLimit({ windowMs: 60_000, max: 30  });

r.get(
  '/policies',
  optionalAuthMiddleware,
  query('status').optional().isIn(['active','inactive']),
  validateRequest,
  listLimit,
  asyncHandler(ctrl.listPolicies),
);

r.post(
  '/policies',
  authMiddleware,
  body('name').isString().isLength({ min: 2, max: 255 }),
  body('category').optional().isIn(['access','privacy','retention']),
  body('status').optional().isIn(['active','inactive']),
  body('rules').optional().isArray(),
  validateRequest,
  writeLimit,
  asyncHandler(ctrl.createPolicy),
);

r.put(
  '/policies/:id',
  authMiddleware,
  param('id').isString(),
  validateRequest,
  writeLimit,
  asyncHandler(ctrl.updatePolicy),
);

r.delete(
  '/policies/:id',
  authMiddleware,
  param('id').isString(),
  validateRequest,
  writeLimit,
  asyncHandler(ctrl.deletePolicy),
);

export default r;
