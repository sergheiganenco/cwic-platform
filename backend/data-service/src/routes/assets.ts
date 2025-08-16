import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError } from '../middleware/error.js';
import { pageParams } from '../utils/pagination.js';

export const assetsRouter = Router();

/** GET /assets?search=&page=&pageSize=&sort=name|created_at|owner&dir=asc|desc */
assetsRouter.get('/', async (req, res, next) => {
  try {
    const { page, pageSize, sort, dir, offset } = pageParams(
      {
        page: req.query.page,
        pageSize: req.query.pageSize,
        sort: req.query.sort,
        dir: req.query.dir
      },
      ['name', 'created_at', 'owner']
    );

    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (req.query.search) {
      params.push(`%${String(req.query.search)}%`);
      where += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    // total
    const countSql = `SELECT COUNT(*)::int AS total FROM assets ${where}`;
    const { rows: countRows } = await pool.query(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // page
    params.push(pageSize, offset);
    const dataSql = `
      SELECT id, name, owner, created_at
      FROM assets
      ${where}
      ORDER BY ${sort} ${dir}
      LIMIT $${params.length-1} OFFSET $${params.length}
    `;
    const { rows } = await pool.query(dataSql, params);

    res.json({ data: rows, total, page, pageSize });
  } catch (e) { next(e); }
});

/** GET /assets/:id */
assetsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { rows } = await pool.query(
      `SELECT id, name, owner, created_at, description, metadata
         FROM assets WHERE id = $1`,
      [id]
    );
    if (!rows[0]) throw new HttpError(404, 'Asset not found', 'NotFound');
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** POST /assets */
assetsRouter.post('/', async (req, res, next) => {
  try {
    const Schema = z.object({
      name: z.string().min(1),
      owner: z.string().min(1),
      description: z.string().optional(),
      metadata: z.record(z.any()).optional()
    });
    const body = Schema.parse(req.body);

    const { rows } = await pool.query(
      `INSERT INTO assets (name, owner, description, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, owner, created_at`,
      [body.name, body.owner, body.description ?? null, body.metadata ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
