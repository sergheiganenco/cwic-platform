# Critical Alerts Fix - Empty Tables Issue

## Problem Summary

**Issue**: Critical alerts were showing ONLY for empty tables (tables with 0 rows)

**Root Cause**: All 136 quality rules in the database were "completeness" checks with the description "Table should contain at least one row". When these rules failed, they created alerts, but these alerts aren't actionable data quality issues - they're just empty table notifications.

## Solution Implemented

### Changes Made

**File**: `backend/data-service/src/controllers/QualityController.ts`

**Line 940-942** - Added filters to exclude empty table checks:
```sql
AND qr.description NOT ILIKE '%should contain at least one row%'
AND qr.description NOT ILIKE '%table is empty%'
AND COALESCE(qres.rows_failed, 0) > 0
```

**Line 996** - Fixed auto-fix availability logic:
```typescript
// Before (incorrect):
autoFixAvailable: row.severity === 'high' && rowsFailed === 0

// After (correct):
autoFixAvailable: row.severity === 'high' && rowsFailed > 0
```

### Testing

**Before the fix**:
```bash
curl "http://localhost:3002/api/quality/critical-alerts?limit=5"
# Returns 5 alerts, all for empty tables
```

**After the fix**:
```bash
curl "http://localhost:3002/api/quality/critical-alerts?limit=5"
# Returns 0 alerts (because only empty table checks exist)
```

## Next Steps: Creating Real Quality Rules

To see meaningful critical alerts, you need to create quality rules that check for actual data quality issues. Here are some examples:

### 1. NULL Value Checks (Completeness)
```sql
-- Check for NULL values in important columns
SELECT
  (COUNT(*) FILTER (WHERE email IS NULL))::float / NULLIF(COUNT(*), 0) < 0.05 as passed,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE email IS NULL) as rows_failed,
  'Email completeness check - less than 5% NULL values' as message
FROM customers
```

### 2. Email Format Validation (Validity)
```sql
-- Check email format
SELECT
  (COUNT(*) FILTER (WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'))::float / NULLIF(COUNT(*), 0) < 0.02 as passed,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$') as rows_failed,
  'Invalid email format check - less than 2% invalid' as message
FROM customers
WHERE email IS NOT NULL
```

### 3. Duplicate Detection (Uniqueness)
```sql
-- Check for duplicates
WITH duplicates AS (
  SELECT email, COUNT(*) as cnt
  FROM customers
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING COUNT(*) > 1
)
SELECT
  (SELECT COUNT(*) FROM duplicates) = 0 as passed,
  (SELECT COUNT(*) FROM customers) as total_rows,
  (SELECT COALESCE(SUM(cnt - 1), 0) FROM duplicates) as rows_failed,
  'Duplicate email check - no duplicates allowed' as message
```

### 4. Range Validation (Validity)
```sql
-- Check age is in valid range
SELECT
  (COUNT(*) FILTER (WHERE age < 0 OR age > 150))::float / NULLIF(COUNT(*), 0) = 0 as passed,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE age < 0 OR age > 150) as rows_failed,
  'Age range validation - must be 0-150' as message
FROM customers
WHERE age IS NOT NULL
```

### 5. Referential Integrity (Consistency)
```sql
-- Check foreign key integrity
SELECT
  (SELECT COUNT(*) FROM orders WHERE customer_id NOT IN (SELECT id FROM customers)) = 0 as passed,
  (SELECT COUNT(*) FROM orders) as total_rows,
  (SELECT COUNT(*) FROM orders WHERE customer_id NOT IN (SELECT id FROM customers)) as rows_failed,
  'Orphaned orders check - all orders must have valid customers' as message
```

### 6. Freshness Check (Timeliness)
```sql
-- Check data freshness (last updated within 24 hours)
SELECT
  (MAX(updated_at) > NOW() - INTERVAL '24 hours') as passed,
  COUNT(*) as total_rows,
  CASE WHEN MAX(updated_at) <= NOW() - INTERVAL '24 hours' THEN COUNT(*) ELSE 0 END as rows_failed,
  'Freshness check - data updated within 24 hours' as message
FROM customers
```

## How to Create Quality Rules via API

### Using the Quality Rules API:
```bash
# Create a completeness rule
curl -X POST http://localhost:3002/api/quality/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Email Completeness",
    "description": "Ensure customer emails are not NULL",
    "dimension": "completeness",
    "severity": "high",
    "type": "sql",
    "expression": "SELECT (COUNT(*) FILTER (WHERE email IS NULL))::float / NULLIF(COUNT(*), 0) < 0.05 as passed, COUNT(*) as total_rows, COUNT(*) FILTER (WHERE email IS NULL) as rows_failed, '\''Email must be populated for 95% of customers'\'' as message FROM customers",
    "assetId": 123,
    "enabled": true
  }'

# Create a validity rule
curl -X POST http://localhost:3002/api/quality/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Format Validation",
    "description": "Validate email format",
    "dimension": "validity",
    "severity": "medium",
    "type": "sql",
    "expression": "SELECT (COUNT(*) FILTER (WHERE email !~ '\''^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'\''))::float / NULLIF(COUNT(*), 0) < 0.02 as passed, COUNT(*) as total_rows, COUNT(*) FILTER (WHERE email !~ '\''^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'\'') as rows_failed, '\''Invalid email format'\'' as message FROM customers WHERE email IS NOT NULL",
    "assetId": 123,
    "enabled": true
  }'
```

### Using Rule Templates:
```bash
# Get available templates
curl http://localhost:3002/api/quality/rule-templates

# Apply a template
curl -X POST http://localhost:3002/api/quality/rule-templates/completeness-check/apply \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "tableName": "customers",
      "columnName": "email",
      "threshold": 95
    }
  }'
```

## Summary

The fix ensures that:
1. ✅ Empty table checks are excluded from critical alerts
2. ✅ Only alerts with actual failed rows (`rows_failed > 0`) are shown
3. ✅ Auto-fix is only available when there are actual issues to fix

**Current State**: Critical alerts are empty because you need to create real quality rules that check for data quality issues in tables with data.

**Action Items**:
1. Create quality rules for tables that have data
2. Run quality scans with these new rules
3. Critical alerts will then show meaningful data quality issues

**Files Modified**:
- `backend/data-service/src/controllers/QualityController.ts` (lines 940-942, 996)
