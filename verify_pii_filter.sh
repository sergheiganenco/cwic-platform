#!/bin/bash
# Verify PII Filter Data Integrity

echo "=== PII Filter Verification ==="
echo ""

echo "1. Checking Database State..."
docker exec -i cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
SELECT
  pii_detected,
  COUNT(*) as table_count
FROM catalog_assets
GROUP BY pii_detected
ORDER BY pii_detected DESC NULLS LAST;
" 2>/dev/null

echo ""
echo "2. Checking API Response (cwic_platform database)..."
curl -s "http://localhost:3002/api/assets?dataSourceId=793e4fe5-db62-4aa4-8b48-c220960d85ba&limit=100" | python -c "
import sys, json
data = json.load(sys.stdin)
total = len(data['data'])
with_pii = sum(1 for a in data['data'] if a.get('piiDetected') == True)
without_pii = sum(1 for a in data['data'] if a.get('piiDetected') == False)
print(f'  Total assets: {total}')
print(f'  With PII: {with_pii}')
print(f'  Without PII: {without_pii}')
" 2>/dev/null

echo ""
echo "3. Tables with PII (should be 8 total across all databases)..."
docker exec -i cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
SELECT
  database_name,
  table_name,
  (SELECT COUNT(*) FROM catalog_columns cc WHERE cc.asset_id = ca.id AND cc.pii_type IS NOT NULL) as pii_count
FROM catalog_assets ca
WHERE pii_detected = true
ORDER BY database_name, table_name;
" 2>/dev/null

echo ""
echo "4. Verification - Any tables marked as PII but have no PII columns?"
docker exec -i cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
SELECT COUNT(*) as false_positives
FROM catalog_assets ca
WHERE pii_detected = true
  AND NOT EXISTS (
    SELECT 1 FROM catalog_columns cc
    WHERE cc.asset_id = ca.id AND cc.pii_type IS NOT NULL
  );
" 2>/dev/null

echo ""
echo "=== Status ==="
echo "If database shows 8 tables with PII: ✅ Database is correct"
echo "If API shows 0 with PII for cwic_platform: ✅ API is correct (cwic_platform has no PII)"
echo "If false_positives = 0: ✅ All flags are accurate"
echo ""
echo "If UI still shows wrong data after this → Clear browser cache!"
echo "  Windows/Linux: Ctrl + Shift + R"
echo "  Mac: Cmd + Shift + R"
echo "  Or: F12 → Application → Clear Storage → Clear site data"
