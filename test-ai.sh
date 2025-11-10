#!/bin/bash
# Quick test script for AI Assistant

echo "🧪 Testing AI Assistant..."
echo ""

# Test 1: Enhanced Query
echo "1️⃣ Testing Enhanced Query about tables..."
curl -s -X POST http://localhost:3000/api/ai/discovery/enhanced-query \
  -H "Content-Type: application/json" \
  -d '{"query": "What tables do we have in the database?"}' | python -m json.tool | head -40

echo ""
echo "---"
echo ""

# Test 2: Natural Language SQL
echo "2️⃣ Testing Natural Language to SQL..."
curl -s -X POST http://localhost:3000/api/ai/discovery/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all pipeline related tables"}' | python -m json.tool | head -40

echo ""
echo "---"
echo ""

# Test 3: Quality Analysis
echo "3️⃣ Testing Quality Analysis..."
curl -s -X POST http://localhost:3000/api/ai/discovery/enhanced-query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the data quality issues?"}' | python -m json.tool | head -40

echo ""
echo "✅ Tests complete!"
echo ""
echo "💡 Look for 'isAiGenerated: true' in the responses to confirm OpenAI is working"
echo "💡 If you see 'AI service not available' or 'isAiGenerated: false', the key might not be configured correctly"
