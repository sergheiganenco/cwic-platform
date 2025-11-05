// Test Rule Execution
const fetch = require('node-fetch');

async function testRuleExecution() {
  try {
    // First, get all rules
    console.log('Fetching rules...');
    const rulesResponse = await fetch('http://localhost:3002/api/quality/rules');
    const rulesData = await rulesResponse.json();

    console.log('Rules API response:', JSON.stringify(rulesData, null, 2));

    // Handle different response formats
    let rules = rulesData.data || rulesData.rules || rulesData;
    if (Array.isArray(rulesData)) {
      rules = rulesData;
    } else if (rulesData.data && Array.isArray(rulesData.data.rules)) {
      rules = rulesData.data.rules;
    }

    if (!rules || rules.length === 0) {
      console.log('No rules found!');
      return;
    }

    console.log(`Found ${rules.length} rules`);
    console.log('First rule:', JSON.stringify(rules[0], null, 2));

    // Execute the first rule
    const ruleId = rules[0].id;
    console.log(`\nExecuting rule: ${ruleId}`);

    const executeResponse = await fetch(`http://localhost:3002/api/quality/rules/${ruleId}/execute/v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        databaseType: 'postgresql'
      })
    });

    const executeData = await executeResponse.json();
    console.log('\nExecution result:');
    console.log(JSON.stringify(executeData, null, 2));

    if (!executeResponse.ok) {
      console.error('Execution failed with status:', executeResponse.status);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRuleExecution();
