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
    console.log('Checking Quality Results Data...\n');

    const result = await pool.query(`
      SELECT
        qr.name as rule_name,
        qr.asset_id,
        ca.table_name,
        ca.database_name,
        qres.rows_failed,
        qr.severity
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qres.status = 'failed'
      LIMIT 20
    `);

    console.log('Sample Failed Quality Results:');
    console.log('===============================');
    result.rows.forEach((row, i) => {
      console.log(`\nResult ${i + 1}:`);
      console.log('  Rule:', row.rule_name);
      console.log('  Asset ID:', row.asset_id);
      console.log('  Table:', row.table_name || 'NULL');
      console.log('  Database:', row.database_name || 'NULL');
      console.log('  Rows Failed:', row.rows_failed);
      console.log('  Severity:', row.severity);
    });

    // Count unique assets
    const countResult = await pool.query(`
      SELECT
        COUNT(DISTINCT qr.asset_id) as unique_assets,
        COUNT(DISTINCT ca.table_name) as unique_tables,
        COUNT(*) as total_failed_scans
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qres.status = 'failed'
    `);

    console.log('\n\nSummary:');
    console.log('========');
    console.log('Total Failed Scans:', countResult.rows[0].total_failed_scans);
    console.log('Unique Assets (by asset_id):', countResult.rows[0].unique_assets);
    console.log('Unique Tables (by table_name):', countResult.rows[0].unique_tables);

    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
