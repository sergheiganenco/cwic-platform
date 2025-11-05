import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { validateRequest } from '../middleware/validation';
import { createRateLimit } from '../middleware/rateLimit';
import { QualityAutopilotService } from '../services/QualityAutopilotService';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';

const router = Router();
const autopilotService = new QualityAutopilotService(pool);

// Moderate rate limiting for autopilot operations
const moderateRateLimit = createRateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  skipSuccessfulRequests: true,
  standardHeaders: true
});

/**
 * @route POST /api/quality/autopilot/enable
 * @desc Enable Quality Autopilot for a data source
 * @access Private
 */
router.post(
  '/enable',
  authMiddleware,
  moderateRateLimit,
  [
    body('dataSourceId')
      .notEmpty()
      .withMessage('Data source ID is required')
      .isUUID(4)
      .withMessage('Invalid data source ID format')
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const { dataSourceId } = req.body;
    const userId = (req as any).user?.id || 'system';

    logger.info(`Enabling Quality Autopilot for data source ${dataSourceId} by user ${userId}`);

    try {
      const result = await autopilotService.enableAutopilot(dataSourceId, userId);

      const processingTime = Date.now() - startTime;

      logger.info(`Autopilot enabled successfully in ${processingTime}ms`, {
        dataSourceId,
        rulesGenerated: result.rulesGenerated,
        userId
      });

      res.json({
        success: true,
        data: result,
        message: `Quality Autopilot enabled! Generated ${result.rulesGenerated} smart rules.`,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Failed to enable autopilot:', error);
      res.status(500).json({
        success: false,
        error: 'AUTOPILOT_ENABLE_FAILED',
        message: error.message || 'Failed to enable Quality Autopilot'
      });
    }
  })
);

/**
 * @route GET /api/quality/autopilot/status/:dataSourceId
 * @desc Get autopilot status for a data source
 * @access Private
 */
router.get(
  '/status/:dataSourceId',
  authMiddleware,
  moderateRateLimit,
  [
    param('dataSourceId')
      .isUUID(4)
      .withMessage('Invalid data source ID format')
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { dataSourceId } = req.params;

    logger.info(`Fetching autopilot status for data source ${dataSourceId}`);

    try {
      const status = await autopilotService.getAutopilotStatus(dataSourceId);

      if (!status) {
        return res.json({
          success: true,
          data: {
            enabled: false,
            message: 'Quality Autopilot is not enabled for this data source'
          }
        });
      }

      res.json({
        success: true,
        data: {
          enabled: true,
          ...status
        }
      });
    } catch (error: any) {
      logger.error('Failed to fetch autopilot status:', error);
      res.status(500).json({
        success: false,
        error: 'AUTOPILOT_STATUS_FAILED',
        message: error.message || 'Failed to fetch autopilot status'
      });
    }
  })
);

/**
 * @route POST /api/quality/autopilot/disable
 * @desc Disable Quality Autopilot for a data source
 * @access Private
 */
router.post(
  '/disable',
  authMiddleware,
  moderateRateLimit,
  [
    body('dataSourceId')
      .notEmpty()
      .withMessage('Data source ID is required')
      .isUUID(4)
      .withMessage('Invalid data source ID format')
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { dataSourceId } = req.body;
    const userId = (req as any).user?.id || 'system';

    logger.info(`Disabling Quality Autopilot for data source ${dataSourceId} by user ${userId}`);

    try {
      await autopilotService.disableAutopilot(dataSourceId);

      logger.info('Autopilot disabled successfully', { dataSourceId, userId });

      res.json({
        success: true,
        message: 'Quality Autopilot disabled successfully'
      });
    } catch (error: any) {
      logger.error('Failed to disable autopilot:', error);
      res.status(500).json({
        success: false,
        error: 'AUTOPILOT_DISABLE_FAILED',
        message: error.message || 'Failed to disable Quality Autopilot'
      });
    }
  })
);

export default router;
