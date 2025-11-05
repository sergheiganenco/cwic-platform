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
    console.log('BUSINESS IMPACT DATA SOURCE ANALYSIS');
    console.log('='.repeat(70));

    // Check the structure of business_impact in quality_issues
    const sample = await client.query(`
      SELECT
        id,
        severity,
        title,
        affected_rows,
        business_impact,
        created_at
      FROM quality_issues
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n1. Sample quality_issues with business_impact:\n');
    sample.rows.forEach((row, i) => {
      console.log(`Issue ${i + 1}:`);
      console.log('  ID:', row.id);
      console.log('  Severity:', row.severity);
      console.log('  Title:', row.title);
      console.log('  Affected Rows:', row.affected_rows);
      console.log('  Business Impact:', JSON.stringify(row.business_impact, null, 2));
      console.log('');
    });

    // Check how business_impact is calculated
    console.log('\n2. Business Impact Calculation Logic:\n');
    console.log('   revenue_impact: Calculated based on affected_rows and business criticality');
    console.log('   user_impact: Number of users affected (same as affected_rows for user-facing tables)');
    console.log('   compliance_risk: Boolean indicating regulatory/compliance implications');
    console.log('   asset_name: The table/view name affected');
    console.log('   asset_id: The catalog asset ID');

    // Show aggregated metrics
    const metrics = await client.query(`
      SELECT
        COUNT(*) as total_issues,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE severity = 'high') as high_count,
        SUM((business_impact->>'revenue_impact')::numeric) as total_revenue_impact,
        SUM((business_impact->>'user_impact')::numeric) as total_user_impact,
        COUNT(*) FILTER (WHERE (business_impact->>'compliance_risk')::boolean = true) as compliance_issues
      FROM quality_issues
      WHERE business_impact IS NOT NULL
    `);

    console.log('\n3. Aggregated Business Impact Metrics:\n');
    console.log('   Total Issues:', metrics.rows[0].total_issues);
    console.log('   Critical Issues:', metrics.rows[0].critical_count);
    console.log('   High Severity Issues:', metrics.rows[0].high_count);
    console.log('   Total Revenue at Risk:', '$' + (parseInt(metrics.rows[0].total_revenue_impact) / 1000).toFixed(0) + 'K');
    console.log('   Total Users Impacted:', parseInt(metrics.rows[0].total_user_impact).toLocaleString());
    console.log('   Compliance Issues:', metrics.rows[0].compliance_issues);

    console.log('\n4. How This Data is Generated:\n');
    console.log('   - Business impact is calculated when quality issues are detected');
    console.log('   - Revenue impact = affected_rows × estimated_revenue_per_row');
    console.log('   - User impact = affected_rows (for user-facing tables)');
    console.log('   - This data comes from the add_quality_issues_and_results.js script');
    console.log('   - In production, this would come from quality rule execution results');

    console.log('\n' + '='.repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
})();
