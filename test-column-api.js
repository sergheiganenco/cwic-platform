const fetch = require('node-fetch');

async function testColumnAPI() {
  const dataSourceId = 'af910adf-c7c1-4573-9eec-93f05f0970b7'; // Azure Feya
  const tableName = 'customers';
  const schemaName = 'dbo';
  const database = 'CWIC_Demo';

  const url = 'http://localhost:3002/data/execute-query';
  const body = {
    dataSourceId: dataSourceId,
    database: database,
    query: `
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE table_schema = '${schemaName}'
        AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `
  };

  console.log('Testing Column API');
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

testColumnAPI();