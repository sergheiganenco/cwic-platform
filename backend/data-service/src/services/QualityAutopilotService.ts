import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { ProfilingService } from './ProfilingService';
import { v4 as uuidv4 } from 'uuid';

interface DataFormat {
  type: string;
  pattern: string;
  confidence: number;
}

interface ColumnProfile {
  name: string;
  type: string;
  nullRate: number;
  uniqueRate: number;
  sampleValues: string[];
}

interface TableProfile {
  schema: string;
  name: string;
  rowCount: number;
  columns: ColumnProfile[];
}

interface DataProfile {
  dataSourceId: string;
  tables: TableProfile[];
  profiledAt: Date;
}

interface AutopilotResult {
  groupId: string;
  rulesGenerated: number;
  profile: DataProfile;
  nextScan: string;
  summary: {
    nullChecks: number;
    formatValidators: number;
    uniquenessRules: number;
    piiRules: number;
    freshnessChecks: number;
  };
}

export class QualityAutopilotService {
  private db: Pool;
  private profilingService: ProfilingService;

  constructor(db: Pool) {
    this.db = db;
    this.profilingService = new ProfilingService(db);
  }

  /**
   * Main entry point - enables autopilot for a data source
   */
  async enableAutopilot(dataSourceId: string, userId: string): Promise<AutopilotResult> {
    logger.info(`Enabling Quality Autopilot for data source ${dataSourceId}`);

    try {
      // 1. Check if autopilot already enabled
      const existing = await this.getAutopilotGroup(dataSourceId);
      if (existing) {
        logger.warn(`Autopilot already enabled for data source ${dataSourceId}`);
        return this.getAutopilotStatus(dataSourceId);
      }

      // 2. Profile the entire database
      logger.info('Step 1/4: Profiling database...');
      const profile = await this.profileDataSource(dataSourceId);

      // 3. Generate smart rules based on profiling
      logger.info('Step 2/4: Generating smart rules...');
      const { rules, summary } = await this.generateSmartRules(dataSourceId, profile, userId);

      // 4. Create autopilot rule group
      logger.info('Step 3/4: Creating autopilot group...');
      const group = await this.createAutopilotGroup(dataSourceId, userId, summary);

      // 5. Associate generated rules with group
      logger.info('Step 4/4: Associating rules with group...');
      await this.associateRules(group.id, rules.map(r => r.id));

      // 6. Save profiling results
      await this.saveProfilingResults(dataSourceId, profile, rules.length, userId);

      logger.info(`Autopilot enabled successfully! Generated ${rules.length} rules`);

      return {
        groupId: group.id,
        rulesGenerated: rules.length,
        profile,
        nextScan: 'Tomorrow at 3:00 AM',
        summary
      };
    } catch (error: any) {
      logger.error('Failed to enable autopilot:', error);
      throw new Error(`Failed to enable autopilot: ${error.message}`);
    }
  }

  /**
   * Get autopilot status for a data source
   */
  async getAutopilotStatus(dataSourceId: string): Promise<AutopilotResult | null> {
    const group = await this.getAutopilotGroup(dataSourceId);
    if (!group) {
      return null;
    }

    // Get associated rules count
    const rulesResult = await this.db.query(
      `SELECT COUNT(*) as count FROM quality_rule_group_members WHERE group_id = $1`,
      [group.id]
    );

    // Get latest profile
    const profileResult = await this.db.query(
      `SELECT * FROM quality_autopilot_profiles
       WHERE data_source_id = $1
       ORDER BY profiled_at DESC
       LIMIT 1`,
      [dataSourceId]
    );

    const profile = profileResult.rows[0];

    return {
      groupId: group.id,
      rulesGenerated: parseInt(rulesResult.rows[0].count),
      profile: profile ? profile.profile_data : null,
      nextScan: 'Tomorrow at 3:00 AM',
      summary: group.config?.summary || {
        nullChecks: 0,
        formatValidators: 0,
        uniquenessRules: 0,
        piiRules: 0,
        freshnessChecks: 0
      }
    };
  }

