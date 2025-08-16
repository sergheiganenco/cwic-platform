import { DiscoveryController } from '@/controllers/DiscoveryController';
import { authenticateToken } from '@/middleware/auth';
import { aiRateLimitMw, discoveryRateLimitMw } from '@/middleware/rateLimit';
import { validateDiscoveryRequest, validateNLQuery } from '@/middleware/validation';
import { NextFunction, Request, Response, Router } from 'express';

const router = Router();
const controller = new DiscoveryController();

const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<any>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn.call(controller, req, res, next)).catch(next);

// In dev we’ll allow requests without a token; see auth middleware below
router.use(authenticateToken);

router.post('/', discoveryRateLimitMw, validateDiscoveryRequest, asyncHandler(controller.startDiscovery));
router.post('/query', aiRateLimitMw, validateNLQuery, asyncHandler(controller.processNaturalLanguageQuery));
router.post('/quality-rules', aiRateLimitMw, asyncHandler(controller.generateQualityRules));
router.post('/explain-violation', aiRateLimitMw, asyncHandler(controller.explainViolation));

router.get('/', asyncHandler(controller.listDiscoverySessions));
router.get('/:sessionId', asyncHandler(controller.getDiscoveryStatus));
router.delete('/:sessionId', asyncHandler(controller.deleteDiscoverySession));

export default router;
