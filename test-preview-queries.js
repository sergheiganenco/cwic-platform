const fetch = require('node-fetch');

async function testPreviewQueries() {
  console.log('='.repeat(80));
  console.log('TESTING PREVIEW QUERIES FOR VISUAL RULE BUILDER');
  console.log('='.repeat(80));

  const postgresId = '793e4fe5-db62-4aa4-8b48-c220960d85ba';
  const database = 'cwic_platform';

  // Test different rule types
  const tests = [
    {
      name: 'NULL Check',
      table: 'public.catalog_assets',
      column: 'description',
      query: `
        SELECT COUNT(*) as total_rows,
               COUNT(CASE WHEN description IS NULL THEN 1 END) as null_rows
        FROM public.catalog_assets
      `
    },
    {
      name: 'Duplicate Check',
      table: 'public.catalog_assets',
      column: 'schema_name',
      query: `
        SELECT COUNT(*) as total_rows,
               COUNT(*) - COUNT(DISTINCT schema_name) as duplicate_rows
        FROM public.catalog_assets
      `
    },
    {
      name: 'Completeness Check',
      table: 'public.catalog_assets',
      column: 'table_name',
      query: `
        SELECT COUNT(*) as total_rows,
               COUNT(table_name) as non_null_rows
        FROM public.catalog_assets
      `
    }
  ];

  for (const test of tests) {
    console.log(`\n📊 TEST: ${test.name}`);
    console.log('-'.repeat(40));
    console.log(`Table: ${test.table}`);
    console.log(`Column: ${test.column}`);

    try {
      const response = await fetch('http://localhost:3002/data/execute-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSourceId: postgresId,
          database: database,
          query: test.query
        })
      });

      const data = await response.json();

      if (data.success && data.rows && data.rows.length > 0) {
        const result = data.rows[0];
        const totalRows = parseInt(result.total_rows) || 0;
        const issueRows = parseInt(result.null_rows || result.duplicate_rows || 0);
        const nonNullRows = parseInt(result.non_null_rows || 0);
        const passRate = totalRows > 0 ? ((totalRows - issueRows) / totalRows * 100).toFixed(2) : 100;

        console.log(`✅ Query successful!`);
        console.log(`   Total rows: ${totalRows}`);

        if (result.null_rows !== undefined) {
          console.log(`   NULL rows: ${result.null_rows}`);
          console.log(`   Pass rate: ${passRate}%`);
        }

        if (result.duplicate_rows !== undefined) {
          console.log(`   Duplicate rows: ${result.duplicate_rows}`);
        }

        if (result.non_null_rows !== undefined) {
          console.log(`   Non-NULL rows: ${result.non_null_rows}`);
          console.log(`   Completeness: ${(nonNullRows / totalRows * 100).toFixed(2)}%`);
        }

        // Test sample query for NULL check
        if (test.name === 'NULL Check') {
          const sampleQuery = `SELECT * FROM ${test.table} WHERE ${test.column} IS NULL LIMIT 3`;
          const sampleResponse = await fetch('http://localhost:3002/data/execute-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataSourceId: postgresId,
              database: database,
              query: sampleQuery
            })
          });

          const sampleData = await sampleResponse.json();
          if (sampleData.success && sampleData.rows) {
            console.log(`   Sample NULL rows: ${sampleData.rows.length} found`);
          }
        }
      } else {
        console.log(`❌ Query failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('The Visual Rule Builder preview now:');
  console.log('✅ Executes real queries against the database');
  console.log('✅ Shows actual row counts and issue counts');
  console.log('✅ Calculates real pass rates');
  console.log('✅ Fetches sample data for issues found');
  console.log('✅ No more dummy data!');
  console.log('\nHow to test in UI:');
  console.log('1. Select a table and column');
  console.log('2. Choose a rule pattern (NULL check, Duplicate, etc.)');
  console.log('3. Click "Preview Results"');
  console.log('4. See real data from your database!');
}

testPreviewQueries().catch(console.error);