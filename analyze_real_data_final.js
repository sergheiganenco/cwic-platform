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
    console.log('REAL DATA INVENTORY');
    console.log('='.repeat(70));

    // 1. Quality Rules
    const rules = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE enabled) as active,
        COUNT(DISTINCT dimension) as dimensions_count
      FROM quality_rules
    `);
    console.log('\n1. QUALITY RULES:');
    console.log('   Total:', rules.rows[0].total);
    console.log('   Active:', rules.rows[0].active);

    // 2. Quality Results (actual scan executions)
    const results = await client.query(`
      SELECT
        COUNT(*) as total_results,
        COUNT(*) FILTER (WHERE status = 'passed') as passed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        MIN(executed_at) as oldest,
        MAX(executed_at) as newest
      FROM quality_results
    `);
    console.log('\n2. QUALITY RESULTS (Scan Executions):');
    console.log('   Total Results:', results.rows[0].total_results);
    console.log('   Passed:', results.rows[0].passed);
    console.log('   Failed:', results.rows[0].failed);
    console.log('   Pass Rate:', results.rows[0].total_results > 0 ? Math.round((results.rows[0].passed / results.rows[0].total_results) * 100) + '%' : '0%');
    console.log('   Oldest:', results.rows[0].oldest);
    console.log('   Newest:', results.rows[0].newest);

    // 3. Catalog Assets
    const assets = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT datasource_id) as sources,
        COUNT(DISTINCT database_name) as databases
      FROM catalog_assets
      WHERE NOT is_system_database(database_name)
        AND schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')
    `);
    console.log('\n3. CATALOG ASSETS:');
    console.log('   Total Assets:', assets.rows[0].total);
    console.log('   Data Sources:', assets.rows[0].sources);
    console.log('   Databases:', assets.rows[0].databases);

    // 4. Calculate REAL dimension scores
    const dimScores = await client.query(`
      SELECT
        qr.dimension,
        COUNT(*) as scans,
        COUNT(*) FILTER (WHERE qres.status = 'passed') as passed,
        ROUND(AVG(CASE WHEN qres.status = 'passed' THEN 100 ELSE 0 END), 2) as score
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      WHERE qres.executed_at > NOW() - INTERVAL '7 days'
      GROUP BY qr.dimension
      ORDER BY score DESC
    `);
    console.log('\n4. REAL DIMENSION SCORES (Last 7 Days):');
    dimScores.rows.forEach(d => {
      console.log(`   ${d.dimension}: ${d.score}% (${d.passed}/${d.scans})`);
    });

    // 5. Overall quality score
    const overall = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'passed') as passed,
        ROUND(COUNT(*) FILTER (WHERE status = 'passed')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as overall_score
      FROM quality_results
      WHERE executed_at > NOW() - INTERVAL '7 days'
    `);
    console.log('\n5. OVERALL QUALITY SCORE (Last 7 Days):');
    console.log(`   ${overall.rows[0].overall_score}% (${overall.rows[0].passed}/${overall.rows[0].total} passed)`);

    // 6. Assets with vs without issues
    const assetIssues = await client.query(`
      SELECT
        COUNT(DISTINCT ca.id) as total_assets,
        COUNT(DISTINCT CASE WHEN qi.id IS NOT NULL THEN ca.id END) as assets_with_issues
      FROM catalog_assets ca
      LEFT JOIN quality_issues qi ON qi.asset_id = ca.id AND qi.status IN ('open', 'acknowledged')
      WHERE NOT is_system_database(ca.database_name)
        AND ca.schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')
    `);
    console.log('\n6. ASSET HEALTH:');
    console.log('   Total Assets:', assetIssues.rows[0].total_assets);
    console.log('   With Issues:', assetIssues.rows[0].assets_with_issues);
    console.log('   Safe:', parseInt(assetIssues.rows[0].total_assets) - parseInt(assetIssues.rows[0].assets_with_issues));

    console.log('\n' + '='.repeat(70));
    console.log('✅ WE CAN USE REAL DATA FOR:');
    console.log('='.repeat(70));
    console.log('1. Overall Score: quality_results pass rate');
    console.log('2. Dimension Scores: GROUP BY dimension from quality_results');
    console.log('3. Total Assets: COUNT from catalog_assets');
    console.log('4. Safe/Warning/Critical: Based on quality_issues severity');
    console.log('5. Trends: Historical quality_results data');
    console.log('\n⚠️  BUSINESS IMPACT LIMITATION:');
    console.log('   - quality_issues has test data (business_impact field)');
    console.log('   - Need to either:');
    console.log('     a) Clear test issues and generate from real scans');
    console.log('     b) Calculate business impact without quality_issues table');
    console.log('     c) Set business impact to $0 until real issues exist');
    console.log('='.repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
})();
