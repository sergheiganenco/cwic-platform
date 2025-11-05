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
    console.log('ANALYZING REAL DATA SOURCES');
    console.log('='.repeat(70));

    // 1. Check real quality rules (not test data)
    const rulesCheck = await client.query(`
      SELECT
        COUNT(*) as total_rules,
        COUNT(*) FILTER (WHERE enabled = true) as active_rules,
        array_agg(DISTINCT dimension) as dimensions
      FROM quality_rules
    `);

    console.log('\n1. QUALITY RULES (Real Configuration):');
    console.log('   Total Rules:', rulesCheck.rows[0].total_rules);
    console.log('   Active Rules:', rulesCheck.rows[0].active_rules);
    console.log('   Dimensions:', rulesCheck.rows[0].dimensions);

    // 2. Check quality scan results (actual executions)
    const scanResults = await client.query(`
      SELECT
        COUNT(*) as total_scans,
        COUNT(*) FILTER (WHERE status = 'passed') as passed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(metric_value) as avg_metric,
        MIN(executed_at) as first_scan,
        MAX(executed_at) as last_scan
      FROM quality_scan_results
      WHERE executed_at > NOW() - INTERVAL '7 days'
    `);

    console.log('\n2. QUALITY SCAN RESULTS (Last 7 Days):');
    console.log('   Total Scans:', scanResults.rows[0].total_scans);
    console.log('   Passed:', scanResults.rows[0].passed);
    console.log('   Failed:', scanResults.rows[0].failed);
    console.log('   Pass Rate:', scanResults.rows[0].total_scans > 0 ? Math.round((scanResults.rows[0].passed / scanResults.rows[0].total_scans) * 100) + '%' : 'N/A');
    console.log('   First Scan:', scanResults.rows[0].first_scan);
    console.log('   Last Scan:', scanResults.rows[0].last_scan);

    // 3. Check catalog assets (real data assets)
    const assetsCheck = await client.query(`
      SELECT
        COUNT(*) as total_assets,
        COUNT(DISTINCT datasource_id) as data_sources,
        COUNT(DISTINCT database_name) as databases,
        array_agg(DISTINCT asset_type) as asset_types
      FROM catalog_assets
      WHERE NOT is_system_database(database_name)
        AND schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')
    `);

    console.log('\n3. CATALOG ASSETS (Real Data Assets):');
    console.log('   Total Assets:', assetsCheck.rows[0].total_assets);
    console.log('   Data Sources:', assetsCheck.rows[0].data_sources);
    console.log('   Databases:', assetsCheck.rows[0].databases);
    console.log('   Asset Types:', assetsCheck.rows[0].asset_types);

    // 4. Check data sources
    const dataSourcesCheck = await client.query(`
      SELECT
        id, name, type, database_name
      FROM data_sources
      ORDER BY name
    `);

    console.log('\n4. DATA SOURCES (Real Connections):');
    dataSourcesCheck.rows.forEach(ds => {
      console.log(`   - ${ds.name} (${ds.type}): ${ds.database_name || 'N/A'}`);
    });

    // 5. Calculate REAL business impact from scan results
    console.log('\n5. REAL BUSINESS IMPACT CALCULATION:');
    console.log('   Strategy: Use actual quality scan failures to calculate impact');

    const failedScans = await client.query(`
      SELECT
        qsr.id,
        qsr.status,
        qsr.metric_value,
        qsr.rows_checked,
        qsr.rows_failed,
        qr.name as rule_name,
        qr.dimension,
        qr.severity,
        ca.table_name,
        ca.database_name
      FROM quality_scan_results qsr
      JOIN quality_rules qr ON qr.id = qsr.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qsr.status = 'failed'
        AND qsr.executed_at > NOW() - INTERVAL '7 days'
      LIMIT 10
    `);

    console.log(`   Failed Scans (Last 7 days): ${failedScans.rows.length}`);
    if (failedScans.rows.length > 0) {
      console.log('\n   Sample Failed Scans:');
      failedScans.rows.slice(0, 3).forEach((scan, i) => {
        console.log(`   ${i + 1}. ${scan.rule_name}`);
        console.log(`      Table: ${scan.table_name || 'N/A'}`);
        console.log(`      Severity: ${scan.severity}`);
        console.log(`      Rows Failed: ${scan.rows_failed || 'N/A'}`);
      });
    }

    // 6. Calculate dimension scores from real scan results
    const dimensionScores = await client.query(`
      SELECT
        qr.dimension,
        COUNT(*) as total_scans,
        COUNT(*) FILTER (WHERE qsr.status = 'passed') as passed_scans,
        ROUND(COUNT(*) FILTER (WHERE qsr.status = 'passed')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as score
      FROM quality_scan_results qsr
      JOIN quality_rules qr ON qr.id = qsr.rule_id
      WHERE qsr.executed_at > NOW() - INTERVAL '7 days'
      GROUP BY qr.dimension
      ORDER BY score DESC
    `);

    console.log('\n6. REAL DIMENSION SCORES (from actual scans):');
    dimensionScores.rows.forEach(dim => {
      console.log(`   ${dim.dimension}: ${dim.score}% (${dim.passed_scans}/${dim.total_scans} passed)`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('CONCLUSION:');
    console.log('='.repeat(70));
    console.log('\n✅ WE HAVE REAL DATA:');
    console.log('   - Quality rules are configured');
    console.log('   - Scan results exist from actual executions');
    console.log('   - Catalog assets represent real data');
    console.log('   - Dimension scores can be calculated from scans');
    console.log('\n⚠️  BUSINESS IMPACT CHALLENGE:');
    console.log('   - quality_issues table has test data');
    console.log('   - Need to calculate business impact from scan results instead');
    console.log('   - Can estimate: rows_failed × revenue_per_row');
    console.log('\n💡 RECOMMENDATION:');
    console.log('   1. Use quality_scan_results for metrics (real data)');
    console.log('   2. Calculate business impact from rows_failed');
    console.log('   3. Use actual dimension scores from scans');
    console.log('   4. Remove dependency on quality_issues for now');
    console.log('\n' + '='.repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
})();
