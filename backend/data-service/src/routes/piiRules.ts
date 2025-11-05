// PII Rules Configuration API
import { Request, Response, Router } from 'express';
import { Pool } from 'pg';
import { PIIQualityIntegration } from '../services/PIIQualityIntegration';
import { SmartPIIDetectionService } from '../services/SmartPIIDetectionService';
import { PIIRescanService } from '../services/PIIRescanService';
import { PIIRuleSyncService } from '../services/PIIRuleSync';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const piiQualityIntegration = new PIIQualityIntegration(pool);
const piiRescanService = new PIIRescanService(pool);
const piiRuleSync = new PIIRuleSyncService(pool);

const ok = <T>(res: Response, data: T) => res.json({ success: true, data });
const fail = (res: Response, code: number, message: string) =>
  res.status(code).json({ success: false, error: message });

/**
 * GET /api/pii-rules
 * Get all PII rule definitions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = 1; // TODO: Get from auth context

    const { rows } = await pool.query(
      `SELECT
        id,
        pii_type,
        display_name,
        description,
        category,
        regex_pattern,
        column_name_hints,
        sensitivity_level,
        compliance_flags,
        is_enabled,
        is_system_rule,
        requires_encryption,
        requires_masking,
        examples,
        false_positive_rate,
        created_at,
        updated_at
       FROM pii_rule_definitions
       WHERE tenant_id = $1
       ORDER BY
         CASE sensitivity_level
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         display_name`,
      [tenantId]
    );

    ok(res, rows);
  } catch (error: any) {
    console.error('Error fetching PII rules:', error);
    fail(res, 500, error.message);
  }
});

/**
 * GET /api/pii-rules/enabled
 * Get only enabled PII rules (for detection)
 */
router.get('/enabled', async (req: Request, res: Response) => {
  try {
    const tenantId = 1;

    const { rows } = await pool.query(
      `SELECT
        pii_type,
        display_name,
        regex_pattern,
        column_name_hints,
        sensitivity_level,
        compliance_flags,
        requires_encryption,
        requires_masking
       FROM pii_rule_definitions
       WHERE tenant_id = $1 AND is_enabled = true
       ORDER BY
         CASE sensitivity_level
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END`,
      [tenantId]
    );

    ok(res, rows);
  } catch (error: any) {
    console.error('Error fetching enabled PII rules:', error);
    fail(res, 500, error.message);
  }
});

