const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass'
});

(async () => {
  try {
    console.log('============================================================================');
    console.log('CREATING REAL QUALITY RULES LINKED TO CATALOG ASSETS');
    console.log('============================================================================\n');

    // Get real assets from non-system databases
    const assetsResult = await pool.query(`
      SELECT
        id as asset_id,
        table_name,
        database_name,
        schema_name
      FROM catalog_assets
      WHERE database_name NOT IN ('master', 'tempdb', 'model', 'msdb')  -- Skip system databases
        AND table_name IS NOT NULL
      ORDER BY database_name, table_name
    `);

    console.log(`Found ${assetsResult.rows.length} real assets to create rules for\n`);

    let rulesCreated = 0;

    // For each asset, create basic quality rules
    for (const asset of assetsResult.rows) {
      console.log(`Creating rules for ${asset.database_name}.${asset.table_name}...`);

      // Rule 1: Table has data (row count > 0)
      await pool.query(`
        INSERT INTO quality_rules (
          name,
          description,
          asset_id,
          dimension,
          severity,
          type,
          dialect,
          expression,
          tags,
          enabled,
          max_execution_time_ms,
          execution_count,
          run_count
        ) VALUES (
          $1,
          $2,
          $3,
          'completeness',
          'high',
          'sql',
          'postgres',
          'SELECT COUNT(*) as row_count FROM ' || $4,
          ARRAY['completeness', 'basic']::varchar[],
          true,
          30000,
          0,
          0
        )
      `, [
        `${asset.table_name} - Has Data`,
        `Table ${asset.database_name}.${asset.table_name} should contain at least one row`,
        asset.asset_id,
        `${asset.schema_name || 'public'}.${asset.table_name}`
      ]);
      rulesCreated++;

      console.log(`  ✅ Created "Has Data" rule`);
    }

    console.log(`\n✅ Created ${rulesCreated} quality rules for ${assetsResult.rows.length} real assets`);

    // Verify
    const verifyResult = await pool.query(`
      SELECT
        qr.id,
        qr.name,
        qr.asset_id,
        ca.table_name,
        ca.database_name,
        qr.dimension,
        qr.severity
      FROM quality_rules qr
      JOIN catalog_assets ca ON ca.id = qr.asset_id
      LIMIT 10
    `);

    console.log('\n📋 Sample of Created Rules:');
    verifyResult.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. ${row.name}`);
      console.log(`   Table: ${row.database_name}.${row.table_name}`);
      console.log(`   Asset ID: ${row.asset_id}`);
      console.log(`   Dimension: ${row.dimension}`);
      console.log(`   Severity: ${row.severity}`);
    });

    // Count rules by database
    const countResult = await pool.query(`
      SELECT
        ca.database_name,
        COUNT(*) as rule_count
      FROM quality_rules qr
      JOIN catalog_assets ca ON ca.id = qr.asset_id
      GROUP BY ca.database_name
      ORDER BY ca.database_name
    `);

    console.log('\n📊 Rules by Database:');
    countResult.rows.forEach(row => {
      console.log(`  ${row.database_name}: ${row.rule_count} rules`);
    });

    await pool.end();
    console.log('\n✅ All quality rules created and linked to REAL catalog assets!\n');
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    await pool.end();
    process.exit(1);
  }
})();
