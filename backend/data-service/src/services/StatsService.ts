// backend/data-service/src/services/StatsService.ts
import { DatabaseService } from './DatabaseService';

/** Public types your controller/routers can use */
export type KpiRow = { key: string; value: number; updated_at: Date };
export type StatusBucket = { key: string; count: number };
export type SeriesPoint = { ts: string; count: number; status?: string };

function timeframeToInterval(timeframe: '24h'|'7d'|'30d'|'90d'): { fromIso: string; dateTrunc: 'hour'|'day' } {
  const now = new Date();
  let ms = 7 * 24 * 60 * 60 * 1000;
  let trunc: 'hour'|'day' = 'day';
  switch (timeframe) {
    case '24h': ms = 24 * 60 * 60 * 1000; trunc = 'hour'; break;
    case '7d':  ms = 7  * 24 * 60 * 60 * 1000; trunc = 'day'; break;
    case '30d': ms = 30 * 24 * 60 * 60 * 1000; trunc = 'day'; break;
    case '90d': ms = 90 * 24 * 60 * 60 * 1000; trunc = 'day'; break;
  }
  const from = new Date(now.getTime() - ms).toISOString();
  return { fromIso: from, dateTrunc: trunc };
}

export class StatsService {
  private readonly db = new DatabaseService();