/**
 * PUT /api/pii-rules/:id
 * Update a PII rule configuration
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      is_enabled,
      sensitivity_level,
      requires_encryption,
      requires_masking,
      compliance_flags,
      description,
      column_name_hints,
      regex_pattern,
      category,
      examples
    } = req.body;

    const tenantId = 1;

    // Get current rule to check for changes
    const currentRule = await pool.query(
      `SELECT pii_type, is_enabled FROM pii_rule_definitions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (currentRule.rows.length === 0) {
      return fail(res, 404, 'PII rule not found');
    }

    const wasEnabled = currentRule.rows[0].is_enabled;
    const piiType = currentRule.rows[0].pii_type;

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (typeof is_enabled === 'boolean') {
      updates.push(`is_enabled = $${paramIndex++}`);
      values.push(is_enabled);
    }

    if (sensitivity_level) {
      updates.push(`sensitivity_level = $${paramIndex++}`);
      values.push(sensitivity_level);
    }

    if (typeof requires_encryption === 'boolean') {
      updates.push(`requires_encryption = $${paramIndex++}`);
      values.push(requires_encryption);
    }

    if (typeof requires_masking === 'boolean') {
      updates.push(`requires_masking = $${paramIndex++}`);
      values.push(requires_masking);
    }

    if (compliance_flags !== undefined) {
      updates.push(`compliance_flags = $${paramIndex++}`);
      values.push(compliance_flags);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (column_name_hints !== undefined) {
      updates.push(`column_name_hints = $${paramIndex++}`);
      values.push(column_name_hints);
    }

    if (regex_pattern !== undefined) {
      updates.push(`regex_pattern = $${paramIndex++}`);
      values.push(regex_pattern);
    }

    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }

    if (examples !== undefined) {
      updates.push(`examples = $${paramIndex++}`);
      values.push(examples);
    }

    if (updates.length === 0) {
      return fail(res, 400, 'No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add id and tenant_id to values
    values.push(id, tenantId);

    const query = `
      UPDATE pii_rule_definitions
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return fail(res, 404, 'PII rule not found');
    }

    // If rule was disabled, use sync service to clean up all related data
    if (typeof is_enabled === 'boolean' && !is_enabled && wasEnabled) {
      console.log(`[PIIRules] Rule disabled: ${piiType} - syncing catalog and quality issues...`);

      const syncResult = await piiRuleSync.syncRuleDisabled(piiType);

      console.log(`[PIIRules] Sync complete: cleared ${syncResult.columnsCleared} columns, resolved ${syncResult.issuesResolved} issues`);
    }

    // If rule was enabled, automatically scan all data sources for this PII type
    if (typeof is_enabled === 'boolean' && is_enabled && !wasEnabled) {
      console.log(`PII rule enabled: ${piiType} - triggering automatic scan of all data sources`);

      // Get all data sources
      const dataSources = await pool.query(`SELECT id FROM data_sources`);

      // ALSO: Create quality issues for columns that are ALREADY marked with this PII type
      // (They were marked before but didn't have quality issues)
      const { rows: ruleDetails } = await pool.query(
        `SELECT requires_encryption, requires_masking, sensitivity_level FROM pii_rule_definitions WHERE id = $1`,
        [id]
      );

      if (ruleDetails.length > 0) {
        const rule = ruleDetails[0];

        // Get all columns already marked with this PII type
        const { rows: existingPII } = await pool.query(`
          SELECT
            cc.id as column_id,
            ca.id as asset_id,
            ca.datasource_id,
            ca.table_name,
            ca.schema_name,
            cc.column_name
          FROM catalog_columns cc
          JOIN catalog_assets ca ON ca.id = cc.asset_id
          WHERE cc.pii_type = $1
        `, [piiType]);

        console.log(`[PIIRules] Found ${existingPII.length} columns already marked as ${piiType} - creating quality issues`);

        // Create quality issues for existing PII columns
        for (const col of existingPII) {
          try {
            // Check if quality issue already exists (including resolved ones)
            const { rows: existingIssues } = await pool.query(`
              SELECT id, status FROM quality_issues
              WHERE asset_id = $1 AND title LIKE $2
              ORDER BY created_at DESC
              LIMIT 1
            `, [col.asset_id, `%${piiType}%`]);

            if (existingIssues.length > 0) {
              const existingIssue = existingIssues[0];

              // If issue exists and is open/acknowledged, skip
              if (existingIssue.status === 'open' || existingIssue.status === 'acknowledged') {
                continue;
              }

              // If issue was resolved, reopen it
              if (existingIssue.status === 'resolved') {
                await pool.query(`
                  UPDATE quality_issues
                  SET
                    status = 'open',
                    resolved_at = NULL,
                    updated_at = CURRENT_TIMESTAMP,
                    last_seen_at = CURRENT_TIMESTAMP
                  WHERE id = $1
                `, [existingIssue.id]);

                console.log(`[PIIRules] ✅ Reopened quality issue for: ${col.table_name}.${col.column_name} (${piiType})`);
                continue;
              }
            }

            // Get or create quality rule
            let ruleId;
            const { rows: qualityRules } = await pool.query(
              `SELECT id FROM quality_rules WHERE name = $1`,
              [`PII Detection: ${piiType}`]
            );

            if (qualityRules.length > 0) {
              ruleId = qualityRules[0].id;
            } else {
              const { rows: newRule } = await pool.query(`
                INSERT INTO quality_rules (
                  name, description, dimension, severity, type, dialect, expression,
                  rule_type, rule_config, tags, enabled, auto_generated
                ) VALUES (
                  $1, $2, 'validity', $3, 'sql', 'postgres', 'SELECT 1 WHERE 1=0',
                  'validation', $4, $5, true, true
                ) RETURNING id
              `, [
                `PII Detection: ${piiType}`,
                `Automatically detects ${piiType} PII in data columns`,
                rule.sensitivity_level || 'medium',
                JSON.stringify({ piiType, automated: true }),
                ['pii', 'privacy', piiType]
              ]);
              ruleId = newRule[0].id;
            }

            // Create quality issue
            const description = `Column "${col.schema_name}.${col.table_name}.${col.column_name}" contains ${piiType} PII data.

${rule.requires_encryption ? '⚠️ ENCRYPT this column immediately' : ''}
${rule.requires_masking ? '🔒 MASK in UI displays' : ''}

Sensitivity: ${rule.sensitivity_level}
Requires Encryption: ${rule.requires_encryption ? 'Yes' : 'No'}
Requires Masking: ${rule.requires_masking ? 'Yes' : 'No'}`;

            await pool.query(`
              INSERT INTO quality_issues (
                rule_id, asset_id, data_source_id, severity, dimension, status,
                title, description, affected_rows,
                created_at, updated_at, first_seen_at, last_seen_at
              ) VALUES (
                $1, $2, $3, $4, 'privacy', 'open', $5, $6, 1,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
            `, [
              ruleId,
              col.asset_id,
              col.datasource_id,
              rule.sensitivity_level || 'medium',
              `PII Detected: ${piiType}`,
              description
            ]);

            console.log(`[PIIRules] ✅ Created quality issue for: ${col.table_name}.${col.column_name} (${piiType})`);
          } catch (issueError) {
            console.error(`[PIIRules] Error creating quality issue:`, issueError);
          }
        }
      }

      // Trigger scan for each data source in background (don't wait)
      setImmediate(async () => {
        for (const ds of dataSources.rows) {
          try {
            const scanResult = await piiQualityIntegration.scanDataSourceForPII(ds.id);
            console.log(`Auto-scan complete for data source ${ds.id}: ${scanResult.violationsFound} ${piiType} violations found`);
          } catch (error) {
            console.error(`Auto-scan failed for data source ${ds.id}:`, error);
          }
        }
      });

      console.log(`Triggered background scan for ${dataSources.rows.length} data sources`);
    }

    // Clear the SmartPIIDetectionService cache so profiling uses updated rules
    SmartPIIDetectionService.clearCache();
    console.log('Cleared SmartPIIDetectionService cache - profiling will use updated PII rules');

    ok(res, rows[0]);
  } catch (error: any) {
    console.error('Error updating PII rule:', error);
    fail(res, 500, error.message);
  }
});

/**
 * POST /api/pii-rules
 * Create a custom PII rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      pii_type,
      display_name,
      description,
      category,
      regex_pattern,
      column_name_hints,
      sensitivity_level,
      compliance_flags,
      requires_encryption,
      requires_masking,
      examples
    } = req.body;

    const tenantId = 1;

    // Validate required fields
    if (!pii_type || !display_name || !sensitivity_level) {
      return fail(res, 400, 'Missing required fields: pii_type, display_name, sensitivity_level');
    }

    const { rows } = await pool.query(
      `INSERT INTO pii_rule_definitions (
        tenant_id, pii_type, display_name, description, category,
        regex_pattern, column_name_hints, sensitivity_level, compliance_flags,
        is_enabled, is_system_rule, requires_encryption, requires_masking, examples
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false, $10, $11, $12)
      RETURNING *`,
      [
        tenantId,
        pii_type,
        display_name,
        description,
        category || 'custom',
        regex_pattern,
        column_name_hints || [],
        sensitivity_level,
        compliance_flags || [],
        requires_encryption || false,
        requires_masking || false,
        examples || []
      ]
    );

    ok(res, rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique constraint violation
      return fail(res, 409, 'PII rule with this type already exists');
    }
    console.error('Error creating PII rule:', error);
    fail(res, 500, error.message);
  }
});

/**
 * DELETE /api/pii-rules/:id
 * Delete a custom PII rule (system rules cannot be deleted)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = 1;

    const { rows } = await pool.query(
      `DELETE FROM pii_rule_definitions
       WHERE id = $1 AND tenant_id = $2 AND is_system_rule = false
       RETURNING *`,
      [id, tenantId]
    );

    if (rows.length === 0) {
      return fail(res, 404, 'PII rule not found or cannot be deleted (system rule)');
    }

    ok(res, { deleted: true, rule: rows[0] });
  } catch (error: any) {
    console.error('Error deleting PII rule:', error);
    fail(res, 500, error.message);
  }
});

/**
 * GET /api/pii-rules/statistics
 * Get statistics about PII rules usage
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const tenantId = 1;

    const { rows: stats } = await pool.query(
      `SELECT
        COUNT(*) as total_rules,
        COUNT(*) FILTER (WHERE is_enabled = true) as enabled_rules,
        COUNT(*) FILTER (WHERE is_system_rule = true) as system_rules,
        COUNT(*) FILTER (WHERE is_system_rule = false) as custom_rules,
        COUNT(*) FILTER (WHERE sensitivity_level = 'critical') as critical_rules,
        COUNT(*) FILTER (WHERE requires_encryption = true) as encrypted_rules
       FROM pii_rule_definitions
       WHERE tenant_id = $1`,
      [tenantId]
    );

    ok(res, stats[0]);
  } catch (error: any) {
    console.error('Error fetching PII rules statistics:', error);
    fail(res, 500, error.message);
  }
});

/**
 * POST /api/pii-rules/scan/:dataSourceId
 * Scan a data source for PII violations and create quality issues
 */
router.post('/scan/:dataSourceId', async (req: Request, res: Response) => {
  try {
    const { dataSourceId } = req.params;

    // Validate data source exists
    const { rows: ds } = await pool.query(
      `SELECT id, name FROM data_sources WHERE id = $1`,
      [dataSourceId]
    );

    if (ds.length === 0) {
      return fail(res, 404, `Data source ${dataSourceId} not found`);
    }

    // Run PII scan
    console.log(`Starting PII scan for data source: ${ds[0].name} (${dataSourceId})`);
    const scanResult = await piiQualityIntegration.scanDataSourceForPII(dataSourceId);

    ok(res, {
      dataSource: {
        id: dataSourceId,
        name: ds[0].name
      },
      scan: scanResult
    });
  } catch (error: any) {
    console.error('Error scanning for PII:', error);
    fail(res, 500, error.message);
  }
});

/**
 * GET /api/pii-rules/:id/impact
 * Get impact preview of a PII rule - shows how many columns would be affected
 */
router.get('/:id/impact', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = 1;

    // Get the rule
    const { rows } = await pool.query(
      `SELECT pii_type FROM pii_rule_definitions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (rows.length === 0) {
      return fail(res, 404, 'PII rule not found');
    }

    const impact = await piiRescanService.getRuleImpact(rows[0].pii_type);

    ok(res, impact);
  } catch (error: any) {
    console.error('Error getting rule impact:', error);
    fail(res, 500, error.message);
  }
});

/**
 * POST /api/pii-rules/:id/rescan
 * Rescan all data using this specific PII rule
 */
router.post('/:id/rescan', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { clearExisting } = req.body;

    console.log(`Starting rescan for PII rule ${id}...`);

    // If requested, first clear existing classifications
    if (clearExisting) {
      const { rows } = await pool.query(
        `SELECT pii_type FROM pii_rule_definitions WHERE id = $1`,
        [id]
      );

      if (rows.length > 0) {
        await piiRescanService.clearPIIClassifications(rows[0].pii_type);
      }
    }

    // Run the rescan
    const result = await piiRescanService.rescanWithRule(parseInt(id));

    // After rescan, ensure quality issues exist for ALL columns with this PII type
    // (including columns that were already marked as PII before the rescan)
    const { rows: ruleRows } = await pool.query(
      `SELECT pii_type, display_name, requires_encryption, requires_masking, sensitivity_level
       FROM pii_rule_definitions
       WHERE id = $1 AND is_enabled = true`,
      [id]
    );

    if (ruleRows.length > 0) {
      const rule = ruleRows[0];

      // Get all columns with this PII type
      const { rows: allPIIColumns } = await pool.query(`
        SELECT
          cc.id as column_id,
          ca.id as asset_id,
          ca.datasource_id,
          ca.table_name,
          ca.schema_name,
          cc.column_name
        FROM catalog_columns cc
        JOIN catalog_assets ca ON ca.id = cc.asset_id
        WHERE cc.pii_type = $1
      `, [rule.pii_type]);

      console.log(`[PIIRules] Found ${allPIIColumns.length} columns with ${rule.pii_type} PII`);

      // Check quality issues for these columns and create/reopen as needed
      for (const col of allPIIColumns) {
        try {
          // Check if this is monitoring mode (no protection required)
          if (!rule.requires_encryption && !rule.requires_masking) {
            // Monitoring mode - resolve any existing quality issues FOR THIS SPECIFIC COLUMN
            // Match by column name in description since quality_issues are table-level
            const { rows: existingIssues } = await pool.query(`
              SELECT id, status, description FROM quality_issues
              WHERE asset_id = $1
                AND status IN ('open', 'acknowledged')
                AND (title ILIKE $2 OR title ILIKE $3)
                AND (
                  description ILIKE $4
                  OR description ILIKE $5
                  OR $6 = ANY(affected_columns)
                )
              ORDER BY created_at DESC
            `, [
              col.asset_id,
              `%${rule.pii_type}%`,        // Match pii_type (phone)
              `%${rule.display_name}%`,    // Match display_name (Phone Number)
              `%${col.schema_name}.${col.table_name}.${col.column_name}%`,  // Full qualified name
              `%.${col.column_name}"%`,    // Quoted column name
              col.column_name              // In affected_columns array
            ]);

            for (const issue of existingIssues) {
              await pool.query(`
                UPDATE quality_issues
                SET
                  status = 'resolved',
                  resolved_at = CURRENT_TIMESTAMP,
                  updated_at = CURRENT_TIMESTAMP,
                  description = description || $1
                WHERE id = $2
              `, [
                `\n\n✅ MONITORING MODE ENABLED: Protection requirements have been removed from PII settings.
This column is now in monitoring mode - encryption and masking are no longer required.
The issue has been automatically resolved.`,
                issue.id
              ]);

              console.log(`[PIIRules] ✅ AUTO-RESOLVED quality issue for monitoring mode: ${col.table_name}.${col.column_name} (${rule.pii_type})`);
            }

            // Skip creating new issues in monitoring mode
            continue;
          }

          // Protection required - check existing issues FOR THIS SPECIFIC COLUMN
          const { rows: existingIssues } = await pool.query(`
            SELECT id, status FROM quality_issues
            WHERE asset_id = $1
              AND (title ILIKE $2 OR title ILIKE $3)
              AND (
                description ILIKE $4
                OR description ILIKE $5
                OR $6 = ANY(affected_columns)
              )
            ORDER BY created_at DESC
            LIMIT 1
          `, [
            col.asset_id,
            `%${rule.pii_type}%`,        // Match pii_type (phone)
            `%${rule.display_name}%`,    // Match display_name (Phone Number)
            `%${col.schema_name}.${col.table_name}.${col.column_name}%`,  // Full qualified name
            `%.${col.column_name}"%`,    // Quoted column name
            col.column_name              // In affected_columns array
          ]);

          if (existingIssues.length > 0) {
            const existingIssue = existingIssues[0];

            // If issue exists and is open/acknowledged, skip
            if (existingIssue.status === 'open' || existingIssue.status === 'acknowledged') {
              continue;
            }

            // If issue was resolved, reopen it (protection is required but was removed)
            if (existingIssue.status === 'resolved') {
              await pool.query(`
                UPDATE quality_issues
                SET
                  status = 'open',
                  resolved_at = NULL,
                  updated_at = CURRENT_TIMESTAMP,
                  last_seen_at = CURRENT_TIMESTAMP
                WHERE id = $1
              `, [existingIssue.id]);

              console.log(`[PIIRules] ✅ Reopened quality issue for: ${col.table_name}.${col.column_name} (${rule.pii_type})`);
              continue;
            }
          }
          // Get or create quality rule
          let ruleId;
          const { rows: existingRules } = await pool.query(
            `SELECT id FROM quality_rules WHERE name = $1`,
            [`PII Detection: ${rule.pii_type}`]
          );

          if (existingRules.length > 0) {
            ruleId = existingRules[0].id;
          } else {
            const { rows: newRule } = await pool.query(`
              INSERT INTO quality_rules (
                name, description, dimension, severity, type, dialect, expression,
                rule_type, rule_config, tags, enabled, auto_generated
              ) VALUES (
                $1, $2, 'validity', $3, 'sql', 'postgres', 'SELECT 1 WHERE 1=0',
                'validation', $4, $5, true, true
              ) RETURNING id
            `, [
              `PII Detection: ${rule.pii_type}`,
              `Automatically detects ${rule.pii_type} PII in data columns`,
              rule.sensitivity_level || 'medium',
              JSON.stringify({ piiType: rule.pii_type, automated: true }),
              ['pii', 'privacy', rule.pii_type]
            ]);
            ruleId = newRule[0].id;
          }

          // Create quality issue
          const description = `Column "${col.schema_name}.${col.table_name}.${col.column_name}" contains ${rule.pii_type} PII data.

${rule.requires_encryption ? '⚠️ ENCRYPT this column immediately' : ''}
${rule.requires_masking ? '🔒 MASK in UI displays' : ''}

Sensitivity: ${rule.sensitivity_level}
Requires Encryption: ${rule.requires_encryption ? 'Yes' : 'No'}
Requires Masking: ${rule.requires_masking ? 'Yes' : 'No'}`;

          await pool.query(`
            INSERT INTO quality_issues (
              rule_id, asset_id, data_source_id, severity, dimension, status,
              title, description, affected_rows,
              created_at, updated_at, first_seen_at, last_seen_at
            ) VALUES (
              $1, $2, $3, $4, 'privacy', 'open', $5, $6, 1,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `, [
            ruleId,
            col.asset_id,
            col.datasource_id,
            rule.sensitivity_level || 'medium',
            `PII Detected: ${rule.pii_type}`,
            description
          ]);

          console.log(`[PIIRules] Created quality issue for existing PII: ${col.table_name}.${col.column_name}`);
        } catch (issueError) {
          console.error(`[PIIRules] Error creating quality issue for ${col.table_name}.${col.column_name}:`, issueError);
        }
      }
    }

    ok(res, {
      message: 'Rescan completed successfully',
      result,
    });
  } catch (error: any) {
    console.error('Error rescanning with rule:', error);
    fail(res, 500, error.message);
  }
});

