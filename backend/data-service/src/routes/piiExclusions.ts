// PII Exclusions API - Manual False Positive Management
import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

const router = Router();

/**
 * Mark a column as "Not PII" and add to exclusion list
 * POST /api/pii-exclusions/mark-not-pii
 */
router.post('/mark-not-pii', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      columnId,
      assetId,
      columnName,
      tableName,
      schemaName,
      databaseName,
      piiType,
      exclusionType = 'table_column', // Default to specific table+column
      reason,
      excludedBy = 'user',
    } = req.body;

    // Validation
    if (!columnId || !piiType || !columnName) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: columnId, piiType, columnName',
      });
      return;
    }

    // Step 1: Get the PII rule ID for this pii_type
    const { rows: ruleRows } = await client.query(
      `SELECT id, pii_type, display_name FROM pii_rule_definitions WHERE pii_type = $1`,
      [piiType]
    );

    if (ruleRows.length === 0) {
      res.status(404).json({
        success: false,
        error: `PII rule not found for type: ${piiType}`,
      });
      return;
    }

    const rule = ruleRows[0];

    // Step 2: Clear the PII classification from the column IMMEDIATELY
    console.log(`[Mark as Not PII] Clearing PII classification for column ${columnId} (${columnName})`);

    const { rowCount: clearedRows } = await client.query(
      `UPDATE catalog_columns
       SET
         pii_type = NULL,
         data_classification = NULL,
         is_sensitive = false,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [columnId]
    );

    console.log(`[Mark as Not PII] ✅ Cleared PII from ${clearedRows} column(s)`);

    // Verify the update worked
    const { rows: verifyRows } = await client.query(
      `SELECT id, column_name, pii_type, is_sensitive FROM catalog_columns WHERE id = $1`,
      [columnId]
    );
    console.log(`[Mark as Not PII] 🔍 Verification query result:`, verifyRows[0]);

    // Step 3: Resolve any open quality issues for this column IMMEDIATELY
    console.log(`[Mark as Not PII] Resolving quality issues for column ${columnName}...`);

    const { rowCount: resolvedIssues } = await client.query(
      `UPDATE quality_issues
       SET
         status = 'resolved',
         resolved_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP,
         description = description || $1
       WHERE asset_id = $2
         AND (title ILIKE $3 OR title ILIKE $4)
         AND status IN ('open', 'acknowledged')
         AND (
           description ILIKE $5
           OR description ILIKE $6
           OR $7 = ANY(affected_columns)
         )`,
      [
        `\n\n✅ MARKED AS NOT PII: User manually verified this is not ${rule.display_name}.
The column has been removed from PII detection and added to the exclusion list.
Future scans will skip this column automatically.`,
        assetId,
        `%${piiType}%`,
        `%${rule.display_name}%`,
        `%${schemaName}.${tableName}.${columnName}%`,
        `%.${columnName}"%`,
        columnName,
      ]
    );

    console.log(`[Mark as Not PII] ✅ Resolved ${resolvedIssues} quality issue(s)`);

    // Step 4: Check if exclusion already exists
    const { rows: existingExclusions } = await client.query(
      `SELECT id FROM pii_exclusions
       WHERE pii_rule_id = $1
         AND exclusion_type = $2
         AND column_name = $3
         AND (
           $2 = 'exact_column'
           OR (table_name = $4 AND schema_name = $5)
         )`,
      [rule.id, exclusionType, columnName, tableName || null, schemaName || null]
    );

    let exclusionId;

    if (existingExclusions.length > 0) {
      // Update existing exclusion
      exclusionId = existingExclusions[0].id;
      await client.query(
        `UPDATE pii_exclusions
         SET
           reason = $1,
           excluded_by = $2,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [
          reason || `User marked as false positive - ${columnName} is not ${rule.display_name}`,
          excludedBy,
          exclusionId,
        ]
      );
    } else {
      // Create new exclusion
      console.log(`[Mark as Not PII] Creating NEW exclusion for ${columnName}...`);
      console.log(`[Mark as Not PII] Exclusion params:`, {
        pii_rule_id: rule.id,
        exclusion_type: exclusionType,
        column_name: columnName,
        table_name: tableName,
        schema_name: schemaName,
        database_name: databaseName,
      });

      const { rows: newExclusion } = await client.query(
        `INSERT INTO pii_exclusions (
          pii_rule_id,
          exclusion_type,
          column_name,
          table_name,
          schema_name,
          database_name,
          reason,
          excluded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          rule.id,
          exclusionType,
          columnName,
          tableName || null,
          schemaName || null,
          databaseName || null,
          reason || `User marked as false positive - ${columnName} is not ${rule.display_name}`,
          excludedBy,
        ]
      );
      exclusionId = newExclusion[0].id;
      console.log(`[Mark as Not PII] ✅ Created exclusion ID: ${exclusionId}`);
    }

    // Step 5: Update pii_detected flag on asset if no more PII columns exist
    const { rows: remainingPII } = await client.query(
      `SELECT COUNT(*) as pii_count
       FROM catalog_columns
       WHERE asset_id = $1 AND pii_type IS NOT NULL`,
      [assetId]
    );

    if (parseInt(remainingPII[0].pii_count) === 0) {
      await client.query(
        `UPDATE catalog_assets
         SET pii_detected = false, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [assetId]
      );
    }

    // Step 6: Log the action (optional - audit_log table may not exist)
    // IMPORTANT: Don't try audit logging inside transaction - it can cause implicit ROLLBACK
    /*
    try {
      await client.query(
        `INSERT INTO audit_log (action, entity_type, entity_id, details, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [
          'mark_not_pii',
          'column',
          columnId,
          JSON.stringify({
            piiType,
            columnName,
            tableName,
            schemaName,
            exclusionType,
            exclusionId,
            reason: reason || 'User marked as false positive',
          }),
        ]
      );
    } catch (auditError) {
      // Ignore audit log errors - table may not exist
      console.log('Note: audit_log table not available, skipping audit entry');
    }
    */
    console.log('[Mark as Not PII] Skipping audit log (moved outside transaction)');

    // COMMIT the transaction
    await client.query('COMMIT');
    console.log(`[Mark as Not PII] ✅ COMPLETE - Column ${columnName} is no longer PII (cleared: ${clearedRows}, resolved issues: ${resolvedIssues}, exclusion: ${exclusionId})`);

    res.json({
      success: true,
      message: `✅ INSTANT UPDATE: Column "${columnName}" is no longer ${rule.display_name} PII`,
      data: {
        exclusionId,
        piiRuleId: rule.id,
        piiType,
        columnName,
        tableName,
        schemaName,
        exclusionType,
        clearedFromDatabase: true,
        issuesResolved: resolvedIssues || 0,
        instantUpdate: true, // Flag to indicate no rescan needed
      },
    });

    console.log(
      `✅ Marked ${schemaName}.${tableName}.${columnName} as NOT ${piiType} (exclusion: ${exclusionId})`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error marking column as not PII:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark column as not PII',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    client.release();
  }
});

