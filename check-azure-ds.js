const fetch = require('node-fetch');

async function checkDataSource() {
  try {
    const response = await fetch('http://localhost:3002/api/data-sources');
    const data = await response.json();

    const azureDs = (data.data || data).find(ds => ds.id === 'af910adf-c7c1-4573-9eec-93f05f0970b7');

    if (azureDs) {
      console.log('Azure Data Source Found:');
      console.log('Name:', azureDs.name);
      console.log('Type:', azureDs.type);
      console.log('Host:', azureDs.host);
      console.log('Port:', azureDs.port);
      console.log('Database:', azureDs.database_name);
      console.log('Connection Config:', JSON.stringify(azureDs.connection_config, null, 2));
    } else {
      console.log('Azure data source not found!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDataSource();