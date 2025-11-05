const { Pool } = require('pg');

async function fixDataSourceConfigs() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://cwic_user:cwic_secure_pass@localhost:5432/cwic_platform'
  });

  try {
    // Update Postgres data source
    const postgresConfig = {
      host: 'cwic-platform-db-1',
      port: 5432,
      database: 'cwic_platform',
      username: 'cwic_user',
      password: 'cwic_secure_pass'
    };

    await pool.query(
      `UPDATE data_sources
       SET connection_config = $1::jsonb,
           host = $2,
           port = $3,
           database_name = $4
       WHERE id = '793e4fe5-db62-4aa4-8b48-c220960d85ba'`,
      [JSON.stringify(postgresConfig), postgresConfig.host, postgresConfig.port, postgresConfig.database]
    );
    console.log('✅ Updated Postgres data source configuration');

    // Check if Azure Feya has any existing config
    const azureResult = await pool.query(
      `SELECT connection_config FROM data_sources WHERE id = 'af910adf-c7c1-4573-9eec-93f05f0970b7'`
    );

    if (azureResult.rows.length > 0) {
      // If Azure doesn't have config, we'll create a dummy one for now
      // In production, you'd get real Azure SQL credentials
      const azureConfig = {
        host: 'your-azure-server.database.windows.net',
        port: 1433,
        database: 'CWIC_Demo',
        username: 'your-username',
        password: 'your-password',
        options: {
          encrypt: true,
          trustServerCertificate: false
        }
      };

      await pool.query(
        `UPDATE data_sources
         SET connection_config = $1::jsonb,
             host = $2,
             port = $3,
             database_name = $4
         WHERE id = 'af910adf-c7c1-4573-9eec-93f05f0970b7'`,
        [JSON.stringify(azureConfig), azureConfig.host, azureConfig.port, azureConfig.database]
      );
      console.log('✅ Updated Azure Feya data source with placeholder configuration');
      console.log('   NOTE: You need to update with real Azure SQL credentials');
    }

    // Verify the updates
    const result = await pool.query(
      `SELECT name, type, host, port, database_name
       FROM data_sources
       WHERE id IN ('793e4fe5-db62-4aa4-8b48-c220960d85ba', 'af910adf-c7c1-4573-9eec-93f05f0970b7')`
    );

    console.log('\nCurrent configurations:');
    result.rows.forEach(row => {
      console.log(`- ${row.name} (${row.type}): ${row.host}:${row.port}/${row.database_name}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixDataSourceConfigs();