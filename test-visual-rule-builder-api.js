// Test script to debug Visual Rule Builder dropdown issue
const fetch = require('node-fetch');

async function testVisualRuleBuilderAPI() {
  console.log('\n=== Visual Rule Builder API Debug Test ===\n');

  // Step 1: Test if we can fetch data sources
  console.log('Step 1: Fetching data sources...');
  try {
    // The frontend might be using different endpoints - let's check all possibilities
    const endpoints = [
      'http://localhost:3002/api/datasources',
      'http://localhost:3002/api/data-sources',
      'http://localhost:8000/api/datasources',
      'http://localhost:8000/api/data-sources'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        const data = await response.json();
        if (data.success || data.data || Array.isArray(data)) {
          console.log(`✓ ${endpoint} works!`);
          console.log(`  Response:`, JSON.stringify(data).substring(0, 200));
        }
      } catch (err) {
        console.log(`✗ ${endpoint} failed: ${err.message}`);
      }
    }
  } catch (error) {
    console.error('Failed to fetch data sources:', error.message);
  }

  // Step 2: Test with a valid dataSourceId (Postgres with 88 assets)
  const testDataSourceId = '793e4fe5-db62-4aa4-8b48-c220960d85ba';
  console.log(`\nStep 2: Fetching assets for dataSourceId: ${testDataSourceId}`);

  try {
    const url = `http://localhost:3002/api/assets?dataSourceId=${testDataSourceId}&limit=1000`;
    console.log(`Fetching from: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    console.log('\n✓ API Response Structure:');
    console.log('  success:', data.success);
    console.log('  data array length:', data.data?.length);
    console.log('  pagination:', data.pagination);

    if (data.success && data.data?.length > 0) {
      console.log('\n✓ Sample asset structure:');
      const sample = data.data[0];
      console.log('  id:', sample.id);
      console.log('  name:', sample.name);
      console.log('  schemaName:', sample.schemaName);
      console.log('  tableName:', sample.tableName);
      console.log('  type:', sample.type);

      // Step 3: Extract unique tables (simulating what Visual Rule Builder does)
      console.log('\nStep 3: Extracting unique tables (like Visual Rule Builder)...');

      const uniqueTables = Array.from(
        new Map(
          data.data.map((asset) => [
            `${asset.schemaName}.${asset.tableName}`,
            {
              name: `${asset.schemaName}.${asset.tableName}`,
              tableName: asset.tableName,
              schemaName: asset.schemaName,
              id: asset.id
            }
          ])
        ).values()
      );

      console.log(`✓ Found ${uniqueTables.length} unique tables`);
      console.log('\nFirst 5 tables:');
      uniqueTables.slice(0, 5).forEach((table, idx) => {
        console.log(`  ${idx + 1}. ${table.name}`);
      });

      // Step 4: Test fetching columns for a table
      console.log('\nStep 4: Testing column fetch for first table...');
      const firstTable = uniqueTables[0];
      console.log(`  Table: ${firstTable.tableName}`);
      console.log(`  Schema: ${firstTable.schemaName}`);

      const queryEndpoint = 'http://localhost:3002/api/data/execute-query';
      const columnQuery = `SELECT column_name, data_type FROM catalog_columns WHERE asset_id = (SELECT id FROM catalog_assets WHERE table_name = '${firstTable.tableName}' AND schema_name = '${firstTable.schemaName}' AND datasource_id = '${testDataSourceId}' LIMIT 1) ORDER BY ordinal`;

      console.log(`\n  Query: ${columnQuery}`);

      const columnResponse = await fetch(queryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSourceId: testDataSourceId,
          query: columnQuery
        })
      });

      const columnData = await columnResponse.json();
      console.log('\n  Column API Response:');
      console.log('    success:', columnData.success);
      console.log('    rows count:', columnData.data?.rows?.length);

      if (columnData.success && columnData.data?.rows?.length > 0) {
        console.log('\n  ✓ Sample columns:');
        columnData.data.rows.slice(0, 5).forEach((col) => {
          console.log(`    - ${col.column_name} (${col.data_type})`);
        });
      } else {
        console.log('  ✗ No columns found or query failed');
        console.log('    Full response:', JSON.stringify(columnData, null, 2));
      }
    } else {
      console.log('✗ No assets found in response');
    }
  } catch (error) {
    console.error('Failed to fetch assets:', error.message);
  }

  // Step 5: Test with "Azure Feya" dataSourceId (the one user is trying)
  console.log('\n\nStep 5: Testing with Azure Feya dataSourceId...');
  const azureFeyaId = 'e6d1dd81-4bb2-4e2a-8fd3-e8dc662386f4';

  try {
    const url = `http://localhost:3002/api/assets?dataSourceId=${azureFeyaId}&limit=1000`;
    const response = await fetch(url);
    const data = await response.json();

    console.log(`  Assets found: ${data.data?.length || 0}`);

    if (data.data?.length === 0) {
      console.log('\n  ⚠ ROOT CAUSE FOUND:');
      console.log('  The "Azure Feya" data source has NO assets in the catalog!');
      console.log('  This is why the dropdown is empty.');
      console.log('\n  SOLUTION:');
      console.log('  1. The user needs to run a catalog scan for this data source first');
      console.log('  2. OR select a different data source that has been scanned');
    }
  } catch (error) {
    console.error('Failed:', error.message);
  }

  console.log('\n\n=== Test Complete ===\n');
}

testVisualRuleBuilderAPI().catch(console.error);
