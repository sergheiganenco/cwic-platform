const { Pool } = require('pg');

// ============================================
// UPDATE THESE VALUES WITH YOUR REAL AZURE SQL CREDENTIALS
// ============================================
const AZURE_SQL_CONFIG = {
  host: 'your-server.database.windows.net',  // <-- Replace with your Azure SQL server
  port: 1433,
  database: 'your-database',                  // <-- Replace with your database name
  username: 'your-username',                  // <-- Replace with your username
  password: 'your-password',                  // <-- Replace with your password
  options: {
    encrypt: true,                            // Azure requires encryption
    trustServerCertificate: false,            // For production, use proper certificates
    connectTimeout: 30000
  }
};

// ============================================
// For testing with local SQL Server (if you have one)
// ============================================
const LOCAL_SQL_CONFIG = {
  host: 'localhost',                          // Or your local SQL Server host
  port: 1433,
  database: 'CWIC_Demo',                      // Your local database
  username: 'sa',                             // SQL Server login
  password: 'YourStrong@Passw0rd',           // Your SQL Server password
  options: {
    encrypt: false,                           // Local might not need encryption
    trustServerCertificate: true,             // For local development
    connectTimeout: 30000
  }
};

async function updateAzureCredentials() {
  // Choose which config to use
  const USE_LOCAL_SQL = false;  // Set to true if using local SQL Server
  const config = USE_LOCAL_SQL ? LOCAL_SQL_CONFIG : AZURE_SQL_CONFIG;

  // Check if placeholder values are still there
  if (config.host.includes('your-')) {
    console.log('❌ ERROR: Please update the credentials at the top of this file!');
    console.log('');
    console.log('Steps:');
    console.log('1. Open this file: update-azure-credentials.js');
    console.log('2. Replace the placeholder values with your real Azure SQL credentials');
    console.log('3. Run this script again');
    console.log('');
    console.log('If you don\'t have Azure SQL, you can:');
    console.log('- Use a local SQL Server (set USE_LOCAL_SQL = true)');
    console.log('- Continue testing with just Postgres');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://cwic_user:cwic_secure_pass@localhost:5432/cwic_platform'
  });

  try {
    console.log('Updating Azure Feya data source configuration...');
    console.log(`Host: ${config.host}`);
    console.log(`Database: ${config.database}`);
    console.log(`Username: ${config.username}`);
    console.log('');

    // Update all Azure data sources (there might be duplicates)
    const result = await pool.query(
      `UPDATE data_sources
       SET connection_config = $1::jsonb,
           host = $2,
           port = $3,
           database_name = $4
       WHERE type = 'mssql'
         AND (name LIKE '%Azure%' OR name LIKE '%Feya%')
       RETURNING id, name`,
      [JSON.stringify(config), config.host, config.port, config.database]
    );

    if (result.rows.length > 0) {
      console.log('✅ Updated data sources:');
      result.rows.forEach(row => {
        console.log(`   - ${row.name} (${row.id})`);
      });
    } else {
      console.log('⚠️  No Azure data sources found to update');
    }

    // Test the connection
    console.log('\n📊 Testing SQL Server connection...');
    const testQuery = `
      SELECT TOP 1
        TABLE_SCHEMA,
        TABLE_NAME,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c
         WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA
           AND c.TABLE_NAME = t.TABLE_NAME) as column_count
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;

    const { createConnector } = require('./backend/data-service/src/services/connectors');

    try {
      const connector = createConnector(config);
      const result = await connector.query(testQuery);

      if (result && result.rows && result.rows.length > 0) {
        console.log('✅ Connection successful!');
        console.log(`   Found table: ${result.rows[0].TABLE_SCHEMA}.${result.rows[0].TABLE_NAME}`);
        console.log(`   Column count: ${result.rows[0].column_count}`);
      }

      await connector.disconnect();
    } catch (testError) {
      console.log('❌ Connection test failed:', testError.message);
      console.log('\nPossible issues:');
      console.log('1. Check your firewall rules in Azure');
      console.log('2. Verify the server name is correct');
      console.log('3. Ensure the user has proper permissions');
      console.log('4. Check if your IP is whitelisted in Azure SQL firewall');
    }

    console.log('\n✅ Configuration updated in database');
    console.log('\nNext steps:');
    console.log('1. Restart the data service: docker restart cwic-platform-data-service-1');
    console.log('2. Go to Data Quality page');
    console.log('3. Select "Azure Feya" data source');
    console.log('4. Open Visual Rule Builder');
    console.log('5. Tables and columns should now work!');

  } catch (error) {
    console.error('❌ Error updating configuration:', error.message);
  } finally {
    await pool.end();
  }
}

// Also create a test function
async function testAzureColumns() {
  const fetch = require('node-fetch');

  console.log('\n📊 Testing column fetch for Azure...');

  // Get the Azure data source ID
  const dsResponse = await fetch('http://localhost:3002/api/data-sources');
  const dsData = await dsResponse.json();
  const azureDs = (dsData.data || dsData).find(ds =>
    ds.type === 'mssql' && (ds.name.includes('Azure') || ds.name.includes('Feya'))
  );

  if (!azureDs) {
    console.log('❌ No Azure data source found');
    return;
  }

  console.log(`Found Azure data source: ${azureDs.name} (${azureDs.id})`);

  // Test column query
  const testQuery = `
    SELECT TOP 5 column_name, data_type
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = 'customers'
  `;

  const response = await fetch('http://localhost:3002/data/execute-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataSourceId: azureDs.id,
      database: azureDs.database_name || 'CWIC_Demo',
      query: testQuery
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('✅ Column query successful!');
    console.log(`   Found ${data.rows?.length || 0} columns`);
    if (data.rows && data.rows.length > 0) {
      console.log('   Sample columns:');
      data.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    }
  } else {
    console.log('❌ Column query failed:', data.error);
  }
}

// Run the update
updateAzureCredentials()
  .then(() => testAzureColumns())
  .catch(console.error);