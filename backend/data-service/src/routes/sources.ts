import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError } from '../middleware/error.js';
import { pageParams } from '../utils/pagination.js';

export const sourcesRouter = Router();

/** GET /sources?search=&page=&pageSize=&sort=name|created_at|type&dir=asc|desc */
sourcesRouter.get('/', async (req, res, next) => {
  try {
    const { page, pageSize, sort, dir, offset } = pageParams(
      {
        page: req.query.page,
        pageSize: req.query.pageSize,
        sort: req.query.sort,
        dir: req.query.dir
      },
      ['name', 'created_at', 'type']
    );

    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (req.query.search) {
      params.push(`%${String(req.query.search)}%`);
      where += ` AND (name ILIKE $${params.length} OR type ILIKE $${params.length})`;
    }

    const countSql = `SELECT COUNT(*)::int AS total FROM sources ${where}`;
    const { rows: countRows } = await pool.query(countSql, params);
    const total = countRows[0]?.total ?? 0;

    params.push(pageSize, offset);
    const dataSql = `
      SELECT id, name, type, created_at
      FROM sources
      ${where}
      ORDER BY ${sort} ${dir}
      LIMIT $${params.length-1} OFFSET $${params.length}
    `;
    const { rows } = await pool.query(dataSql, params);
    res.json({ data: rows, total, page, pageSize });
  } catch (e) { next(e); }
});

/** GET /sources/:id */
sourcesRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, type, config, created_at FROM sources WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, 'Source not found', 'NotFound');
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** POST /sources */
sourcesRouter.post('/', async (req, res, next) => {
  try {
    const Schema = z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      config: z.record(z.any()).optional()
    });
    const body = Schema.parse(req.body);

    const { rows } = await pool.query(
      `INSERT INTO sources (name, type, config)
       VALUES ($1, $2, $3)
       RETURNING id, name, type, created_at`,
      [body.name, body.type, body.config ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
