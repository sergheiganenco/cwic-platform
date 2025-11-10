#!/bin/bash

echo "================================================================"
echo "PII Fix Verification Script"
echo "================================================================"
echo ""

echo "1. Checking database - schema_name column status..."
docker exec cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
  SELECT
    ca.table_name,
    cc.column_name,
    CASE WHEN cc.pii_type IS NULL THEN '✅ NOT PII' ELSE '❌ IS PII: ' || cc.pii_type END as pii_status,
    CASE WHEN cc.is_sensitive THEN '❌ SENSITIVE' ELSE '✅ NOT SENSITIVE' END as sensitivity,
    CASE WHEN cc.quality_issues::text = '[]' THEN '✅ NO ISSUES' ELSE '❌ HAS ISSUES' END as issues
  FROM catalog_columns cc
  JOIN catalog_assets ca ON cc.asset_id = ca.id
  WHERE cc.column_name = 'schema_name'
  LIMIT 5;
" 2>/dev/null

echo ""
echo "2. Checking total Person Name PII columns (should be 10)..."
docker exec cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
  SELECT COUNT(*) as person_name_pii_columns
  FROM catalog_columns
  WHERE pii_type = 'NAME';
" 2>/dev/null

echo ""
echo "3. Checking for open PII quality issues (should be 0)..."
docker exec cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
  SELECT COUNT(*) as open_pii_issues
  FROM quality_issues
  WHERE status IN ('open', 'acknowledged')
    AND (title ILIKE '%PII%' OR title ILIKE '%unencrypted%');
" 2>/dev/null

echo ""
echo "4. Listing legitimate PII columns..."
docker exec cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
  SELECT
    ca.schema_name,
    ca.table_name,
    cc.column_name
  FROM catalog_columns cc
  JOIN catalog_assets ca ON cc.asset_id = ca.id
  WHERE cc.pii_type = 'NAME'
  ORDER BY ca.schema_name, ca.table_name;
" 2>/dev/null

echo ""
echo "================================================================"
echo "Verification Complete"
echo "================================================================"
echo ""
echo "Expected Results:"
echo "✅ schema_name columns: NOT PII, NOT SENSITIVE, NO ISSUES"
echo "✅ Total Person Name PII columns: 10"
echo "✅ Open PII quality issues: 0"
echo ""
echo "If all checks pass, do a hard refresh in your browser:"
echo "  Windows: Ctrl + Shift + R"
echo "  Mac: Cmd + Shift + R"
echo ""
