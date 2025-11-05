/**
 * SLA Management Service
 *
 * Manages Quality SLAs and tracks breaches:
 * - Define SLAs for freshness, completeness, accuracy
 * - Monitor SLA compliance
 * - Track and alert on breaches
 * - Calculate SLA uptime percentages
 */

import { Pool } from 'pg';

export interface SLADefinition {
  id?: string;
  name: string;
  description: string;
  scopeType: 'table' | 'database' | 'data_source' | 'global';
  scopeValue: string;
  assetId?: number;
  dataSourceId?: string;
  slaType: 'freshness' | 'completeness' | 'accuracy' | 'consistency';
  thresholdValue: number;
  thresholdOperator: '>' | '<' | '>=' | '<=' | '=';
  measurementWindowHours: number;
  breachSeverity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
}

export interface SLABreach {
  id?: string;
  slaId: string;
  alertId?: string;
  breachType: string;
  expectedValue: number;
  actualValue: number;
  deviationPct: number;
  breachStart: Date;
  breachEnd?: Date;
  durationMinutes?: number;
  status: 'active' | 'resolved' | 'acknowledged';
  resolutionNotes?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface SLACompliance {
  slaId: string;
  slaName: string;
  scopeType: string;
  scopeValue: string;
  slaType: string;
  threshold: number;
  currentValue: number;
  compliant: boolean;
  uptimePercentage: number;
  breachCount: number;
  lastBreachAt?: Date;
  averageBreachDuration?: number;
}

export class SLAManagementService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Create a new SLA definition
   */
  async createSLA(sla: SLADefinition): Promise<string> {
    const query = `
      INSERT INTO quality_sla_definitions (
        name,
        description,
        scope_type,
        scope_value,
        asset_id,
        data_source_id,
        sla_type,
        threshold_value,
        threshold_operator,
        measurement_window_hours,
        breach_severity,
        enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;

    const result = await this.db.query(query, [
      sla.name,
      sla.description,
      sla.scopeType,
      sla.scopeValue,
      sla.assetId || null,
      sla.dataSourceId || null,
      sla.slaType,
      sla.thresholdValue,
      sla.thresholdOperator,
      sla.measurementWindowHours,
      sla.breachSeverity,
      sla.enabled
    ]);

    return result.rows[0].id;
  }

  /**
   * Monitor SLA compliance
   */
  async monitorSLACompliance(): Promise<SLABreach[]> {
    const breaches: SLABreach[] = [];

    // Get all enabled SLAs
    const slas = await this.getEnabledSLAs();

    for (const sla of slas) {
      const breach = await this.checkSLA(sla);
      if (breach) {
        // Record breach
        await this.recordBreach(breach);
        breaches.push(breach);
      } else {
        // Resolve any active breaches for this SLA
        await this.resolveActiveBreaches(sla.id!);
      }
    }

    return breaches;
  }

  /**
   * Check if a specific SLA is being met
   */
  private async checkSLA(sla: SLADefinition): Promise<SLABreach | null> {
    let actualValue: number;

    switch (sla.slaType) {
      case 'freshness':
        actualValue = await this.measureFreshness(sla);
        break;

      case 'completeness':
        actualValue = await this.measureCompleteness(sla);
        break;

      case 'accuracy':
        actualValue = await this.measureAccuracy(sla);
        break;

      case 'consistency':
        actualValue = await this.measureConsistency(sla);
        break;

      default:
        throw new Error(`Unknown SLA type: ${sla.slaType}`);
    }

    // Check if threshold is violated
    const isViolated = this.isThresholdViolated(
      actualValue,
      sla.thresholdValue,
      sla.thresholdOperator
    );

    if (!isViolated) {
      return null;
    }

    // Calculate deviation
    const deviationPct = ((actualValue - sla.thresholdValue) / sla.thresholdValue) * 100;

    return {
      slaId: sla.id!,
      breachType: sla.slaType,
      expectedValue: sla.thresholdValue,
      actualValue,
      deviationPct: Math.abs(deviationPct),
      breachStart: new Date(),
      status: 'active'
    };
  }

  /**
   * Measure data freshness (hours since last update)
   */
  private async measureFreshness(sla: SLADefinition): Promise<number> {
    let query: string;

    if (sla.scopeType === 'table') {
      query = `
        SELECT
          EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 3600 as hours_since_update
        FROM ${sla.scopeValue}
      `;
    } else if (sla.scopeType === 'database') {
      // Check freshness across all tables in database
      query = `
        SELECT
          EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) / 3600 as hours_since_update
        FROM information_schema.tables
        WHERE table_schema = '${sla.scopeValue}'
      `;
    } else {
      // Global or data source level
      return 0;
    }

    const result = await this.db.query(query);
    return parseFloat(result.rows[0]?.hours_since_update || '0');
  }

  /**
   * Measure data completeness (% of non-NULL values)
   */
  private async measureCompleteness(sla: SLADefinition): Promise<number> {
    if (sla.scopeType !== 'table') {
      return 100; // Skip non-table scopes for now
    }

    // Get table columns
    const columnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = '${sla.scopeValue}'
        AND is_nullable = 'YES'
    `;

