const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass'
});

(async () => {
  const client = await pool.connect();
  try {
    // Get all data sources
    const dataSources = await client.query(`
      SELECT id, name, database_name
      FROM data_sources
      ORDER BY name
    `);

    console.log('Checking quality issues for all data sources:\n');

    for (const ds of dataSources.rows) {
      console.log('\n' + '='.repeat(60));
      console.log(`${ds.name.toUpperCase()}`);
      console.log('='.repeat(60));

      // Get total assets for this data source
      const totalAssets = await client.query(`
        SELECT COUNT(DISTINCT id) as count
        FROM catalog_assets
        WHERE datasource_id = $1
          AND schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')
          AND NOT is_system_database(database_name)
      `, [ds.id]);

      // Get issues for this data source
      const issues = await client.query(`
        SELECT
          business_impact->>'asset_id' as asset_id,
          severity
        FROM quality_issues qi
        WHERE EXISTS (
          SELECT 1 FROM catalog_assets ca
          WHERE ca.id::text = qi.business_impact->>'asset_id'
            AND ca.datasource_id = $1
        )
      `, [ds.id]);

      // Apply severity prioritization
      const assetSeverityMap = new Map();
      const severityPriority = { critical: 4, high: 3, medium: 2, low: 1 };

      issues.rows.forEach(row => {
        if (!row.asset_id) return;
        const assetId = row.asset_id;
        const severity = row.severity;

        const currentSeverity = assetSeverityMap.get(assetId);
        if (!currentSeverity || severityPriority[severity] > severityPriority[currentSeverity]) {
          assetSeverityMap.set(assetId, severity);
        }
      });

      let criticalAssets = 0;
      let highAssets = 0;
      let mediumAssets = 0;
      let lowAssets = 0;

      assetSeverityMap.forEach((severity) => {
        if (severity === 'critical') criticalAssets++;
        else if (severity === 'high') highAssets++;
        else if (severity === 'medium') mediumAssets++;
        else if (severity === 'low') lowAssets++;
      });

      const total = parseInt(totalAssets.rows[0].count);
      const assetsWithIssues = assetSeverityMap.size;
      const warningAssets = highAssets + mediumAssets;
      const safeAssets = total - assetsWithIssues;

      console.log(`\nTotal Assets: ${total}`);
      console.log(`\nSeverity Breakdown:`);
      console.log(`  Critical: ${criticalAssets}`);
      console.log(`  High:     ${highAssets}`);
      console.log(`  Medium:   ${mediumAssets}`);
      console.log(`  Low:      ${lowAssets}`);
      console.log(`\nUI Display:`);
      console.log(`  At Risk (Critical):      ${criticalAssets} (${total > 0 ? Math.round(criticalAssets/total*100) : 0}%)`);
      console.log(`  Watch List (High+Med):   ${warningAssets} (${total > 0 ? Math.round(warningAssets/total*100) : 0}%)`);
      console.log(`  Safe Assets:             ${safeAssets} (${total > 0 ? Math.round(safeAssets/total*100) : 0}%)`);
    }

  } finally {
    client.release();
    await pool.end();
  }
})();