/**
 * Get all exclusions for a specific PII rule
 * GET /api/pii-exclusions/rule/:ruleId
 */
router.get('/rule/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    const { rows } = await pool.query(
      `SELECT
        pe.id,
        pe.exclusion_type,
        pe.column_name,
        pe.table_name,
        pe.schema_name,
        pe.database_name,
        pe.pattern,
        pe.reason,
        pe.excluded_by,
        pe.created_at,
        prd.pii_type,
        prd.display_name
      FROM pii_exclusions pe
      JOIN pii_rule_definitions prd ON prd.id = pe.pii_rule_id
      WHERE pe.pii_rule_id = $1
      ORDER BY pe.created_at DESC`,
      [ruleId]
    );

    res.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('Error fetching exclusions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exclusions',
    });
  }
});

/**
 * Get all exclusions across all rules
 * GET /api/pii-exclusions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        pe.id,
        pe.exclusion_type,
        pe.column_name,
        pe.table_name,
        pe.schema_name,
        pe.database_name,
        pe.pattern,
        pe.reason,
        pe.excluded_by,
        pe.created_at,
        prd.id as pii_rule_id,
        prd.pii_type,
        prd.display_name
      FROM pii_exclusions pe
      JOIN pii_rule_definitions prd ON prd.id = pe.pii_rule_id
      ORDER BY pe.created_at DESC`
    );

    res.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('Error fetching exclusions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exclusions',
    });
  }
});

/**
 * Delete an exclusion (allow column to be re-detected)
 * DELETE /api/pii-exclusions/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `DELETE FROM pii_exclusions WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Exclusion not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Exclusion deleted - column can now be re-detected as PII',
      data: rows[0],
    });

    console.log(`✅ Deleted PII exclusion ${id} - column can now be re-detected`);
  } catch (error) {
    console.error('Error deleting exclusion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete exclusion',
    });
  }
});

export default router;