    const columnsResult = await this.db.query(columnsQuery);
    const columns = columnsResult.rows.map(r => r.column_name);

    if (columns.length === 0) {
      return 100; // No nullable columns
    }

    // Calculate completeness for each column
    let totalCompleteness = 0;

    for (const column of columns) {
      const query = `
        SELECT
          (COUNT(*) - COUNT(${column}))::float / NULLIF(COUNT(*), 0) * 100 as null_pct
        FROM ${sla.scopeValue}
      `;

      const result = await this.db.query(query);
      const nullPct = parseFloat(result.rows[0]?.null_pct || '0');
      totalCompleteness += (100 - nullPct);
    }

    return totalCompleteness / columns.length;
  }

  /**
   * Measure data accuracy (% of records passing quality checks)
   */
  private async measureAccuracy(sla: SLADefinition): Promise<number> {
    // Query quality_results for this scope
    let query = `
      SELECT
        (COUNT(CASE WHEN status = 'passed' THEN 1 END)::float / NULLIF(COUNT(*), 0)) * 100 as accuracy_pct
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      WHERE qres.run_at > NOW() - INTERVAL '${sla.measurementWindowHours} hours'
    `;

    if (sla.scopeType === 'table' && sla.assetId) {
      query += ` AND qr.asset_id = ${sla.assetId}`;
    }

    const result = await this.db.query(query);
    return parseFloat(result.rows[0]?.accuracy_pct || '100');
  }

  /**
   * Measure data consistency
   */
  private async measureConsistency(sla: SLADefinition): Promise<number> {
    // Check for consistency violations (example: cross-table consistency)
    return 100; // Placeholder
  }

  /**
   * Check if threshold is violated
   */
  private isThresholdViolated(
    actualValue: number,
    thresholdValue: number,
    operator: string
  ): boolean {
    switch (operator) {
      case '>':
        return actualValue > thresholdValue;
      case '<':
        return actualValue < thresholdValue;
      case '>=':
        return actualValue >= thresholdValue;
      case '<=':
        return actualValue <= thresholdValue;
      case '=':
        return Math.abs(actualValue - thresholdValue) < 0.01;
      default:
        return false;
    }
  }

  /**
   * Record SLA breach
   */
  private async recordBreach(breach: SLABreach): Promise<string> {
    // Check if breach already exists and is active
    const existingQuery = `
      SELECT id
      FROM quality_sla_breaches
      WHERE sla_id = $1
        AND status = 'active'
      ORDER BY breach_start DESC
      LIMIT 1
    `;

    const existing = await this.db.query(existingQuery, [breach.slaId]);

    if (existing.rows.length > 0) {
      // Update existing breach
      return existing.rows[0].id;
    }

    // Create new breach
    const query = `
      INSERT INTO quality_sla_breaches (
        sla_id,
        alert_id,
        breach_type,
        expected_value,
        actual_value,
        deviation_pct,
        breach_start,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const result = await this.db.query(query, [
      breach.slaId,
      breach.alertId || null,
      breach.breachType,
      breach.expectedValue,
      breach.actualValue,
      breach.deviationPct,
      breach.breachStart,
      breach.status
    ]);

    return result.rows[0].id;
  }

  /**
   * Resolve active breaches for an SLA
   */
  private async resolveActiveBreaches(slaId: string): Promise<void> {
    const query = `
      UPDATE quality_sla_breaches
      SET
        status = 'resolved',
        breach_end = NOW(),
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - breach_start)) / 60,
        resolution_notes = 'Auto-resolved: SLA compliance restored'
      WHERE sla_id = $1
        AND status = 'active'
    `;

    await this.db.query(query, [slaId]);
  }

  /**
   * Get enabled SLAs
   */
  private async getEnabledSLAs(): Promise<SLADefinition[]> {
    const query = `
      SELECT
        id,
        name,
        description,
        scope_type as "scopeType",
        scope_value as "scopeValue",
        asset_id as "assetId",
        data_source_id as "dataSourceId",
        sla_type as "slaType",
        threshold_value as "thresholdValue",
        threshold_operator as "thresholdOperator",
        measurement_window_hours as "measurementWindowHours",
        breach_severity as "breachSeverity",
        enabled
      FROM quality_sla_definitions
      WHERE enabled = true
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * Get SLA compliance report
   */
  async getSLAComplianceReport(
    scopeType?: string,
    windowHours: number = 24
  ): Promise<SLACompliance[]> {
    let query = `
      SELECT
        sla.id as "slaId",
        sla.name as "slaName",
        sla.scope_type as "scopeType",
        sla.scope_value as "scopeValue",
        sla.sla_type as "slaType",
        sla.threshold_value as threshold,
        COUNT(br.id) as breach_count,
        MAX(br.breach_start) as last_breach_at,
        AVG(br.duration_minutes) as avg_breach_duration
      FROM quality_sla_definitions sla
      LEFT JOIN quality_sla_breaches br ON br.sla_id = sla.id
        AND br.breach_start > NOW() - INTERVAL '${windowHours} hours'
      WHERE sla.enabled = true
    `;

    if (scopeType) {
      query += ` AND sla.scope_type = '${scopeType}'`;
    }

    query += ` GROUP BY sla.id, sla.name, sla.scope_type, sla.scope_value, sla.sla_type, sla.threshold_value`;

    const result = await this.db.query(query);

    return result.rows.map(row => {
      const breachCount = parseInt(row.breach_count);
      const totalMinutes = windowHours * 60;
      const breachMinutes = row.avg_breach_duration * breachCount || 0;
      const uptimePercentage = ((totalMinutes - breachMinutes) / totalMinutes) * 100;

      return {
        slaId: row.slaId,
        slaName: row.slaName,
        scopeType: row.scopeType,
        scopeValue: row.scopeValue,
        slaType: row.slaType,
        threshold: parseFloat(row.threshold),
        currentValue: 0, // Would need to measure current value
        compliant: breachCount === 0,
        uptimePercentage: Math.max(0, Math.min(100, uptimePercentage)),
        breachCount,
        lastBreachAt: row.last_breach_at,
        averageBreachDuration: parseFloat(row.avg_breach_duration) || 0
      };
    });
  }

  /**
   * Get active SLA breaches
   */
  async getActiveBreaches(): Promise<SLABreach[]> {
    const query = `
      SELECT
        br.id,
        br.sla_id as "slaId",
        br.alert_id as "alertId",
        br.breach_type as "breachType",
        br.expected_value as "expectedValue",
        br.actual_value as "actualValue",
        br.deviation_pct as "deviationPct",
        br.breach_start as "breachStart",
        br.breach_end as "breachEnd",
        br.duration_minutes as "durationMinutes",
        br.status,
        br.resolution_notes as "resolutionNotes",
        br.acknowledged_by as "acknowledgedBy",
        br.acknowledged_at as "acknowledgedAt",
        sla.name as "slaName",
        sla.scope_value as "scopeValue"
      FROM quality_sla_breaches br
      JOIN quality_sla_definitions sla ON sla.id = br.sla_id
      WHERE br.status = 'active'
      ORDER BY br.breach_start DESC
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * Acknowledge a breach
   */
  async acknowledgeBreach(
    breachId: string,
    acknowledgedBy: string,
    notes?: string
  ): Promise<void> {
    const query = `
      UPDATE quality_sla_breaches
      SET
        status = 'acknowledged',
        acknowledged_by = $1,
        acknowledged_at = NOW(),
        resolution_notes = COALESCE($2, resolution_notes)
      WHERE id = $3
    `;

    await this.db.query(query, [acknowledgedBy, notes, breachId]);
  }
}
