import { Router, type RequestHandler } from 'express';
import { body, param, query } from 'express-validator';
import { DataSourceController } from '../controllers/DataSourceController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createRateLimit } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';

// Use this ONE router file. Delete/ignore DataSources.routes.ts.
const router = Router();
const ctrl = new DataSourceController();

const asHandler = (h: any) => h as unknown as RequestHandler;
const IS_PROD = (process.env.NODE_ENV || '').toLowerCase() === 'production';

/** Type normalizers (inputs -> canonical) */
const CANONICAL_TYPES = [
  'postgresql','mysql','mssql','oracle','mongodb','redis',
  's3','azure-blob','gcs','snowflake','bigquery','redshift',
  'databricks','api','file','kafka','elasticsearch',
] as const;
type CanonicalType = (typeof CANONICAL_TYPES)[number];

const INPUT_TYPES = new Set<string>([...CANONICAL_TYPES, 'postgres']);
const normalizeType = (t?: string): CanonicalType | undefined => {
  if (!t) return undefined;
  const x = t.toLowerCase();
  const mapped = x === 'postgres' ? 'postgresql' : x;
  return (CANONICAL_TYPES as readonly string[]).includes(mapped)
    ? (mapped as CanonicalType)
    : undefined;
};

const INPUT_STATUSES = new Set<string>([
  'active','inactive','pending','error','testing','connected','disconnected','warning','syncing',
]);

/** Sort keys we allow from the UI */
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

// Rate limits
const listLimit    = asHandler(createRateLimit({ windowMs: 60_000, max: 100 }));
const healthLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 60  }));
const getByIdLimit = asHandler(createRateLimit({ windowMs: 60_000, max: 200 }));
const schemaLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 30  }));
const createLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 20  }));
const testLimit    = asHandler(createRateLimit({ windowMs: 60_000, max: 10  }));
const syncLimit    = asHandler(createRateLimit({ windowMs: 60_000, max: 5   }));
const updateLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 30  }));
const deleteLimit  = asHandler(createRateLimit({ windowMs: 60_000, max: 10  }));

// Validation
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
  body('connectionConfig').isObject(),
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
  body('connectionConfig').optional().isObject(),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
];

/** Guard: in dev accept SKIP_AUTH=true or header X-Dev-Auth: 1 */
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

/** ROUTES (relative!) — app.ts adds the /api/data-sources & /data-sources prefixes */
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

router.get('/:id', guard, idValidation, validateRequest, getByIdLimit, asyncHandler(ctrl.getDataSourceById));
router.get('/:id/schema', guard, idValidation, validateRequest, schemaLimit, asyncHandler(ctrl.getDataSourceSchema));

router.post('/', guard, createDataSourceValidation, validateRequest, createLimit, asyncHandler(ctrl.createDataSource));
router.put('/:id', guard, updateDataSourceValidation, validateRequest, updateLimit, asyncHandler(ctrl.updateDataSource));
router.delete('/:id', guard, idValidation, validateRequest, deleteLimit, asyncHandler(ctrl.deleteDataSource));

router.post('/:id/test', guard, idValidation, validateRequest, testLimit, asyncHandler(ctrl.testConnection));
router.post('/:id/sync',
  guard,
  idValidation,
  body('force').optional().isBoolean(),
  validateRequest,
  syncLimit,
  asyncHandler(ctrl.syncDataSource),
);

export default router;
