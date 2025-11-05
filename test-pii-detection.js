#!/usr/bin/env node
/**
 * Test PII Detection API
 */

const http = require('http');

// Test 1: Detect PII in email column
function testDetectColumnPII() {
  console.log('\n🧪 Test 1: Detect PII in email column');

  const postData = JSON.stringify({
    dataSourceId: 'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
    schema: 'public',
    table: 'customers',
    column: 'email',
    sampleSize: 100
  });

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/quality/pii/detect/column',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      try {
        const result = JSON.parse(data);
        console.log('Response:', JSON.stringify(result, null, 2));

        if (result.success && result.data) {
          console.log('\n✅ Email PII Detection Results:');
          console.log(`   Column: ${result.data.columnName}`);
          console.log(`   PII Type: ${result.data.piiType || 'None detected'}`);
          console.log(`   Confidence: ${result.data.confidence}`);
          console.log(`   Sensitivity: ${result.data.sensitivity || 'N/A'}`);
          console.log(`   Sample Values: ${result.data.sampleCount}`);
          console.log(`   Compliance: ${result.data.complianceFlags?.join(', ') || 'N/A'}`);
        }
      } catch (e) {
        console.error('Error parsing response:', data);
      }

      // Test 2: Detect PII in entire table
      setTimeout(() => testDetectTablePII(), 1000);
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Request failed: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

// Test 2: Detect PII in entire table
function testDetectTablePII() {
  console.log('\n🧪 Test 2: Detect PII in all columns of customers table');

  const postData = JSON.stringify({
    dataSourceId: 'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
    schema: 'public',
    table: 'customers'
  });

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/quality/pii/detect/table',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      try {
        const result = JSON.parse(data);

        if (result.success && result.data) {
          console.log(`\n✅ Found ${result.count} columns analyzed:`);
          result.data.forEach(col => {
            if (col.piiType) {
              console.log(`   📍 ${col.columnName}:`);
              console.log(`      Type: ${col.piiType}`);
              console.log(`      Confidence: ${col.confidence}`);
              console.log(`      Sensitivity: ${col.sensitivity}`);
              console.log(`      Compliance: ${col.complianceFlags?.join(', ')}`);
            }
          });
        } else {
          console.log('Response:', JSON.stringify(result, null, 2));
        }
      } catch (e) {
        console.error('Error parsing response:', data);
      }

      // Test 3: Sample data with masking
      setTimeout(() => testSampleData(), 1000);
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Request failed: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

// Test 3: Sample column data with masking
function testSampleData() {
  console.log('\n🧪 Test 3: Sample email column with PII masking');

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/quality/pii/sample?schema=public&table=customers&column=email&sampleSize=10&maskPII=true',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      try {
        const result = JSON.parse(data);

        if (result.success && result.data) {
          console.log('\n✅ Sample Data with Masking:');
          console.log(`   Column: ${result.data.columnName}`);
          console.log(`   Has PII: ${result.data.hasPII}`);
          console.log(`   PII Type: ${result.data.piiType || 'None'}`);
          console.log('\n   Masked Values:');
          result.data.maskedValues?.slice(0, 5).forEach((val, i) => {
            console.log(`   ${i + 1}. ${val}`);
          });
        } else {
          console.log('Response:', JSON.stringify(result, null, 2));
        }
      } catch (e) {
        console.error('Error parsing response:', data);
      }

      console.log('\n✅ PII Detection API tests completed!');
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Request failed: ${e.message}`);
  });

  req.end();
}

// Start tests
console.log('🚀 Starting PII Detection API Tests...');
testDetectColumnPII();
