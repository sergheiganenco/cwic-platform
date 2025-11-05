const fetch = require('node-fetch');

async function checkAllDataSources() {
  try {
    console.log('='.repeat(80));
    console.log('DATA SOURCE STATUS CHECK');
    console.log('='.repeat(80));

    const response = await fetch('http://localhost:3002/api/data-sources');
    const data = await response.json();
    const sources = data.data || data;

    for (const source of sources) {
      console.log(`\n📊 ${source.name} (${source.type})`);
      console.log(`   ID: ${source.id}`);

      // Check if connection config exists
      const hasConfig = source.connection_config || source.host;
      console.log(`   Config: ${hasConfig ? '✅ Configured' : '❌ Not configured'}`);

      // Check catalog assets
      const assetsResponse = await fetch(`http://localhost:3002/catalog/assets?dataSourceId=${source.id}&limit=5`);
      const assetsData = await assetsResponse.json();
      const assetCount = assetsData.data?.assets?.length || 0;
      const totalAssets = assetsData.data?.total || 0;

      console.log(`   Catalog: ${totalAssets > 0 ? `✅ ${totalAssets} assets` : '❌ Not scanned'}`);

      // Test column query for first table if available
      if (assetCount > 0) {
        const firstTable = assetsData.data.assets.find(a => a.type === 'table');
        if (firstTable) {
          const columnTestBody = {
            dataSourceId: source.id,
            database: firstTable.databaseName || source.database_name,
            query: `
              SELECT column_name, data_type
              FROM ${source.type === 'postgresql' ? 'information_schema.columns' : 'INFORMATION_SCHEMA.COLUMNS'}
              WHERE table_schema = '${firstTable.schemaName}'
                AND table_name = '${firstTable.tableName}'
              LIMIT 1
            `
          };

          try {
            const columnResponse = await fetch('http://localhost:3002/data/execute-query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(columnTestBody)
            });
            const columnData = await columnResponse.json();

            if (columnData.success) {
              console.log(`   Columns: ✅ Query works`);
            } else {
              console.log(`   Columns: ❌ ${columnData.error?.substring(0, 50)}...`);
            }
          } catch (err) {
            console.log(`   Columns: ❌ Failed to test`);
          }
        }
      }

      // Summary
      if (hasConfig && totalAssets > 0) {
        console.log(`   Status: ✅ READY FOR USE`);
      } else if (!hasConfig) {
        console.log(`   Status: ⚠️  NEEDS CONNECTION CONFIG`);
      } else if (totalAssets === 0) {
        console.log(`   Status: ⚠️  NEEDS CATALOG SCAN`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATIONS:');
    console.log('1. Use Postgres data source for testing (fully configured)');
    console.log('2. Update Azure credentials if you need to test with SQL Server');
    console.log('3. Run catalog scan if assets are missing');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllDataSources();