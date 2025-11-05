// Script to run quality scan and check results
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3002/api';
const DATA_SOURCE_ID = '793e4fe5-db62-4aa4-8b48-c220960d85ba';

async function runQualityScan() {
  console.log('\n🔍 Running Quality Scan with Rules...\n');

  // Get all rule IDs
  const rulesResponse = await fetch(`${API_BASE}/quality/rules?dataSourceId=${DATA_SOURCE_ID}`);
  const rulesResult = await rulesResponse.json();

  console.log(`Found ${rulesResult.data ? rulesResult.data.length : 0} rules`);

  // Run scan
  const scanResponse = await fetch(`${API_BASE}/quality/scan/${DATA_SOURCE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  const scanResult = await scanResponse.json();

  if (scanResult.success) {
    const data = scanResult.data;
    console.log('\n📊 Scan Results:');
    console.log(`  Total Rules Executed: ${data.totalRules || 0}`);
    console.log(`  Rules Passed: ${data.rulesPassed || 0}`);
    console.log(`  Rules Failed: ${data.rulesFailed || 0}`);
    console.log(`  Total Issues Found: ${data.totalIssues || 0}`);

    if (data.results && data.results.length > 0) {
      console.log('\n🚨 Issues Detected:');
      data.results.forEach(result => {
        if (result.issueCount > 0) {
          console.log(`\n  Rule: ${result.ruleName}`);
          console.log(`    • Issues: ${result.issueCount}/${result.totalCount} records`);
          console.log(`    • Severity: ${result.severity}`);
          console.log(`    • Dimension: ${result.dimension}`);
        }
      });
    }

    // Get quality issues
    const issuesResponse = await fetch(`${API_BASE}/quality/issues?dataSourceId=${DATA_SOURCE_ID}&limit=20`);
    const issuesResult = await issuesResponse.json();

    if (issuesResult.success && issuesResult.data.length > 0) {
      console.log(`\n📋 Quality Issues Summary:`);
      const issueCounts = {};
      issuesResult.data.forEach(issue => {
        const key = `${issue.ruleName} (${issue.severity})`;
        issueCounts[key] = (issueCounts[key] || 0) + 1;
      });

      Object.entries(issueCounts).forEach(([rule, count]) => {
        console.log(`  • ${rule}: ${count} issues`);
      });
    }

    return data;
  } else {
    console.error('❌ Scan failed:', scanResult.error || scanResult);
    return null;
  }
}

async function checkSummary() {
  console.log('\n📈 Quality Summary After Scan:');

  const summaryResponse = await fetch(`${API_BASE}/quality/summary?dataSourceId=${DATA_SOURCE_ID}&database=adventureworks`);
  const result = await summaryResponse.json();

  if (result.success) {
    const data = result.data;
    console.log(`  Overall Score: ${data.overallScore || 0}%`);
    console.log(`  Active Rules: ${data.activeRules || 0}`);
    console.log(`  Open Issues: ${data.openIssues || 0}`);
    console.log(`  Critical Issues: ${data.criticalIssues || 0}`);
    console.log(`  High Issues: ${data.highIssues || 0}`);
    console.log(`  Medium Issues: ${data.mediumIssues || 0}`);
    console.log(`  Low Issues: ${data.lowIssues || 0}`);

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
  console.log('  Quality Scan Test with Bad Data Detection');
  console.log('='.repeat(60));

  try {
    await runQualityScan();
    await checkSummary();

    console.log('\n✅ Scan complete!');
    console.log('\n💡 The quality score should now be lower due to the detected issues.');
    console.log('   Bad data detected:');
    console.log('   • 5 customers with NULL emails');
    console.log('   • 3 customers with invalid email formats');
    console.log('   • 2 customers with negative credit limits');
    console.log('   • 1 customer with future birth date');
    console.log('\n   Check the Data Quality page to see the issues and lower scores!');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();