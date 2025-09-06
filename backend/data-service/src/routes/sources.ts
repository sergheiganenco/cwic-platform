// backend/data-service/src/routes/sources.ts
import { Router, type RequestHandler } from 'express';
import { body, param, query } from 'express-validator';
import { DataSourceController } from '../controllers/DataSourceController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createRateLimit } from '../middleware/rateLimit';
import { validateDataSource, validateDataSourceUpdate, validateRequest } from '../middleware/validation';

const router = Router();
const dataSourceController = new DataSourceController();

// Helper to coerce mixed-type middlewares into Express' RequestHandler
const asHandler = (h: any) => h as unknown as RequestHandler;

// 🔐 Auth on every route
router.use(asHandler(authMiddleware));

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────
const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn([
      'postgresql', 'mysql', 'mssql', 'oracle', 'mongodb', 'redis',
      's3', 'azure-blob', 'gcs', 'snowflake', 'bigquery', 'redshift',
      'databricks', 'api', 'file', 'kafka', 'elasticsearch',
    ])
    .withMessage('Invalid source type filter'),
  query('status')
    .optional()
    .isIn(['pending', 'connected', 'disconnected', 'error', 'warning', 'syncing', 'testing'])
    .withMessage('Invalid status filter'),
];

const idValidation = [param('id').isUUID().withMessage('Source ID must be a valid UUID')];

// ─────────────────────────────────────────────────────────────────────────────
// Per-route rate limiters (use the factory; don’t “call” a handler as a fn)
// ─────────────────────────────────────────────────────────────────────────────
const listSourcesLimit          = asHandler(createRateLimit({ windowMs: 60_000, max: 100 }));
const healthLimit               = asHandler(createRateLimit({ windowMs: 60_000, max: 60 }));
const getSourceLimit            = asHandler(createRateLimit({ windowMs: 60_000, max: 200 }));
const schemaLimit               = asHandler(createRateLimit({ windowMs: 60_000, max: 30 }));
const createSourceLimit         = asHandler(createRateLimit({ windowMs: 60_000, max: 20 }));
const testLimit                 = asHandler(createRateLimit({ windowMs: 60_000, max: 10 }));
const discoverSourceLimit       = asHandler(createRateLimit({ windowMs: 60_000, max: 5 }));
const updateSourceLimit         = asHandler(createRateLimit({ windowMs: 60_000, max: 30 }));
const updateStatusLimit         = asHandler(createRateLimit({ windowMs: 60_000, max: 20 }));
const deleteSourceLimit         = asHandler(createRateLimit({ windowMs: 60_000, max: 10 }));

// ─────────────────────────────────────────────────────────────────────────────
// Routes – only methods that exist on DataSourceController
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route GET /api/sources
 * @desc Get all data sources with pagination & filters
 */
router.get(
  '/',
  paginationValidation,
  validateRequest,
  listSourcesLimit,
  asyncHandler(dataSourceController.getAllDataSources),
);

/**
 * @route GET /api/sources/health
 * @desc Health summary of all data sources
 */
router.get(
  '/health',
  healthLimit,
  asyncHandler(dataSourceController.getHealthSummary),
);

/**
 * @route GET /api/sources/:id
 * @desc Get a data source by ID
 */
router.get(
  '/:id',
  idValidation,
  validateRequest,
  getSourceLimit,
  asyncHandler(dataSourceController.getDataSourceById),
);

/**
 * @route GET /api/sources/:id/schema
 * @desc Get schema for a data source
 */
router.get(
  '/:id/schema',
  idValidation,
  validateRequest,
  schemaLimit,
  asyncHandler(dataSourceController.getDataSourceSchema),
);

/**
 * @route POST /api/sources
 * @desc Create a new data source
 */
router.post(
  '/',
  validateDataSource,
  validateRequest,
  createSourceLimit,
  asyncHandler(dataSourceController.createDataSource),
);

/**
 * @route POST /api/sources/:id/test
 * @desc Test connection for an existing source
 * (if you want a “test without creating” endpoint, add a controller method first)
 */
router.post(
  '/:id/test',
  idValidation,
  validateRequest,
  testLimit,
  asyncHandler(dataSourceController.testConnection),
);

/**
 * @route POST /api/sources/:id/discover
 * @desc Trigger discovery/sync on a source
 */
router.post(
  '/:id/discover',
  idValidation,
  [
    body('force').optional().isBoolean().withMessage('Force must be a boolean'),
  ],
  validateRequest,
  discoverSourceLimit,
  asyncHandler(dataSourceController.syncDataSource),
);

/**
 * @route PUT /api/sources/:id
 * @desc Update a data source
 */
router.put(
  '/:id',
  validateDataSourceUpdate,
  validateRequest,
  updateSourceLimit,
  asyncHandler(dataSourceController.updateDataSource),
);

/**
 * @route PUT /api/sources/:id/status
 * @desc Update status for a data source (reuses updateDataSource)
 */
router.put(
  '/:id/status',
  idValidation,
  [
    body('status')
      .isIn(['pending', 'connected', 'disconnected', 'error', 'warning', 'syncing', 'testing'])
      .withMessage('Invalid status'),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters'),
  ],
  validateRequest,
  updateStatusLimit,
  asyncHandler(dataSourceController.updateDataSource),
);

/**
 * @route DELETE /api/sources/:id
 * @desc Delete a data source
 */
router.delete(
  '/:id',
  idValidation,
  validateRequest,
  deleteSourceLimit,
  asyncHandler(dataSourceController.deleteDataSource),
);

export default router;
