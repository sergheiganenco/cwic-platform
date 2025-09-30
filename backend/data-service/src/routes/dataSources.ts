// backend/data-service/src/routes/dataSources.ts
import { Router, type RequestHandler } from 'express';
import { body, param, query } from 'express-validator';

import { DataSourceController } from '../controllers/DataSourceController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createRateLimit } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';

// Single router file for data sources
const router = Router();
const ctrl = new DataSourceController();
const asHandler = (h: any) => h as unknown as RequestHandler;

const IS_PROD = (process.env.NODE_ENV || '').toLowerCase() === 'production';

/* -------------------------------------------------------------------------- */
/* Type & status normalization                                                */
/* -------------------------------------------------------------------------- */

const CANONICAL_TYPES = [
  'postgresql','mysql','mssql','oracle','mongodb','redis',
  's3','azure-blob','gcs','snowflake','bigquery','redshift',
  'databricks','api','file','kafka','elasticsearch',
] as const;

type CanonicalType = (typeof CANONICAL_TYPES)[number];

const INPUT_TYPES = new Set<string>([...CANONICAL_TYPES, 'postgres']); // accept "postgres"
const INPUT_STATUSES = new Set<string>([
  'active','inactive','pending','error','testing','connected','disconnected','warning','syncing',
]);

const normalizeType = (t?: string): CanonicalType | undefined => {
  if (!t) return undefined;
  const x = t.toLowerCase();
  const mapped = x === 'postgres' ? 'postgresql' : x;
  return (CANONICAL_TYPES as readonly string[]).includes(mapped)
    ? (mapped as CanonicalType)
    : undefined;
};

const ALLOWED_SORT_BY = new Set(['updatedAt','createdAt','name','status','type'] as const);

const normalizeListParams: RequestHandler = (req, _res, next) => {
  // pagination
  const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
  const limitRaw = Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1);
  const limit = Math.min(limitRaw, 100);

  // sorting (keep UI names; service maps -> DB columns)
  const sortByRaw = String(req.query.sortBy ?? '').trim();
  const sortOrderRaw = String(req.query.sortOrder ?? '').trim().toLowerCase();
  const sortBy = ALLOWED_SORT_BY.has(sortByRaw as any) ? sortByRaw : 'updatedAt';
  const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc';

  // filters (normalized)
  const status = typeof req.query.status === 'string' && INPUT_STATUSES.has(req.query.status.toLowerCase())
    ? req.query.status.toLowerCase()
    : undefined;
  const type = normalizeType(req.query.type as string | undefined);

  req.query.page = String(page);
  req.query.limit = String(limit);
  req.query.sortBy = sortBy;
  req.query.sortOrder = sortOrder;
  if (status) req.query.status = status; else delete req.query.status;
  if (type) req.query.type = type; else delete req.query.type;

  next();
};

/* -------------------------------------------------------------------------- */
/* Rate limits                                                                */
/* -------------------------------------------------------------------------- */

const listLimit    = asHandler(createRateLimit({ windowMs: 60_000, max: 100 }));
const healthLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 60  }));
const getByIdLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 200 }));
const schemaLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 30  }));
const createLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 20  }));
const testLimit    = asHandler(createRateLimit({ windowMs: 60_000, max: 60  })); // ↑ allow wizard to click often
const syncLimit    = asHandler(createRateLimit({ windowMs: 60_000, max: 15  }));
const updateLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 30  }));
const deleteLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 10  }));

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

// Fixed validator that accepts both 'config' and 'connection' (API Gateway transforms field names)
const validateConnectionConfig = () => {
  return body().custom((value, { req }) => {
    // Log what we're receiving for debugging
    console.log('🔍 Full request body received:', JSON.stringify(req.body, null, 2));
    
    // API Gateway transforms 'config' to 'connection', so we check both
    const config = req.body?.config || req.body?.connection;
    
    console.log('🔍 Backend validating config/connection:', JSON.stringify(config, null, 2));
    console.log('🔍 Config type:', typeof config);
    console.log('🔍 Config is array:', Array.isArray(config));
    console.log('🔍 Config is null:', config === null);
    
    // Basic checks
    if (config === undefined) {
      console.log('❌ Config/connection is undefined');
      throw new Error('Connection config is required');
    }
    
    if (config === null) {
      console.log('❌ Config/connection is null');
      throw new Error('Connection config cannot be null');
    }
    
    if (typeof config !== 'object') {
      console.log('❌ Config/connection is not an object, type:', typeof config);
      throw new Error('Connection config must be an object');
    }
    
    if (Array.isArray(config)) {
      console.log('❌ Config/connection is an array');
      throw new Error('Connection config cannot be an array');
    }
    
    console.log('✅ Connection config validation passed');
    return true;
  });
};

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString().custom((v) => INPUT_STATUSES.has(String(v).toLowerCase())),
  query('type').optional().isString().custom((v) => INPUT_TYPES.has(String(v).toLowerCase())),
  query('sortBy').optional().isString(),
  query('sortOrder').optional().isIn(['asc','desc']),
  query('search').optional().isString(),
  query('createdBy').optional().isString(),
];

