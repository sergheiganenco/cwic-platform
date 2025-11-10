import { fieldDiscoveryDB } from '@services/FieldDiscoveryDBService';
import { logger } from '@utils/logger';
import { NextFunction, Request, Response } from 'express';
import * as csv from 'csv-writer';

export class FieldDiscoveryExportController {

  /**
   * GET /api/ai/field-discovery/export
   * Export discovered fields in various formats
   */
  public exportFields = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { format = 'json', datasourceId, status, classification } = req.query;

      // Get fields from database
      const { fields } = await fieldDiscoveryDB.getDiscoveredFields({
        datasourceId: datasourceId as string,
        status: status as any,
        classification: classification as any,
        limit: 10000 // Export up to 10k fields
      });

      logger.info('Exporting discovered fields', {
        count: fields.length,
        format
      });

      switch (format) {
        case 'csv':
          await this.exportAsCSV(res, fields);
          break;

        case 'json':
          res.json({
            exportDate: new Date(),
            totalFields: fields.length,
            fields: fields.map(f => ({
              id: f.id,
              dataSource: f.assetName,
              schema: f.schema,
              table: f.tableName,
              field: f.fieldName,
              dataType: f.dataType,
              classification: f.classification,
              sensitivity: f.sensitivity,
              confidence: f.confidence,
              status: f.status,
              description: f.description,
              suggestedTags: f.suggestedTags,
              suggestedRules: f.suggestedRules,
              patterns: f.dataPatterns,
              reviewedBy: f.reviewedBy,
              reviewedAt: f.reviewedAt
            }))
          });
          break;

        case 'sql':
          await this.exportAsSQL(res, fields);
          break;

        case 'markdown':
          await this.exportAsMarkdown(res, fields);
          break;

        default:
          res.status(400).json({ error: 'Invalid format. Use: json, csv, sql, or markdown' });
      }

    } catch (error) {
      logger.error('Export failed', { error });
      next(error);
    }
  };

  /**
   * Export as CSV
   */
  private async exportAsCSV(res: Response, fields: any[]): Promise<void> {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=discovered_fields_${Date.now()}.csv`);

    // CSV header
    const headers = [
      'Schema', 'Table', 'Field', 'Data Type', 'Classification',
      'Sensitivity', 'Confidence', 'Status', 'Description',
      'Suggested Tags', 'Suggested Rules', 'Patterns'
    ];

    res.write(headers.join(',') + '\n');

    // CSV rows
    for (const field of fields) {
      const row = [
        field.schema,
        field.tableName,
        field.fieldName,
        field.dataType,
        field.classification,
        field.sensitivity,
        field.confidence,
        field.status,
        `"${(field.description || '').replace(/"/g, '""')}"`,
        `"${(field.suggestedTags || []).join(';')}"`,
        `"${(field.suggestedRules || []).join(';')}"`,
        `"${(field.dataPatterns || []).join(';')}"`
      ];
      res.write(row.join(',') + '\n');
    }

    res.end();
  }

  /**
   * Export as SQL
   */
  private async exportAsSQL(res: Response, fields: any[]): Promise<void> {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=field_classifications_${Date.now()}.sql`);

    res.write('-- Field Discovery Export\n');
    res.write(`-- Generated: ${new Date().toISOString()}\n`);
    res.write(`-- Total Fields: ${fields.length}\n\n`);

    // Group by table for better organization
    const tables = new Map<string, any[]>();
    for (const field of fields) {
      const key = `${field.schema}.${field.tableName}`;
      if (!tables.has(key)) {
        tables.set(key, []);
      }
      tables.get(key)!.push(field);
    }

    // Generate SQL comments for each table
    for (const [tableName, tableFields] of tables.entries()) {
      res.write(`\n-- Table: ${tableName}\n`);
      res.write(`-- Fields: ${tableFields.length}\n`);

      for (const field of tableFields) {
        // Generate column comment SQL
        res.write(`COMMENT ON COLUMN ${tableName}.${field.fieldName} IS '`);
        res.write(`Classification: ${field.classification}, `);
        res.write(`Sensitivity: ${field.sensitivity}, `);
        res.write(`Status: ${field.status}`);

        if (field.description) {
          res.write(`. ${field.description.replace(/'/g, "''")}`);
        }
        res.write(`';\n`);

        // Add tags as comments
        if (field.suggestedTags && field.suggestedTags.length > 0) {
          res.write(`-- Tags: ${field.suggestedTags.join(', ')}\n`);
        }

        // Add validation rules as check constraints (commented out)
        if (field.suggestedRules && field.suggestedRules.length > 0) {
          res.write(`-- Suggested validations:\n`);
          for (const rule of field.suggestedRules) {
            res.write(`-- ALTER TABLE ${tableName} ADD CONSTRAINT chk_${field.fieldName}_${rule.toLowerCase().replace(/\s+/g, '_')} CHECK (...);\n`);
          }
        }
        res.write('\n');
      }
    }

    res.end();
  }

  /**
   * Export as Markdown documentation
   */
  private async exportAsMarkdown(res: Response, fields: any[]): Promise<void> {
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=data_dictionary_${Date.now()}.md`);

    res.write('# Data Dictionary\n\n');
    res.write(`Generated: ${new Date().toISOString()}\n\n`);
    res.write(`Total Fields Discovered: ${fields.length}\n\n`);

    // Statistics
    const stats = {
      pii: fields.filter(f => f.classification === 'PII').length,
      phi: fields.filter(f => f.classification === 'PHI').length,
      financial: fields.filter(f => f.classification === 'Financial').length,
      general: fields.filter(f => f.classification === 'General').length,
      accepted: fields.filter(f => f.status === 'accepted').length,
      pending: fields.filter(f => f.status === 'pending').length
    };

    res.write('## Summary Statistics\n\n');
    res.write('| Classification | Count |\n');
    res.write('|---------------|-------|\n');
    res.write(`| PII | ${stats.pii} |\n`);
    res.write(`| PHI | ${stats.phi} |\n`);
    res.write(`| Financial | ${stats.financial} |\n`);
    res.write(`| General | ${stats.general} |\n`);
    res.write('\n');

    res.write('| Status | Count |\n');
    res.write('|--------|-------|\n');
    res.write(`| Accepted | ${stats.accepted} |\n`);
    res.write(`| Pending Review | ${stats.pending} |\n`);
    res.write('\n');

    // Group by schema and table
    const schemas = new Map<string, Map<string, any[]>>();
    for (const field of fields) {
      if (!schemas.has(field.schema)) {
        schemas.set(field.schema, new Map());
      }
      const tables = schemas.get(field.schema)!;
      if (!tables.has(field.tableName)) {
        tables.set(field.tableName, []);
      }
      tables.get(field.tableName)!.push(field);
    }

    // Generate documentation
    res.write('## Field Documentation\n\n');

    for (const [schemaName, tables] of schemas.entries()) {
      res.write(`### Schema: ${schemaName}\n\n`);

      for (const [tableName, tableFields] of tables.entries()) {
        res.write(`#### Table: ${tableName}\n\n`);

        // Count sensitive fields
        const sensitiveCount = tableFields.filter(f =>
          f.classification !== 'General' || f.sensitivity === 'High' || f.sensitivity === 'Critical'
        ).length;

        if (sensitiveCount > 0) {
          res.write(`> ⚠️ **Contains ${sensitiveCount} sensitive fields**\n\n`);
        }

        res.write('| Field | Type | Classification | Sensitivity | Status | Description |\n');
        res.write('|-------|------|---------------|-------------|--------|-------------|\n');

        for (const field of tableFields) {
          const statusIcon = field.status === 'accepted' ? '✅' :
                            field.status === 'rejected' ? '❌' : '⏳';
          const classIcon = field.classification === 'PII' ? '👤' :
                           field.classification === 'PHI' ? '🏥' :
                           field.classification === 'Financial' ? '💳' : '';

          res.write(`| **${field.fieldName}** | ${field.dataType} | ${classIcon} ${field.classification} | ${field.sensitivity} | ${statusIcon} | ${field.description || '-'} |\n`);
        }
        res.write('\n');
      }
    }

    res.end();
  }

  /**
   * GET /api/ai/field-discovery/report
   * Generate compliance report
   */
  public generateReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { datasourceId } = req.query;

      const stats = await fieldDiscoveryDB.getStats(datasourceId as string);
      const { fields } = await fieldDiscoveryDB.getDiscoveredFields({
        datasourceId: datasourceId as string,
        limit: 1000
      });

      // Generate compliance report
      const report = {
        generatedAt: new Date(),
        datasourceId,
        summary: {
          totalFields: stats.totalFields,
          reviewedFields: stats.byStatus.accepted + stats.byStatus.rejected,
          pendingReview: stats.byStatus.pending,
          completionRate: Math.round(((stats.byStatus.accepted + stats.byStatus.rejected) / stats.totalFields) * 100) + '%'
        },
        sensitiveData: {
          piiFields: stats.byClassification.PII,
          phiFields: stats.byClassification.PHI,
          financialFields: stats.byClassification.Financial,
          criticalFields: stats.bySensitivity.Critical,
          highRiskFields: stats.bySensitivity.High
        },
        compliance: {
          gdprRelevant: fields.filter(f => f.classification === 'PII').map(f => ({
            field: `${f.schema}.${f.tableName}.${f.fieldName}`,
            type: f.dataType,
            status: f.status
          })),
          hipaaRelevant: fields.filter(f => f.classification === 'PHI').map(f => ({
            field: `${f.schema}.${f.tableName}.${f.fieldName}`,
            type: f.dataType,
            status: f.status
          })),
          pciRelevant: fields.filter(f => f.classification === 'Financial').map(f => ({
            field: `${f.schema}.${f.tableName}.${f.fieldName}`,
            type: f.dataType,
            status: f.status
          }))
        },
        recommendations: this.generateRecommendations(stats, fields)
      };

      res.json(report);

    } catch (error) {
      logger.error('Report generation failed', { error });
      next(error);
    }
  };

  /**
   * Generate recommendations based on discovered fields
   */
  private generateRecommendations(stats: any, fields: any[]): string[] {
    const recommendations: string[] = [];

    // Check for unreviewed sensitive fields
    const unreviewed = fields.filter(f =>
      f.status === 'pending' &&
      (f.classification !== 'General' || f.sensitivity === 'High' || f.sensitivity === 'Critical')
    );

    if (unreviewed.length > 0) {
      recommendations.push(`Review ${unreviewed.length} sensitive fields that are pending classification`);
    }

    // Check for PII without encryption
    const unprotectedPII = fields.filter(f =>
      f.classification === 'PII' &&
      !f.suggestedRules?.includes('encryption')
    );

    if (unprotectedPII.length > 0) {
      recommendations.push(`Consider encryption for ${unprotectedPII.length} PII fields`);
    }

    // Check confidence levels
    if (stats.averageConfidence < 0.7) {
      recommendations.push('Low average confidence score - consider manual review or AI re-classification');
    }

    // Check for patterns
    const emailFields = fields.filter(f => f.dataPatterns?.includes('Email'));
    if (emailFields.length > 0) {
      recommendations.push(`${emailFields.length} email fields detected - ensure GDPR compliance`);
    }

    const ssnFields = fields.filter(f => f.dataPatterns?.includes('SSN'));
    if (ssnFields.length > 0) {
      recommendations.push(`${ssnFields.length} SSN fields detected - implement strict access controls`);
    }

    return recommendations;
  }
}

export const fieldDiscoveryExportController = new FieldDiscoveryExportController();