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
    // Get the Postgres data source
    const dsResult = await client.query(`
      SELECT id, name FROM data_sources WHERE name = 'Postgres'
    `);
    const dsId = dsResult.rows[0].id;

    console.log('POSTGRES SERVER - OVERALL (All Databases)');
    console.log('='.repeat(60));

    const totalAll = await client.query(`
      SELECT COUNT(DISTINCT id) as count
      FROM catalog_assets
      WHERE datasource_id = $1
        AND schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')
        AND NOT is_system_database(database_name)
    `, [dsId]);

    console.log('Total assets (all databases):', totalAll.rows[0].count);

    console.log('\n\nPOSTGRES SERVER - ADVENTUREWORKS DATABASE ONLY');
    console.log('='.repeat(60));

    const totalAdv = await client.query(`
      SELECT COUNT(DISTINCT id) as count
      FROM catalog_assets
      WHERE datasource_id = $1
        AND database_name = 'adventureworks'
        AND schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')
        AND NOT is_system_database(database_name)
    `, [dsId]);

    console.log('Total assets (adventureworks only):', totalAdv.rows[0].count);

    const issues = await client.query(`
      SELECT
        business_impact->>'asset_id' as asset_id,
        severity
      FROM quality_issues qi
      WHERE EXISTS (
        SELECT 1 FROM catalog_assets ca
        WHERE ca.id::text = qi.business_impact->>'asset_id'
          AND ca.datasource_id = $1
          AND ca.database_name = 'adventureworks'
      )
    `, [dsId]);

    console.log('Total issues found:', issues.rows.length);

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

    assetSeverityMap.forEach((severity) => {
      if (severity === 'critical') criticalAssets++;
      else if (severity === 'high') highAssets++;
      else if (severity === 'medium') mediumAssets++;
    });

    const total = parseInt(totalAdv.rows[0].count);
    const warningAssets = highAssets + mediumAssets;
    const safeAssets = total - assetSeverityMap.size;

    console.log('\nUnique assets with issues:', assetSeverityMap.size);
    console.log('  Critical:', criticalAssets);
    console.log('  High:', highAssets);
    console.log('  Medium:', mediumAssets);
    console.log('\nExpected UI Display:');
    console.log('  At Risk (Critical):     ', criticalAssets, '(' + Math.round(criticalAssets/total*100) + '%)');
    console.log('  Watch List (High+Med):  ', warningAssets, '(' + Math.round(warningAssets/total*100) + '%)');
    console.log('  Safe Assets:            ', safeAssets, '(' + Math.round(safeAssets/total*100) + '%)');
    console.log('  Total:                  ', total);

  } finally {
    client.release();
    await pool.end();
  }
})();
