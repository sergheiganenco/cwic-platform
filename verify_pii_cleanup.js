const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Get columns that previously had NAME classification
    const { rows } = await pool.query(`
      SELECT
        table_name,
        column_name,
        pii_type,
        data_classification,
        is_sensitive
      FROM catalog_columns
      WHERE
        column_name IN ('schema_name', 'table_name', 'description', 'FirstName', 'LastName', 'MiddleName')
      ORDER BY table_name, column_name
    `);

    console.log('Columns that were previously marked as NAME PII:');
    console.log('');
    rows.forEach(r => {
      const pii = r.pii_type || r.data_classification || 'NONE';
      const sensitive = r.is_sensitive ? 'YES' : 'NO';
      console.log(`  ${r.table_name}.${r.column_name}`);
      console.log(`    PII Type: ${pii}`);
      console.log(`    Sensitive: ${sensitive}`);
      console.log('');
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
