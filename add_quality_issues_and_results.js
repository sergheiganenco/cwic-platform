// Add comprehensive quality issues and test data to cwic_platform database
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass'
});

async function addQualityIssuesAndResults() {
  const client = await pool.connect();

  try {
    console.log('Starting quality issues and results generation...\n');

    // Get data source ID and assets
    const dsResult = await client.query(
      "SELECT id FROM data_sources WHERE database_name = 'adventureworks' AND deleted_at IS NULL LIMIT 1"
    );
    const dataSourceId = dsResult.rows[0]?.id;

    if (!dataSourceId) {
      console.error('No adventureworks data source found!');
      return;
    }

    const assetsResult = await client.query(
      `SELECT id, schema_name, table_name, datasource_id FROM catalog_assets
       WHERE database_name = 'adventureworks' AND datasource_id = $1
       ORDER BY table_name LIMIT 20`,
      [dataSourceId]
    );
    const assets = assetsResult.rows;
    console.log(`Found ${assets.length} assets from adventureworks\n`);

    // Get existing rules
    const rulesResult = await client.query(
      `SELECT id, dimension, name, severity FROM quality_rules WHERE enabled = true`
    );
    const rules = rulesResult.rows;
    console.log(`Found ${rules.length} quality rules\n`);

    if (rules.length === 0) {
      console.error('No quality rules found! Please create rules first.');
      return;
    }

    // Group rules by dimension
    const rulesByDimension = {
      completeness: rules.filter(r => r.dimension === 'completeness'),
      accuracy: rules.filter(r => r.dimension === 'accuracy'),
      consistency: rules.filter(r => r.dimension === 'consistency'),
      validity: rules.filter(r => r.dimension === 'validity'),
      uniqueness: rules.filter(r => r.dimension === 'uniqueness'),
      freshness: rules.filter(r => r.dimension === 'freshness')
    };

    let totalIssuesAdded = 0;
    let totalResultsAdded = 0;

    // Generate quality results for each asset with varied pass/fail ratios
    for (const asset of assets) {
      const assetName = `${asset.schema_name}.${asset.table_name}`;
      console.log(`Processing ${assetName}...`);

      // Run "scans" - create quality_results entries
      for (const dimension of Object.keys(rulesByDimension)) {
        const dimensionRules = rulesByDimension[dimension];
        if (dimensionRules.length === 0) continue;

        for (const rule of dimensionRules) {
          // Randomly determine if this rule passes or fails (70% pass, 30% fail)
          const passed = Math.random() > 0.3;
          const status = passed ? 'passed' : 'failed';
          const execTimeMs = Math.floor(Math.random() * 5000) + 100;

          // Insert quality result
          const resultId = require('crypto').randomUUID();
          const rowsChecked = Math.floor(Math.random() * 10000) + 100;
          const rowsFailed = passed ? 0 : Math.floor(Math.random() * 100) + 1;

          await client.query(
            `INSERT INTO quality_results
             (id, rule_id, data_source_id, status, execution_time_ms, rows_checked, rows_failed, run_at, executed_by, metrics)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${Math.floor(Math.random() * 7)} days', 'system', $8)`,
            [
              resultId,
              rule.id,
              dataSourceId,
              status,
              execTimeMs,
              rowsChecked,
              rowsFailed,
              JSON.stringify({
                table: assetName,
                dimension: dimension,
                asset_id: asset.id,
                passed: passed
              })
            ]
          );
          totalResultsAdded++;

          // If failed, create a quality issue
          if (!passed) {
            const severity = rule.severity || ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)];
            const affectedRows = Math.floor(Math.random() * 500) + 10;
            const impactScore = severity === 'critical' ? 90 : severity === 'high' ? 70 : severity === 'medium' ? 50 : 30;

            const issueTemplates = {
              completeness: {
                title: `Missing data in ${assetName}`,
                description: `Found ${affectedRows} rows with NULL values in critical columns`,
                root_cause: 'Data pipeline not validating required fields before insert',
                remediation_plan: 'Add NOT NULL constraints and update ETL validation'
              },
              accuracy: {
                title: `Inaccurate data detected in ${assetName}`,
                description: `${affectedRows} rows contain out-of-range or incorrect values`,
                root_cause: 'Missing data validation in application layer',
                remediation_plan: 'Implement field-level validation and add database constraints'
              },
              consistency: {
                title: `Data inconsistency in ${assetName}`,
                description: `Found ${affectedRows} rows with values inconsistent with related tables`,
                root_cause: 'Lack of referential integrity enforcement',
                remediation_plan: 'Add foreign key constraints and implement cross-table validation'
              },
              validity: {
                title: `Invalid format in ${assetName}`,
                description: `${affectedRows} rows contain invalid email/phone/date formats`,
                root_cause: 'No format validation at data entry point',
                remediation_plan: 'Add regex-based validation and data type constraints'
              },
              uniqueness: {
                title: `Duplicate records found in ${assetName}`,
                description: `Detected ${affectedRows} duplicate records`,
                root_cause: 'Missing unique constraints on key fields',
                remediation_plan: 'Add unique constraints and implement deduplication process'
              },
              freshness: {
                title: `Stale data in ${assetName}`,
                description: `${affectedRows} rows have not been updated in over 90 days`,
                root_cause: 'Infrequent data refresh process',
                remediation_plan: 'Implement automated data refresh schedule'
              }
            };

            const template = issueTemplates[dimension] || issueTemplates.completeness;

            await client.query(
              `INSERT INTO quality_issues
               (result_id, rule_id, data_source_id, severity, dimension, status, title, description,
                impact_score, affected_rows, root_cause, remediation_plan, auto_heal_eligible, auto_heal_confidence,
                downstream_assets, business_impact, first_seen_at, last_seen_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
              [
                resultId,
                rule.id,
                dataSourceId,
                severity,
                dimension,
                'open',
                template.title,
                template.description,
                impactScore,
                affectedRows,
                template.root_cause,
                template.remediation_plan,
                severity === 'low' || severity === 'medium', // Low/medium can be auto-healed
                severity === 'low' ? 0.85 : severity === 'medium' ? 0.65 : 0.25,
                Math.floor(Math.random() * 10), // downstream assets affected
                JSON.stringify({
                  revenue_impact: affectedRows * (severity === 'critical' ? 100 : severity === 'high' ? 50 : 20),
                  user_impact: affectedRows,
                  compliance_risk: severity === 'critical' || severity === 'high',
                  asset_id: asset.id,
                  asset_name: assetName
                }),
                new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random date in last 30 days
                new Date().toISOString()
              ]
            );
            totalIssuesAdded++;
          }
        }
      }
    }

    // Add some additional critical issues for high-impact scenarios
    const criticalIssues = [
      {
        title: 'Critical: PII data exposed in logs',
        description: 'Customer email addresses and phone numbers found in application logs',
        dimension: 'validity',
        severity: 'critical',
        impact_score: 95,
        affected_rows: 1250,
        downstream_assets: 15,
        business_impact: {
          revenue_impact: 125000,
          user_impact: 1250,
          compliance_risk: true,
          gdpr_violation: true,
          hipaa_violation: false
        }
      },
      {
        title: 'Critical: Duplicate customer records causing billing errors',
        description: 'Over 500 duplicate customer records leading to double billing incidents',
        dimension: 'uniqueness',
        severity: 'critical',
        impact_score: 92,
        affected_rows: 523,
        downstream_assets: 8,
        business_impact: {
          revenue_impact: 52300,
          user_impact: 523,
          compliance_risk: true,
          customer_complaints: 45
        }
      },
      {
        title: 'High: Missing foreign key relationships',
        description: 'Orphaned order records with no corresponding customer',
        dimension: 'consistency',
        severity: 'high',
        impact_score: 78,
        affected_rows: 342,
        downstream_assets: 12,
        business_impact: {
          revenue_impact: 17100,
          user_impact: 342,
          reporting_impact: true
        }
      },
      {
        title: 'High: Price discrepancies between systems',
        description: 'Product prices differ between catalog and order processing system',
        dimension: 'accuracy',
        severity: 'high',
        impact_score: 82,
        affected_rows: 156,
        downstream_assets: 6,
        business_impact: {
          revenue_impact: 31200,
          user_impact: 156,
          financial_impact: true
        }
      }
    ];

    for (const issue of criticalIssues) {
      const randomAsset = assets[Math.floor(Math.random() * assets.length)];
      const dimensionRules = rulesByDimension[issue.dimension];
      if (dimensionRules && dimensionRules.length > 0) {
        const rule = dimensionRules[0];
        const resultId = require('crypto').randomUUID();

        // Create failed result
        await client.query(
          `INSERT INTO quality_results
           (id, rule_id, data_source_id, status, execution_time_ms, rows_checked, rows_failed, run_at, executed_by, metrics)
           VALUES ($1, $2, $3, 'failed', $4, $5, $6, NOW() - INTERVAL '1 day', 'system', $7)`,
          [
            resultId,
            rule.id,
            dataSourceId,
            Math.floor(Math.random() * 3000) + 500,
            issue.affected_rows * 2,
            issue.affected_rows,
            JSON.stringify({ critical: true, dimension: issue.dimension, asset_id: randomAsset.id, asset_name: `${randomAsset.schema_name}.${randomAsset.table_name}` })
          ]
        );

        // Create critical issue
        await client.query(
          `INSERT INTO quality_issues
           (result_id, rule_id, data_source_id, severity, dimension, status, title, description,
            impact_score, affected_rows, auto_heal_eligible, auto_heal_confidence, downstream_assets,
            business_impact, first_seen_at, last_seen_at)
           VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, false, 0.15, $10, $11, NOW() - INTERVAL '2 days', NOW())`,
          [
            resultId,
            rule.id,
            dataSourceId,
            issue.severity,
            issue.dimension,
            issue.title,
            issue.description,
            issue.impact_score,
            issue.affected_rows,
            issue.downstream_assets,
            JSON.stringify({...issue.business_impact, asset_id: randomAsset.id, asset_name: `${randomAsset.schema_name}.${randomAsset.table_name}`})
          ]
        );
        totalIssuesAdded++;
        totalResultsAdded++;
      }
    }

    console.log(`\n✅ Successfully added:`);
    console.log(`   - ${totalResultsAdded} quality scan results`);
    console.log(`   - ${totalIssuesAdded} quality issues`);
    console.log(`\nBreakdown by severity:`);

    const severityCounts = await client.query(
      `SELECT severity, COUNT(*) as count FROM quality_issues GROUP BY severity ORDER BY
       CASE severity
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END`
    );
    severityCounts.rows.forEach(row => {
      console.log(`   - ${row.severity}: ${row.count}`);
    });

    console.log(`\nBreakdown by dimension:`);
    const dimensionCounts = await client.query(
      `SELECT dimension, COUNT(*) as count FROM quality_issues GROUP BY dimension ORDER BY dimension`
    );
    dimensionCounts.rows.forEach(row => {
      console.log(`   - ${row.dimension}: ${row.count}`);
    });

  } catch (error) {
    console.error('Error adding quality data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addQualityIssuesAndResults().catch(console.error);
