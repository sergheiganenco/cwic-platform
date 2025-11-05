const fetch = require('node-fetch');

(async () => {
  try {
    const response = await fetch('http://localhost:3002/api/data-sources');
    const result = await response.json();
    const data = result.dataSources || result;

    console.log('Active Data Sources visible in UI:');
    console.log('==================================\n');

    (Array.isArray(data) ? data : [data])
      .filter(ds => !ds.deleted_at)
      .forEach(ds => {
        console.log(`Name: ${ds.name}`);
        console.log(`  ID: ${ds.id}`);
        console.log(`  Database: ${ds.database_name || 'N/A'}`);
        console.log(`  Type: ${ds.type}`);
        console.log('');
      });
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
