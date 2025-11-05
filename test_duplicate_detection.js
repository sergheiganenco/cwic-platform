// Test script to create and execute a duplicate detection rule
const API_BASE = 'http://localhost:8000/api';

async function testDuplicateDetection() {
  console.log('🔍 Testing Duplicate Detection Rule Functionality\n');

  // Step 1: Get data sources
  console.log('Step 1: Fetching data sources...');
  const dsResponse = await fetch(`${API_BASE}/data-sources`);
  const dsData = await dsResponse.json();

  if (!dsData.success || !dsData.data || dsData.data.length === 0) {
    console.error('❌ No data sources found');
    return;
  }

  // Find Azure Feya data source
  const azureFeya = dsData.data.find(ds => ds.name.includes('Feya'));
  if (!azureFeya) {
    console.error('❌ Azure Feya data source not found');
    return;
  }

  console.log(`✅ Found data source: ${azureFeya.name} (ID: ${azureFeya.id})\n`);

  // Step 2: Check if Role table exists
  console.log('Step 2: Checking Role table...');
  const catalogResponse = await fetch(`${API_BASE}/catalog/assets?dataSourceId=${azureFeya.id}&search=Role`);
  const catalogData = await catalogResponse.json();

  if (!catalogData.success || !catalogData.data || !catalogData.data.assets || catalogData.data.assets.length === 0) {
    console.error('❌ Role table not found');
    return;
  }

  const roleTable = catalogData.data.assets.find(a => a.name === 'Role' || a.table === 'Role');
  if (!roleTable) {
    console.error('❌ Role table not found in results');
    return;
  }

  console.log(`✅ Found table: ${roleTable.table} (Schema: ${roleTable.schema}, Database: ${roleTable.databaseName})\n`);

  // Step 3: Create duplicate detection rule
  console.log('Step 3: Creating duplicate detection rule...');

  const duplicateRule = {
    name: 'TEST: Duplicate Detection - Role.Name',
    description: 'Detects duplicate values in the Name column of the Role table. Duplicates indicate data quality issues.',
    ruleType: 'sql',
    dimension: 'uniqueness',
    severity: 'high',
    assetId: roleTable.id,
    tableName: `${roleTable.schema}.${roleTable.table}`,
    columnName: 'Name',
    dataSourceId: azureFeya.id,
    enabled: true,
    // SQL to detect duplicates - returns rows that have duplicates
    expression: `SELECT Name as duplicate_value, COUNT(*) as occurrence_count, STRING_AGG(CAST(Id AS VARCHAR), ', ') as duplicate_ids FROM ${roleTable.databaseName ? `[${roleTable.databaseName}]` : ''}.${roleTable.schema}.${roleTable.table} WHERE Name IS NOT NULL GROUP BY Name HAVING COUNT(*) > 1 ORDER BY occurrence_count DESC`,
    tags: ['test', 'uniqueness', 'duplicates']
  };

  const createRuleResponse = await fetch(`${API_BASE}/quality/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(duplicateRule)
  });

  const createdRuleData = await createRuleResponse.json();

  if (!createdRuleData.success || !createdRuleData.data) {
    console.error('❌ Failed to create rule:', createdRuleData);
    return;
  }

  const rule = createdRuleData.data;
  console.log(`✅ Created rule: ${rule.name} (ID: ${rule.id})\n`);

  // Step 4: Execute the rule
  console.log('Step 4: Executing duplicate detection rule...');

  const executeResponse = await fetch(`${API_BASE}/quality/rules/${rule.id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const executeData = await executeResponse.json();

  if (!executeData.success) {
    console.error('❌ Failed to execute rule:', executeData);
    return;
  }

  console.log('✅ Rule executed successfully!\n');
  console.log('Execution Results:');
  console.log(JSON.stringify(executeData.data, null, 2));
  console.log('\n');

  // Step 5: Check for quality issues
  console.log('Step 5: Checking for quality issues...');

  const issuesResponse = await fetch(`${API_BASE}/quality/issues?dataSourceId=${azureFeya.id}&assetId=${roleTable.id}`);
  const issuesData = await issuesResponse.json();

  if (!issuesData.success) {
    console.error('❌ Failed to fetch issues:', issuesData);
    return;
  }

  console.log(`\n📊 Found ${issuesData.data?.issues?.length || 0} quality issues\n`);

  if (issuesData.data?.issues && issuesData.data.issues.length > 0) {
    console.log('Quality Issues:');
    issuesData.data.issues.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. ${issue.title || issue.issue_type}`);
      console.log(`   Severity: ${issue.severity}`);
      console.log(`   Status: ${issue.status}`);
      console.log(`   Table: ${issue.table_name || issue.tableName}`);
      console.log(`   Column: ${issue.column_name || issue.columnName}`);
      console.log(`   Affected Rows: ${issue.affected_rows || issue.affectedRows || 0}`);
      console.log(`   Description: ${(issue.description || '').substring(0, 150)}...`);

      if (issue.root_cause || issue.rootCause) {
        console.log(`   🧠 Root Cause: ${issue.root_cause || issue.rootCause}`);
      }

      if (issue.remediation_plan || issue.remediationPlan) {
        console.log(`   💡 Fix: ${issue.remediation_plan || issue.remediationPlan}`);
      }
    });
  } else {
    console.log('✅ No duplicates found - data quality is excellent!');
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 Test Summary');
  console.log('='.repeat(80));
  console.log(`✅ Data Source: ${azureFeya.name}`);
  console.log(`✅ Table: ${roleTable.table}`);
  console.log(`✅ Rule Created: ${rule.name}`);
  console.log(`✅ Rule Executed: Yes`);
  console.log(`✅ Issues Found: ${issuesData.data?.issues?.length || 0}`);
  console.log('\n📍 Where to view results:');
  console.log('   1. Data Quality → Rules tab → See rule in list');
  console.log('   2. Data Quality → Violations tab → See quality issues');
  console.log('   3. Data Quality → Overview tab → See metrics');
  console.log('\n🔗 Direct link: http://localhost:3000/quality?tab=violations');
  console.log('\n');
}

// Run the test
testDuplicateDetection().catch(err => {
  console.error('❌ Test failed:', err.message);
  console.error(err);
});
