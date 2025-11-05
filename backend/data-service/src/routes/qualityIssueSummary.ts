/**
 * Quality Issue Summary Routes
 * Provides aggregated quality issue counts for assets
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const ok = (res: Response, data: any) => res.json({ success: true, data });
const fail = (res: Response, code: number, msg: string) => res.status(code).json({ success: false, error: msg });

export function createQualityIssueSummaryRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * GET /api/quality/issue-summary
   * Returns quality issue counts for all assets
   */
  router.get('/issue-summary', async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          ca.id as asset_id,
          ca.table_name,
          ca.schema_name,
          ca.database_name,
          COUNT(DISTINCT CASE WHEN cc.pii_type IS NOT NULL THEN cc.id END) as pii_column_count,
          COUNT(DISTINCT CASE WHEN qi.id IS NOT NULL THEN cc.id END) as columns_with_issues,
          COUNT(DISTINCT qi.id) as total_issues,
          COUNT(DISTINCT CASE WHEN qi.severity = 'critical' THEN qi.id END) as critical_issues,
          COUNT(DISTINCT CASE WHEN qi.severity = 'high' THEN qi.id END) as high_issues
        FROM catalog_assets ca
        LEFT JOIN catalog_columns cc ON cc.asset_id = ca.id
        LEFT JOIN quality_issues qi ON qi.asset_id = ca.id
          AND qi.status IN ('open', 'acknowledged')
        GROUP BY ca.id, ca.table_name, ca.schema_name, ca.database_name
        HAVING COUNT(DISTINCT CASE WHEN cc.pii_type IS NOT NULL THEN cc.id END) > 0
            OR COUNT(DISTINCT qi.id) > 0
        ORDER BY total_issues DESC, pii_column_count DESC
      `);

      ok(res, rows);
    } catch (error: any) {
      console.error('[quality-issue-summary] Error fetching issue summary:', error);
      fail(res, 500, error.message || 'Failed to fetch quality issue summary');
    }
  });

  /**
   * GET /api/quality/issue-summary/:assetId
   * Returns quality issue details for a specific asset
   */
  router.get('/issue-summary/:assetId', async (req: Request, res: Response) => {
    try {
      const { assetId } = req.params;

      const { rows } = await pool.query(`
        SELECT
          cc.id as column_id,
          cc.column_name,
          cc.data_type,
          cc.pii_type,
          jsonb_agg(
            jsonb_build_object(
              'id', qi.id,
              'title', qi.title,
              'description', qi.description,
              'severity', qi.severity,
              'dimension', qi.dimension,
              'status', qi.status
            )
          ) FILTER (WHERE qi.id IS NOT NULL) as quality_issues,
          COUNT(qi.id) as issue_count
        FROM catalog_columns cc
        LEFT JOIN quality_issues qi ON qi.asset_id = $1
          AND qi.status IN ('open', 'acknowledged')
          AND (qi.title ILIKE '%' || cc.column_name || '%' OR qi.description ILIKE '%' || cc.column_name || '%')
        WHERE cc.asset_id = $1
          AND (cc.pii_type IS NOT NULL OR qi.id IS NOT NULL)
        GROUP BY cc.id, cc.column_name, cc.data_type, cc.pii_type
        ORDER BY issue_count DESC NULLS LAST
      `, [assetId]);

      ok(res, rows);
    } catch (error: any) {
      console.error(`[quality-issue-summary] Error fetching issues for asset ${req.params.assetId}:`, error);
      fail(res, 500, error.message || 'Failed to fetch asset quality issues');
    }
  });

  return router;
}
