#!/usr/bin/env node
// Verification script to check which component is being rendered

const http = require('http');

console.log('========================================');
console.log('UI Component Verification');
console.log('========================================\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/data-quality',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✓ Page loaded successfully (HTTP ' + res.statusCode + ')\n');

    // Check for component identifiers in the HTML
    const checks = {
      'ModernRulesHubFixed component': data.includes('Production-ready data quality rules with AI learning'),
      'React app loaded': data.includes('id="root"'),
      'Vite client loaded': data.includes('@vite/client'),
    };

    console.log('Component Detection:');
    Object.entries(checks).forEach(([name, found]) => {
      console.log(`  ${found ? '✓' : '✗'} ${name}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    });

    console.log('\n========================================');
    console.log('Next Steps:');
    console.log('========================================');
    console.log('1. Open DevTools (F12)');
    console.log('2. Go to Network tab');
    console.log('3. Check "Disable cache" checkbox');
    console.log('4. Hard refresh: Ctrl+Shift+R');
    console.log('\nOR open Incognito mode: Ctrl+Shift+N');
    console.log('Then visit: http://localhost:3000/data-quality');
    console.log('========================================\n');
  });
});

req.on('error', (error) => {
  console.error('✗ Error:', error.message);
  console.log('\nMake sure dev server is running: npm run dev');
});

req.end();
