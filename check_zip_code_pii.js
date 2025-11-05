const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Get zip_code rule configuration
    const { rows } = await pool.query(`
      SELECT
        id,
        pii_type,
        display_name,
        is_enabled,
        column_name_hints,
        regex_pattern,
        sensitivity_level,
        description
      FROM pii_rule_definitions
      WHERE pii_type = 'zip_code'
    `);

    if (rows.length === 0) {
      console.log('❌ No zip_code rule found');
    } else {
      console.log('ZIP CODE RULE CONFIGURATION:');
      console.log('');
      const rule = rows[0];
      console.log(`  ID: ${rule.id}`);
      console.log(`  Display Name: ${rule.display_name}`);
      console.log(`  Enabled: ${rule.is_enabled ? 'YES' : 'NO'}`);
      console.log(`  Sensitivity: ${rule.sensitivity_level}`);
      console.log(`  Column Hints: ${rule.column_name_hints ? JSON.stringify(rule.column_name_hints) : 'NONE'}`);
      console.log(`  Regex Pattern: ${rule.regex_pattern || 'NONE'}`);
      console.log(`  Description: ${rule.description || 'NONE'}`);
    }

    // Check if there are any columns with zip-related names
    const { rows: columns } = await pool.query(`
      SELECT
        data_source_id,
        schema_name,
        table_name,
        column_name,
        data_type,
        pii_type
      FROM catalog_columns
      WHERE column_name ILIKE '%zip%' OR column_name ILIKE '%postal%'
      LIMIT 20
    `);

    console.log('');
    console.log('COLUMNS WITH ZIP/POSTAL IN NAME:');
    if (columns.length === 0) {
      console.log('  No columns found');
    } else {
      console.log(`  Found ${columns.length} columns:`);
      columns.forEach(c => {
        console.log(`    ${c.schema_name}.${c.table_name}.${c.column_name} (${c.data_type}) - PII: ${c.pii_type || 'NONE'}`);
      });
    }

    // Check all PII rules and their enabled status
    const { rows: allRules } = await pool.query(`
      SELECT
        pii_type,
        display_name,
        is_enabled,
        column_name_hints
      FROM pii_rule_definitions
      ORDER BY
        CASE
          WHEN is_enabled THEN 0
          ELSE 1
        END,
        pii_type
    `);

    console.log('');
    console.log('ALL PII RULES STATUS:');
    allRules.forEach(r => {
      const status = r.is_enabled ? '✓' : '✗';
      const hints = r.column_name_hints ? r.column_name_hints.length : 0;
      console.log(`  [${status}] ${r.pii_type} - ${hints} hints`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
