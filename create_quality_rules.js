// Script to create quality rules for detecting bad data
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3002/api';
const DATA_SOURCE_ID = '793e4fe5-db62-4aa4-8b48-c220960d85ba';

async function createRule(rule) {
  const response = await fetch(`${API_BASE}/quality/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule)
  });

  const result = await response.json();
  if (result.success) {
    console.log(`✅ Created rule: ${rule.name}`);
    return result.data.id;
  } else {
    console.error(`❌ Failed to create rule ${rule.name}:`, result.error);
    return null;
  }
}

async function createQualityRules() {
  console.log('\n📋 Creating Quality Rules for Bad Data Detection...\n');

  const rules = [
    // 1. Completeness Rules
    {
      name: 'Customer Email Required',
      description: 'All customers must have an email address',
      dataSourceId: DATA_SOURCE_ID,
      dimension: 'completeness',
      severity: 'high',
      expression: `SELECT
        COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as issues,
        COUNT(*) as total,
        'customers' as table_name,
        'email' as column_name
      FROM adventureworks.public.customers`,
      threshold: { operator: '<=', value: 0 },
      enabled: true,
      tags: ['customer', 'email', 'required']
    },

    // 2. Validity Rules
    {
      name: 'Valid Email Format',
      description: 'Customer emails must be in valid format',
      dataSourceId: DATA_SOURCE_ID,
      dimension: 'validity',
      severity: 'medium',
      expression: `SELECT
        COUNT(CASE WHEN email IS NOT NULL AND email NOT LIKE '%@%.%' THEN 1 END) as issues,
        COUNT(*) as total,
        'customers' as table_name,
        'email' as column_name
      FROM adventureworks.public.customers
      WHERE email IS NOT NULL`,
      threshold: { operator: '<=', value: 0 },
      enabled: true,
      tags: ['customer', 'email', 'format']
    },

    {
      name: 'Positive Credit Limits',
      description: 'Customer credit limits must be positive',
      dataSourceId: DATA_SOURCE_ID,
      dimension: 'validity',
      severity: 'critical',
      expression: `SELECT
        COUNT(CASE WHEN credit_limit < 0 THEN 1 END) as issues,
        COUNT(*) as total,
        'customers' as table_name,
        'credit_limit' as column_name
      FROM adventureworks.public.customers`,
      threshold: { operator: '<=', value: 0 },
      enabled: true,
      tags: ['customer', 'credit', 'validation']
    },

    // 3. Timeliness Rules
    {
      name: 'Valid Birth Dates',
      description: 'Customer birth dates must be in the past',
      dataSourceId: DATA_SOURCE_ID,
      dimension: 'timeliness',
      severity: 'high',
      expression: `SELECT
        COUNT(CASE WHEN date_of_birth > CURRENT_DATE THEN 1 END) as issues,
        COUNT(*) as total,
        'customers' as table_name,
        'date_of_birth' as column_name
      FROM adventureworks.public.customers
      WHERE date_of_birth IS NOT NULL`,
      threshold: { operator: '<=', value: 0 },
      enabled: true,
      tags: ['customer', 'birthdate', 'temporal']
    },

    // 4. Accuracy Rules
    {
      name: 'Reasonable Credit Limits',
      description: 'Credit limits should be within reasonable range',
      dataSourceId: DATA_SOURCE_ID,
      dimension: 'accuracy',
      severity: 'medium',
      expression: `SELECT
        COUNT(CASE WHEN credit_limit > 100000 OR credit_limit < 0 THEN 1 END) as issues,
        COUNT(*) as total,
        'customers' as table_name,
        'credit_limit' as column_name
      FROM adventureworks.public.customers
      WHERE credit_limit IS NOT NULL`,
      threshold: { operator: '<=', value: 0 },
      enabled: true,
      tags: ['customer', 'credit', 'outlier']
    },

    // 5. Consistency Rules
    {
      name: 'Phone Number Format',
      description: 'Phone numbers should follow consistent format',
      dataSourceId: DATA_SOURCE_ID,
      dimension: 'consistency',
      severity: 'low',
      expression: `SELECT
        COUNT(CASE WHEN phone NOT LIKE '___-____' AND phone NOT LIKE '(___) ___-____' THEN 1 END) as issues,
        COUNT(*) as total,
        'customers' as table_name,
        'phone' as column_name
      FROM adventureworks.public.customers
      WHERE phone IS NOT NULL`,
      threshold: { operator: '<=', value: 5 },
      enabled: true,
      tags: ['customer', 'phone', 'format']
    },

    // 6. Check for duplicate emails (uniqueness)
    {
      name: 'Unique Customer Emails',
      description: 'Customer emails should be unique',
      dataSourceId: DATA_SOURCE_ID,
      dimension: 'uniqueness',
      severity: 'high',
      expression: `SELECT
        COUNT(*) - COUNT(DISTINCT email) as issues,
        COUNT(*) as total,
        'customers' as table_name,
        'email' as column_name
      FROM adventureworks.public.customers
      WHERE email IS NOT NULL`,
      threshold: { operator: '<=', value: 0 },
      enabled: true,
      tags: ['customer', 'email', 'unique']
    },

    // 7. Check for extremely old customers
    {
      name: 'Reasonable Customer Age',
      description: 'Customers should not be older than 120 years',
      dataSourceId: DATA_SOURCE_ID,
      dimension: 'accuracy',
      severity: 'medium',
      expression: `SELECT
        COUNT(CASE WHEN DATE_PART('year', AGE(date_of_birth)) > 120 THEN 1 END) as issues,
        COUNT(*) as total,
        'customers' as table_name,
        'date_of_birth' as column_name
      FROM adventureworks.public.customers
      WHERE date_of_birth IS NOT NULL`,
      threshold: { operator: '<=', value: 0 },
      enabled: true,
      tags: ['customer', 'age', 'validation']
    }
  ];

  const ruleIds = [];
  for (const rule of rules) {
    const id = await createRule(rule);
    if (id) ruleIds.push(id);
  }

  console.log(`\n✨ Created ${ruleIds.length} quality rules`);
  return ruleIds;
}

async function runQualityScan(ruleIds) {
  console.log('\n🔍 Running Quality Scan...\n');

  const response = await fetch(`${API_BASE}/quality/scan/${DATA_SOURCE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruleIds })
  });

  const result = await response.json();

  if (result.success) {
    const data = result.data;
    console.log('📊 Scan Results:');
    console.log(`  Total Rules Executed: ${data.totalRules || ruleIds.length}`);
    console.log(`  Rules Passed: ${data.rulesPassed || 0}`);
    console.log(`  Rules Failed: ${data.rulesFailed || 0}`);
    console.log(`  Total Issues Found: ${data.totalIssues || 0}`);

    if (data.issues && data.issues.length > 0) {
      console.log('\n🚨 Issues Detected:');
      data.issues.forEach(issue => {
        console.log(`  • ${issue.ruleName}: ${issue.issueCount} issues (${issue.severity})`);
        console.log(`    Table: ${issue.tableName}, Column: ${issue.columnName}`);
      });
    }

    return data;
  } else {
    console.error('❌ Scan failed:', result.error);
    return null;
  }
}

