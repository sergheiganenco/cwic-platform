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
    // Check if there's a cwic_platform data source
    const result = await pool.query(`
      SELECT id, name, database_name, type, deleted_at
      FROM data_sources
      WHERE database_name = 'cwic_platform'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('cwic_platform Data Sources (including deleted):');
    console.log('===============================================');
    if (result.rows.length === 0) {
      console.log('❌ No data source found for cwic_platform database\n');
      console.log('This is why filtering shows 0 when selecting both databases!');
      console.log('');
      console.log('Solution: Create a data source for cwic_platform');
    } else {
      result.rows.forEach(row => {
        console.log(`Name: ${row.name}`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Database: ${row.database_name}`);
        console.log(`  Type: ${row.type}`);
        console.log(`  Deleted: ${row.deleted_at || 'No'}`);
        console.log('');
      });
    }

    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
