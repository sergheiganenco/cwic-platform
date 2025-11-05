/**
 * Root Cause Analysis Service
 *
 * Identifies root causes of data quality issues:
 * - Correlates quality issues with deployments
 * - Analyzes data source changes
 * - Tracks pipeline failures
 * - Identifies manual data modifications
 */

import { Pool } from 'pg';

export interface RootCause {
  id?: string;
  alertId?: string;
  alertGroupId?: string;
  causeType: 'deployment' | 'data_source' | 'pipeline' | 'manual' | 'schema_change' | 'unknown';
  causeDescription: string;
  evidence: any;
  confidence: number;
  identifiedBy: 'system' | 'ml' | 'user';
  identifiedAt: Date;
  verifiedBy?: string;
  verifiedAt?: Date;
}

export interface DeploymentEvent {
  id: string;
  timestamp: Date;
  service: string;
  version: string;
  author: string;
  changes: string[];
}

export interface PipelineRun {
  id: string;
  pipelineName: string;
  runAt: Date;
  status: string;
  errorMessage?: string;
}

export class RootCauseAnalysisService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Analyze root cause for an alert
   */
  async analyzeRootCause(alertId: string): Promise<RootCause[]> {
    const causes: RootCause[] = [];

    // Get alert details
    const alert = await this.getAlertDetails(alertId);

    // 1. Check for recent deployments
    const deploymentCause = await this.checkDeploymentCorrelation(alert);
    if (deploymentCause) {
      causes.push(deploymentCause);
    }

    // 2. Check for pipeline failures
    const pipelineCause = await this.checkPipelineFailures(alert);
    if (pipelineCause) {
      causes.push(pipelineCause);
    }

    // 3. Check for schema changes
    const schemaCause = await this.checkSchemaChanges(alert);
    if (schemaCause) {
      causes.push(schemaCause);
    }

    // 4. Check for manual data modifications
    const manualCause = await this.checkManualModifications(alert);
    if (manualCause) {
      causes.push(manualCause);
    }

    // 5. Check for data source changes
    const dataSourceCause = await this.checkDataSourceChanges(alert);
    if (dataSourceCause) {
      causes.push(dataSourceCause);
    }

    // Save identified causes
    for (const cause of causes) {
      await this.saveRootCause(cause);
    }

    // If no causes found, create "unknown" cause
    if (causes.length === 0) {
      const unknownCause: RootCause = {
        alertId,
        causeType: 'unknown',
        causeDescription: 'Root cause could not be automatically determined',
        evidence: {},
        confidence: 0,
        identifiedBy: 'system',
        identifiedAt: new Date()
      };

      await this.saveRootCause(unknownCause);
      causes.push(unknownCause);
    }

    return causes;
  }

  /**
   * Check for deployment correlation
   */
  private async checkDeploymentCorrelation(alert: any): Promise<RootCause | null> {
    // Check if quality degraded after a recent deployment
    const timeWindow = 6; // hours

    // Query for deployments in the time window before the alert
    const deploymentQuery = `
      SELECT
        id,
        timestamp,
        service,
        version,
        author
      FROM deployments
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
      LIMIT 5
    `;

    const alertTime = new Date(alert.runAt);
    const windowStart = new Date(alertTime.getTime() - timeWindow * 60 * 60 * 1000);

    try {
      const result = await this.db.query(deploymentQuery, [windowStart, alertTime]);

      if (result.rows.length > 0) {
        const deployment = result.rows[0];
        const timeDiffMinutes = (alertTime.getTime() - new Date(deployment.timestamp).getTime()) / 60000;

        // High confidence if deployment was within 1 hour of alert
        const confidence = timeDiffMinutes < 60 ? 85 : 60;

        return {
          alertId: alert.id,
          causeType: 'deployment',
          causeDescription: `Issue detected ${Math.round(timeDiffMinutes)} minutes after deployment of ${deployment.service} v${deployment.version}`,
          evidence: {
            deploymentId: deployment.id,
            service: deployment.service,
            version: deployment.version,
            deployedAt: deployment.timestamp,
            deployedBy: deployment.author,
            timeDiffMinutes
          },
          confidence,
          identifiedBy: 'system',
          identifiedAt: new Date()
        };
      }
    } catch (error) {
      // Deployments table may not exist
      console.log('Deployments table not available for root cause analysis');
    }

    return null;
  }

  /**
   * Check for pipeline failures
   */
  private async checkPipelineFailures(alert: any): Promise<RootCause | null> {
    // Check if there were pipeline failures affecting this table
    const pipelineQuery = `
      SELECT
        id,
        name as pipeline_name,
        run_at,
        status,
        error_message
      FROM pipeline_runs
      WHERE status = 'failed'
        AND run_at < $1
        AND run_at > $1 - INTERVAL '24 hours'
      ORDER BY run_at DESC
      LIMIT 5
    `;

    try {
      const result = await this.db.query(pipelineQuery, [alert.runAt]);

      if (result.rows.length > 0) {
        const pipeline = result.rows[0];

        return {
          alertId: alert.id,
          causeType: 'pipeline',
          causeDescription: `Pipeline '${pipeline.pipeline_name}' failed before this issue was detected`,
          evidence: {
            pipelineId: pipeline.id,
            pipelineName: pipeline.pipeline_name,
            failedAt: pipeline.run_at,
            status: pipeline.status,
            errorMessage: pipeline.error_message
          },
          confidence: 75,
          identifiedBy: 'system',
          identifiedAt: new Date()
        };
      }
    } catch (error) {
      // Pipeline runs table may not exist
      console.log('Pipeline runs table not available for root cause analysis');
    }

    return null;
  }

  /**
   * Check for schema changes
   */
  private async checkSchemaChanges(alert: any): Promise<RootCause | null> {
    // Check if table schema was modified recently
    const schemaQuery = `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `;

    try {
      // This would require storing historical schema snapshots
      // For now, we'll just check if the issue is related to schema
      if (alert.issue.includes('column') || alert.issue.includes('type') || alert.issue.includes('constraint')) {
        return {
          alertId: alert.id,
          causeType: 'schema_change',
          causeDescription: 'Issue may be related to recent schema modifications',
          evidence: {
            table: alert.table,
            database: alert.database,
            issue: alert.issue
          },
          confidence: 50,
          identifiedBy: 'system',
          identifiedAt: new Date()
        };
      }
    } catch (error) {
      console.log('Schema history not available for root cause analysis');
    }

    return null;
  }

  /**
   * Check for manual data modifications
   */
  private async checkManualModifications(alert: any): Promise<RootCause | null> {
    // Check audit logs for manual modifications
    const auditQuery = `
      SELECT
        id,
        action,
        resource_type,
        resource_id,
        user_id,
        created_at,
        metadata
      FROM audit_logs
      WHERE resource_type = 'data'
        AND action IN ('UPDATE', 'DELETE', 'INSERT')
        AND created_at < $1
        AND created_at > $1 - INTERVAL '12 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    try {
      const result = await this.db.query(auditQuery, [alert.runAt]);

      if (result.rows.length > 0) {
        const modifications = result.rows;

        return {
          alertId: alert.id,
          causeType: 'manual',
          causeDescription: `${modifications.length} manual data modification(s) detected before this issue`,
          evidence: {
            modifications: modifications.map(m => ({
              id: m.id,
              action: m.action,
              userId: m.user_id,
              timestamp: m.created_at
            }))
          },
          confidence: 65,
          identifiedBy: 'system',
          identifiedAt: new Date()
        };
      }
    } catch (error) {
      console.log('Audit logs not available for root cause analysis');
    }

    return null;
  }

  /**
   * Check for data source changes
   */
  private async checkDataSourceChanges(alert: any): Promise<RootCause | null> {
    // Check if data source configuration changed
    const dataSourceQuery = `
      SELECT
        id,
        name,
        updated_at,
        config
      FROM data_sources
      WHERE id = $1
        AND updated_at > NOW() - INTERVAL '7 days'
    `;

    try {
      if (alert.dataSourceId) {
        const result = await this.db.query(dataSourceQuery, [alert.dataSourceId]);

        if (result.rows.length > 0) {
          const dataSource = result.rows[0];
          const daysSinceUpdate = (new Date().getTime() - new Date(dataSource.updated_at).getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceUpdate < 7) {
            return {
              alertId: alert.id,
              causeType: 'data_source',
              causeDescription: `Data source '${dataSource.name}' was modified ${Math.round(daysSinceUpdate)} days ago`,
              evidence: {
                dataSourceId: dataSource.id,
                dataSourceName: dataSource.name,
                updatedAt: dataSource.updated_at,
                daysSinceUpdate
              },
              confidence: 55,
              identifiedBy: 'system',
              identifiedAt: new Date()
            };
          }
        }
      }
    } catch (error) {
      console.log('Data source information not available for root cause analysis');
    }

    return null;
  }

  /**
   * Get alert details
   */
  private async getAlertDetails(alertId: string): Promise<any> {
    const query = `
      SELECT
        qres.id,
        qres.run_at as "runAt",
        qres.data_source_id as "dataSourceId",
        qr.description as issue,
        ca.table_name as "table",
        ca.database_name as "database"
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qres.id = $1
    `;

    const result = await this.db.query(query, [alertId]);

    if (result.rows.length === 0) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    return result.rows[0];
  }

  /**
   * Save root cause to database
   */
  private async saveRootCause(cause: RootCause): Promise<string> {
    const query = `
      INSERT INTO alert_root_causes (
        alert_id,
        alert_group_id,
        cause_type,
        cause_description,
        evidence,
        confidence,
        identified_by,
        identified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (alert_id, cause_type)
      DO UPDATE SET
        cause_description = EXCLUDED.cause_description,
        evidence = EXCLUDED.evidence,
        confidence = EXCLUDED.confidence,
        identified_at = EXCLUDED.identified_at
      RETURNING id
    `;

    const result = await this.db.query(query, [
      cause.alertId || null,
      cause.alertGroupId || null,
      cause.causeType,
      cause.causeDescription,
      JSON.stringify(cause.evidence),
      cause.confidence,
      cause.identifiedBy,
      cause.identifiedAt
    ]);

    return result.rows[0].id;
  }

  /**
   * Get root causes for an alert
   */
  async getRootCauses(alertId: string): Promise<RootCause[]> {
    const query = `
      SELECT
        id,
        alert_id as "alertId",
        alert_group_id as "alertGroupId",
        cause_type as "causeType",
        cause_description as "causeDescription",
        evidence,
        confidence,
        identified_by as "identifiedBy",
        identified_at as "identifiedAt",
        verified_by as "verifiedBy",
        verified_at as "verifiedAt"
      FROM alert_root_causes
      WHERE alert_id = $1
      ORDER BY confidence DESC, identified_at DESC
    `;

    const result = await this.db.query(query, [alertId]);
    return result.rows;
  }

  /**
   * Verify a root cause (human confirmation)
   */
  async verifyRootCause(causeId: string, verifiedBy: string): Promise<void> {
    const query = `
      UPDATE alert_root_causes
      SET
        verified_by = $1,
        verified_at = NOW(),
        confidence = 95
      WHERE id = $2
    `;

    await this.db.query(query, [verifiedBy, causeId]);
  }

  /**
   * Analyze root causes across multiple alerts (pattern detection)
   */
  async analyzePatterns(windowHours: number = 24): Promise<any> {
    const query = `
      SELECT
        cause_type,
        COUNT(*) as occurrence_count,
        AVG(confidence) as avg_confidence,
        ARRAY_AGG(DISTINCT alert_id) as affected_alerts
      FROM alert_root_causes
      WHERE identified_at > NOW() - INTERVAL '${windowHours} hours'
      GROUP BY cause_type
      ORDER BY occurrence_count DESC
    `;

    const result = await this.db.query(query);

    return {
      windowHours,
      patterns: result.rows.map(row => ({
        causeType: row.cause_type,
        occurrenceCount: parseInt(row.occurrence_count),
        avgConfidence: parseFloat(row.avg_confidence),
        affectedAlertCount: row.affected_alerts.length
      }))
    };
  }
}