async function getSummary() {
  console.log('\n📈 Getting Quality Summary...\n');

  const response = await fetch(`${API_BASE}/quality/summary?dataSourceId=${DATA_SOURCE_ID}&database=adventureworks`);
  const result = await response.json();

  if (result.success) {
    const data = result.data;
    console.log('📊 Quality Summary:');
    console.log(`  Overall Score: ${data.overallScore || 0}%`);
    console.log(`  Active Rules: ${data.activeRules || 0}`);
    console.log(`  Open Issues: ${data.openIssues || 0}`);
    console.log(`  Critical Issues: ${data.criticalIssues || 0}`);

    if (data.dimensionScores) {
      console.log('\n  Dimension Scores:');
      Object.entries(data.dimensionScores).forEach(([dim, score]) => {
        console.log(`    ${dim}: ${score}%`);
      });
    }
  }
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('  Quality Rules and Scanning Test');
  console.log('='.repeat(60));

  try {
    // Create rules
    const ruleIds = await createQualityRules();

    // Wait a moment for rules to be saved
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run scan
    if (ruleIds.length > 0) {
      await runQualityScan(ruleIds);
    }

    // Get summary
    await getSummary();

    console.log('\n✅ Quality testing complete!');
    console.log('\n💡 The quality score should now be lower than 97% due to the bad data we inserted.');
    console.log('   You can view the issues in the Data Quality page in the UI.');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();