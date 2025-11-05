const fetch = require('node-fetch');

async function testColumnsQuery() {
  console.log('Testing column query for Azure Feya User table...\n');

  // First, get the asset ID for User table
  const assetsUrl = 'http://localhost:3002/catalog/assets?dataSourceId=af910adf-c7c1-4573-9eec-93f05f0970b7&type=table&limit=100';
  console.log('1. Fetching assets from:', assetsUrl);

  const assetsResponse = await fetch(assetsUrl);
  const assetsData = await assetsResponse.json();

  const userAsset = assetsData.data.assets.find(a => a.table === 'User' && a.schema === 'dbo');

  if (!userAsset) {
    console.error('User table not found!');
    return;
  }

  console.log('2. Found User table with asset ID:', userAsset.id);
  console.log('   Full name:', `${userAsset.schema}.${userAsset.table}`);
  console.log('   Database:', userAsset.databaseName);

  // Now query columns
  const columnQuery = `SELECT column_name, data_type FROM catalog_columns WHERE asset_id = ${userAsset.id} ORDER BY ordinal`;
  console.log('\n3. Executing column query:', columnQuery);

  const queryResponse = await fetch('http://localhost:3002/data/execute-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataSourceId: 'af910adf-c7c1-4573-9eec-93f05f0970b7',
      query: columnQuery
    })
  });

  const queryData = await queryResponse.json();

  console.log('\n4. Query response:');
  console.log('   Success:', queryData.success);
  console.log('   Error:', queryData.error || 'None');

  if (queryData.success && queryData.data?.rows) {
    console.log('   Row count:', queryData.data.rows.length);
    console.log('\n5. Columns found:');
    queryData.data.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
  } else {
    console.log('   No data returned!');
    console.log('   Full response:', JSON.stringify(queryData, null, 2));
  }
}

testColumnsQuery().catch(console.error);