const { Pool } = require('pg');

// Connection to CWIC Platform database (where rules are stored)
const cwicPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass'
});

// Connections to target databases (to execute rules against)
const targetPools = {
  adventureworks: new Pool({
    host: 'localhost',
    port: 5432,
    database: 'adventureworks',
    user: 'cwic_user',
    password: 'cwic_secure_pass'
  }),
  cwic_platform: cwicPool, // Same as CWIC
  Feya_DB: new Pool({
    host: 'localhost',
    port: 5432,
    database: 'Feya_DB',
    user: 'cwic_user',
    password: 'cwic_secure_pass'
  })
};

async function executeQualityRules() {
  console.log('============================================================================');
  console.log('EXECUTING QUALITY RULES');
  console.log('============================================================================\n');

  try {
    // Get data source mappings
    const dataSourcesResult = await cwicPool.query(`
      SELECT id, database_name
      FROM data_sources
      WHERE deleted_at IS NULL
    `);

    const dataSourceMap = {};
    dataSourcesResult.rows.forEach(ds => {
      dataSourceMap[ds.database_name] = ds.id;
    });

    console.log('Data Source Mappings:');
    Object.entries(dataSourceMap).forEach(([db, id]) => {
      console.log(`  ${db} → ${id}`);
    });
    console.log('');

    // Get all active quality rules with their associated assets
    const rulesResult = await cwicPool.query(`
      SELECT
        qr.id as rule_id,
        qr.name as rule_name,
        qr.expression,
        qr.severity,
        qr.dimension,
        qr.asset_id,
        ca.table_name,
        ca.database_name,
        ca.schema_name
      FROM quality_rules qr
      JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qr.enabled = true
      ORDER BY ca.database_name, ca.table_name
    `);

    console.log(`Found ${rulesResult.rows.length} quality rules to execute\n`);

    let totalExecuted = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalErrors = 0;

    const resultsByDatabase = {};

    for (const rule of rulesResult.rows) {
      const dbName = rule.database_name;

      if (!resultsByDatabase[dbName]) {
        resultsByDatabase[dbName] = { passed: 0, failed: 0, errors: 0 };
      }

      // Get the appropriate connection pool for this database
      const targetPool = targetPools[dbName];

      if (!targetPool) {
        console.log(`⚠️  Skipping ${rule.rule_name} - no connection for database: ${dbName}`);
        resultsByDatabase[dbName].errors++;
        totalErrors++;
        continue;
      }

      console.log(`Executing: ${rule.rule_name} (${dbName}.${rule.table_name})...`);

      try {
        const startTime = Date.now();

        // Execute the rule SQL against the target database
        const ruleResult = await targetPool.query(rule.expression);

        const executionTime = Date.now() - startTime;
        const rowCount = ruleResult.rows[0]?.row_count || 0;

        // Determine pass/fail based on row count
        const status = rowCount > 0 ? 'passed' : 'failed';
        const rowsFailed = rowCount > 0 ? 0 : 1; // If table is empty, 1 failure

        // Get data source ID for this database (if exists)
        const dataSourceId = dataSourceMap[dbName] || null;

        // Store result in quality_results table
        // Note: asset_id is not included because quality_results.asset_id is uuid but catalog_assets.id is bigint
        // Backend gets asset info by joining quality_results → quality_rules → catalog_assets
        await cwicPool.query(`
          INSERT INTO quality_results (
            rule_id,
            data_source_id,
            status,
            rows_checked,
            rows_failed,
            run_at,
            execution_time_ms
          ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        `, [rule.rule_id, dataSourceId, status, rowCount, rowsFailed, executionTime]);

        if (status === 'passed') {
          console.log(`  ✅ PASSED - ${rowCount} rows found (${executionTime}ms)`);
          totalPassed++;
          resultsByDatabase[dbName].passed++;
        } else {
          console.log(`  ❌ FAILED - Table is empty (${executionTime}ms)`);
          totalFailed++;
          resultsByDatabase[dbName].failed++;
        }

        totalExecuted++;

      } catch (error) {
        console.log(`  ⚠️  ERROR - ${error.message}`);

        // Get data source ID for this database (if exists)
        const dataSourceId = dataSourceMap[dbName] || null;

        // Store error result
        // Note: asset_id is not included because quality_results.asset_id is uuid but catalog_assets.id is bigint
        await cwicPool.query(`
          INSERT INTO quality_results (
            rule_id,
            data_source_id,
            status,
            rows_checked,
            rows_failed,
            run_at,
            error
          ) VALUES ($1, $2, 'error', 0, 0, NOW(), $3)
        `, [rule.rule_id, dataSourceId, error.message]);

        totalErrors++;
        resultsByDatabase[dbName].errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Rules Executed: ${totalExecuted}`);
    console.log(`✅ Passed: ${totalPassed} (${Math.round(totalPassed/totalExecuted*100)}%)`);
    console.log(`❌ Failed: ${totalFailed} (${Math.round(totalFailed/totalExecuted*100)}%)`);
    console.log(`⚠️  Errors: ${totalErrors} (${Math.round(totalErrors/totalExecuted*100)}%)`);

    console.log('\nResults by Database:');
    Object.entries(resultsByDatabase).forEach(([db, stats]) => {
      const total = stats.passed + stats.failed + stats.errors;
      console.log(`\n${db}:`);
      console.log(`  ✅ Passed: ${stats.passed}/${total}`);
      console.log(`  ❌ Failed: ${stats.failed}/${total}`);
      console.log(`  ⚠️  Errors: ${stats.errors}/${total}`);
    });

    console.log('\n✅ Quality rules execution complete!');
    console.log('Check the UI to see updated metrics.\n');

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    // Close all connections
    await cwicPool.end();
    for (const pool of Object.values(targetPools)) {
      if (pool !== cwicPool) {
        await pool.end();
      }
    }
  }
}

// Run the executor
executeQualityRules().catch(err => {
  console.error('Failed to execute quality rules:', err);
  process.exit(1);
});