const idValidation = [param('id').isString()];

const createDataSourceValidation = [
  body('name').isString().isLength({ min: 1, max: 255 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('type').isString()
    .custom((val) => INPUT_TYPES.has(String(val).toLowerCase()))
    .customSanitizer((val) => normalizeType(String(val))),
  body('connectionConfig').custom((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Connection config must be a valid object');
    }
    return true;
  }),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
];

const updateDataSourceValidation = [
  param('id').isString(),
  body('name').optional().isString().isLength({ min: 1, max: 255 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('type').optional().isString()
    .custom((val) => INPUT_TYPES.has(String(val).toLowerCase()))
    .customSanitizer((val) => normalizeType(String(val))),
  body('connectionConfig').optional().custom((value) => {
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
      throw new Error('Connection config must be a valid object');
    }
    return true;
  }),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
];

/* -------------------------------------------------------------------------- */
/* Auth guard                                                                 */
/* -------------------------------------------------------------------------- */

const guard: RequestHandler = (req, res, next) => {
  const devBypass =
    !IS_PROD &&
    (
      (process.env.SKIP_AUTH || '').toLowerCase() === 'true' ||
      (process.env.MOCK_AUTH || '').toLowerCase() === 'true' ||
      req.header('x-dev-auth') === '1'
    );
  if (devBypass) return next();
  return authMiddleware(req, res, next);
};

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* (Note: the app mounts this router at /api/data-sources)                    */
/* -------------------------------------------------------------------------- */

// List + summary
router.get(
  '/',
  guard,
  paginationValidation,
  validateRequest,
  normalizeListParams,
  listLimit,
  asyncHandler(ctrl.getAllDataSources),
);
router.get('/health', guard, healthLimit, asyncHandler(ctrl.getHealthSummary));

// CRUD
router.get('/:id', guard, idValidation, validateRequest, getByIdLimit, asyncHandler(ctrl.getDataSourceById));
router.get('/:id/schema', guard, idValidation, validateRequest, schemaLimit, asyncHandler(ctrl.getDataSourceSchema));
router.post('/', guard, createDataSourceValidation, validateRequest, createLimit, asyncHandler(ctrl.createDataSource));
router.put('/:id', guard, updateDataSourceValidation, validateRequest, updateLimit, asyncHandler(ctrl.updateDataSource));
router.delete('/:id', guard, idValidation, validateRequest, deleteLimit, asyncHandler(ctrl.deleteDataSource));

/* ------------------------- Wizard-specific endpoints ---------------------- */
// Test a raw config BEFORE create
router.post(
  '/test',
  guard,
  body('type').isString().custom((v) => INPUT_TYPES.has(String(v).toLowerCase()))
    .customSanitizer((v) => normalizeType(String(v))),
  validateConnectionConfig(),
  validateRequest,
  testLimit,
  asyncHandler(ctrl.testConfig),
);

// Preview discovered DBs from a raw config BEFORE create
router.post(
  '/databases/preview',
  guard,
  body('type').isString().custom((v) => INPUT_TYPES.has(String(v).toLowerCase()))
    .customSanitizer((v) => normalizeType(String(v))),
  validateConnectionConfig(),
  validateRequest,
  listLimit,
  asyncHandler(ctrl.previewDatabases),
);

/* ------------------------- Saved-source operations ------------------------ */
// Connection test for a saved source
router.post('/:id/test', guard, idValidation, validateRequest, testLimit, asyncHandler(ctrl.testConnection));

// Trigger sync/discovery for a saved source
router.post(
  '/:id/sync',
  guard,
  idValidation,
  body('force').optional().isBoolean(),
  validateRequest,
  syncLimit,
  asyncHandler(ctrl.syncDataSource),
);

// Optional: poll sync status (frontend can use this if needed)
router.get('/:id/sync/status', guard, idValidation, validateRequest, listLimit, asyncHandler(ctrl.getSyncStatus));

// List databases belonging to a saved source (used by "Browse Databases")
router.get('/:id/databases', guard, idValidation, validateRequest, listLimit, asyncHandler(ctrl.listDatabases));

export default router;