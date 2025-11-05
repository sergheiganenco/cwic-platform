/**
 * PII Discovery Routes
 *
 * Helps users discover what PII patterns exist in their actual databases
 * before creating rules. Makes configuration easier and more robust.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { PIIDiscoveryService } from '../services/PIIDiscoveryService';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const piiDiscoveryService = new PIIDiscoveryService(pool);

// Response helpers
const ok = <T>(res: Response, data: T) => res.json({ success: true, data });
const badRequest = (res: Response, message: string) =>
  res.status(400).json({ success: false, error: message });
const internalServerError = (res: Response, message: string) =>
  res.status(500).json({ success: false, error: message });

/**
 * GET /api/pii-discovery/patterns
 * Discover PII patterns across all data sources
 */
router.get('/patterns', async (req: Request, res: Response) => {
  try {
    const { dataSourceId, category, minOccurrences } = req.query;

    const discoveries = await piiDiscoveryService.discoverPIIPatterns({
      dataSourceId: dataSourceId as string,
      category: category as string,
      minOccurrences: minOccurrences ? parseInt(minOccurrences as string) : 2
    });

    ok(res, discoveries);
  } catch (error: any) {
    console.error('Error discovering PII patterns:', error);
    internalServerError(res, error.message);
  }
});

/**
 * GET /api/pii-discovery/columns/search
 * Search for columns by keyword and get suggestions
 */
router.get('/columns/search', async (req: Request, res: Response) => {
  try {
    const { keyword, dataSourceId, limit } = req.query;

    if (!keyword) {
      return badRequest(res, 'keyword parameter is required');
    }

    const result = await piiDiscoveryService.getColumnSuggestions(
      keyword as string,
      {
        dataSourceId: dataSourceId as string,
        limit: limit ? parseInt(limit as string) : 50
      }
    );

    ok(res, result);
  } catch (error: any) {
    console.error('Error searching columns:', error);
    internalServerError(res, error.message);
  }
});

/**
 * GET /api/pii-discovery/data-source/:id/analyze
 * Analyze a specific data source and suggest PII rules
 */
router.get('/data-source/:id/analyze', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const analysis = await piiDiscoveryService.analyzeDataSource(id);

    ok(res, analysis);
  } catch (error: any) {
    console.error('Error analyzing data source:', error);
    internalServerError(res, error.message);
  }
});

export default router;
