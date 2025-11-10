import { FieldDiscoveryController } from '@/controllers/FieldDiscoveryController';
import { FieldDiscoveryExportController } from '@/controllers/FieldDiscoveryExportController';
import { authenticateToken, optionalAuth } from '@/middleware/auth';
import { aiRateLimitMw } from '@/middleware/rateLimit';
import { NextFunction, Request, Response, Router } from 'express';

const router = Router();
const controller = new FieldDiscoveryController();
const exportController = new FieldDiscoveryExportController();

const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<any>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn.call(controller, req, res, next)).catch(next);

const exportHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<any>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn.call(exportController, req, res, next)).catch(next);

// Apply authentication middleware (use optionalAuth in development for easier testing)
const isDevelopment = process.env.NODE_ENV === 'development';
router.use(isDevelopment ? optionalAuth : authenticateToken);

// POST /api/ai/field-discovery/discover - Trigger field discovery
router.post(
  '/discover',
  aiRateLimitMw,
  asyncHandler(controller.discoverFields)
);

// GET /api/ai/field-discovery - Get discovered fields
router.get(
  '/',
  asyncHandler(controller.getDiscoveredFields)
);

// GET /api/ai/field-discovery/stats - Get statistics
router.get(
  '/stats',
  asyncHandler(controller.getStats)
);

// GET /api/ai/field-discovery/drift-alerts - Get drift alerts
router.get(
  '/drift-alerts',
  asyncHandler(controller.getDriftAlerts)
);

// PATCH /api/ai/field-discovery/:id/status - Update field status
router.patch(
  '/:id/status',
  aiRateLimitMw,
  asyncHandler(controller.updateFieldStatus)
);

// POST /api/ai/field-discovery/:id/classify - Manually classify a field
router.post(
  '/:id/classify',
  aiRateLimitMw,
  asyncHandler(controller.classifyField)
);

// POST /api/ai/field-discovery/bulk-action - Bulk operations
router.post(
  '/bulk-action',
  aiRateLimitMw,
  asyncHandler(controller.bulkAction)
);

// GET /api/ai/field-discovery/export - Export discovered fields
router.get(
  '/export',
  exportHandler(exportController.exportFields)
);

// GET /api/ai/field-discovery/report - Generate compliance report
router.get(
  '/report',
  exportHandler(exportController.generateReport)
);

export default router;
