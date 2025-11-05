// Check which data sources have catalog assets
const fetch = require('node-fetch');

async function checkCatalogAssets() {
  try {
    // 1. Get all data sources
    console.log('Fetching data sources...');
    const sourcesResponse = await fetch('http://localhost:3002/api/data-sources');
    const sourcesData = await sourcesResponse.json();
    const sources = sourcesData.data || sourcesData;

    console.log(`\nFound ${sources.length} data sources:\n`);
    console.log('='.repeat(60));

    // 2. Check assets for each data source
    for (const source of sources) {
      const assetsResponse = await fetch(`http://localhost:3002/api/assets?dataSourceId=${source.id}&limit=1000`);
      const assetsData = await assetsResponse.json();

      const assetCount = assetsData.data ? assetsData.data.length : 0;
      const status = assetCount > 0 ? '✅ SCANNED' : '❌ NOT SCANNED';

      console.log(`${status} ${source.name} (${source.type})`);
      console.log(`  ID: ${source.id}`);
      console.log(`  Assets: ${assetCount}`);

      if (assetCount > 0) {
        // Show first 3 tables
        const tables = assetsData.data.slice(0, 3);
        console.log('  Sample tables:');
        tables.forEach(t => {
          console.log(`    - ${t.schemaName}.${t.tableName}`);
        });
      }
      console.log();
    }

    console.log('='.repeat(60));
    console.log('\nSUMMARY:');
    console.log('- Sources with ✅ will show tables in dropdown');
    console.log('- Sources with ❌ need catalog scan first');
    console.log('\nTo fix ❌ sources:');
    console.log('1. Go to Data Catalog');
    console.log('2. Select the data source');
    console.log('3. Click "Scan Source"');
    console.log('4. Wait for scan to complete');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCatalogAssets();