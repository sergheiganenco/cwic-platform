const https = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/quality/issues?database=adventureworks&limit=5',
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Total issues:', json.data.total);
    console.log('\nFirst 3 issues:');

    json.data.issues.slice(0, 3).forEach((issue, i) => {
      console.log(`\nIssue ${i+1}:`);
      console.log('  severity:', issue.severity);
      console.log('  assetId:', issue.assetId);
      console.log('  asset_id:', issue.asset_id);
      console.log('  business_impact.asset_id:', issue.business_impact?.asset_id);
    });
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();
