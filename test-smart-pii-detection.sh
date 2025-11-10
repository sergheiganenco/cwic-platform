#!/bin/bash

# Test Smart PII Detection for audit_log.table_name
# This should correctly identify table_name as NOT PII

echo "Testing Smart PII Detection..."
echo "================================"
echo ""

# Get data source ID for adventureworks
DATA_SOURCE_ID="793e4fe5-db62-4aa4-8b48-c220960d85ba"

echo "Testing: public.audit_log"
echo "Expected: table_name should be NOT PII (metadata)"
echo ""

# Call PII detection endpoint
response=$(curl -s -X POST http://localhost:3000/api/catalog/pii/detect \
  -H "Content-Type: application/json" \
  -d "{
    \"dataSourceId\": \"$DATA_SOURCE_ID\",
    \"databaseName\": \"adventureworks\",
    \"schemaName\": \"public\",
    \"tableName\": \"audit_log\"
  }")

echo "Response:"
echo "$response" | jq '.'

echo ""
echo "Checking table_name column specifically..."
table_name_result=$(echo "$response" | jq '.columns[] | select(.columnName == "table_name")')

if [ -z "$table_name_result" ]; then
  echo "❌ ERROR: table_name column not found in results"
  exit 1
fi

echo "$table_name_result" | jq '.'

# Check if it's correctly identified as NOT PII
is_pii=$(echo "$table_name_result" | jq -r '.isPII')
reason=$(echo "$table_name_result" | jq -r '.reason')
confidence=$(echo "$table_name_result" | jq -r '.confidence')

echo ""
echo "Summary:"
echo "--------"
echo "Column: table_name"
echo "Is PII: $is_pii"
echo "Reason: $reason"
echo "Confidence: $confidence%"
echo ""

if [ "$is_pii" = "false" ]; then
  echo "✅ SUCCESS: table_name correctly identified as NOT PII!"
  echo "   This is a metadata field that contains table names like 'customers', 'orders', etc."
  echo "   Not personal names."
  exit 0
else
  echo "❌ FAILED: table_name incorrectly flagged as PII"
  echo "   This is a FALSE POSITIVE that needs to be fixed."
  exit 1
fi
