// Test Multi-Dialect SQL Translation
const fetch = require('node-fetch');

async function testMultiDialect() {
  try {
    console.log('='.repeat(60));
    console.log('MULTI-DIALECT SQL TRANSLATION TEST');
    console.log('='.repeat(60));

    // Get data sources
    console.log('\n1. Fetching data sources...');
    const sourcesResponse = await fetch('http://localhost:3002/api/data-sources');
    const sourcesData = await sourcesResponse.json();
    const sources = sourcesData.data || sourcesData;

    console.log(`\nFound ${sources.length} data sources:`);
    sources.forEach(s => {
      console.log(`  - ${s.name} (${s.type})`);
    });

    // Get rules by data source type
    console.log('\n2. Checking rules by source type...');
    const rulesResponse = await fetch('http://localhost:3002/api/quality/rules');
    const rulesData = await rulesResponse.json();
    const rules = rulesData.data?.rules || rulesData.data || rulesData;

    // Group rules by data source type
    const rulesByType = {};
    for (const rule of rules.slice(0, 50)) {  // Check first 50 rules
      if (!rule.data_source_id) continue;

      const source = sources.find(s => s.id === rule.data_source_id);
      if (!source) continue;

      const type = source.type;
      if (!rulesByType[type]) {
        rulesByType[type] = [];
      }
      rulesByType[type].push(rule);
    }

    console.log('\nRules by database type:');
    Object.keys(rulesByType).forEach(type => {
      console.log(`  ${type}: ${rulesByType[type].length} rules`);
    });

    // Test execution on different types
    console.log('\n3. Testing rule execution across different databases...\n');

    for (const [type, typeRules] of Object.entries(rulesByType)) {
      if (typeRules.length === 0) continue;

      const testRule = typeRules[0];
      console.log(`\nTesting ${type.toUpperCase()}:`);
      console.log(`  Rule: ${testRule.name}`);
      console.log(`  Rule Dialect: ${testRule.dialect || 'postgres'}`);
      console.log(`  Target DB: ${type}`);

      // Check if translation would be needed
      const ruleDialect = testRule.dialect || 'postgres';
      const needsTranslation = ruleDialect !== type &&
                               (ruleDialect === 'postgres' || type === 'mssql');

      console.log(`  Translation: ${needsTranslation ? '✅ YES (auto)' : '❌ NO (same dialect)'}`);

      // Show SQL snippet
      if (testRule.expression) {
        const sqlPreview = testRule.expression.substring(0, 80);
        console.log(`  SQL: ${sqlPreview}${testRule.expression.length > 80 ? '...' : ''}`);

        // Check for PostgreSQL-specific syntax
        const hasFilter = /FILTER\s*\(/i.test(testRule.expression);
        const hasDoubleQuotes = /"[^"]+"/g.test(testRule.expression);
        const hasTypecast = /::/g.test(testRule.expression);

        if (needsTranslation && (hasFilter || hasDoubleQuotes || hasTypecast)) {
          console.log(`  🔧 Contains syntax that will be translated:`);
          if (hasFilter) console.log(`     - FILTER (WHERE ...) → SUM(CASE WHEN ...)`);
          if (hasDoubleQuotes) console.log(`     - "identifiers" → [identifiers]`);
          if (hasTypecast) console.log(`     - ::type → AS type`);
        }
      }

      // Execute the rule
      try {
        console.log(`  Executing...`);
        const executeResponse = await fetch(
          `http://localhost:3002/api/quality/rules/${testRule.id}/execute/v2`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ databaseType: type })
          }
        );

        const result = await executeResponse.json();

        if (result.success) {
          console.log(`  ✅ Execution: ${result.data.status}`);
          console.log(`  ⏱️  Time: ${result.data.executionTimeMs}ms`);
          if (result.data.errorMessage) {
            console.log(`  ⚠️  Error: ${result.data.errorMessage}`);
          }
        } else {
          console.log(`  ❌ Execution failed`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMultiDialect();
