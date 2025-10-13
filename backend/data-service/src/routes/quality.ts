// backend/data-service/src/routes/quality.ts
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { QualityController } from '../controllers/QualityController';
import { auditMiddleware } from '../middleware/audit';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createRateLimit } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';

const router = Router();
const controller = new QualityController();

// Enhanced rate limiting with different tiers
const strictRateLimit = createRateLimit({ 
  windowMs: 60_000, 
  max: 10,
  skipSuccessfulRequests: false,
  standardHeaders: true
});

const moderateRateLimit = createRateLimit({ 
  windowMs: 60_000, 
  max: 60,
  skipSuccessfulRequests: true,
  standardHeaders: true
});

const listRateLimit = createRateLimit({ 
  windowMs: 60_000, 
  max: 120,
  skipSuccessfulRequests: true,
  standardHeaders: true
});

// Validation schemas for reuse
const uuidValidation = param('id')
  .isUUID(4)
  .withMessage('Invalid UUID format')
  .bail();

const paginationValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative')
    .toInt()
];

const sqlValidationFunction = (value: string) => {
  // Basic SQL injection prevention
  const dangerous = /(\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/i;
  if (dangerous.test(value)) {
    throw new Error('Expression contains forbidden SQL keywords');
  }
  if (!value.trim().toUpperCase().startsWith('SELECT')) {
    throw new Error('Expression must start with SELECT');
  }
  return true;
};

const ruleValidation = [
  body('name')
    .isString()
    .isLength({ min: 2, max: 255 })
    .trim()
    .withMessage('Name must be between 2 and 255 characters'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .trim()
    .withMessage('Description must not exceed 1000 characters'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('type')
    .optional()
    .isIn(['sql', 'metric'])
    .withMessage('Invalid rule type'),
  body('dialect')
    .optional()
    .isIn(['postgres', 'generic'])
    .withMessage('Invalid dialect'),
  body('expression')
    .isString()
    .isLength({ min: 3, max: 10000 })
    .withMessage('Expression must be between 3 and 10000 characters')
    .custom(sqlValidationFunction),
  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Tags must be an array with maximum 20 items')
    .custom((tags) => {
      if (tags && !tags.every((tag: any) => typeof tag === 'string' && tag.length <= 50)) {
        throw new Error('Each tag must be a string with maximum 50 characters');
      }
      return true;
    }),
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean')
];

// Routes

/**
 * @route GET /api/quality/health
 * @desc Health check for quality service
 * @access Public
 */
router.get(
  '/health',
  listRateLimit,
  asyncHandler(controller.healthCheck)
);

router.get(
  '/summary',
  optionalAuthMiddleware,
  [
    query('timeframe')
      .optional()
      .isIn(['24h', '7d', '30d', '90d'])
      .withMessage('Invalid timeframe')
  ],
  validateRequest,
  listRateLimit,
  auditMiddleware('QUALITY_SUMMARY', 'READ'),
  asyncHandler(controller.getQualitySummary)
);

/**
 * @route GET /api/quality/rules
 * @desc List quality rules with filtering and pagination
 * @access Public (with optional auth for enhanced features)
 */
router.get(
  '/rules',
  optionalAuthMiddleware,
  [
    query('q')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .trim()
      .withMessage('Search query must not exceed 100 characters'),
    query('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity filter'),
    query('enabled')
      .optional()
      .isBoolean()
      .toBoolean()
      .withMessage('Enabled filter must be boolean'),
    ...paginationValidation
  ],
  validateRequest,
  listRateLimit,
  auditMiddleware('QUALITY_RULES', 'LIST'),
  asyncHandler(controller.listRules)
);

/**
 * @route GET /api/quality/rules/:id
 * @desc Get a specific quality rule
 * @access Public
 */
router.get(
  '/rules/:id',
  uuidValidation,
  validateRequest,
  moderateRateLimit,
  auditMiddleware('QUALITY_RULE', 'ACCESS'),
  asyncHandler(controller.getRule)
);

/**
 * @route POST /api/quality/rules
 * @desc Create a new quality rule
 * @access Private
 */
router.post(
  '/rules',
  authMiddleware,
  ruleValidation,
  validateRequest,
  strictRateLimit,
  auditMiddleware('QUALITY_RULE', 'CREATE'),
  asyncHandler(controller.createRule)
);

/**
 * @route PUT /api/quality/rules/:id
 * @desc Update an existing quality rule
 * @access Private
 */
router.put(
  '/rules/:id',
  authMiddleware,
  uuidValidation,
  [
    body('name')
      .optional()
      .isString()
      .isLength({ min: 2, max: 255 })
      .trim()
      .withMessage('Name must be between 2 and 255 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .trim()
      .withMessage('Description must not exceed 1000 characters'),
    body('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity level'),
    body('expression')
      .optional()
      .isString()
      .isLength({ min: 3, max: 10000 })
      .withMessage('Expression must be between 3 and 10000 characters')
      .custom((value) => {
        if (value) {
          const dangerous = /(\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/i;
          if (dangerous.test(value)) {
            throw new Error('Expression contains forbidden SQL keywords');
          }
          if (!value.trim().toUpperCase().startsWith('SELECT')) {
            throw new Error('Expression must start with SELECT');
          }
        }
        return true;
      }),
    body('tags')
      .optional()
      .isArray({ max: 20 })
      .withMessage('Tags must be an array with maximum 20 items')
      .custom((tags) => {
        if (tags && !tags.every((tag: any) => typeof tag === 'string' && tag.length <= 50)) {
          throw new Error('Each tag must be a string with maximum 50 characters');
        }
        return true;
      }),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('Enabled must be a boolean')
  ],
  validateRequest,
  strictRateLimit,
  auditMiddleware('QUALITY_RULE', 'UPDATE'),
  asyncHandler(controller.updateRule)
);

/**
 * @route DELETE /api/quality/rules/:id
 * @desc Delete (disable) a quality rule
 * @access Private
 */
router.delete(
  '/rules/:id',
  authMiddleware,
  uuidValidation,
  validateRequest,
  strictRateLimit,
  auditMiddleware('QUALITY_RULE', 'DELETE'),
  asyncHandler(controller.deleteRule)
);

/**
 * @route POST /api/quality/rules/:id/execute
 * @desc Execute a quality rule
 * @access Private
 */
router.post(
  '/rules/:id/execute',
  authMiddleware,
  uuidValidation,
  [
    body('dataSourceId')
      .optional()
      .isUUID(4)
      .withMessage('Invalid data source ID format'),
    body('timeout')
      .optional()
      .isInt({ min: 1000, max: 300000 })
      .withMessage('Timeout must be between 1000 and 300000 milliseconds')
      .toInt()
  ],
  validateRequest,
  strictRateLimit,
  auditMiddleware('QUALITY_RULE', 'EXECUTE'),
  asyncHandler(controller.executeRule)
);

/**
 * @route GET /api/quality/results
 * @desc List quality rule execution results
 * @access Public (with optional auth)
 */
router.get(
  '/results',
  optionalAuthMiddleware,
  [
    query('ruleId')
      .optional()
      .isUUID(4)
      .withMessage('Invalid rule ID format'),
    query('dataSourceId')
      .optional()
      .isUUID(4)
      .withMessage('Invalid data source ID format'),
    query('status')
      .optional()
      .isIn(['passed', 'failed', 'error', 'skipped', 'timeout'])
      .withMessage('Invalid status filter'),
    ...paginationValidation
  ],
  validateRequest,
  listRateLimit,
  auditMiddleware('QUALITY_RESULTS', 'LIST'),
  asyncHandler(controller.listResults)
);

// Bulk operations endpoint
/**
 * @route POST /api/quality/rules/bulk/execute
 * @desc Execute multiple quality rules
 * @access Private
 */
router.post(
  '/rules/bulk/execute',
  authMiddleware,
  [
    body('ruleIds')
      .isArray({ min: 1, max: 10 })
      .withMessage('Must provide 1-10 rule IDs')
      .custom((ruleIds) => {
        if (!ruleIds.every((id: any) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
          throw new Error('All rule IDs must be valid UUIDs');
        }
        return true;
      }),
    body('dataSourceId')
      .optional()
      .isUUID(4)
      .withMessage('Invalid data source ID format')
  ],
  validateRequest,
  createRateLimit({ windowMs: 300_000, max: 5 }), // Very limited for bulk operations
  auditMiddleware('QUALITY_RULES', 'BULK_EXECUTE'),
  asyncHandler(controller.executeRule)
);

// Statistics endpoint
/**
 * @route GET /api/quality/stats
 * @desc Get quality statistics
 * @access Public (with optional auth)
 */
router.get(
  '/stats',
  optionalAuthMiddleware,
  [
    query('timeframe')
      .optional()
      .isIn(['24h', '7d', '30d', '90d'])
      .withMessage('Invalid timeframe'),
    query('groupBy')
      .optional()
      .isIn(['severity', 'status', 'data_source'])
      .withMessage('Invalid groupBy parameter')
  ],
  validateRequest,
  moderateRateLimit,
  auditMiddleware('QUALITY_STATS', 'ACCESS'),
  asyncHandler(controller.getQualityStats)
);

// Error handling middleware for this router
router.use((error: any, req: any, res: any, next: any) => {
  const errorResponse = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      ...(error.details && { details: error.details }),
      ...(error.errorId && { errorId: error.errorId })
    },
    meta: {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  };

  const statusCode = error.statusCode || 500;
  
  // Don't expose internal error details in production
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  }

  res.status(statusCode).json(errorResponse);
});

// ============================================================================
// ENHANCED QUALITY ROUTES - Profiling & Scanning
// ============================================================================

/**
 * @route GET /api/quality/profiles
 * @desc Get persisted profiles from database
 * @access Public
 */
router.get(
  '/profiles',
  optionalAuthMiddleware,
  [
    query('dataSourceId').optional().isUUID(4).withMessage('Invalid data source ID'),
    query('assetId').optional().isInt({ min: 1 }).withMessage('Invalid asset ID'),
  ],
  validateRequest,
  listRateLimit,
  auditMiddleware('QUALITY_PROFILES', 'READ'),
  asyncHandler(controller.getPersistedProfiles)
);

/**
 * @route POST /api/quality/profile/asset/:id
 * @desc Profile a specific asset (table/view)
 * @access Private
 */
router.post(
  '/profile/asset/:id',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('Asset ID must be a positive integer'),
  ],
  validateRequest,
  strictRateLimit,
  auditMiddleware('QUALITY_PROFILE', 'CREATE'),
  asyncHandler(controller.profileAsset)
);

/**
 * @route POST /api/quality/profile/datasource/:id
 * @desc Profile entire data source (all assets)
 * @access Private
 */
router.post(
  '/profile/datasource/:id',
  authMiddleware,
  [
    param('id').isUUID(4).withMessage('Data source ID must be a valid UUID'),
  ],
  validateRequest,
  strictRateLimit,
  auditMiddleware('QUALITY_PROFILE', 'CREATE'),
  asyncHandler(controller.profileDataSource)
);

/**
 * @route GET /api/quality/profile/asset/:id/suggestions
 * @desc Get AI-generated rule suggestions for an asset
 * @access Public
 */
router.get(
  '/profile/asset/:id/suggestions',
  optionalAuthMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('Asset ID must be a positive integer'),
  ],
  validateRequest,
  listRateLimit,
  auditMiddleware('QUALITY_SUGGESTIONS', 'READ'),
  asyncHandler(controller.getProfileSuggestions)
);

/**
 * @route POST /api/quality/scan/:dataSourceId
 * @desc Scan data source with all enabled rules
 * @access Private
 */
router.post(
  '/scan/:dataSourceId',
  authMiddleware,
  [
    param('dataSourceId').isUUID(4).withMessage('Data source ID must be a valid UUID'),
    body('ruleIds').optional().isArray().withMessage('Rule IDs must be an array'),
  ],
  validateRequest,
  strictRateLimit,
  auditMiddleware('QUALITY_SCAN', 'EXECUTE'),
  asyncHandler(controller.scanDataSource)
);

/**
 * @route POST /api/quality/rules/:id/execute/v2
 * @desc Execute single rule with enhanced engine
 * @access Private
 */
router.post(
  '/rules/:id/execute/v2',
  optionalAuthMiddleware,  // Changed to optional for demo
  [
    param('id').isString().withMessage('Rule ID is required'),  // Allow non-UUID IDs for mock data
  ],
  validateRequest,
  moderateRateLimit,
  auditMiddleware('QUALITY_RULE', 'EXECUTE'),
  asyncHandler(controller.executeRuleV2)
);

/**
 * @route GET /api/quality/issues
 * @desc List quality issues with filters
 * @access Public
 */
router.get(
  '/issues',
  optionalAuthMiddleware,
  [
    query('status').optional().isIn(['open', 'acknowledged', 'in_progress', 'resolved', 'false_positive', 'wont_fix']),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('dataSourceId').optional().isUUID(4),
    query('assetId').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validateRequest,
  listRateLimit,
  auditMiddleware('QUALITY_ISSUES', 'READ'),
  asyncHandler(controller.listIssues)
);

/**
 * @route PATCH /api/quality/issues/:id/status
 * @desc Update issue status
 * @access Private
 */
router.patch(
  '/issues/:id/status',
  authMiddleware,
  [
    param('id').isString().withMessage('Issue ID is required'),
    body('status').isIn(['open', 'acknowledged', 'in_progress', 'resolved', 'false_positive', 'wont_fix']).withMessage('Invalid status'),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  validateRequest,
  moderateRateLimit,
  auditMiddleware('QUALITY_ISSUE', 'UPDATE'),
  asyncHandler(controller.updateIssueStatus)
);

/**
 * @route GET /api/quality/trends
 * @desc Get quality trends over time
 * @access Public
 */
router.get(
  '/trends',
  optionalAuthMiddleware,
  [
    query('dataSourceId').optional().isUUID(4),
    query('timeframe').optional().isIn(['24h', '7d', '30d', '90d']).withMessage('Invalid timeframe'),
  ],
  validateRequest,
  listRateLimit,
  auditMiddleware('QUALITY_TRENDS', 'READ'),
  asyncHandler(controller.getQualityTrends)
);

/**
 * @route POST /api/quality/ai/generate-rule
 * @desc Generate quality rule from natural language
 * @access Private
 */
router.post(
  '/ai/generate-rule',
  authMiddleware,
  [
    body('prompt').isString().isLength({ min: 10, max: 500 }).withMessage('Prompt must be 10-500 characters'),
    body('context').optional().isObject(),
  ],
  validateRequest,
  strictRateLimit,
  auditMiddleware('QUALITY_AI', 'GENERATE'),
  asyncHandler(controller.generateRuleFromText)
);

/**
 * @route GET /api/quality/rule-templates
 * @desc Get available rule templates based on industry best practices
 * @access Public
 */
router.get(
  '/rule-templates',
  optionalAuthMiddleware,
  [
    query('dimension')
      .optional()
      .isIn(['completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness'])
      .withMessage('Invalid dimension filter'),
    query('search')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .trim()
      .withMessage('Search query must not exceed 100 characters'),
    query('category')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .trim()
      .withMessage('Category must not exceed 50 characters')
  ],
  validateRequest,
  listRateLimit,
  auditMiddleware('QUALITY_TEMPLATES', 'READ'),
  asyncHandler(controller.getRuleTemplates)
);

/**
 * @route POST /api/quality/rule-templates/:templateId/apply
 * @desc Apply a rule template with parameters
 * @access Public (with optional auth)
 */
router.post(
  '/rule-templates/:templateId/apply',
  optionalAuthMiddleware,
  [
    param('templateId').isString().withMessage('Template ID is required'),
    body('parameters').isObject().withMessage('Parameters object is required'),
    body('parameters.tableName').isString().withMessage('Table name is required'),
  ],
  validateRequest,
  moderateRateLimit,
  auditMiddleware('QUALITY_TEMPLATE', 'APPLY'),
  asyncHandler(controller.applyRuleTemplate)
);

export default router;
