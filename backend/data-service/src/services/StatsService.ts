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

  /** Quality summary (counts by status + pass rate + avg exec time) */
  async getQualitySummary(timeframe: '24h'|'7d'|'30d'|'90d' = '7d'): Promise<{
    timeframe: typeof timeframe;
    from: string;
    to: string;
    byStatus: StatusBucket[];
    totals: { total: number; passed: number; failed: number; error: number; skipped: number; timeout: number; passRate: number; avgExecMs: number };
  }> {
    const { fromIso } = timeframeToInterval(timeframe);
    const nowIso = new Date().toISOString();

    const byStatusRes = await this.db.query(
      `
      SELECT status AS key, COUNT(*)::int AS count
      FROM quality_results
      WHERE run_at >= $1
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC
      `,
      [fromIso]
    ) as any;

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
      WHERE run_at >= $1
      `,
      [fromIso]
    ) as any;

    const a = aggRes.rows?.[0] ?? { total: 0, passed: 0, failed: 0, error: 0, skipped: 0, timeout: 0, avg_exec_ms: 0 };
    const passRate = a.total ? Math.round((a.passed / a.total) * 1000) / 10 : 0;

    return {
      timeframe,
      from: fromIso,
      to: nowIso,
      byStatus: (byStatusRes.rows ?? []) as StatusBucket[],
      totals: {
        total: a.total,
        passed: a.passed,
        failed: a.failed,
        error: a.error,
        skipped: a.skipped,
        timeout: a.timeout,
        passRate,
        avgExecMs: Math.round(a.avg_exec_ms),
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
