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
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'quality_rules'::regclass
    `);

    console.log('quality_rules constraints:');
    console.log('==========================');
    result.rows.forEach(row => {
      console.log(`\n${row.constraint_name}:`);
      console.log(row.constraint_definition);
    });

    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
