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
    const result = await pool.query(`
      SELECT
        qres.data_source_id,
        ca.database_name,
        COUNT(*) as count
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      GROUP BY qres.data_source_id, ca.database_name
      ORDER BY ca.database_name
    `);

    console.log('Quality Results by Database and Data Source ID:');
    console.log('================================================');
    result.rows.forEach(row => {
      console.log(`Database: ${row.database_name || 'NULL'}`);
      console.log(`  Data Source ID: ${row.data_source_id || 'NULL'}`);
      console.log(`  Count: ${row.count}`);
      console.log('');
    });

    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
