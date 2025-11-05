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
    console.log('VERIFYING DATA SOURCE - REAL vs MOCK/TEST DATA');
    console.log('='.repeat(70));

    // Check where quality_issues came from
    const issuesCheck = await client.query(`
      SELECT
        COUNT(*) as total_issues,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created,
        COUNT(*) FILTER (WHERE business_impact IS NOT NULL) as has_business_impact
      FROM quality_issues
    `);

    console.log('\n1. Quality Issues Overview:');
    console.log('   Total Issues:', issuesCheck.rows[0].total_issues);
    console.log('   First Created:', issuesCheck.rows[0].first_created);
    console.log('   Last Created:', issuesCheck.rows[0].last_created);
    console.log('   With Business Impact:', issuesCheck.rows[0].has_business_impact);

    // Check the actual data in AdventureWorks tables
    console.log('\n2. Checking ACTUAL AdventureWorks Data:');

    try {
      const actualCustomers = await client.query(`
        SELECT COUNT(*) as count FROM adventureworks.public.customers
      `);
      console.log('   Actual Customers in DB:', actualCustomers.rows[0].count);
    } catch (e) {
      console.log('   Customers table: Not accessible or does not exist');
    }

    try {
      const actualOrders = await client.query(`
        SELECT COUNT(*) as count FROM adventureworks.public.orders
      `);
      console.log('   Actual Orders in DB:', actualOrders.rows[0].count);
    } catch (e) {
      console.log('   Orders table: Not accessible or does not exist');
    }

    // Now check what the business_impact says
    const impactSum = await client.query(`
      SELECT
        SUM((business_impact->>'user_impact')::numeric) as total_user_impact,
        SUM((business_impact->>'revenue_impact')::numeric) as total_revenue_impact,
        AVG((business_impact->>'user_impact')::numeric) as avg_user_impact,
        AVG((business_impact->>'revenue_impact')::numeric) as avg_revenue_impact,
        COUNT(*) as issue_count
      FROM quality_issues
      WHERE business_impact IS NOT NULL
    `);

    console.log('\n3. Business Impact Aggregation (from quality_issues):');
    console.log('   Issues with Business Impact:', impactSum.rows[0].issue_count);
    console.log('   Total User Impact:', parseInt(impactSum.rows[0].total_user_impact || 0).toLocaleString());
    console.log('   Total Revenue Impact: $' + ((parseInt(impactSum.rows[0].total_revenue_impact || 0)) / 1000).toFixed(0) + 'K');
    console.log('   Avg User Impact per Issue:', Math.round(impactSum.rows[0].avg_user_impact || 0));
    console.log('   Avg Revenue Impact per Issue: $' + Math.round(impactSum.rows[0].avg_revenue_impact || 0).toLocaleString());

    // Sample a few issues to see the pattern
    const samples = await client.query(`
      SELECT
        title,
        affected_rows,
        business_impact->>'user_impact' as user_impact,
        business_impact->>'revenue_impact' as revenue_impact,
        created_at
      FROM quality_issues
      WHERE business_impact IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n4. Sample Issues (most recent):');
    samples.rows.forEach((row, i) => {
      console.log(`\n   Issue ${i + 1}:`);
      console.log('   Title:', row.title);
      console.log('   Affected Rows:', row.affected_rows);
      console.log('   User Impact:', row.user_impact);
      console.log('   Revenue Impact: $' + parseInt(row.revenue_impact || 0).toLocaleString());
      console.log('   Created:', row.created_at);
    });

    console.log('\n' + '='.repeat(70));
    console.log('VERDICT:');
    console.log('='.repeat(70));
    console.log('\n⚠️  THESE ARE TEST/GENERATED QUALITY ISSUES');
    console.log('   Source: add_quality_issues_and_results.js script');
    console.log('   Purpose: Demonstrate data quality platform capabilities');
    console.log('\n📊 THE NUMBERS ARE:');
    console.log('   - REAL in the sense they exist in the database');
    console.log('   - CALCULATED from actual quality_issues records');
    console.log('   - SIMULATED business impact values (not from production)');
    console.log('\n✅ IN PRODUCTION THIS WOULD BE:');
    console.log('   - Quality rules run on actual data');
    console.log('   - Business impact calculated from real affected rows');
    console.log('   - User impact = actual users affected by data issues');
    console.log('   - Revenue impact = real business calculations');
    console.log('\n💡 RECOMMENDATION:');
    console.log('   Add a banner/badge: "Demo Data" or "Test Environment"');
    console.log('   This makes it clear these are example metrics');
    console.log('\n' + '='.repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
})();
