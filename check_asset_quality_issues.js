const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Find the asset with postal_code column showing in the screenshot
    const { rows: assets } = await pool.query(`
      SELECT
        ca.id,
        ca.table_name,
        ca.schema_name,
        ca.database_name,
        ca.datasource_id,
        ds.name as datasource_name
      FROM catalog_assets ca
      LEFT JOIN data_sources ds ON ds.id::text = ca.datasource_id::text
      WHERE ca.table_name ILIKE '%address%'
        AND EXISTS (
          SELECT 1 FROM catalog_columns cc
          WHERE cc.asset_id = ca.id
            AND cc.column_name = 'postal_code'
        )
      ORDER BY ca.table_name
      LIMIT 5
    `);

    console.log(`Found ${assets.length} assets with postal_code column:`);
    console.log('');

    for (const asset of assets) {
      console.log(`Asset: ${asset.schema_name}.${asset.table_name}`);
      console.log(`  ID: ${asset.id}`);
      console.log(`  Database: ${asset.database_name}`);
      console.log(`  Data Source: ${asset.datasource_name} (${asset.datasource_id})`);

      // Check postal_code column
      const { rows: columns } = await pool.query(
        `SELECT column_name, pii_type, is_sensitive
         FROM catalog_columns
         WHERE asset_id = $1 AND column_name = 'postal_code'`,
        [asset.id]
      );

      if (columns.length > 0) {
        const col = columns[0];
        console.log(`  postal_code: PII=${col.pii_type}, Sensitive=${col.is_sensitive}`);
      }

      // Check quality issues for this asset
      const { rows: issues } = await pool.query(
        `SELECT id, title, status, severity
         FROM quality_issues
         WHERE asset_id = $1 AND status IN ('open', 'acknowledged')`,
        [asset.id]
      );

      console.log(`  Quality Issues: ${issues.length}`);
      if (issues.length > 0) {
        issues.forEach(issue => {
          console.log(`    - [${issue.severity}] ${issue.title} (${issue.status})`);
        });
      }

      console.log('');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
