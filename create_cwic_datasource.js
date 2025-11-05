const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass'
});

(async () => {
  try {
    console.log('Creating data source for cwic_platform database...\n');

    const dataSourceId = uuidv4();

    await pool.query(`
      INSERT INTO data_sources (
        id,
        name,
        type,
        host,
        port,
        database_name,
        username,
        ssl,
        status,
        created_by,
        public_id
      ) VALUES (
        $1,
        'CWIC Platform',
        'postgresql',
        'localhost',
        5432,
        'cwic_platform',
        'cwic_user',
        false,
        'connected',
        'system',
        $2
      )
    `, [dataSourceId, `ds_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`]);

    console.log('✅ Created data source for cwic_platform');
    console.log(`   ID: ${dataSourceId}`);
    console.log(`   Name: CWIC Platform`);
    console.log(`   Database: cwic_platform`);
    console.log('');
    console.log('Next step: Re-run execute_quality_rules.js to update data_source_id for cwic_platform results');

    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
