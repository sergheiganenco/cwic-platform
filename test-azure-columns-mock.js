const fetch = require('node-fetch');

async function testAzureColumnsMock() {
  console.log('Testing Azure columns with mock data...\n');

  // First, get the Azure data source ID
  const dsResponse = await fetch('http://localhost:3002/api/data-sources');
  const dsData = await dsResponse.json();
  const azureDs = (dsData.data || dsData).find(ds =>
    ds.type === 'mssql' && ds.name.includes('Azure')
  );

  if (!azureDs) {
    console.log('❌ No Azure data source found');
    return;
  }

  console.log(`Found Azure data source: ${azureDs.name}`);
  console.log(`ID: ${azureDs.id}\n`);

  // Get the first table from catalog
  const tablesResponse = await fetch(
    `http://localhost:3002/catalog/assets?dataSourceId=${azureDs.id}&limit=5`
  );
  const tablesData = await tablesResponse.json();
  const tables = tablesData.data?.assets || [];
  const firstTable = tables.find(t => t.type === 'table');

  if (!firstTable) {
    console.log('❌ No tables found in catalog');
    return;
  }

  console.log(`Found table: ${firstTable.schema}.${firstTable.table}`);
  console.log(`Asset ID: ${firstTable.id}`);
  console.log(`Database: ${firstTable.databaseName}\n`);

  // Test 1: Query catalog_columns directly (what the UI does)
  console.log('📊 TEST 1: Query catalog_columns table');
  console.log('-'.repeat(40));

  const catalogQuery = `SELECT column_name, data_type FROM catalog_columns WHERE asset_id = ${firstTable.id} ORDER BY ordinal`;

  const catalogResponse = await fetch('http://localhost:3002/data/execute-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataSourceId: '793e4fe5-db62-4aa4-8b48-c220960d85ba', // Using Postgres to query our own catalog
      database: 'cwic_platform',
      query: catalogQuery
    })
  });

  const catalogData = await catalogResponse.json();

  console.log('Query:', catalogQuery);
  console.log('Response success:', catalogData.success);

  if (catalogData.success && catalogData.rows) {
    console.log(`✅ Found ${catalogData.rows.length} columns`);
    if (catalogData.rows.length > 0) {
      console.log('Sample columns:');
      catalogData.rows.slice(0, 5).forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    }
  } else {
    console.log('❌ Query failed:', catalogData.error);
  }

  // Test 2: Try with Azure data source ID (this will fail without real credentials)
  console.log('\n📊 TEST 2: Try with Azure dataSourceId (expected to fail)');
  console.log('-'.repeat(40));

  const azureResponse = await fetch('http://localhost:3002/data/execute-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataSourceId: azureDs.id,
      database: firstTable.databaseName || 'CWIC_Demo',
      query: catalogQuery
    })
  });

  const azureData = await azureResponse.json();

  if (!azureData.success) {
    console.log('✅ Expected: Azure query fails (no real credentials)');
    console.log(`   Error: ${azureData.error?.substring(0, 60)}...`);
  } else {
    console.log('⚠️  Unexpected: Azure query succeeded');
  }

  // Test 3: Check what the Visual Rule Builder would see
  console.log('\n📊 TEST 3: Simulate Visual Rule Builder logic');
  console.log('-'.repeat(40));

  // This simulates what happens in the UI
  const tableName = `${firstTable.schema}.${firstTable.table}`;
  console.log(`Selected table: ${tableName}`);
  console.log(`Asset ID: ${firstTable.id}`);
  console.log(`Database to use: ${firstTable.databaseName || 'cwic_platform'}`);

  // The UI should use Postgres to query catalog_columns
  console.log('\n✅ Solution: Visual Rule Builder should:');
  console.log('1. Use asset.id from the selected table');
  console.log('2. Query catalog_columns table');
  console.log('3. Use Postgres dataSourceId for the query');
  console.log('4. This avoids needing real Azure credentials');
}

testAzureColumnsMock().catch(console.error);