/**
 * POST /api/pii-rules/rescan-all
 * Rescan all data with all enabled PII rules
 */
router.post('/rescan-all', async (req: Request, res: Response) => {
  try {
    console.log('Starting full PII rescan...');

    const result = await piiRescanService.rescanAllRules();

    // After rescan, process ALL enabled rules to handle existing quality issues
    // This ensures monitoring mode is applied across all PII types
    const { rows: enabledRules } = await pool.query(
      `SELECT id, pii_type, display_name, requires_encryption, requires_masking, sensitivity_level
       FROM pii_rule_definitions
       WHERE is_enabled = true`
    );

    for (const rule of enabledRules) {
      // Get all columns with this PII type
      const { rows: allPIIColumns } = await pool.query(`
        SELECT
          cc.id as column_id,
          ca.id as asset_id,
          ca.datasource_id,
          ca.database_name,
          ca.table_name,
          ca.schema_name,
          cc.column_name
        FROM catalog_columns cc
        JOIN catalog_assets ca ON ca.id = cc.asset_id
        WHERE cc.pii_type = $1
      `, [rule.pii_type]);

      console.log(`[PIIRules - Rescan All] Processing ${allPIIColumns.length} columns with ${rule.pii_type} PII`);

      // Check quality issues for these columns
      for (const col of allPIIColumns) {
        try {
          // Check if this is monitoring mode (no protection required)
          if (!rule.requires_encryption && !rule.requires_masking) {
            // Monitoring mode - resolve any existing quality issues FOR THIS SPECIFIC COLUMN
            // Match by column name in description since quality_issues are table-level
            const { rows: existingIssues } = await pool.query(`
              SELECT id, status, description FROM quality_issues
              WHERE asset_id = $1
                AND status IN ('open', 'acknowledged')
                AND (title ILIKE $2 OR title ILIKE $3)
                AND (
                  description ILIKE $4
                  OR description ILIKE $5
                  OR $6 = ANY(affected_columns)
                )
              ORDER BY created_at DESC
            `, [
              col.asset_id,
              `%${rule.pii_type}%`,        // Match pii_type (phone)
              `%${rule.display_name}%`,    // Match display_name (Phone Number)
              `%${col.schema_name}.${col.table_name}.${col.column_name}%`,  // Full qualified name
              `%.${col.column_name}"%`,    // Quoted column name
              col.column_name              // In affected_columns array
            ]);

            for (const issue of existingIssues) {
              await pool.query(`
                UPDATE quality_issues
                SET
                  status = 'resolved',
                  resolved_at = CURRENT_TIMESTAMP,
                  updated_at = CURRENT_TIMESTAMP,
                  description = description || $1
                WHERE id = $2
              `, [
                `\n\n✅ MONITORING MODE ENABLED: Protection requirements have been removed from PII settings.
This column is now in monitoring mode - encryption and masking are no longer required.
The issue has been automatically resolved.`,
                issue.id
              ]);

              console.log(`[PIIRules - Rescan All] ✅ AUTO-RESOLVED quality issue for monitoring mode: ${col.table_name}.${col.column_name} (${rule.pii_type})`);
            }

            // Skip creating new issues in monitoring mode
            continue;
          }

          // Protection required - check existing issues FOR THIS SPECIFIC COLUMN
          const { rows: existingIssues } = await pool.query(`
            SELECT id, status FROM quality_issues
            WHERE asset_id = $1
              AND (title ILIKE $2 OR title ILIKE $3)
              AND (
                description ILIKE $4
                OR description ILIKE $5
                OR $6 = ANY(affected_columns)
              )
            ORDER BY created_at DESC
            LIMIT 1
          `, [
            col.asset_id,
            `%${rule.pii_type}%`,        // Match pii_type (phone)
            `%${rule.display_name}%`,    // Match display_name (Phone Number)
            `%${col.schema_name}.${col.table_name}.${col.column_name}%`,  // Full qualified name
            `%.${col.column_name}"%`,    // Quoted column name
            col.column_name              // In affected_columns array
          ]);

          if (existingIssues.length > 0) {
            const existingIssue = existingIssues[0];

            // If issue exists and is open/acknowledged, skip
            if (existingIssue.status === 'open' || existingIssue.status === 'acknowledged') {
              continue;
            }

            // If issue was resolved, reopen it (protection is required but was removed)
            if (existingIssue.status === 'resolved') {
              await pool.query(`
                UPDATE quality_issues
                SET
                  status = 'open',
                  resolved_at = NULL,
                  updated_at = CURRENT_TIMESTAMP,
                  last_seen_at = CURRENT_TIMESTAMP
                WHERE id = $1
              `, [existingIssue.id]);

              console.log(`[PIIRules - Rescan All] ✅ Reopened quality issue for: ${col.table_name}.${col.column_name} (${rule.pii_type})`);
            }
          }
        } catch (issueError) {
          console.error(`[PIIRules - Rescan All] Error processing quality issue for ${col.table_name}.${col.column_name}:`, issueError);
        }
      }
    }

    console.log('[PIIRules - Rescan All] Post-processing complete');

    ok(res, {
      message: 'Full rescan completed successfully',
      result,
    });
  } catch (error: any) {
    console.error('Error in full rescan:', error);
    fail(res, 500, error.message);
  }
});

