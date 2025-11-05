const http = require('http');

async function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('Testing Business Impact Dashboard Data\n');
  console.log('='.repeat(70));

  // Fetch issues
  console.log('\n1. Fetching issues (limit 100)...');
  const issuesResponse = await httpGet('http://localhost:3002/api/quality/issues?limit=100');
  const issuesList = issuesResponse.data?.issues || [];

  console.log(`   Total Issues: ${issuesList.length}`);

  // Calculate business impact
  let totalRevenueImpact = 0;
  let totalUserImpact = 0;
  let estimatedDowntimeMinutes = 0;
  let resolvedCount = 0;

  issuesList.forEach((issue) => {
    const impact = issue.business_impact || {};
    totalRevenueImpact += parseInt(impact.revenue_impact || 0);
    totalUserImpact += parseInt(impact.user_impact || 0);

    // Estimate downtime
    if (issue.severity === 'critical') {
      estimatedDowntimeMinutes += 5;
    } else if (issue.severity === 'high') {
      estimatedDowntimeMinutes += 2;
    }

    // Count resolved
    if (issue.status === 'resolved') {
      resolvedCount++;
    }
  });

  const revenueAtRisk = totalRevenueImpact > 0 ? `$${Math.round(totalRevenueImpact / 1000)}K` : '$0';
  const usersImpacted = totalUserImpact.toLocaleString();
  const downtimeToday = estimatedDowntimeMinutes > 0 ? `${estimatedDowntimeMinutes} min` : '0 min';
  const incidentsPrevented = resolvedCount;
  const estimatedSavings = totalRevenueImpact > 0 ? `$${Math.round(totalRevenueImpact / 1000)}K` : '$0';

  console.log('\n' + '='.repeat(70));
  console.log('BUSINESS IMPACT DASHBOARD - EXPECTED VALUES');
  console.log('='.repeat(70));
  console.log('\n💰 Revenue at Risk:', revenueAtRisk);
  console.log('   Trend: Down 12% from yesterday (hardcoded)');
  console.log('\n👥 Users Impacted:', usersImpacted);
  console.log('   Trend: Down 8% from yesterday (hardcoded)');
  console.log('\n⏱️  Downtime Today:', downtimeToday);
  console.log('   Trend: Down 45% from yesterday (hardcoded)');
  console.log('\n✅ Incidents Prevented:', incidentsPrevented);
  console.log('💵 Estimated Savings:', estimatedSavings);

  console.log('\n' + '='.repeat(70));
  console.log('DETAILS:');
  console.log('='.repeat(70));
  console.log('Total revenue impact (raw):', totalRevenueImpact);
  console.log('Total user impact:', totalUserImpact);
  console.log('Estimated downtime minutes:', estimatedDowntimeMinutes);
  console.log('Resolved issues:', resolvedCount);

  // Sample a few issues to show business impact
  console.log('\nSample Issues with Business Impact:');
  issuesList.slice(0, 3).forEach((issue, i) => {
    const impact = issue.business_impact || {};
    console.log(`\n  Issue ${i + 1}:`);
    console.log(`    Severity: ${issue.severity}`);
    console.log(`    Status: ${issue.status}`);
    console.log(`    Revenue Impact: $${impact.revenue_impact || 0}`);
    console.log(`    User Impact: ${impact.user_impact || 0}`);
    console.log(`    Asset: ${impact.asset_name || 'N/A'}`);
  });

  console.log('\n' + '='.repeat(70));
})();