  /**
   * Disable autopilot for a data source
   */
  async disableAutopilot(dataSourceId: string): Promise<void> {
    const group = await this.getAutopilotGroup(dataSourceId);
    if (!group) {
      throw new Error('Autopilot not enabled for this data source');
    }

    // Disable the group (keeps rules but marks as inactive)
    await this.db.query(
      `UPDATE quality_rule_groups SET enabled = false WHERE id = $1`,
      [group.id]
    );

    logger.info(`Autopilot disabled for data source ${dataSourceId}`);
  }

  /**
   * Profile entire data source
   */
  private async profileDataSource(dataSourceId: string): Promise<DataProfile> {
    // Get all tables for this data source
    const tablesResult = await this.db.query(
      `SELECT DISTINCT schema_name, table_name
       FROM catalog_assets
       WHERE datasource_id = $1
       AND asset_type = 'table'
       AND system_table = false
       ORDER BY schema_name, table_name`,
      [dataSourceId]
    );

    const tables: TableProfile[] = [];

    for (const tableRow of tablesResult.rows) {
      try {
        logger.info(`Profiling table ${tableRow.schema_name}.${tableRow.table_name}...`);

        // Get table profile from existing profiling service
        const profile = await this.profilingService.profileTable(
          dataSourceId,
          tableRow.schema_name,
          tableRow.table_name,
          { sampleSize: 1000 }
        );

        tables.push({
          schema: tableRow.schema_name,
          name: tableRow.table_name,
          rowCount: profile.row_count || 0,
          columns: (profile.columns || []).map((col: any) => ({
            name: col.name,
            type: col.type,
            nullRate: col.null_count / (profile.row_count || 1),
            uniqueRate: col.distinct_count / (profile.row_count || 1),
            sampleValues: col.sample_values || []
          }))
        });
      } catch (error: any) {
        logger.warn(`Failed to profile table ${tableRow.schema_name}.${tableRow.table_name}:`, error.message);
        // Continue with other tables
      }
    }

    return {
      dataSourceId,
      tables,
      profiledAt: new Date()
    };
  }

  /**
   * Generate smart rules based on profiling data
   */
  private async generateSmartRules(
    dataSourceId: string,
    profile: DataProfile,
    userId: string
  ): Promise<{ rules: any[]; summary: any }> {
    const rules: any[] = [];
    const summary = {
      nullChecks: 0,
      formatValidators: 0,
      uniquenessRules: 0,
      piiRules: 0,
      freshnessChecks: 0
    };

    for (const tableProfile of profile.tables) {
      // Get asset ID for this table
      const assetResult = await this.db.query(
        `SELECT id FROM catalog_assets
         WHERE datasource_id = $1
         AND schema_name = $2
         AND table_name = $3
         LIMIT 1`,
        [dataSourceId, tableProfile.schema, tableProfile.name]
      );

      if (assetResult.rows.length === 0) {
        continue;
      }

      const assetId = assetResult.rows[0].id;

      // NULL checks for columns with low NULL rate
      for (const col of tableProfile.columns) {
        if (col.nullRate > 0 && col.nullRate < 0.5) {
          const rule = await this.createNullCheckRule(
            dataSourceId,
            assetId,
            tableProfile,
            col,
            col.nullRate * 1.5,
            userId
          );
          rules.push(rule);
          summary.nullChecks++;
        }
      }

      // Format validators (email, phone, etc.)
      for (const col of tableProfile.columns) {
        const format = this.detectFormat(col);
        if (format && format.confidence > 0.8) {
          const rule = await this.createFormatRule(
            dataSourceId,
            assetId,
            tableProfile,
            col,
            format,
            userId
          );
          rules.push(rule);
          summary.formatValidators++;
        }
      }

      // Uniqueness rules
      for (const col of tableProfile.columns) {
        if (col.uniqueRate > 0.95 && tableProfile.rowCount > 100) {
          const rule = await this.createUniquenessRule(
            dataSourceId,
            assetId,
            tableProfile,
            col,
            userId
          );
          rules.push(rule);
          summary.uniquenessRules++;
        }
      }

      // PII detection (basic patterns)
      for (const col of tableProfile.columns) {
        const piiType = this.detectPIIType(col);
        if (piiType) {
          const rule = await this.createPIIRule(
            dataSourceId,
            assetId,
            tableProfile,
            col,
            piiType,
            userId
          );
          rules.push(rule);
          summary.piiRules++;
        }
      }

      // Freshness check (if has timestamp column)
      const timestampCol = tableProfile.columns.find(c =>
        c.type.toLowerCase().includes('timestamp') ||
        c.name.toLowerCase().match(/(created|updated)_at/)
      );
      if (timestampCol) {
        const rule = await this.createFreshnessRule(
          dataSourceId,
          assetId,
          tableProfile,
          timestampCol,
          userId
        );
        rules.push(rule);
        summary.freshnessChecks++;
      }
    }

    return { rules, summary };
  }

