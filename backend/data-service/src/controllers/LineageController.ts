import { Request, Response } from 'express';
import { LineageService } from '../services/LineageService';
import { AILineageService } from '../services/AILineageService';

export class LineageController {
  private svc = new LineageService();
  private aiSvc = new AILineageService();

  // Original graph method (kept from main)
  graph = async (req: Request, res: Response) => {
    const dataSourceId = req.query.dataSourceId as string;
    const data = await this.svc.buildDemoGraph(dataSourceId);
    res.json({ success: true, data });
  };

  /**
   * Get column-level lineage for a specific column
   */
  columnLineage = async (req: Request, res: Response) => {
    const { assetId, columnName } = req.params;
    const depth = parseInt(req.query.depth as string) || 2;

    const data = await this.svc.getColumnLineage(assetId, columnName, depth, {
      userId: (req as any).user?.id,
      requestId: (req as any).id,
    });

    res.json({ success: true, data });
  };

  /**
   * Get lineage graph with filters
   */
  getGraph = async (req: Request, res: Response) => {
    const filters = {
      dataSourceId: req.query.dataSourceId as string,
      maxDepth: parseInt(req.query.maxDepth as string) || 5,
      includeMetadata: req.query.includeMetadata === 'true',
      limit: parseInt(req.query.limit as string) || 1000,
    };

    const data = await this.svc.getGraph(filters, {
      userId: (req as any).user?.id,
      requestId: (req as any).id,
    });

    res.json({ success: true, data });
  };

  /**
   * Get impact analysis for a node
   */
  impactAnalysis = async (req: Request, res: Response) => {
    const { nodeId } = req.params;
    const depth = parseInt(req.query.depth as string) || 5;

    const data = await this.svc.analyzeImpact(nodeId, depth, {
      userId: (req as any).user?.id,
      requestId: (req as any).id,
    });

    res.json({ success: true, data });
  };

  /**
   * Get lineage statistics
   */
  stats = async (req: Request, res: Response) => {
    const dataSourceId = req.query.dataSourceId as string;

    const data = await this.svc.getLineageStats(dataSourceId, {
      userId: (req as any).user?.id,
      requestId: (req as any).id,
    });

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
