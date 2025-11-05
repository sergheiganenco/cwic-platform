import { Request, Response } from 'express';
import { LineageService } from '../services/LineageService';
import { AILineageService } from '../services/AILineageService';

export class LineageController {
  private svc = new LineageService();
  private aiSvc = new AILineageService();

  graph = async (_req: Request, res: Response) => {
    const data = await this.svc.buildDemoGraph();
    res.json({ success: true, data });
  };

  /**
   * POST /api/lineage/ai/suggestions
   * Generate AI-powered connection suggestions
   */
  aiSuggestions = async (req: Request, res: Response) => {
    const { dataSourceId, server, database, minConfidence, maxSuggestions, analyzeSampleData } = req.body;

    const suggestions = await this.aiSvc.generateConnectionSuggestions({
      dataSourceId: dataSourceId || '00000000-0000-0000-0000-000000000001',
      server,
      database,
      minConfidence,
      maxSuggestions,
      analyzeSampleData,
    });

    res.json({ success: true, data: suggestions });
  };

  /**
   * GET /api/lineage/ai/insights/:tableName
   * Get AI-powered insights for a specific table
   */
  aiInsights = async (req: Request, res: Response) => {
    const { tableName } = req.params;
    const { dataSourceId } = req.query;

    const insights = await this.aiSvc.getLineageInsights(
      tableName,
      (dataSourceId as string) || '00000000-0000-0000-0000-000000000001'
    );

    res.json({ success: true, data: insights });
  };
}