  /**
   * Detect data format (email, phone, SSN, etc.)
   */
  private detectFormat(column: ColumnProfile): DataFormat | null {
    const sample = column.sampleValues || [];
    if (sample.length < 5) return null;

    // Email detection
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailMatches = sample.filter(v => v && emailPattern.test(String(v))).length;
    if (emailMatches / sample.length > 0.8) {
      return {
        type: 'email',
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        confidence: emailMatches / sample.length
      };
    }

    // Phone detection
    const phonePattern = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    const phoneMatches = sample.filter(v => v && phonePattern.test(String(v))).length;
    if (phoneMatches / sample.length > 0.8) {
      return {
        type: 'phone',
        pattern: phonePattern.source,
        confidence: phoneMatches / sample.length
      };
    }

    return null;
  }

  /**
   * Detect PII type based on column name and data
   */
  private detectPIIType(column: ColumnProfile): string | null {
    const colName = column.name.toLowerCase();

    if (colName.match(/email/)) return 'email';
    if (colName.match(/phone|tel|mobile/)) return 'phone';
    if (colName.match(/ssn|social/)) return 'ssn';
    if (colName.match(/credit|card/)) return 'credit_card';
    if (colName.match(/address|street|city|zip/)) return 'address';
    if (colName.match(/first_name|last_name|full_name/)) return 'name';

    return null;
  }

  /**
   * Create NULL check rule
   */
  private async createNullCheckRule(
    dataSourceId: string,
    assetId: number,
    table: TableProfile,
    column: ColumnProfile,
    threshold: number,
    userId: string
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO quality_rules (
        name, description, rule_type, dimension, severity,
        data_source_id, asset_id, column_name, rule_config, enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        `[Autopilot] ${table.schema}.${table.name}.${column.name} - NULL check`,
        `Ensures ${column.name} has less than ${(threshold * 100).toFixed(1)}% NULL values`,
        'threshold',
        'completeness',
        'medium',
        dataSourceId,
        assetId,
        column.name,
        JSON.stringify({ metric: 'null_rate', operator: '<', threshold }),
        true,
        userId
      ]
    );

