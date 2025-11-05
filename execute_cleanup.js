const { Pool } = require('pg');
const fs = require('fs');

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
    console.log('CLEANING ALL TEST/DEMO QUALITY DATA');
    console.log('============================================================================\n');

    // Read the SQL file
    const sql = fs.readFileSync('clean_all_test_quality_data.sql', 'utf8');

    // Execute the cleanup
    const result = await pool.query(sql);

    console.log('\n✅ Cleanup Complete!\n');

    // Check what's left
    const checkResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM quality_rules) as rules_remaining,
        (SELECT COUNT(*) FROM quality_results) as results_remaining,
        (SELECT COUNT(*) FROM quality_issues) as issues_remaining
    `);

    console.log('Remaining Data:');
    console.log('  Quality Rules:', checkResult.rows[0].rules_remaining);
    console.log('  Quality Results:', checkResult.rows[0].results_remaining);
    console.log('  Quality Issues:', checkResult.rows[0].issues_remaining);

    // Check real assets available
    const assetsResult = await pool.query(`
      SELECT
        COUNT(*) as total_assets,
        COUNT(DISTINCT database_name) as databases,
        COUNT(DISTINCT table_name) as tables
      FROM catalog_assets
    `);

    console.log('\nReal Assets Available:');
    console.log('  Total Assets:', assetsResult.rows[0].total_assets);
    console.log('  Databases:', assetsResult.rows[0].databases);
    console.log('  Unique Tables:', assetsResult.rows[0].tables);

    // Show breakdown by database
    const dbResult = await pool.query(`
      SELECT
        database_name,
        COUNT(*) as table_count
      FROM catalog_assets
      GROUP BY database_name
      ORDER BY database_name
    `);

    console.log('\nAssets by Database:');
    dbResult.rows.forEach(row => {
      console.log(`  ${row.database_name}: ${row.table_count} tables`);
    });

    await pool.end();
    console.log('\n✅ All test data removed. Ready to create REAL quality rules!\n');
  } catch (e) {
    console.error('❌ Error:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
