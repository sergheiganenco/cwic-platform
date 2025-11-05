const fetch = require('node-fetch');

async function testPostgresColumns() {
  const dataSourceId = '793e4fe5-db62-4aa4-8b48-c220960d85ba'; // Postgres
  const tableName = 'catalog_assets';
  const schemaName = 'public';
  const database = 'cwic_platform'; // Postgres database

  const url = 'http://localhost:3002/data/execute-query';
  const body = {
    dataSourceId: dataSourceId,
    database: database,
    query: `
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = '${schemaName}'
        AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `
  };

  console.log('Testing Postgres Column API');
  console.log('URL:', url);
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success && data.data) {
      console.log('\nColumns found:');
      data.data.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPostgresColumns();