const fetch = require('node-fetch');

async function testColumnQueryBoth() {
  console.log('='.repeat(80));
  console.log('TESTING COLUMN QUERIES FOR BOTH POSTGRES AND AZURE');
  console.log('='.repeat(80));

  // Test 1: Postgres columns
  console.log('\n📊 TEST 1: Postgres Columns');
  console.log('-'.repeat(40));

  const postgresId = '793e4fe5-db62-4aa4-8b48-c220960d85ba';

  // Get first Postgres table
  const pgTablesResp = await fetch(`http://localhost:3002/catalog/assets?dataSourceId=${postgresId}&limit=1`);
  const pgTablesData = await pgTablesResp.json();
  const pgTable = pgTablesData.data?.assets?.[0];

  if (pgTable) {
    console.log(`Table: ${pgTable.schema}.${pgTable.table}`);
    console.log(`Asset ID: ${pgTable.id}`);

    // Query columns using catalog_columns
    const pgColumnQuery = `SELECT column_name, data_type FROM catalog_columns WHERE asset_id = ${pgTable.id} ORDER BY ordinal`;

    const pgResponse = await fetch('http://localhost:3002/data/execute-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataSourceId: postgresId,
        database: pgTable.databaseName || 'cwic_platform',
        query: pgColumnQuery
      })
    });

    const pgData = await pgResponse.json();

    if (pgData.success) {
      console.log(`✅ Success! Found ${pgData.rows?.length || 0} columns`);
      if (pgData.rows && pgData.rows.length > 0) {
        console.log('Sample columns:');
        pgData.rows.slice(0, 3).forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type})`);
        });
      }
    } else {
      console.log(`❌ Failed: ${pgData.error}`);
    }
  }

  // Test 2: Azure columns
  console.log('\n📊 TEST 2: Azure Columns');
  console.log('-'.repeat(40));

  const azureId = 'af910adf-c7c1-4573-9eec-93f05f0970b7';

  // Get first Azure table
  const azTablesResp = await fetch(`http://localhost:3002/catalog/assets?dataSourceId=${azureId}&limit=1`);
  const azTablesData = await azTablesResp.json();
  const azTable = azTablesData.data?.assets?.[0];

  if (azTable) {
    console.log(`Table: ${azTable.schema}.${azTable.table}`);
    console.log(`Asset ID: ${azTable.id}`);

    // Method 1: Query using Azure data source (will fail without credentials)
    console.log('\nMethod 1: Using Azure dataSourceId (expected to fail)');
    const azColumnQuery = `SELECT column_name, data_type FROM catalog_columns WHERE asset_id = ${azTable.id} ORDER BY ordinal`;

    const azResponse1 = await fetch('http://localhost:3002/data/execute-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataSourceId: azureId,
        database: azTable.databaseName || 'CWIC_Demo',
        query: azColumnQuery
      })
    });

    const azData1 = await azResponse1.json();

    if (!azData1.success) {
      console.log(`✅ Expected failure: ${azData1.error?.substring(0, 50)}...`);
    }

    // Method 2: Query using Postgres to access catalog_columns (should work!)
    console.log('\nMethod 2: Using Postgres to query catalog_columns');

    const azResponse2 = await fetch('http://localhost:3002/data/execute-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataSourceId: postgresId,  // Use Postgres!
        database: 'cwic_platform',
        query: azColumnQuery
      })
    });

    const azData2 = await azResponse2.json();

    if (azData2.success) {
      console.log(`✅ Success! Found ${azData2.rows?.length || 0} columns`);
      if (azData2.rows && azData2.rows.length > 0) {
        console.log('Sample columns:');
        azData2.rows.slice(0, 3).forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type})`);
        });
      }
    } else {
      console.log(`❌ Failed: ${azData2.error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SOLUTION FOR VISUAL RULE BUILDER');
  console.log('='.repeat(80));
  console.log('The Visual Rule Builder should:');
  console.log('1. Keep the current dataSourceId for table fetching');
  console.log('2. For columns, ALWAYS use Postgres dataSourceId to query catalog_columns');
  console.log('3. This works for both Postgres and Azure tables');
  console.log('4. No need for real Azure credentials!');
}

testColumnQueryBoth().catch(console.error);