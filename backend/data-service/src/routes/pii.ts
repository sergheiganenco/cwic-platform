/**
 * Routes for PII Detection and Data Preview API
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { PIIController } from '../controllers/PIIController';

export function createPIIRoutes(pool: Pool): Router {
  const router = Router();
  const controller = new PIIController(pool);

  // PII Detection
  router.post('/detect/column', controller.detectColumnPII);
  router.post('/detect/table', controller.detectTablePII);

  // PII Marking
  router.post('/mark', controller.markColumnPII);
  router.get('/marked-columns', controller.getMarkedPIIColumns);

  // Data Sampling and Preview
  router.get('/sample', controller.sampleColumnData);

  // Issue Details
  router.get('/issue-details', controller.getIssueDetails);
  router.get('/table-issues', controller.getTableIssues);

  // Asset Scanning
  router.post('/scan-asset', controller.scanAssetForPII);

  return router;
}