  /** Health ping for /stats/health or readiness checks */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.db.query('SELECT 1 AS ok') as any;
      return res.rows?.[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  /** Simple KPIs table -> UI cards */
  async getKpis(): Promise<KpiRow[]> {
    const res = await this.db.query(
      `SELECT key, value, updated_at FROM kpi_stats ORDER BY key`
    ) as any;
    return (res.rows ?? []) as KpiRow[];
  }

  /** Quality summary with dimension scores, optionally filtered by data source, database, and asset type */
  async getQualitySummary(
    timeframe: '24h'|'7d'|'30d'|'90d' = '7d',
    dataSourceId?: string,
    database?: string,
    assetType?: string
  ): Promise<{
    timeframe: typeof timeframe;
    from: string;
    to: string;
    byStatus: StatusBucket[];
    totals: {
      total: number;
      passed: number;
      failed: number;
      error: number;
      skipped: number;
      timeout: number;
      passRate: number;
      avgExecMs: number;
      overallScore: number;
    };
    dimensions?: {
      completeness: number;
      accuracy: number;
      consistency: number;
      validity: number;
      freshness: number;
      uniqueness: number;
    };
    statusBreakdown: StatusBucket[];
    sourceBreakdown?: Array<{ dataSourceId: string; count: number }>;
    ruleCounts: {
      total: number;
      active: number;
      disabled: number;
    };
    assetCoverage: {
      totalAssets: number;
      monitoredAssets: number;
      byType?: {
        tables: number;
        views: number;
      };
    };
  }> {
    const { fromIso } = timeframeToInterval(timeframe);
    const nowIso = new Date().toISOString();

    // Build WHERE clause for filtering
    const whereConditions: string[] = ['run_at >= $1'];
    const params: any[] = [fromIso];
    let paramIndex = 2;

    if (dataSourceId) {
      whereConditions.push(`data_source_id = $${paramIndex}`);
      params.push(dataSourceId);
      paramIndex++;
    }

    // Note: quality_results.asset_id is UUID but catalog_assets.id is BIGINT
    // So we cannot filter quality_results by database directly
    // Database filtering is handled separately in dimension scores and asset coverage

    const whereClause = whereConditions.join(' AND ');

    // Status breakdown
    const byStatusRes = await this.db.query(
      `
      SELECT status AS key, COUNT(*)::int AS count
      FROM quality_results
      WHERE ${whereClause}
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC
      `,
      params
    ) as any;

    // Aggregated results
    const aggRes = await this.db.query(
      `
      SELECT
        COUNT(*)::int                                  AS total,
        SUM(CASE WHEN status = 'passed'  THEN 1 ELSE 0 END)::int AS passed,
        SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END)::int AS failed,
        SUM(CASE WHEN status = 'error'   THEN 1 ELSE 0 END)::int AS error,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END)::int AS skipped,
        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END)::int AS timeout,
        COALESCE(AVG(execution_time_ms), 0)::float                AS avg_exec_ms
      FROM quality_results
      WHERE ${whereClause}
      `,
      params
    ) as any;

    const a = aggRes.rows?.[0] ?? { total: 0, passed: 0, failed: 0, error: 0, skipped: 0, timeout: 0, avg_exec_ms: 0 };
    const passRate = a.total ? Math.round((a.passed / a.total) * 1000) / 10 : 0;

    // Get quality dimension scores from data_profiles
    const dimensionParams: any[] = [];
    const dimensionConditions: string[] = [];
    let dimParamIndex = 1;

    if (dataSourceId) {
      dimensionConditions.push(`dp.data_source_id = $${dimParamIndex}`);
      dimensionParams.push(dataSourceId);
      dimParamIndex++;
    }

    if (database) {
      // Support comma-separated databases like Data Catalog does
      const databaseList = database.split(',').map(d => d.trim()).filter(d => d);
      if (databaseList.length > 1) {
        // Multiple databases: use IN clause
        dimensionConditions.push(`ca.database_name = ANY($${dimParamIndex}::text[])`);
        dimensionParams.push(databaseList);
        dimParamIndex++;
      } else if (databaseList.length === 1) {
        // Single database
        dimensionConditions.push(`ca.database_name = $${dimParamIndex}`);
        dimensionParams.push(databaseList[0]);
        dimParamIndex++;
      }
      dimensionConditions.push(`NOT is_system_database(ca.database_name)`);
    } else {
      // Exclude system databases
      dimensionConditions.push(`NOT is_system_database(ca.database_name)`);
    }

    if (assetType) {
      dimensionConditions.push(`ca.asset_type = $${dimParamIndex}`);
      dimensionParams.push(assetType);
      dimParamIndex++;
    }

    const dimensionWhereClause = dimensionConditions.length > 0
      ? 'WHERE ' + dimensionConditions.join(' AND ')
      : '';

    const dimensionRes = await this.db.query(
      `
      SELECT
        COALESCE(ROUND(AVG(dp.completeness_score)::numeric, 2), 0)::float AS completeness,
        COALESCE(ROUND(AVG(dp.accuracy_score)::numeric, 2), 0)::float AS accuracy,
        COALESCE(ROUND(AVG(dp.consistency_score)::numeric, 2), 0)::float AS consistency,
        COALESCE(ROUND(AVG(dp.validity_score)::numeric, 2), 0)::float AS validity,
        COALESCE(ROUND(AVG(dp.freshness_score)::numeric, 2), 0)::float AS freshness,
        COALESCE(ROUND(AVG(dp.uniqueness_score)::numeric, 2), 0)::float AS uniqueness,
        COALESCE(ROUND(AVG(dp.quality_score)::numeric, 2), 0)::float AS overall_score
      FROM data_profiles dp
      JOIN catalog_assets ca ON dp.asset_id = ca.id
      ${dimensionWhereClause}
      `,
      dimensionParams
    ) as any;

    const dimensions = dimensionRes.rows?.[0] ?? {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      validity: 0,
      freshness: 0,
      uniqueness: 0,
      overall_score: 0
    };

    // Get rule counts
    const ruleCountParams: any[] = [];
    const ruleConditions: string[] = [];
    let ruleParamIndex = 1;

    if (dataSourceId) {
      ruleConditions.push(`data_source_id = $${ruleParamIndex}`);
      ruleCountParams.push(dataSourceId);
      ruleParamIndex++;
    }

    const ruleWhereClause = ruleConditions.length > 0
      ? 'WHERE ' + ruleConditions.join(' AND ')
      : '';

    const ruleCountRes = await this.db.query(
      `
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN enabled = true THEN 1 ELSE 0 END)::int AS active,
        SUM(CASE WHEN enabled = false THEN 1 ELSE 0 END)::int AS disabled
      FROM quality_rules
      ${ruleWhereClause}
      `,
      ruleCountParams
    ) as any;

    const ruleCounts = ruleCountRes.rows?.[0] ?? { total: 0, active: 0, disabled: 0 };

    // Get asset coverage
    const assetParams: any[] = [];
    const assetConditions: string[] = [];
    let assetParamIndex = 1;

    if (dataSourceId) {
      assetConditions.push(`datasource_id = $${assetParamIndex}::uuid`);
      assetParams.push(dataSourceId);
      assetParamIndex++;
    }

    if (database) {
      // Support comma-separated databases like Data Catalog does
      const databaseList = database.split(',').map(d => d.trim()).filter(d => d);
      if (databaseList.length > 1) {
        // Multiple databases: use IN clause
        assetConditions.push(`database_name = ANY($${assetParamIndex}::text[])`);
        assetParams.push(databaseList);
        assetParamIndex++;
      } else if (databaseList.length === 1) {
        // Single database
        assetConditions.push(`database_name = $${assetParamIndex}`);
        assetParams.push(databaseList[0]);
        assetParamIndex++;
      }
      assetConditions.push(`NOT is_system_database(database_name)`);
    } else {
      assetConditions.push(`NOT is_system_database(database_name)`);
    }

    if (assetType) {
      assetConditions.push(`asset_type = $${assetParamIndex}`);
      assetParams.push(assetType);
      assetParamIndex++;
    }

    // Exclude system schemas to match Data Catalog behavior
    assetConditions.push(`schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')`);

    const assetWhereClause = assetConditions.length > 0
      ? 'WHERE ' + assetConditions.join(' AND ')
      : '';

    const assetCoverageRes = await this.db.query(
      `
      SELECT
        COUNT(*)::int AS total_assets,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM quality_rules qr
            WHERE qr.asset_id = catalog_assets.id
            AND qr.enabled = true
          ) THEN id
        END)::int AS monitored_assets
      FROM catalog_assets
      ${assetWhereClause}
      `,
      assetParams
    ) as any;

    const assetCoverage = assetCoverageRes.rows?.[0] ?? { total_assets: 0, monitored_assets: 0 };

    // Get asset counts by type (tables vs views) to match Data Catalog
    const assetByTypeRes = await this.db.query(
      `
      SELECT
        asset_type,
        COUNT(*)::int AS count
      FROM catalog_assets
      ${assetWhereClause}
      GROUP BY asset_type
      `,
      assetParams
    ) as any;

    const assetsByType = assetByTypeRes.rows ?? [];
    const tableCount = assetsByType.find((a: any) => a.asset_type === 'table')?.count ?? 0;
    const viewCount = assetsByType.find((a: any) => a.asset_type === 'view')?.count ?? 0;

    return {
      timeframe,
      from: fromIso,
      to: nowIso,
      byStatus: (byStatusRes.rows ?? []) as StatusBucket[],
      statusBreakdown: (byStatusRes.rows ?? []) as StatusBucket[],
      totals: {
        total: a.total,
        passed: a.passed,
        failed: a.failed,
        error: a.error,
        skipped: a.skipped,
        timeout: a.timeout,
        passRate,
        avgExecMs: Math.round(a.avg_exec_ms),
        overallScore: dimensions.overall_score
      },
      dimensions: {
        completeness: dimensions.completeness,
        accuracy: dimensions.accuracy,
        consistency: dimensions.consistency,
        validity: dimensions.validity,
        freshness: dimensions.freshness,
        uniqueness: dimensions.uniqueness
      },
      ruleCounts: {
        total: ruleCounts.total,
        active: ruleCounts.active,
        disabled: ruleCounts.disabled
      },
      assetCoverage: {
        totalAssets: assetCoverage.total_assets,
        monitoredAssets: assetCoverage.monitored_assets,
        byType: {
          tables: tableCount,
          views: viewCount
        }
      }
    };
  }

  /** Time-series of results count; optionally split by status */
  async getQualitySeries(params: { timeframe?: '24h'|'7d'|'30d'|'90d'; splitByStatus?: boolean } = {}): Promise<{
    timeframe: NonNullable<typeof params['timeframe']> extends never ? '7d' : NonNullable<typeof params['timeframe']>;
    from: string;
    to: string;
    series: SeriesPoint[];
  }> {
    const timeframe = (params.timeframe ?? '7d') as any;
    const split = !!params.splitByStatus;
    const { fromIso, dateTrunc } = timeframeToInterval(timeframe);
    const nowIso = new Date().toISOString();

    const sql = split
      ? `
        SELECT
          to_char(date_trunc('${dateTrunc}', run_at), 'YYYY-MM-DD"T"HH24:00:00Z') AS ts,
          status,
          COUNT(*)::int AS count
        FROM quality_results
        WHERE run_at >= $1
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
      `
      : `
        SELECT
          to_char(date_trunc('${dateTrunc}', run_at), 'YYYY-MM-DD"T"HH24:00:00Z') AS ts,
          COUNT(*)::int AS count
        FROM quality_results
        WHERE run_at >= $1
        GROUP BY 1
        ORDER BY 1 ASC
      `;

    const res = await this.db.query(sql, [fromIso]) as any;

    const series = (res.rows ?? []).map((r: any) =>
      split ? ({ ts: r.ts, count: r.count, status: r.status }) : ({ ts: r.ts, count: r.count })
    ) as SeriesPoint[];

    return { timeframe, from: fromIso, to: nowIso, series };
  }
}
