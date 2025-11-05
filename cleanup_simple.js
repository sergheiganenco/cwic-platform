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
    console.log('CLEANING ALL TEST/DEMO QUALITY DATA');
    console.log('============================================================================\n');

    // Delete in order of dependencies
    console.log('1. Deleting quality_results...');
    const results = await pool.query('DELETE FROM quality_results WHERE id IS NOT NULL');
    console.log(`   ✅ Deleted ${results.rowCount} results`);

    console.log('2. Deleting quality_issues...');
    const issues = await pool.query('DELETE FROM quality_issues WHERE id IS NOT NULL');
    console.log(`   ✅ Deleted ${issues.rowCount} issues`);

    console.log('3. Deleting quality_rules...');
    const rules = await pool.query('DELETE FROM quality_rules WHERE id IS NOT NULL');
    console.log(`   ✅ Deleted ${rules.rowCount} rules`);

    // Verify cleanup
    const checkResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM quality_rules) as rules_remaining,
        (SELECT COUNT(*) FROM quality_results) as results_remaining,
        (SELECT COUNT(*) FROM quality_issues) as issues_remaining
    `);

    console.log('\n📊 Remaining Data:');
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

    console.log('\n📦 Real Assets Available:');
    console.log('  Total Assets:', assetsResult.rows[0].total_assets);
    console.log('  Databases:', assetsResult.rows[0].databases);
    console.log('  Unique Tables:', assetsResult.rows[0].tables);

    // Show breakdown by database
    const dbResult = await pool.query(`
      SELECT
        database_name,
        COUNT(*) as table_count
      FROM catalog_assets
      WHERE database_name IS NOT NULL
      GROUP BY database_name
      ORDER BY database_name
    `);

    console.log('\n📁 Assets by Database:');
    dbResult.rows.forEach(row => {
      console.log(`  ${row.database_name}: ${row.table_count} tables`);
    });

    await pool.end();
    console.log('\n✅ All test data removed. Ready to create REAL quality rules!\n');
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    await pool.end();
    process.exit(1);
  }
})();
