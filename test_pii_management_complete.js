// Comprehensive test for Mark as PII and Mark as NOT PII features
const { Pool } = require('pg');
const http = require('http');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://cwic_user:cwic_password@localhost:5432/cwic_platform'
});

const API_BASE = 'http://localhost:3002';

// Helper function to make HTTP requests
function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test 1: Mark Gender column as PII
async function testMarkAsPII() {
  console.log('\n🧪 Test 1: Mark Gender column as "email" PII');
  console.log('='.repeat(60));

  // Get Gender column info
  const { rows: before } = await pool.query(`
    SELECT cc.id, cc.column_name, cc.pii_type, cc.is_sensitive, ca.table_name, ca.id as asset_id
    FROM catalog_columns cc
    JOIN catalog_assets ca ON ca.id = cc.asset_id
    WHERE cc.column_name = 'Gender' AND ca.table_name = 'User'
    LIMIT 1
  `);

  if (before.length === 0) {
    console.log('❌ Gender column not found');
    return false;
  }

  const column = before[0];
  console.log('📋 Before:', { id: column.id, column_name: column.column_name, pii_type: column.pii_type });

  // Mark as PII via API
  const response = await makeRequest('PATCH', `/catalog/columns/${column.id}`, {
    pii_type: 'email',
    data_classification: 'email',
    is_sensitive: true,
  });

  console.log('📡 API Response:', response.status, response.data.pii_type);

  if (response.status !== 200) {
    console.log('❌ API request failed:', response);
    return false;
  }

  // Verify in database
  const { rows: after } = await pool.query(`
    SELECT id, column_name, pii_type, is_sensitive
    FROM catalog_columns
    WHERE id = $1
  `, [column.id]);

  console.log('📋 After:', { id: after[0].id, column_name: after[0].column_name, pii_type: after[0].pii_type });

  if (after[0].pii_type === 'email' && after[0].is_sensitive === true) {
    console.log('✅ Mark as PII PASSED');
    return { columnId: column.id, assetId: column.asset_id };
  } else {
    console.log('❌ Mark as PII FAILED - pii_type:', after[0].pii_type);
    return false;
  }
}

// Test 2: Mark column as NOT PII
async function testMarkAsNotPII(columnInfo) {
  console.log('\n🧪 Test 2: Mark Gender column as NOT PII');
  console.log('='.repeat(60));

  // Count exclusions before
  const { rows: exclusionsBefore } = await pool.query(`
    SELECT COUNT(*) as count FROM pii_exclusions WHERE column_name = 'Gender'
  `);
  console.log('📋 Exclusions before:', exclusionsBefore[0].count);

  // Get email PII rule
  const { rows: rules } = await pool.query(`
    SELECT id FROM pii_rule_definitions WHERE pii_type = 'email'
  `);

  if (rules.length === 0) {
    console.log('❌ Email PII rule not found');
    return false;
  }

  // Mark as NOT PII via API
  const response = await makeRequest('POST', '/api/pii-exclusions/mark-not-pii', {
    columnId: columnInfo.columnId,
    assetId: columnInfo.assetId,
    columnName: 'Gender',
    tableName: 'User',
    schemaName: 'dbo',
    databaseName: 'Feya_DB',
    piiType: 'email',
  });

  console.log('📡 API Response:', response.status, response.data.success ? 'SUCCESS' : 'FAILED');

  if (response.status !== 200 || !response.data.success) {
    console.log('❌ API request failed:', response);
    return false;
  }

  const exclusionId = response.data.data?.exclusionId;
  console.log('📋 Exclusion ID:', exclusionId);

  // Verify column cleared
  const { rows: column } = await pool.query(`
    SELECT id, column_name, pii_type, is_sensitive
    FROM catalog_columns
    WHERE id = $1
  `, [columnInfo.columnId]);

  console.log('📋 Column after:', { pii_type: column[0].pii_type, is_sensitive: column[0].is_sensitive });

  // Verify exclusion created
  const { rows: exclusion } = await pool.query(`
    SELECT id, column_name, table_name, pii_rule_id
    FROM pii_exclusions
    WHERE id = $1
  `, [exclusionId]);

  console.log('📋 Exclusion exists:', exclusion.length > 0 ? 'YES' : 'NO');

  if (column[0].pii_type === null && column[0].is_sensitive === false && exclusion.length > 0) {
    console.log('✅ Mark as NOT PII PASSED');
    return true;
  } else {
    console.log('❌ Mark as NOT PII FAILED');
    console.log('   - pii_type cleared:', column[0].pii_type === null);
    console.log('   - is_sensitive cleared:', column[0].is_sensitive === false);
    console.log('   - exclusion created:', exclusion.length > 0);
    return false;
  }
}

// Test 3: Verify exclusion persists
async function testExclusionPersistence() {
  console.log('\n🧪 Test 3: Verify exclusion persists');
  console.log('='.repeat(60));

  const { rows: exclusions } = await pool.query(`
    SELECT id, column_name, table_name, schema_name, pii_rule_id, created_at
    FROM pii_exclusions
    WHERE column_name = 'Gender'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (exclusions.length > 0) {
    console.log('📋 Exclusion found:', {
      id: exclusions[0].id,
      column_name: exclusions[0].column_name,
      table_name: exclusions[0].table_name,
    });
    console.log('✅ Exclusion persistence PASSED');
    return true;
  } else {
    console.log('❌ Exclusion persistence FAILED - no exclusion found');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting PII Management Tests');
  console.log('='.repeat(60));

  try {
    const test1Result = await testMarkAsPII();
    if (!test1Result) {
      console.log('\n❌ Test 1 failed - stopping tests');
      process.exit(1);
    }

    const test2Result = await testMarkAsNotPII(test1Result);
    if (!test2Result) {
      console.log('\n❌ Test 2 failed - stopping tests');
      process.exit(1);
    }

    const test3Result = await testExclusionPersistence();
    if (!test3Result) {
      console.log('\n❌ Test 3 failed - stopping tests');
      process.exit(1);
    }

    console.log('\n🎉 ALL TESTS PASSED! 🎉');
    console.log('='.repeat(60));
    console.log('\n✅ Mark as PII: WORKING');
    console.log('✅ Mark as NOT PII: WORKING');
    console.log('✅ Exclusions: PERSISTING');
    console.log('\n🏆 PII Management is fully functional!');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
runAllTests();
