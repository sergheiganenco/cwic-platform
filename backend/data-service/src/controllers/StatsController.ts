import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService';

export class StatsController {
  private svc = new StatsService();

  /**
   * GET /api/stats - Returns comprehensive stats for all modules
   */
  get = async (_req: Request, res: Response) => {
    const data = await this.svc.snapshot();
    res.json({ success: true, data });
  };

  /**
   * GET /api/catalog/stats - Returns catalog-specific stats
   */
  getCatalogStats = async (_req: Request, res: Response) => {
    const snapshot = await this.svc.snapshot();
    res.json({ success: true, data: snapshot.catalog, ...snapshot.catalog });
  };

  /**
   * GET /api/quality/metrics - Returns quality-specific metrics
   */
  getQualityMetrics = async (_req: Request, res: Response) => {
    const snapshot = await this.svc.snapshot();
    res.json({ success: true, data: snapshot.quality, ...snapshot.quality });
  };

  /**
   * GET /api/pipelines/stats - Returns pipeline-specific stats
   */
  getPipelineStats = async (_req: Request, res: Response) => {
    const snapshot = await this.svc.snapshot();
    res.json({ success: true, data: snapshot.pipelines, ...snapshot.pipelines });
  };
}