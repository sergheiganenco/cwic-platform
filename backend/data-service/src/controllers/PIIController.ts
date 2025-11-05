/**
 * PII Detection and Data Preview Controller
 * Handles PII detection, marking, and safe data preview
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';
import { EnhancedPIIDetection } from '../services/EnhancedPIIDetection';
import { DataSamplingService } from '../services/DataSamplingService';

export class PIIController {
  private pool: Pool;
  private piiDetection: EnhancedPIIDetection;
  private samplingService: DataSamplingService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.piiDetection = new EnhancedPIIDetection(pool);
    this.samplingService = new DataSamplingService(pool);
  }

  /**
   * POST /api/quality/pii/detect/column
   * Detect PII in a specific column
   */
  public detectColumnPII = async (req: Request, res: Response): Promise<void> => {
    try {
      const { dataSourceId, schema, table, column, sampleSize = 100 } = req.body;

      if (!schema || !table || !column) {
        res.status(400).json({
          success: false,
          error: 'Schema, table, and column are required'
        });
        return;
      }

      const result = await this.piiDetection.detectPIIInColumn(
        dataSourceId || 'local',
        schema,
        table,
        column,
        sampleSize
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error detecting column PII:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * POST /api/quality/pii/detect/table
   * Detect PII in all columns of a table
   */
  public detectTablePII = async (req: Request, res: Response): Promise<void> => {
    try {
      const { dataSourceId, schema, table } = req.body;

      if (!schema || !table) {
        res.status(400).json({
          success: false,
          error: 'Schema and table are required'
        });
        return;
      }

      const results = await this.piiDetection.detectPIIInTable(
        dataSourceId || 'local',
        schema,
        table
      );

      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error: any) {
      console.error('Error detecting table PII:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * POST /api/quality/pii/mark
   * Mark a column as containing PII
   */
  public markColumnPII = async (req: Request, res: Response): Promise<void> => {
    try {
      const { assetId, columnName, piiType, sensitivity, confidence, verified } = req.body;

      if (!assetId || !columnName) {
        res.status(400).json({
          success: false,
          error: 'Asset ID and column name are required'
        });
        return;
      }

      // Update column metadata with PII information
      const query = `
        INSERT INTO column_pii_metadata
          (asset_id, column_name, pii_type, sensitivity, confidence, verified_by, verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (asset_id, column_name)
        DO UPDATE SET
          pii_type = $3,
          sensitivity = $4,
          confidence = $5,
          verified_by = $6,
          verified_at = NOW()
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        assetId,
        columnName,
        piiType,
        sensitivity,
        confidence,
        verified ? req.body.userId || 'system' : null
      ]);

      res.json({
        success: true,
        data: result.rows[0],
        message: 'PII marking saved successfully'
      });
    } catch (error: any) {
      // Table might not exist, create it
      if (error.code === '42P01') {
        await this.createPIIMetadataTable();
        return this.markColumnPII(req, res);
      }

      console.error('Error marking PII:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * GET /api/quality/pii/sample
   * Get sample data from a column with PII masking
   */
  public sampleColumnData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schema, table, column, sampleSize = 10, maskPII = 'true' } = req.query;

      if (!schema || !table || !column) {
        res.status(400).json({
          success: false,
          error: 'Schema, table, and column are required'
        });
        return;
      }

      const sample = await this.samplingService.sampleColumn(
        String(schema),
        String(table),
        String(column),
        parseInt(String(sampleSize)),
        maskPII === 'true'
      );

      res.json({
        success: true,
        data: sample
      });
    } catch (error: any) {
      console.error('Error sampling column:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * GET /api/quality/pii/issue-details
   * Get detailed issue information with sample data
   */
  public getIssueDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schema, table, column, issueType } = req.query;

      if (!schema || !table || !column || !issueType) {
        res.status(400).json({
          success: false,
          error: 'Schema, table, column, and issueType are required'
        });
        return;
      }

      const details = await this.samplingService.getColumnIssueDetails(
        String(schema),
        String(table),
        String(column),
        String(issueType)
      );

      if (!details) {
        res.status(404).json({
          success: false,
          error: 'Issue not found'
        });
        return;
      }

      res.json({
        success: true,
        data: details
      });
    } catch (error: any) {
      console.error('Error getting issue details:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * GET /api/quality/pii/table-issues
   * Get all issues for a table with sample data
   */
  public getTableIssues = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schema, table } = req.query;

      if (!schema || !table) {
        res.status(400).json({
          success: false,
          error: 'Schema and table are required'
        });
        return;
      }

      const issues = await this.samplingService.getTableIssuesWithSamples(
        String(schema),
        String(table)
      );

      res.json({
        success: true,
        data: issues,
        count: issues.length
      });
    } catch (error: any) {
      console.error('Error getting table issues:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * GET /api/quality/pii/marked-columns
   * Get all marked PII columns for an asset
   */
  public getMarkedPIIColumns = async (req: Request, res: Response): Promise<void> => {
    try {
      const { assetId } = req.query;

      if (!assetId) {
        res.status(400).json({
          success: false,
          error: 'Asset ID is required'
        });
        return;
      }

      const query = `
        SELECT
          cpm.*,
          a.name as asset_name,
          a.schema,
          a.table
        FROM column_pii_metadata cpm
        JOIN assets a ON a.id = cpm.asset_id
        WHERE cpm.asset_id = $1
        ORDER BY
          CASE cpm.sensitivity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          cpm.column_name
      `;

      const result = await this.pool.query(query, [assetId]);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    } catch (error: any) {
      console.error('Error getting marked PII columns:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * POST /api/quality/pii/scan-asset
   * Scan an entire asset for PII and save results
   */
  public scanAssetForPII = async (req: Request, res: Response): Promise<void> => {
    try {
      const { assetId, dataSourceId, schema, table } = req.body;

      if (!assetId || !schema || !table) {
        res.status(400).json({
          success: false,
          error: 'Asset ID, schema, and table are required'
        });
        return;
      }

      // Detect PII in all columns
      const results = await this.piiDetection.detectPIIInTable(
        dataSourceId || 'local',
        schema,
        table
      );

      // Save results for columns with PII
      const saved = [];
      for (const result of results) {
        if (result.piiType && result.confidence > 0.5) {
          try {
            const query = `
              INSERT INTO column_pii_metadata
                (asset_id, column_name, pii_type, sensitivity, confidence, detected_at)
              VALUES ($1, $2, $3, $4, $5, NOW())
              ON CONFLICT (asset_id, column_name)
              DO UPDATE SET
                pii_type = $3,
                sensitivity = $4,
                confidence = $5,
                detected_at = NOW()
              RETURNING *
            `;

            const saveResult = await this.pool.query(query, [
              assetId,
              result.columnName,
              result.piiType,
              result.sensitivity,
              result.confidence
            ]);

            saved.push(saveResult.rows[0]);
          } catch (error: any) {
            console.warn(`Failed to save PII for column ${result.columnName}:`, error.message);
          }
        }
      }

      res.json({
        success: true,
        data: {
          scanned: results.length,
          piiDetected: saved.length,
          columns: saved
        },
        message: `Scanned ${results.length} columns, found PII in ${saved.length}`
      });
    } catch (error: any) {
      console.error('Error scanning asset for PII:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Create PII metadata table if it doesn't exist
   */
  private async createPIIMetadataTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS column_pii_metadata (
        id SERIAL PRIMARY KEY,
        asset_id UUID NOT NULL,
        column_name VARCHAR(255) NOT NULL,
        pii_type VARCHAR(50),
        sensitivity VARCHAR(20) CHECK (sensitivity IN ('low', 'medium', 'high', 'critical')),
        confidence NUMERIC(3, 2),
        verified_by VARCHAR(255),
        verified_at TIMESTAMP,
        detected_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(asset_id, column_name)
      );

      CREATE INDEX IF NOT EXISTS idx_pii_metadata_asset_id ON column_pii_metadata(asset_id);
      CREATE INDEX IF NOT EXISTS idx_pii_metadata_sensitivity ON column_pii_metadata(sensitivity);
      CREATE INDEX IF NOT EXISTS idx_pii_metadata_pii_type ON column_pii_metadata(pii_type);
    `;

    await this.pool.query(query);
  }
}
