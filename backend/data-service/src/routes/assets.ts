// backend/data-service/src/routes/assets.ts
import { Router, type RequestHandler } from 'express';
import { body, param, query } from 'express-validator';
import { AssetController } from '../controllers/AssetController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createRateLimit } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';

const router = Router();
const assetController = new AssetController();

// Apply authentication to all routes
router.use(authMiddleware as unknown as RequestHandler);

// Validation schemas
const createAssetValidation = [
  body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters'),
  body('type')
    .isIn(['table', 'view', 'file', 'api_endpoint', 'stream', 'model'])
    .withMessage('Invalid asset type'),
  body('dataSourceId').isString().withMessage('Data source ID is required'),
  body('path').isString().withMessage('Asset path is required'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('classification')
    .optional()
    .isIn(['public', 'internal', 'confidential', 'restricted'])
    .withMessage('Invalid classification level'),
];

const updateAssetValidation = [
  param('id').isString().withMessage('Asset ID must be a string'),
  body('name').optional().isString().isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('classification')
    .optional()
    .isIn(['public', 'internal', 'confidential', 'restricted'])
    .withMessage('Invalid classification level'),
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn(['table', 'view', 'file', 'api_endpoint', 'stream', 'model'])
    .withMessage('Invalid asset type filter'),
  query('dataSourceId').optional().isString().withMessage('Data source ID must be a string'),
  query('classification')
    .optional()
    .isIn(['public', 'internal', 'confidential', 'restricted'])
    .withMessage('Invalid classification filter'),
  query('search').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Search term must be between 1 and 100 characters'),
];

const idValidation = [param('id').isString().withMessage('Asset ID must be a string')];

// --- Rate limiters (cast to RequestHandler to avoid type incompatibilities) ---
const asHandler = (h: any) => h as unknown as RequestHandler;

const listAssetsLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 100 }));
const searchAssetsLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 50 }));
const getAssetStatsLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 30 }));
const getAssetLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 200 }));
const getSchemaLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 30 }));
const getLineageLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 20 }));
const getProfileLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 10 }));
const createAssetLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 20 }));
const scanAssetLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 5 }));
const tagOperationsLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 30 }));
const updateAssetLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 30 }));
const updateClassificationLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 20 }));
const deleteAssetLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 10 }));

/**
 * @route GET /api/assets
 * @desc Get all assets with pagination, filtering, and search
 * @access Private
 */
router.get('/', paginationValidation, validateRequest, listAssetsLimit, asyncHandler(assetController.getAllAssets));

/**
 * @route GET /api/assets/search
 * @desc Search assets by name, description, or metadata
 * @access Private
 */
router.get(
  '/search',
  [
    query('q').isString().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
    query('type')
      .optional()
      .isIn(['table', 'view', 'file', 'api_endpoint', 'stream', 'model'])
      .withMessage('Invalid asset type filter'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  ],
  validateRequest,
  searchAssetsLimit,
  asyncHandler(assetController.searchAssets),
);

/**
 * @route GET /api/assets/stats
 * @desc Get asset statistics and overview (global)
 * @access Private
 */
router.get('/stats', getAssetStatsLimit, asyncHandler(assetController.getAssetStats));

/**
 * @route GET /api/assets/:id
 * @desc Get a specific asset by ID
 * @access Private
 */
router.get('/:id', idValidation, validateRequest, getAssetLimit, asyncHandler(assetController.getAssetById));

/**
 * @route GET /api/assets/:id/schema
 * @desc Get schema information for an asset
 * @access Private
 */
router.get('/:id/schema', idValidation, validateRequest, getSchemaLimit, asyncHandler(assetController.getAssetSchema));

/**
 * @route GET /api/assets/:id/lineage
 * @desc Get data lineage for an asset
 * @access Private
 */
router.get('/:id/lineage', idValidation, validateRequest, getLineageLimit, asyncHandler(assetController.getAssetLineage));

/**
 * @route GET /api/assets/:id/profile
 * @desc Get data profile for an asset
 * @access Private
 */
router.get('/:id/profile', idValidation, validateRequest, getProfileLimit, asyncHandler(assetController.getAssetProfile));

/**
 * @route GET /api/assets/:id/stats
 * @desc Get usage statistics for a specific asset
 * @access Private
 */
router.get('/:id/stats', idValidation, validateRequest, getAssetStatsLimit, asyncHandler(assetController.getAssetStats));

/**
 * @route POST /api/assets
 * @desc Create a new asset
 * @access Private
 */
router.post('/', createAssetValidation, validateRequest, createAssetLimit, asyncHandler(assetController.createAsset));

/**
 * @route POST /api/assets/:id/scan
 * @desc Trigger a scan/discovery for an asset
 * @access Private
 */
router.post(
  '/:id/scan',
  idValidation,
  [
    body('type').optional().isIn(['full', 'incremental', 'schema_only', 'profile_only']).withMessage('Invalid scan type'),
    body('force').optional().isBoolean().withMessage('Force must be a boolean'),
  ],
  validateRequest,
  scanAssetLimit,
  asyncHandler(assetController.scanAsset),
);

/**
 * @route POST /api/assets/:id/tags
 * @desc Add tags to an asset
 * @access Private
 */
router.post(
  '/:id/tags',
  idValidation,
  [
    body('tags').isArray({ min: 1 }).withMessage('Tags must be a non-empty array'),
    body('tags.*').isString().isLength({ min: 1, max: 50 }).withMessage('Each tag must be between 1 and 50 characters'),
  ],
  validateRequest,
  tagOperationsLimit,
  asyncHandler(assetController.addTags),
);

/**
 * @route PUT /api/assets/:id
 * @desc Update an asset
 * @access Private
 */
router.put('/:id', updateAssetValidation, validateRequest, updateAssetLimit, asyncHandler(assetController.updateAsset));

/**
 * @route PUT /api/assets/:id/classification
 * @desc Update asset classification
 * @access Private
 */
router.put(
  '/:id/classification',
  idValidation,
  [
    body('classification')
      .isIn(['public', 'internal', 'confidential', 'restricted'])
      .withMessage('Invalid classification level'),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters'),
  ],
  validateRequest,
  updateClassificationLimit,
  asyncHandler(assetController.updateClassification),
);

/**
 * @route DELETE /api/assets/:id
 * @desc Delete an asset (soft delete)
 * @access Private
 */
router.delete('/:id', idValidation, validateRequest, deleteAssetLimit, asyncHandler(assetController.deleteAsset));

/**
 * @route DELETE /api/assets/:id/tags
 * @desc Remove tags from an asset
 * @access Private
 */
router.delete(
  '/:id/tags',
  idValidation,
  [body('tags').isArray({ min: 1 }).withMessage('Tags must be a non-empty array'), body('tags.*').isString().withMessage('Each tag must be a string')],
  validateRequest,
  tagOperationsLimit,
  asyncHandler(assetController.removeTags),
);

export default router;
