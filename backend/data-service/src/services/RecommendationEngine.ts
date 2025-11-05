/**
 * Recommendation Engine Service
 *
 * Generates actionable recommendations for quality alerts:
 * - Auto-fix recommendations (set defaults, remove duplicates)
 * - Manual fix recommendations (add constraints, update code)
 * - Investigation recommendations (trace data source, check logs)
 * - Escalation recommendations (page on-call, notify stakeholders)
 */

import { Pool } from 'pg';

export interface Recommendation {
  id?: string;
  alertId: string;
  type: 'auto_fix' | 'manual_fix' | 'investigation' | 'escalation';
  title: string;
  description: string;
  steps: string[];
  sqlQuery?: string;
  apiCall?: string;
  estimatedTimeMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiredPermissions: string[];
  confidence: number;
  priority: number;
}

export interface Alert {
  id: string;
  table: string;
  database: string;
  column?: string;
  dimension?: string;
  severity: string;
  issue: string;
  rowsFailed: number;
  complianceTags?: string[];
}

export class RecommendationEngine {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Generate recommendations for an alert
   */
  async generateRecommendations(alert: Alert): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Analyze alert to determine recommendation types
    if (alert.dimension === 'completeness') {
      recommendations.push(...this.generateCompletenessRecommendations(alert));
    }

    if (alert.dimension === 'validity' || alert.issue.includes('invalid')) {
      recommendations.push(...this.generateValidityRecommendations(alert));
    }

    if (alert.dimension === 'uniqueness' || alert.issue.includes('duplicate')) {
      recommendations.push(...this.generateUniquenessRecommendations(alert));
    }

    if (alert.dimension === 'consistency') {
      recommendations.push(...this.generateConsistencyRecommendations(alert));
    }

    if (alert.issue.includes('constraint')) {
      recommendations.push(...this.generateConstraintRecommendations(alert));
    }

    // High severity always gets escalation option
    if (alert.severity === 'critical' || alert.severity === 'high') {
      recommendations.push(this.generateEscalationRecommendation(alert));
    }

    // Compliance issues get special recommendations
    if (alert.complianceTags && alert.complianceTags.length > 0) {
      recommendations.push(...this.generateComplianceRecommendations(alert));
    }

    // Save recommendations to database
    for (const rec of recommendations) {
      await this.saveRecommendation(rec);
    }

