const fetch = require('node-fetch');

async function testAzureAPI() {
  const dataSourceId = 'af910adf-c7c1-4573-9eec-93f05f0970b7';
  const url = `http://localhost:3002/api/assets?dataSourceId=${dataSourceId}&limit=10`;

  console.log('Testing URL:', url);
  console.log('');

  const response = await fetch(url);
  const data = await response.json();

  console.log('Full Response:', JSON.stringify(data, null, 2));
  console.log('');
  console.log('Analysis:');
  console.log('- success:', data.success);
  console.log('- data is array:', Array.isArray(data.data));
  console.log('- data has assets property:', !!data.data?.assets);
  console.log('- data.data:', data.data);

  if (data.data) {
    console.log('- data.data type:', typeof data.data);
    console.log('- data.data keys:', Object.keys(data.data));
  }
}

testAzureAPI().catch(console.error);