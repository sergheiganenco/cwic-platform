const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('Creating quality issues for existing PII columns...');
    console.log('');

    // Step 1: Get all PII columns that don't have quality issues
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

    console.log(`Found ${piiColumns.length} PII columns without quality issues`);
    console.log('');

    if (piiColumns.length === 0) {
      console.log('No work to do!');
      await pool.end();
      return;
    }

    // Step 2: For each PII column, create quality rule and issue
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
        console.log(`  Created quality rule for PII type: ${col.pii_type}`);
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

      console.log(`  ✓ Created quality issue for: ${col.table_name}.${col.column_name} (${col.pii_type})`);
    }

    console.log('');
    console.log(`✅ Successfully created ${piiColumns.length} quality issues for PII columns`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
