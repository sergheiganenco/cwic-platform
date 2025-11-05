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
  console.log('Testing Quality Overview with NO filters (default view)\n');
  console.log('='.repeat(70));

  // Fetch summary
  console.log('\n1. Fetching summary...');
  const summary = await httpGet('http://localhost:3002/api/quality/summary');
  const summaryData = summary.data;

  console.log('   Total Assets:', summaryData.assetCoverage?.totalAssets);
  console.log('   Overall Score:', summaryData.totals?.overallScore);

  // Fetch issues
  console.log('\n2. Fetching issues (limit 100)...');
  const issuesResponse = await httpGet('http://localhost:3002/api/quality/issues?limit=100');
  const issuesList = issuesResponse.data?.issues || [];

  console.log('   Total Issues:', issuesList.length);

  // Process like frontend does
  console.log('\n3. Processing issues...');

  const getAssetId = (issue) => {
    const id = issue.assetId || issue.asset_id || issue.business_impact?.asset_id;
    return id ? String(id) : null;
  };

  const assetSeverityMap = new Map();
  const severityPriority = { critical: 4, high: 3, medium: 2, low: 1 };

  let issuesWithoutAssetId = 0;

  issuesList.forEach((issue) => {
    const assetId = getAssetId(issue);
    if (!assetId) {
      issuesWithoutAssetId++;
      return;
    }

    const currentSeverity = assetSeverityMap.get(assetId);
    const issueSeverity = issue.severity;

    if (!currentSeverity || severityPriority[issueSeverity] > severityPriority[currentSeverity]) {
      assetSeverityMap.set(assetId, issueSeverity);
    }
  });

  console.log('   Issues without asset_id:', issuesWithoutAssetId);
  console.log('   Unique assets with issues:', assetSeverityMap.size);

  let criticalAssets = 0;
  let highAssets = 0;
  let mediumAssets = 0;
  let lowAssets = 0;

  assetSeverityMap.forEach((severity) => {
    if (severity === 'critical') criticalAssets++;
    else if (severity === 'high') highAssets++;
    else if (severity === 'medium') mediumAssets++;
    else if (severity === 'low') lowAssets++;
  });

  const totalAssets = summaryData.assetCoverage?.totalAssets || 0;
  const assetsWithIssues = assetSeverityMap.size;
  const warningAssets = highAssets + mediumAssets;
  const safeAssets = Math.max(0, totalAssets - assetsWithIssues);

  console.log('\n' + '='.repeat(70));
  console.log('EXPECTED UI DISPLAY (No Filters Applied)');
  console.log('='.repeat(70));
  console.log('\nOverall Score:', Math.round(summaryData.totals?.overallScore || 0) + '%');
  console.log('\nAsset Breakdown:');
  console.log('  🔴 At Risk (Critical):      ', criticalAssets, `(${Math.round(criticalAssets/totalAssets*100)}%)`);
  console.log('  🟡 Watch List (High+Med):   ', warningAssets, `(${Math.round(warningAssets/totalAssets*100)}%)`);
  console.log('  🟢 Safe Assets:             ', safeAssets, `(${Math.round(safeAssets/totalAssets*100)}%)`);
  console.log('  📊 Total:                   ', totalAssets);

  console.log('\n' + '='.repeat(70));

  if (criticalAssets === 0 && warningAssets === 0) {
    console.log('\n⚠️  WARNING: Both At Risk and Watch List are showing 0!');
    console.log('   This is the bug the user reported.');
    console.log('\nDEBUGGING INFO:');
    console.log('  - Total issues fetched:', issuesList.length);
    console.log('  - Issues without asset_id:', issuesWithoutAssetId);
    console.log('  - Unique assets with issues:', assetSeverityMap.size);

    if (assetSeverityMap.size === 0 && issuesList.length > 0) {
      console.log('\n❌ PROBLEM: Issues exist but none have valid asset IDs!');
      console.log('\nSample issue structure:');
      const sampleIssue = issuesList[0];
      console.log(JSON.stringify({
        assetId: sampleIssue.assetId,
        asset_id: sampleIssue.asset_id,
        business_impact: sampleIssue.business_impact
      }, null, 2));
    }
  } else {
    console.log('\n✅ Counts look correct!');
  }
})();