    return result.rows[0];
  }

  /**
   * Create format validation rule
   */
  private async createFormatRule(
    dataSourceId: string,
    assetId: number,
    table: TableProfile,
    column: ColumnProfile,
    format: DataFormat,
    userId: string
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO quality_rules (
        name, description, rule_type, dimension, severity,
        data_source_id, asset_id, column_name, rule_config, enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        `[Autopilot] ${table.schema}.${table.name}.${column.name} - ${format.type} format`,
        `Validates ${column.name} follows ${format.type} format`,
        'pattern',
        'validity',
        'medium',
        dataSourceId,
        assetId,
        column.name,
        JSON.stringify({ pattern: format.pattern, expectMatch: true }),
        true,
        userId
      ]
    );

    return result.rows[0];
  }

  /**
   * Create uniqueness rule
   */
  private async createUniquenessRule(
    dataSourceId: string,
    assetId: number,
    table: TableProfile,
    column: ColumnProfile,
    userId: string
  ): Promise<any> {
    const expression = `
      SELECT ${column.name} as duplicate_value,
             COUNT(*) as occurrence_count
      FROM ${table.schema}.${table.name}
      WHERE ${column.name} IS NOT NULL
      GROUP BY ${column.name}
      HAVING COUNT(*) > 1
    `.trim();

    const result = await this.db.query(
      `INSERT INTO quality_rules (
        name, description, rule_type, dimension, severity,
        data_source_id, asset_id, column_name, expression, rule_config, enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        `[Autopilot] ${table.schema}.${table.name}.${column.name} - Uniqueness`,
        `Detects duplicate values in ${column.name}`,
        'sql',
        'uniqueness',
        'high',
        dataSourceId,
        assetId,
        column.name,
        expression,
        JSON.stringify({ expectZero: true }),
        true,
        userId
      ]
    );

    return result.rows[0];
  }

  /**
   * Create PII detection rule
   */
  private async createPIIRule(
    dataSourceId: string,
    assetId: number,
    table: TableProfile,
    column: ColumnProfile,
    piiType: string,
    userId: string
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO quality_rules (
        name, description, rule_type, dimension, severity,
        data_source_id, asset_id, column_name, rule_config, enabled, created_by, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        `[Autopilot] ${table.schema}.${table.name}.${column.name} - PII (${piiType})`,
        `Monitors PII data in ${column.name}`,
        'pii',
        'privacy',
        'high',
        dataSourceId,
        assetId,
        column.name,
        JSON.stringify({ piiType, autoDetect: true }),
        true,
        userId,
        ['pii', 'privacy', 'autopilot']
      ]
    );

    return result.rows[0];
  }

  /**
   * Create freshness check rule
   */
  private async createFreshnessRule(
    dataSourceId: string,
    assetId: number,
    table: TableProfile,
    column: ColumnProfile,
    userId: string
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO quality_rules (
        name, description, rule_type, dimension, severity,
        data_source_id, asset_id, column_name, rule_config, enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        `[Autopilot] ${table.schema}.${table.name} - Data freshness`,
        `Ensures data in ${table.name} is updated within 24 hours`,
        'freshness_check',
        'timeliness',
        'medium',
        dataSourceId,
        assetId,
        column.name,
        JSON.stringify({ maxAgeDays: 1, timestampColumn: column.name }),
        true,
        userId
      ]
    );

    return result.rows[0];
  }

  /**
   * Create autopilot rule group
   */
  private async createAutopilotGroup(
    dataSourceId: string,
    userId: string,
    summary: any
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO quality_rule_groups (
        name, description, type, data_source_id, config, enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        'Quality Autopilot',
        'AI-generated quality rules for comprehensive monitoring',
        'autopilot',
        dataSourceId,
        JSON.stringify({ summary, autoAdjustThresholds: true }),
        true,
        userId
      ]
    );

    return result.rows[0];
  }

  /**
   * Get existing autopilot group
   */
  private async getAutopilotGroup(dataSourceId: string): Promise<any | null> {
    const result = await this.db.query(
      `SELECT * FROM quality_rule_groups
       WHERE data_source_id = $1 AND type = 'autopilot'
       LIMIT 1`,
      [dataSourceId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Associate rules with group
   */
  private async associateRules(groupId: string, ruleIds: string[]): Promise<void> {
    for (const ruleId of ruleIds) {
      await this.db.query(
        `INSERT INTO quality_rule_group_members (group_id, rule_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [groupId, ruleId]
      );
    }
  }

  /**
   * Save profiling results
   */
  private async saveProfilingResults(
    dataSourceId: string,
    profile: DataProfile,
    rulesGenerated: number,
    userId: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO quality_autopilot_profiles (
        data_source_id, profile_data, rules_generated, profiled_by, status
      ) VALUES ($1, $2, $3, $4, $5)`,
      [dataSourceId, JSON.stringify(profile), rulesGenerated, userId, 'completed']
    );
  }
}
