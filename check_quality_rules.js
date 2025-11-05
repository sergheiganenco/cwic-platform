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
    console.log('Checking Quality Rules...\n');

    const rulesResult = await pool.query(`
      SELECT
        qr.id,
        qr.name,
        qr.asset_id,
        qr.dimension,
        qr.severity,
        ca.table_name,
        ca.database_name
      FROM quality_rules qr
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      LIMIT 20
    `);

    console.log('Sample Quality Rules:');
    console.log('====================');
    rulesResult.rows.forEach((row, i) => {
      console.log(`\nRule ${i + 1}:`);
      console.log('  ID:', row.id);
      console.log('  Name:', row.name);
      console.log('  Asset ID:', row.asset_id || 'NULL');
      console.log('  Table:', row.table_name || 'NULL');
      console.log('  Database:', row.database_name || 'NULL');
      console.log('  Dimension:', row.dimension);
      console.log('  Severity:', row.severity);
    });

    // Count rules with and without assets
    const countResult = await pool.query(`
      SELECT
        COUNT(*) as total_rules,
        COUNT(qr.asset_id) as rules_with_assets,
        COUNT(CASE WHEN qr.asset_id IS NULL THEN 1 END) as rules_without_assets
      FROM quality_rules qr
    `);

    console.log('\n\nSummary:');
    console.log('========');
    console.log('Total Rules:', countResult.rows[0].total_rules);
    console.log('Rules WITH asset_id:', countResult.rows[0].rules_with_assets);
    console.log('Rules WITHOUT asset_id:', countResult.rows[0].rules_without_assets);

    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
