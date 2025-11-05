const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Check total quality issues
    const { rows: totalRows } = await pool.query(`
      SELECT COUNT(*) as count, status
      FROM quality_issues
      GROUP BY status
    `);

    console.log('Quality Issues by Status:');
    totalRows.forEach(r => {
      console.log(`  ${r.status}: ${r.count}`);
    });
    console.log('');

    // Check PII issues specifically
    const { rows: piiRows } = await pool.query(`
      SELECT COUNT(*) as count
      FROM quality_issues
      WHERE title LIKE 'PII Detected%'
    `);

    console.log(`Total PII issues: ${piiRows[0].count}`);
    console.log('');

    // Check recent issues
    const { rows: recentRows } = await pool.query(`
      SELECT
        id,
        title,
        status,
        severity,
        created_at
      FROM quality_issues
      WHERE title LIKE 'PII Detected%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('Recent PII issues:');
    recentRows.forEach(r => {
      console.log(`  [${r.status}] ${r.title} (${r.severity}) - Created: ${r.created_at}`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
