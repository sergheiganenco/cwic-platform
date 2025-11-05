import { ClassificationController } from '@/controllers/ClassificationController';
import { authenticateToken, optionalAuth } from '@/middleware/auth';
import { aiRateLimitMw } from '@/middleware/rateLimit';
import { NextFunction, Request, Response, Router } from 'express';

const router = Router();
const controller = new ClassificationController();

const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<any>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn.call(controller, req, res, next)).catch(next);

// Apply authentication middleware (use optionalAuth in development for easier testing)
const isDevelopment = process.env.NODE_ENV === 'development';
router.use(isDevelopment ? optionalAuth : authenticateToken);

// Policies endpoints
router.get(
  '/policies',
  asyncHandler(controller.getPolicies)
);

router.get(
  '/policies/:id',
  asyncHandler(controller.getPolicy)
);

router.post(
  '/policies',
  aiRateLimitMw,
  asyncHandler(controller.createPolicy)
);

router.patch(
  '/policies/:id',
  aiRateLimitMw,
  asyncHandler(controller.updatePolicy)
);

router.delete(
  '/policies/:id',
  aiRateLimitMw,
  asyncHandler(controller.deletePolicy)
);

router.post(
  '/policies/:id/run',
  aiRateLimitMw,
  asyncHandler(controller.runPolicy)
);

// Review queue endpoints
router.get(
  '/review-queue',
  asyncHandler(controller.getReviewQueue)
);

router.post(
  '/review/:id',
  aiRateLimitMw,
  asyncHandler(controller.reviewItem)
);

router.post(
  '/review/bulk-approve',
  aiRateLimitMw,
  asyncHandler(controller.bulkApprove)
);

// Statistics endpoint
router.get(
  '/stats',
  asyncHandler(controller.getStats)
);

export default router;
