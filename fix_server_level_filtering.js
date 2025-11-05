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
    console.log('Fixing server-level data source approach...\n');

    // Step 1: Delete the redundant CWIC Platform data source we just created
    console.log('1. Removing redundant CWIC Platform data source...');
    await pool.query(`
      DELETE FROM data_sources
      WHERE name = 'CWIC Platform'
        AND database_name = 'cwic_platform'
    `);
    console.log('   ✅ Removed redundant data source\n');

    // Step 2: Update the Postgres data source to be server-level (no specific database)
    console.log('2. Updating Postgres data source to server-level...');
    const updateResult = await pool.query(`
      UPDATE data_sources
      SET database_name = NULL,
          description = 'PostgreSQL server with multiple databases (adventureworks, cwic_platform)'
      WHERE id = '793e4fe5-db62-4aa4-8b48-c220960d85ba'
      RETURNING *
    `);

    if (updateResult.rows.length > 0) {
      console.log('   ✅ Updated Postgres to server-level connection');
      console.log(`   Name: ${updateResult.rows[0].name}`);
      console.log(`   Database: ${updateResult.rows[0].database_name || 'NULL (server-level)'}`);
      console.log('');
    }

    // Step 3: Update ALL quality_results for cwic_platform to use the Postgres data_source_id
    console.log('3. Updating quality_results to use server-level data_source_id...');
    const updateQR = await pool.query(`
      UPDATE quality_results qres
      SET data_source_id = '793e4fe5-db62-4aa4-8b48-c220960d85ba'
      FROM quality_rules qr
      JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qres.rule_id = qr.id
        AND ca.database_name IN ('adventureworks', 'cwic_platform')
        AND qres.data_source_id IS DISTINCT FROM '793e4fe5-db62-4aa4-8b48-c220960d85ba'
    `);
    console.log(`   ✅ Updated ${updateQR.rowCount} quality_results to use Postgres data_source_id\n`);

    // Step 4: Verify the fix
    console.log('4. Verifying results...');
    const verify = await pool.query(`
      SELECT
        ca.database_name,
        qres.data_source_id,
        COUNT(*) as count
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      GROUP BY ca.database_name, qres.data_source_id
      ORDER BY ca.database_name
    `);

    console.log('   Quality Results by Database:');
    verify.rows.forEach(row => {
      const dsName = row.data_source_id === '793e4fe5-db62-4aa4-8b48-c220960d85ba' ? 'Postgres (server-level)' :
                     row.data_source_id ? 'Other' : 'NULL';
      console.log(`     ${row.database_name}: ${dsName} - ${row.count} scans`);
    });

    console.log('\n✅ Fix complete!');
    console.log('\nNow the Postgres data source represents the SERVER, not a specific database.');
    console.log('Filtering will work as follows:');
    console.log('  - Select "Postgres" + "adventureworks" → shows adventureworks data only');
    console.log('  - Select "Postgres" + "cwic_platform" → shows cwic_platform data only');
    console.log('  - Select "Postgres" + both databases → shows combined data from both');

    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