/**
 * POST /api/pii-rules/cleanup-orphaned
 * Clean up PII classifications that have no enabled rule
 * This fixes issues where disabled/deleted rules leave stale PII markers
 */
router.post('/cleanup-orphaned', async (req: Request, res: Response) => {
  try {
    console.log('[PIIRules] Running orphaned PII cleanup...');

    const result = await piiRuleSync.cleanupOrphanedPII();

    console.log(`[PIIRules] Cleanup complete: cleared ${result.columnsCleared} columns, resolved ${result.issuesResolved} issues`);

    ok(res, {
      message: 'Orphaned PII cleanup completed successfully',
      columnsCleared: result.columnsCleared,
      issuesResolved: result.issuesResolved
    });
  } catch (error: any) {
    console.error('Error cleaning up orphaned PII:', error);
    fail(res, 500, error.message);
  }
});

/**
 * POST /api/pii-rules/create-quality-issues
 * Create quality issues for existing PII columns that don't have issues yet
 * This is useful when PII was detected but quality issues weren't created
 */
router.post('/create-quality-issues', async (req: Request, res: Response) => {
  try {
    console.log('[PIIRules] Creating quality issues for existing PII columns...');

    // Get all PII columns that don't have quality issues
    const { rows: piiColumns } = await pool.query(`
      SELECT
        cc.id as column_id,
        cc.column_name,
        cc.pii_type,
        ca.id as asset_id,
        ca.datasource_id,
        ca.table_name,
        ca.schema_name,
        prd.sensitivity_level,
        prd.requires_encryption,
        prd.requires_masking
      FROM catalog_columns cc
      JOIN catalog_assets ca ON ca.id = cc.asset_id
      JOIN pii_rule_definitions prd ON prd.pii_type = cc.pii_type AND prd.is_enabled = true
      WHERE cc.pii_type IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM quality_issues qi
          WHERE qi.asset_id = ca.id
            AND qi.title LIKE '%' || cc.pii_type || '%'
            AND qi.status IN ('open', 'acknowledged')
        )
    `);

    console.log(`[PIIRules] Found ${piiColumns.length} PII columns without quality issues`);

    if (piiColumns.length === 0) {
      ok(res, {
        message: 'No PII columns need quality issues',
        issuesCreated: 0
      });
      return;
    }

    let issuesCreated = 0;

    // For each PII column, create quality rule and issue
    for (const col of piiColumns) {
      // Get or create quality rule
      let ruleId;
      const { rows: existingRules } = await pool.query(
        `SELECT id FROM quality_rules WHERE name = $1`,
        [`PII Detection: ${col.pii_type}`]
      );

      if (existingRules.length > 0) {
        ruleId = existingRules[0].id;
      } else {
        // Create quality rule
        const { rows: newRule } = await pool.query(`
          INSERT INTO quality_rules (
            name,
            description,
            dimension,
            severity,
            type,
            dialect,
            expression,
            rule_type,
            rule_config,
            tags,
            enabled,
            auto_generated
          ) VALUES (
            $1, $2, 'validity', $3, 'sql', 'postgres', 'SELECT 1 WHERE 1=0', 'validation', $4, $5, true, true
          )
          RETURNING id
        `, [
          `PII Detection: ${col.pii_type}`,
          `Automatically detects ${col.pii_type} PII in data columns`,
          col.sensitivity_level || 'medium',
          JSON.stringify({ piiType: col.pii_type, automated: true, source: 'pii_backfill' }),
          ['pii', 'privacy', col.pii_type]
        ]);

        ruleId = newRule[0].id;
        console.log(`[PIIRules] Created quality rule for PII type: ${col.pii_type}`);
      }

      // Create quality issue
      const description = `Column "${col.schema_name}.${col.table_name}.${col.column_name}" contains ${col.pii_type} PII data.

${col.requires_encryption ? '⚠️ ENCRYPT this column immediately' : ''}
${col.requires_masking ? '🔒 MASK in UI displays' : ''}

Sensitivity: ${col.sensitivity_level}
Requires Encryption: ${col.requires_encryption ? 'Yes' : 'No'}
Requires Masking: ${col.requires_masking ? 'Yes' : 'No'}`;

      await pool.query(`
        INSERT INTO quality_issues (
          rule_id,
          asset_id,
          data_source_id,
          severity,
          dimension,
          status,
          title,
          description,
          affected_rows,
          created_at,
          updated_at,
          first_seen_at,
          last_seen_at
        ) VALUES (
          $1, $2, $3, $4, 'privacy', 'open', $5, $6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [
        ruleId,
        col.asset_id,
        col.datasource_id,
        col.sensitivity_level || 'medium',
        `PII Detected: ${col.pii_type}`,
        description
      ]);

      console.log(`[PIIRules] Created quality issue for: ${col.table_name}.${col.column_name} (${col.pii_type})`);
      issuesCreated++;
    }

    console.log(`[PIIRules] Successfully created ${issuesCreated} quality issues`);

    ok(res, {
      message: 'Quality issues created successfully',
      issuesCreated,
      columnsProcessed: piiColumns.length
    });
  } catch (error: any) {
    console.error('Error creating quality issues for PII:', error);
    fail(res, 500, error.message);
  }
});

export default router;