    return recommendations;
  }

  /**
   * Completeness recommendations (NULL values, missing data)
   */
  private generateCompletenessRecommendations(alert: Alert): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const column = alert.column || 'unknown';

    // Auto-fix: Set default values
    recommendations.push({
      alertId: alert.id,
      type: 'auto_fix',
      title: 'Set default values for NULL fields',
      description: `Automatically populate NULL values in ${column} with a default value`,
      steps: [
        '1. Identify appropriate default value',
        '2. Update NULL records with default',
        '3. Verify data integrity',
        '4. Re-run quality check'
      ],
      sqlQuery: `
-- Step 1: Preview NULL records
SELECT COUNT(*) as null_count
FROM ${alert.database}.${alert.table}
WHERE ${column} IS NULL;

-- Step 2: Set default value (adjust as needed)
UPDATE ${alert.database}.${alert.table}
SET ${column} = '<DEFAULT_VALUE>'
WHERE ${column} IS NULL;

-- Step 3: Verify
SELECT COUNT(*) as remaining_nulls
FROM ${alert.database}.${alert.table}
WHERE ${column} IS NULL;
      `.trim(),
      estimatedTimeMinutes: 5,
      riskLevel: 'low',
      requiredPermissions: ['data_write'],
      confidence: 85,
      priority: 10
    });

    // Manual fix: Add NOT NULL constraint
    recommendations.push({
      alertId: alert.id,
      type: 'manual_fix',
      title: 'Add NOT NULL constraint',
      description: `Prevent future NULL values by adding database constraint to ${column}`,
      steps: [
        '1. Set default values for existing NULLs',
        '2. Add NOT NULL constraint to column',
        '3. Update application code to require field',
        '4. Deploy and monitor'
      ],
      sqlQuery: `
-- Step 1: Handle existing NULLs
UPDATE ${alert.database}.${alert.table}
SET ${column} = '<DEFAULT_VALUE>'
WHERE ${column} IS NULL;

-- Step 2: Add constraint
ALTER TABLE ${alert.database}.${alert.table}
ALTER COLUMN ${column} SET NOT NULL;

-- Step 3: Verify constraint
SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = '${alert.table}'
  AND column_name = '${column}';
      `.trim(),
      estimatedTimeMinutes: 20,
      riskLevel: 'medium',
      requiredPermissions: ['schema_modify', 'data_write'],
      confidence: 90,
      priority: 20
    });

    // Investigation: Find data source
    recommendations.push({
      alertId: alert.id,
      type: 'investigation',
      title: 'Identify source of NULL values',
      description: 'Trace back to find where NULL data is being inserted',
      steps: [
        '1. Query recent inserts/updates',
        '2. Check application logs',
        '3. Review ETL pipeline',
        '4. Identify data source',
        '5. Fix upstream issue'
      ],
      sqlQuery: `
-- Find recent records with NULL values
SELECT *
FROM ${alert.database}.${alert.table}
WHERE ${column} IS NULL
ORDER BY created_at DESC
LIMIT 100;

-- Check for patterns
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as null_count
FROM ${alert.database}.${alert.table}
WHERE ${column} IS NULL
GROUP BY hour
ORDER BY hour DESC;
      `.trim(),
      estimatedTimeMinutes: 30,
      riskLevel: 'low',
      requiredPermissions: ['data_read'],
      confidence: 75,
      priority: 30
    });

    return recommendations;
  }

  /**
   * Validity recommendations (invalid values, out of range)
   */
  private generateValidityRecommendations(alert: Alert): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Investigation: Identify invalid values
    recommendations.push({
      alertId: alert.id,
      type: 'investigation',
      title: 'Identify and document invalid values',
      description: 'Find all invalid values and their patterns',
      steps: [
        '1. Query all invalid records',
        '2. Group by value patterns',
        '3. Identify data source',
        '4. Document business rules'
      ],
      sqlQuery: `
-- Find invalid values (adjust condition as needed)
SELECT
  ${alert.column || '*'},
  COUNT(*) as occurrence_count
FROM ${alert.database}.${alert.table}
WHERE ${alert.column} < 0  -- Example: negative values
   OR ${alert.column} > 1000000  -- Example: unrealistic values
GROUP BY ${alert.column}
ORDER BY occurrence_count DESC;
      `.trim(),
      estimatedTimeMinutes: 15,
      riskLevel: 'low',
      requiredPermissions: ['data_read'],
      confidence: 80,
      priority: 10
    });

    // Manual fix: Add check constraint
    recommendations.push({
      alertId: alert.id,
      type: 'manual_fix',
      title: 'Add CHECK constraint for valid values',
      description: 'Prevent invalid values at database level',
      steps: [
        '1. Fix existing invalid data',
        '2. Add CHECK constraint',
        '3. Test with insert/update',
        '4. Update application validation'
      ],
      sqlQuery: `
-- Step 1: Review invalid data
SELECT * FROM ${alert.database}.${alert.table}
WHERE ${alert.column} < 0;  -- Adjust condition

-- Step 2: Fix invalid data (example)
UPDATE ${alert.database}.${alert.table}
SET ${alert.column} = 0
WHERE ${alert.column} < 0;

-- Step 3: Add CHECK constraint
ALTER TABLE ${alert.database}.${alert.table}
ADD CONSTRAINT chk_${alert.table}_${alert.column}_valid
CHECK (${alert.column} >= 0 AND ${alert.column} <= 1000000);
      `.trim(),
      estimatedTimeMinutes: 25,
      riskLevel: 'medium',
      requiredPermissions: ['schema_modify', 'data_write'],
      confidence: 85,
      priority: 20
    });

    return recommendations;
  }

  /**
   * Uniqueness recommendations (duplicates)
   */
  private generateUniquenessRecommendations(alert: Alert): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Investigation: Analyze duplicates
    recommendations.push({
      alertId: alert.id,
      type: 'investigation',
      title: 'Analyze duplicate records',
      description: 'Identify duplicate patterns and decide on deduplication strategy',
      steps: [
        '1. Find duplicate records',
        '2. Analyze which to keep (newest, most complete)',
        '3. Check for dependencies',
        '4. Plan deduplication strategy'
      ],
      sqlQuery: `
-- Find duplicates
SELECT
  ${alert.column},
  COUNT(*) as duplicate_count,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM ${alert.database}.${alert.table}
GROUP BY ${alert.column}
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Example: Keep newest, delete old
WITH duplicates AS (
  SELECT
    id,
    ${alert.column},
    ROW_NUMBER() OVER (PARTITION BY ${alert.column} ORDER BY created_at DESC) as rn
  FROM ${alert.database}.${alert.table}
)
SELECT * FROM duplicates WHERE rn > 1;  -- These would be deleted
      `.trim(),
      estimatedTimeMinutes: 20,
      riskLevel: 'low',
      requiredPermissions: ['data_read'],
      confidence: 90,
      priority: 10
    });

    // Manual fix: Add unique constraint
    recommendations.push({
      alertId: alert.id,
      type: 'manual_fix',
      title: 'Remove duplicates and add UNIQUE constraint',
      description: 'Deduplicate data and prevent future duplicates',
      steps: [
        '1. Backup data',
        '2. Remove duplicate records',
        '3. Add UNIQUE constraint',
        '4. Update application logic'
      ],
      sqlQuery: `
-- Step 1: Backup (create temp table)
CREATE TEMP TABLE ${alert.table}_backup AS
SELECT * FROM ${alert.database}.${alert.table};

-- Step 2: Delete duplicates (keeping newest)
DELETE FROM ${alert.database}.${alert.table}
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY ${alert.column} ORDER BY created_at DESC) as rn
    FROM ${alert.database}.${alert.table}
  ) t
  WHERE rn > 1
);

-- Step 3: Add UNIQUE constraint
ALTER TABLE ${alert.database}.${alert.table}
ADD CONSTRAINT uq_${alert.table}_${alert.column}
UNIQUE (${alert.column});
      `.trim(),
      estimatedTimeMinutes: 30,
      riskLevel: 'high',
      requiredPermissions: ['schema_modify', 'data_write', 'data_delete'],
      confidence: 80,
      priority: 20
    });

    return recommendations;
  }

  /**
   * Consistency recommendations (cross-table mismatches)
   */
  private generateConsistencyRecommendations(alert: Alert): Recommendation[] {
    const recommendations: Recommendation[] = [];

    recommendations.push({
      alertId: alert.id,
      type: 'investigation',
      title: 'Investigate data consistency issue',
      description: 'Analyze inconsistency between related tables',
      steps: [
        '1. Identify inconsistent records',
        '2. Check both tables involved',
        '3. Determine correct values',
        '4. Plan reconciliation'
      ],
      sqlQuery: `
-- Find inconsistencies (example: order totals)
SELECT
  o.id,
  o.total_amount as order_total,
  SUM(oi.line_total) as items_total,
  (o.total_amount - SUM(oi.line_total)) as difference
FROM ${alert.database}.${alert.table} o
JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.total_amount
HAVING ABS(o.total_amount - SUM(oi.line_total)) > 0.01;
      `.trim(),
      estimatedTimeMinutes: 25,
      riskLevel: 'low',
      requiredPermissions: ['data_read'],
      confidence: 75,
      priority: 10
    });

    return recommendations;
  }

  /**
   * Constraint recommendations (FK violations, etc.)
   */
  private generateConstraintRecommendations(alert: Alert): Recommendation[] {
    const recommendations: Recommendation[] = [];

    recommendations.push({
      alertId: alert.id,
      type: 'investigation',
      title: 'Identify orphaned records',
      description: 'Find records violating referential integrity',
      steps: [
        '1. Find orphaned records',
        '2. Check if parent records were deleted',
        '3. Decide: delete orphans or restore parents',
        '4. Clean up data'
      ],
      sqlQuery: `
-- Find orphaned records (example)
SELECT t.*
FROM ${alert.database}.${alert.table} t
LEFT JOIN parent_table p ON p.id = t.parent_id
WHERE p.id IS NULL;
      `.trim(),
      estimatedTimeMinutes: 20,
      riskLevel: 'low',
      requiredPermissions: ['data_read'],
      confidence: 85,
      priority: 10
    });

    return recommendations;
  }

  /**
   * Compliance recommendations (PII, GDPR, etc.)
   */
  private generateComplianceRecommendations(alert: Alert): Recommendation[] {
    const recommendations: Recommendation[] = [];

    const hasPII = alert.complianceTags?.includes('PII') || alert.complianceTags?.includes('PHI');

    if (hasPII) {
      recommendations.push({
        alertId: alert.id,
        type: 'escalation',
        title: 'Escalate PII/PHI data quality issue',
        description: 'Compliance-sensitive data requires immediate attention',
        steps: [
          '1. Notify compliance officer',
          '2. Document the issue',
          '3. Assess breach risk',
          '4. Implement fix ASAP',
          '5. File incident report if needed'
        ],
        estimatedTimeMinutes: 60,
        riskLevel: 'high',
        requiredPermissions: ['compliance_write'],
        confidence: 95,
        priority: 5
      });
    }

    return recommendations;
  }

  /**
   * Escalation recommendation
   */
  private generateEscalationRecommendation(alert: Alert): Recommendation {
    return {
      alertId: alert.id,
      type: 'escalation',
      title: 'Escalate to on-call engineer',
      description: 'High-severity issue requires immediate attention',
      steps: [
        '1. Page on-call engineer',
        '2. Create incident ticket',
        '3. Notify stakeholders',
        '4. Monitor resolution'
      ],
      apiCall: 'POST /api/incidents/create',
      estimatedTimeMinutes: 10,
      riskLevel: 'low',
      requiredPermissions: ['incident_create'],
      confidence: 90,
      priority: 5
    };
  }

  /**
   * Save recommendation to database
   */
  private async saveRecommendation(rec: Recommendation): Promise<string> {
    const query = `
      INSERT INTO alert_recommendations (
        alert_id,
        type,
        title,
        description,
        steps,
        sql_query,
        api_call,
        estimated_time_minutes,
        risk_level,
        required_permissions,
        confidence,
        priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (alert_id, title)
      DO UPDATE SET
        description = EXCLUDED.description,
        steps = EXCLUDED.steps,
        sql_query = EXCLUDED.sql_query,
        confidence = EXCLUDED.confidence
      RETURNING id
    `;

    const result = await this.db.query(query, [
      rec.alertId,
      rec.type,
      rec.title,
      rec.description,
      JSON.stringify(rec.steps),
      rec.sqlQuery || null,
      rec.apiCall || null,
      rec.estimatedTimeMinutes,
      rec.riskLevel,
      JSON.stringify(rec.requiredPermissions),
      rec.confidence,
      rec.priority
    ]);

    return result.rows[0].id;
  }

  /**
   * Get recommendations for an alert
   */
  async getRecommendations(alertId: string): Promise<Recommendation[]> {
    const query = `
      SELECT
        id,
        alert_id as "alertId",
        type,
        title,
        description,
        steps,
        sql_query as "sqlQuery",
        api_call as "apiCall",
        estimated_time_minutes as "estimatedTimeMinutes",
        risk_level as "riskLevel",
        required_permissions as "requiredPermissions",
        confidence,
        priority
      FROM alert_recommendations
      WHERE alert_id = $1
      ORDER BY priority ASC, confidence DESC
    `;

    const result = await this.db.query(query, [alertId]);

    return result.rows.map(row => ({
      ...row,
      steps: row.steps || [],
      requiredPermissions: row.requiredPermissions || []
    }));
  }

  /**
   * Bulk generate recommendations for multiple alerts
   */
  async bulkGenerateRecommendations(alerts: Alert[]): Promise<Map<string, Recommendation[]>> {
    const recMap = new Map<string, Recommendation[]>();

    for (const alert of alerts) {
      const recommendations = await this.generateRecommendations(alert);
      recMap.set(alert.id, recommendations);
    }

    return recMap;
  }
}
