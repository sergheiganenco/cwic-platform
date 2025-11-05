#!/usr/bin/env node
/**
 * Test PII Rescan Functionality
 *
 * This script tests the new PII rescan feature that allows users to
 * re-apply PII rules to existing catalog data after creating/modifying rules.
 */

const API_BASE = 'http://localhost:3002/api';

async function testPIIRescan() {
  console.log('🧪 Testing PII Rescan Functionality\n');
  console.log('='* 60);

  try {
    // Step 1: Get list of PII rules
    console.log('\n📋 Step 1: Fetching PII rules...');
    const rulesResponse = await fetch(`${API_BASE}/pii-rules`);
    const rulesData = await rulesResponse.json();

    if (!rulesData.success) {
      throw new Error('Failed to fetch PII rules');
    }

    console.log(`✅ Found ${rulesData.data.length} PII rules`);

    // Find the "Name" rule that the user created
    const nameRule = rulesData.data.find(r => r.pii_type === 'NAME' || r.display_name.toLowerCase().includes('name'));

    if (nameRule) {
      console.log(`\n📌 Found rule: "${nameRule.display_name}" (ID: ${nameRule.id})`);
      console.log(`   PII Type: ${nameRule.pii_type}`);
      console.log(`   Enabled: ${nameRule.is_enabled}`);
      console.log(`   Sensitivity: ${nameRule.sensitivity_level}`);

      // Step 2: Get impact analysis
      console.log(`\n📊 Step 2: Getting impact analysis for rule ${nameRule.id}...`);
      const impactResponse = await fetch(`${API_BASE}/pii-rules/${nameRule.id}/impact`);
      const impactData = await impactResponse.json();

      if (impactData.success) {
        console.log(`✅ Impact Analysis Results:`);
        console.log(`   - Affected Columns: ${impactData.data.affectedColumns}`);
        console.log(`   - Affected Tables: ${impactData.data.affectedTables}`);
        console.log(`   - Affected Data Sources: ${impactData.data.affectedDataSources}`);

        if (impactData.data.sampleColumns.length > 0) {
          console.log(`\n   Sample Affected Columns:`);
          impactData.data.sampleColumns.slice(0, 5).forEach((col, idx) => {
            console.log(`     ${idx + 1}. ${col.column_name} (${col.data_source_name}.${col.database_name}.${col.schema_name}.${col.table_name})`);
          });
        }
      } else {
        console.log('⚠️  Failed to get impact analysis:', impactData.error);
      }

      // Step 3: Test rescan (dry run - we won't actually rescan unless user confirms)
      console.log(`\n🔄 Step 3: Testing rescan endpoint (getting ready)...`);
      console.log(`   Would rescan ${impactData.data.affectedColumns} columns with rule: ${nameRule.display_name}`);
      console.log(`   To trigger actual rescan: POST ${API_BASE}/pii-rules/${nameRule.id}/rescan`);

    } else {
      console.log('\n⚠️  No "Name" rule found. Available rules:');
      rulesData.data.forEach(r => {
        console.log(`   - ${r.display_name} (${r.pii_type})`);
      });
    }

    // Step 4: Check catalog for columns with PII classifications
    console.log(`\n📚 Step 4: Checking catalog for columns with PII markers...`);
    const catalogResponse = await fetch(`${API_BASE}/catalog/columns?limit=10`);
    const catalogData = await catalogResponse.json();

    if (catalogData.success && catalogData.data.length > 0) {
      console.log(`✅ Found ${catalogData.data.length} columns (showing first 10):`);
      catalogData.data.forEach((col, idx) => {
        if (col.pii_type || col.data_classification) {
          console.log(`   ${idx + 1}. ${col.column_name} - PII: ${col.pii_type || col.data_classification || 'none'}`);
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ PII Rescan Test Complete!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Open the PII Settings page: http://localhost:5173/pii-settings');
    console.log('   2. Find your "Name" rule and click "Re-scan Data"');
    console.log('   3. Review the impact and confirm the rescan');
    console.log('   4. Verify that columns like "schema_name" and "table_name" are no longer marked as PII');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testPIIRescan();
