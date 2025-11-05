import { Request, Response } from 'express';
import { TraceService } from '../services/TraceService';

export class TraceController {
  private svc = new TraceService();

  /**
   * Get trace evidence with sample row pairs for an edge
   */
  getTraceEvidence = async (req: Request, res: Response) => {
    const { edgeId } = req.params;
    const sampleSize = parseInt(req.query.sampleSize as string) || 10;
    const maskPII = req.query.maskPII !== 'false';
    const timeWindowDays = parseInt(req.query.timeWindowDays as string) || 30;

    const data = await this.svc.getTraceEvidence(edgeId, {
      sampleSize,
      maskPII,
      timeWindowDays,
    });

    res.json({ success: true, data });
  };

  /**
   * Validate a join between two tables
   */
  validateJoin = async (req: Request, res: Response) => {
    const { sourceTable, targetTable, joinColumn } = req.body;

    if (!sourceTable || !targetTable || !joinColumn) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sourceTable, targetTable, and joinColumn are required',
        },
      });
    }

    const data = await this.svc.validateJoin(sourceTable, targetTable, joinColumn);

    res.json({ success: true, data });
  };

  /**
   * Analyze SQL query for lineage extraction
   */
  analyzeSQL = async (req: Request, res: Response) => {
    const { query, dialect = 'postgresql' } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'query is required',
        },
      });
    }

    const data = await this.svc.analyzeSQL(query, dialect);

    res.json({ success: true, data });
  };
}
