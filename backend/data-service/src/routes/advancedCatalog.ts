// Advanced Catalog API Routes
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { AdvancedCatalogService } from '../services/AdvancedCatalogService';

const router = Router();

// Initialize service (will be injected in app.ts)
let catalogService: AdvancedCatalogService;

export function initAdvancedCatalog(db: Pool): Router {
  catalogService = new AdvancedCatalogService(db);

  // Get hierarchical catalog structure
  router.get('/hierarchy', async (req: Request, res: Response) => {
    try {
      const { sourceId } = req.query;

      const query = sourceId
        ? `SELECT * FROM v_catalog_hierarchy WHERE source_id = $1 ORDER BY source_name, database_name, schema_name, object_name`
        : `SELECT * FROM v_catalog_hierarchy ORDER BY source_name, database_name, schema_name, object_name`;

      const params = sourceId ? [sourceId] : [];
      const result = await (catalogService as any).db.query(query, params);

      // Transform to hierarchical structure
      const hierarchy = buildHierarchy(result.rows);

      res.json({ success: true, data: hierarchy });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get catalog objects with advanced filtering
  router.get('/objects', async (req: Request, res: Response) => {
    try {
      const {
        search,
        sourceIds,
        databaseIds,
        schemaIds,
        objectTypes,
        classifications,
        minQuality,
        tags,
        page = '1',
        limit = '50'
      } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const where: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      // Full-text search
      if (search) {
        where.push(`search_vector @@ plainto_tsquery('english', $${paramCount++})`);
        params.push(search);
      }

      // Filters
      if (sourceIds) {
        where.push(`datasource_id = ANY($${paramCount++}::uuid[])`);
        params.push((sourceIds as string).split(','));
      }

      if (databaseIds) {
        where.push(`database_id = ANY($${paramCount++}::bigint[])`);
        params.push((databaseIds as string).split(',').map(Number));
      }

      if (schemaIds) {
        where.push(`schema_id = ANY($${paramCount++}::bigint[])`);
        params.push((schemaIds as string).split(',').map(Number));
      }

      if (objectTypes) {
        where.push(`object_type = ANY($${paramCount++}::text[])`);
        params.push((objectTypes as string).split(','));
      }

      if (classifications) {
        where.push(`classification = ANY($${paramCount++}::text[])`);
        params.push((classifications as string).split(','));
      }

      if (minQuality) {
        where.push(`quality_score >= $${paramCount++}`);
        params.push(parseInt(minQuality as string));
      }

      if (tags) {
        where.push(`tags && $${paramCount++}::text[]`);
        params.push((tags as string).split(','));
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      // Get total count
      const countResult = await (catalogService as any).db.query(
        `SELECT COUNT(*) as total FROM catalog_objects ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Get objects with joins
      params.push(parseInt(limit as string), offset);
      const objectsResult = await (catalogService as any).db.query(`
        SELECT
          obj.*,
          sch.name as schema_name,
          db.name as database_name,
          ds.name as source_name,
          ds.type as source_type,
          (SELECT COUNT(*) FROM catalog_bookmarks WHERE object_id = obj.id) as bookmark_count,
          (SELECT COUNT(*) FROM catalog_comments WHERE object_id = obj.id) as comment_count
        FROM catalog_objects obj
        JOIN catalog_schemas sch ON sch.id = obj.schema_id
        JOIN catalog_databases db ON db.id = obj.database_id
        JOIN data_sources ds ON ds.id = obj.datasource_id
        ${whereClause}
        ORDER BY obj.popularity_score DESC, obj.access_count DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `, params);

      res.json({
        success: true,
        data: {
          objects: objectsResult.rows,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            totalPages: Math.ceil(total / parseInt(limit as string))
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get object details with columns
  router.get('/objects/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const objectResult = await (catalogService as any).db.query(`
        SELECT
          obj.*,
          sch.name as schema_name,
          db.name as database_name,
          ds.name as source_name,
          ds.type as source_type
        FROM catalog_objects obj
        JOIN catalog_schemas sch ON sch.id = obj.schema_id
        JOIN catalog_databases db ON db.id = obj.database_id
        JOIN data_sources ds ON ds.id = obj.datasource_id
        WHERE obj.id = $1
      `, [id]);

      if (objectResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Object not found' });
      }

      const object = objectResult.rows[0];

      // Get columns
      const columnsResult = await (catalogService as any).db.query(`
        SELECT * FROM catalog_columns
        WHERE object_id = $1
        ORDER BY ordinal_position
      `, [id]);

      // Get lineage
      const upstreamResult = await (catalogService as any).db.query(`
        SELECT
          obj.id,
          obj.name,
          obj.fully_qualified_name,
          l.lineage_type
        FROM catalog_lineage l
        JOIN catalog_objects obj ON obj.id = l.from_object_id
        WHERE l.to_object_id = $1
      `, [id]);

      const downstreamResult = await (catalogService as any).db.query(`
        SELECT
          obj.id,
          obj.name,
          obj.fully_qualified_name,
          l.lineage_type
        FROM catalog_lineage l
        JOIN catalog_objects obj ON obj.id = l.to_object_id
        WHERE l.from_object_id = $1
      `, [id]);

      res.json({
        success: true,
        data: {
          ...object,
          columns: columnsResult.rows,
          lineage: {
            upstream: upstreamResult.rows,
            downstream: downstreamResult.rows
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Start scan
  router.post('/scan', async (req: Request, res: Response) => {
    try {
      const config = req.body;
      const triggeredBy = (req as any).user?.email || 'system';

      const result = await catalogService.startScan(config, triggeredBy);

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get scan progress
  router.get('/scan/:scanId/progress', async (req: Request, res: Response) => {
    try {
      const { scanId } = req.params;
      const progress = await catalogService.getScanProgress(scanId);

      if (!progress) {
        return res.status(404).json({ success: false, error: 'Scan not found' });
      }

      res.json({ success: true, data: progress });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get scan history
  router.get('/scans', async (req: Request, res: Response) => {
    try {
      const { sourceId, limit = '10' } = req.query;

      const where = sourceId ? 'WHERE datasource_id = $1' : '';
      const params = sourceId ? [sourceId, parseInt(limit as string)] : [parseInt(limit as string)];

      const result = await (catalogService as any).db.query(`
        SELECT
          sh.*,
          ds.name as source_name,
          (SELECT COUNT(*) FROM catalog_scan_errors WHERE scan_id = sh.scan_id) as error_count
        FROM catalog_scan_history sh
        JOIN data_sources ds ON ds.id = sh.datasource_id
        ${where}
        ORDER BY sh.created_at DESC
        LIMIT $${sourceId ? 2 : 1}
      `, params);

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get popular objects
  router.get('/popular', async (req: Request, res: Response) => {
    try {
      const result = await (catalogService as any).db.query(`
        SELECT * FROM v_popular_objects LIMIT 20
      `);

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Bookmark object
  router.post('/objects/:id/bookmark', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'system';

      await (catalogService as any).db.query(`
        INSERT INTO catalog_bookmarks (object_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (object_id, user_id) DO NOTHING
      `, [id, userId]);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Add comment
  router.post('/objects/:id/comments', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = (req as any).user?.id || 'system';

      const result = await (catalogService as any).db.query(`
        INSERT INTO catalog_comments (object_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [id, userId, content]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

// Helper function to build hierarchy
function buildHierarchy(rows: any[]): any[] {
  const sources = new Map();

  rows.forEach(row => {
    // Build source level
    if (!sources.has(row.source_id)) {
      sources.set(row.source_id, {
        id: row.source_id,
        name: row.source_name,
        type: row.source_type,
        databases: new Map()
      });
    }

    const source = sources.get(row.source_id);

    // Build database level
    if (row.database_id && !source.databases.has(row.database_id)) {
      source.databases.set(row.database_id, {
        id: row.database_id,
        name: row.database_name,
        schemas: new Map()
      });
    }

    if (row.database_id) {
      const database = source.databases.get(row.database_id);

      // Build schema level
      if (row.schema_id && !database.schemas.has(row.schema_id)) {
        database.schemas.set(row.schema_id, {
          id: row.schema_id,
          name: row.schema_name,
          objects: []
        });
      }

      if (row.schema_id) {
        const schema = database.schemas.get(row.schema_id);

        // Add object
        if (row.object_id) {
          schema.objects.push({
            id: row.object_id,
            name: row.object_name,
            type: row.object_type,
            fqn: row.fully_qualified_name,
            qualityScore: row.quality_score,
            classification: row.classification,
            rowCount: row.row_count,
            columnCount: row.column_count
          });
        }
      }
    }
  });

  // Convert maps to arrays
  return Array.from(sources.values()).map(source => ({
    ...source,
    databases: Array.from(source.databases.values()).map(db => ({
      ...db,
      schemas: Array.from(db.schemas.values())
    }))
  }));
}

export default router;
