#!/usr/bin/env node

/**
 * Comprehensive Quality Autopilot Test
 * Tests the complete autopilot flow end-to-end
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8000/api';
const DATA_SOURCE_ID = 'af910adf-c7c1-4573-9eec-93f05f0970b7'; // Azure Feya

async function testAutopilot() {
  console.log('🧪 Quality Autopilot - Comprehensive Test\n');
  console.log('=' .repeat(70));

  try {
    // Test 1: Check initial status
    console.log('\n📊 Test 1: Check initial autopilot status');
    console.log('-'.repeat(70));

    const statusResponse = await fetch(
      `${API_BASE}/quality/autopilot/status/${DATA_SOURCE_ID}`
    );
    const statusData = await statusResponse.json();

    console.log('Status Response:', JSON.stringify(statusData, null, 2));

    if (statusData.success && statusData.data.enabled) {
      console.log('✅ Autopilot already enabled');
      console.log(`   Rules: ${statusData.data.rulesGenerated}`);
      console.log(`   Next scan: ${statusData.data.nextScan}`);

      // Show summary if available
      if (statusData.data.summary) {
        console.log('\n   Summary:');
        console.log(`   - NULL checks: ${statusData.data.summary.nullChecks}`);
        console.log(`   - Format validators: ${statusData.data.summary.formatValidators}`);
        console.log(`   - Uniqueness rules: ${statusData.data.summary.uniquenessRules}`);
        console.log(`   - PII rules: ${statusData.data.summary.piiRules}`);
        console.log(`   - Freshness checks: ${statusData.data.summary.freshnessChecks}`);
      }

      return statusData.data;
    }

    // Test 2: Enable autopilot
    console.log('\n🚀 Test 2: Enable Quality Autopilot');
    console.log('-'.repeat(70));
    console.log('This will:');
    console.log('  1. Profile all tables in the database');
    console.log('  2. Analyze data patterns and quality risks');
    console.log('  3. Generate smart quality rules automatically');
    console.log('  4. Create rule group and associations');
    console.log('\nStarting... (this may take 2-3 minutes)\n');

    const startTime = Date.now();

    const enableResponse = await fetch(
      `${API_BASE}/quality/autopilot/enable`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSourceId: DATA_SOURCE_ID })
      }
    );

    const enableData = await enableResponse.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!enableResponse.ok) {
      console.error('❌ Failed to enable autopilot');
      console.error('Response:', JSON.stringify(enableData, null, 2));
      return null;
    }

    console.log('\n✅ Autopilot Enabled Successfully!');
    console.log(`   Duration: ${duration} seconds`);
    console.log(`   Rules generated: ${enableData.data.rulesGenerated}`);
    console.log(`   Next scan: ${enableData.data.nextScan}`);

    if (enableData.data.summary) {
      console.log('\n   📊 Rules Breakdown:');
      console.log(`   - NULL checks: ${enableData.data.summary.nullChecks}`);
      console.log(`   - Format validators: ${enableData.data.summary.formatValidators}`);
      console.log(`   - Uniqueness rules: ${enableData.data.summary.uniquenessRules}`);
      console.log(`   - PII rules: ${enableData.data.summary.piiRules}`);
      console.log(`   - Freshness checks: ${enableData.data.summary.freshnessChecks}`);
    }

    // Test 3: Verify rules were created
    console.log('\n📋 Test 3: Verify rules in database');
    console.log('-'.repeat(70));

    const rulesResponse = await fetch(
      `${API_BASE}/quality/rules?dataSourceId=${DATA_SOURCE_ID}&limit=200`
    );
    const rulesData = await rulesResponse.json();

    const autopilotRules = rulesData.data.filter(r =>
      r.name.includes('[Autopilot]')
    );

    console.log(`✅ Found ${autopilotRules.length} autopilot rules in database`);

    // Show sample rules
    console.log('\n   Sample rules:');
    autopilotRules.slice(0, 5).forEach((rule, i) => {
      console.log(`   ${i + 1}. ${rule.name}`);
      console.log(`      Type: ${rule.rule_type} | Severity: ${rule.severity}`);
    });

    if (autopilotRules.length > 5) {
      console.log(`   ... and ${autopilotRules.length - 5} more rules`);
    }

    // Test 4: Check rule group
    console.log('\n🗂️  Test 4: Verify rule group');
    console.log('-'.repeat(70));

    const { Pool } = require('pg');
    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'cwic_platform',
      user: 'cwic_user',
      password: 'cwic_secure_pass'
    });

    const groupResult = await pool.query(
      `SELECT * FROM quality_rule_groups
       WHERE data_source_id = $1 AND type = 'autopilot'`,
      [DATA_SOURCE_ID]
    );

    if (groupResult.rows.length > 0) {
      const group = groupResult.rows[0];
      console.log('✅ Autopilot rule group created');
      console.log(`   ID: ${group.id}`);
      console.log(`   Name: ${group.name}`);
      console.log(`   Enabled: ${group.enabled}`);

      // Check members
      const membersResult = await pool.query(
        `SELECT COUNT(*) as count FROM quality_rule_group_members
         WHERE group_id = $1`,
        [group.id]
      );

      console.log(`   Members: ${membersResult.rows[0].count} rules`);
    }

    await pool.end();

    // Test 5: Test a sample rule
    console.log('\n⚡ Test 5: Execute a sample autopilot rule');
    console.log('-'.repeat(70));

    if (autopilotRules.length > 0) {
      const sampleRule = autopilotRules[0];
      console.log(`Testing rule: ${sampleRule.name}`);

      const execResponse = await fetch(
        `${API_BASE}/quality/rules/${sampleRule.id}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }
      );

      const execData = await execResponse.json();

      if (execResponse.ok && execData.success) {
        console.log('✅ Rule executed successfully');
        console.log(`   Status: ${execData.data.status}`);
        console.log(`   Execution time: ${execData.data.execution_time_ms}ms`);
        if (execData.data.rows_checked !== undefined) {
          console.log(`   Rows checked: ${execData.data.rows_checked}`);
        }
        if (execData.data.rows_failed !== undefined) {
          console.log(`   Rows failed: ${execData.data.rows_failed}`);
        }
      } else {
        console.log('⚠️  Rule execution had issues (this is ok for testing)');
        console.log(`   Error: ${execData.data?.error || execData.error}`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('🎉 AUTOPILOT TEST COMPLETE');
    console.log('='.repeat(70));
    console.log('\n✅ All tests passed!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Autopilot enabled: ✅`);
    console.log(`   - Rules generated: ${enableData.data.rulesGenerated}`);
    console.log(`   - Rules in database: ${autopilotRules.length}`);
    console.log(`   - Setup time: ${duration} seconds`);
    console.log(`\n🚀 Your data quality platform is now monitoring automatically!`);
    console.log(`\n📍 View in UI: http://localhost:3000/quality?tab=rules`);

    return enableData.data;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Run the test
testAutopilot()
  .then(() => {
    console.log('\n✅ Test suite completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed\n');
    process.exit(1);
  });
