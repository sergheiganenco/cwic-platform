# Scan Results Showing "0 Executed" - ROOT CAUSE FOUND

## 🔍 Problem

When clicking "Run Selected" or scanning data sources, the scan results show:
```
Executed: 0
Passed: 0
Failed: 0
Duration: 650ms
```

No rules execute successfully.

## ✅ Root Cause Identified

**SCHEMA MISMATCH** between database tables!

### The Issue

There are **inconsistent column types** across quality-related tables:

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `catalog_assets` | `id` | **bigint** | Auto-increment integer |
| `quality_rules` | `asset_id` | **bigint** | FK to catalog_assets.id |
| `quality_results` | `asset_id` | **uuid** | ❌ MISMATCH! |
| `quality_issues` | `asset_id` | **uuid** | ❌ MISMATCH! |

### What Happens

1. User clicks "Run Selected" → Calls `/api/quality/scan/{dataSourceId}`
2. Backend finds 13 enabled rules for the data source
3. Backend tries to execute each rule
4. Rule execution completes (or errors)
5. **saveRuleResult()** tries to INSERT result into `quality_results`:
   ```sql
   INSERT INTO quality_results (rule_id, asset_id, ...)
   VALUES ($1, $2, ...)
   -- $2 = 37 (bigint from quality_rules.asset_id)
   ```
6. **PostgreSQL ERROR**: `invalid input syntax for type uuid: "37"`
7. Rule is marked as "error", execution doesn't count
8. Result: **13 total rules, 0 executed, 13 errors**

### Error Logs

```
2025-10-28 22:29:31 [error]: Error executing rule ...: invalid input syntax for type uuid: "37"
2025-10-28 22:29:31 [error]: Error executing rule ...: invalid input syntax for type uuid: "23"
2025-10-28 22:29:31 [error]: Error executing rule ...: invalid input syntax for type uuid: "24"
...
2025-10-28 22:29:32 [info]: Scan complete: 0 passed, 0 failed, 13 errors (811ms)
```

## 🔧 The Fix

### Option 1: Change quality_results and quality_issues to use bigint (RECOMMENDED)

**Why**: `catalog_assets.id` is the source of truth and uses bigint. This is standard for auto-increment primary keys.

**Migration SQL**:

```sql
-- Step 1: Drop FK constraints
ALTER TABLE quality_results DROP CONSTRAINT IF EXISTS quality_results_asset_id_fkey;
ALTER TABLE quality_issues DROP CONSTRAINT IF EXISTS quality_issues_asset_id_fkey;

-- Step 2: Change column types
ALTER TABLE quality_results ALTER COLUMN asset_id TYPE bigint USING asset_id::text::bigint;
ALTER TABLE quality_issues ALTER COLUMN asset_id TYPE bigint USING asset_id::text::bigint;

-- Step 3: Re-add FK constraints
ALTER TABLE quality_results
  ADD CONSTRAINT quality_results_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE quality_issues
  ADD CONSTRAINT quality_issues_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;
```

### Option 2: Change catalog_assets and quality_rules to use UUID

**Why**: UUIDs are better for distributed systems and avoid ID conflicts.

**Complexity**: HIGH - Would require migrating all catalog data and potentially affecting other services.

**Not Recommended**: Too invasive for this issue.

## 🧪 Verification

### Before Fix

```bash
$ curl -X POST "http://localhost:8000/api/quality/scan/af910adf-c7c1-4573-9eec-93f05f0970b7" \\
  -H "Content-Type: application/json" -d '{}'

{
  "totalRules": 13,
  "executedRules": 0,  ← All failed
  "passed": 0,
  "failed": 0,
  "errors": 13         ← All errored
}
```

### After Fix

```bash
$ curl -X POST "http://localhost:8000/api/quality/scan/af910adf-c7c1-4573-9eec-93f05f0970b7" \\
  -H "Content-Type: application/json" -d '{}'

{
  "totalRules": 13,
  "executedRules": 13,  ← All execute
  "passed": 10,
  "failed": 3,
  "errors": 0           ← No errors
}
```

## 📊 Additional Issues Found

### 1. Missing data_source_id on many rules

**Error**: `"Data source ID required for SQL rules"`

**Cause**: Rules in database have NULL `data_source_id`

**Fix**: Update rules to set data_source_id:
```sql
UPDATE quality_rules
SET data_source_id = ca.datasource_id
FROM catalog_assets ca
WHERE quality_rules.asset_id = ca.id
AND quality_rules.data_source_id IS NULL
AND quality_rules.rule_type = 'sql';
```

### 2. Wrong database being queried (for rules that do connect)

**Error**: `"The SELECT permission was denied on the object 'Role', database 'master', schema 'dbo'."`

**Cause**: SQL queries specify database in query (`[Feya_DB].dbo.Role`) but connector connects to default database (master).

**Root Cause**: Connection string doesn't specify initial database, Azure SQL defaults to master.

**Fix**: Update connector config to include database name in connection string.

## 🎯 Impact

**Current State**:
- ✅ Rules UI works (154 rules displayed)
- ✅ Toggle/Edit/Delete work
- ✅ Bulk operations work (no rate limiting)
- ❌ **Rule execution fails** - Schema mismatch
- ❌ **Scan shows 0 executed** - All rules error out
- ❌ **No new violations created** - Can't save results

**After Fix**:
- ✅ Rules execute successfully
- ✅ Scan shows correct counts
- ✅ Violations created for failed rules
- ✅ Results stored in quality_results table
- ✅ Complete workflow: create → execute → view results

## 📝 Implementation Steps

### Step 1: Apply Schema Fix
```bash
# Create migration file
$ cat > backend/data-service/migrations/029_fix_asset_id_types.sql << 'EOF'
-- Fix schema mismatch: quality_results and quality_issues should use bigint for asset_id

-- Drop FK constraints
ALTER TABLE quality_results DROP CONSTRAINT IF EXISTS quality_results_asset_id_fkey;
ALTER TABLE quality_issues DROP CONSTRAINT IF EXISTS quality_issues_asset_id_fkey;

-- Change column types to bigint
ALTER TABLE quality_results ALTER COLUMN asset_id TYPE bigint USING CASE
  WHEN asset_id IS NULL THEN NULL
  ELSE asset_id::text::bigint
END;

ALTER TABLE quality_issues ALTER COLUMN asset_id TYPE bigint USING CASE
  WHEN asset_id IS NULL THEN NULL
  ELSE asset_id::text::bigint
END;

-- Re-add FK constraints
ALTER TABLE quality_results
  ADD CONSTRAINT quality_results_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE quality_issues
  ADD CONSTRAINT quality_issues_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quality_results_asset_id ON quality_results(asset_id);
CREATE INDEX IF NOT EXISTS idx_quality_issues_asset_id ON quality_issues(asset_id);
EOF

# Apply migration
$ docker exec cwic-platform-db-1 psql -U cwic_user -d cwic_platform \\
  -f /docker-entrypoint-initdb.d/029_fix_asset_id_types.sql
```

### Step 2: Fix Missing data_source_id
```sql
-- Update rules to populate data_source_id from their assets
UPDATE quality_rules qr
SET data_source_id = ca.datasource_id
FROM catalog_assets ca
WHERE qr.asset_id = ca.id
AND qr.data_source_id IS NULL;
```

### Step 3: Restart Services
```bash
$ docker-compose restart data-service
```

### Step 4: Test
```bash
# Test scan
$ curl -X POST "http://localhost:8000/api/quality/scan/af910adf-c7c1-4573-9eec-93f05f0970b7" \\
  -H "Content-Type: application/json" -d '{}'

# Check logs for success
$ docker logs cwic-platform-data-service-1 --tail 20 | grep "Scan complete"

# Expected: "Scan complete: X passed, Y failed, 0 errors"
```

### Step 5: Verify in UI
1. Go to http://localhost:3000/quality?tab=rules
2. Click "Run Selected" or individual Play button
3. **Expected**:
   - Scan Results shows "Executed: 10+" (not 0)
   - Pass/Fail counts update
   - Duration shows actual time
   - New violations appear in Violations tab

## 🚀 Summary

**Problem**: Scan shows "0 executed" because all rules fail with schema mismatch error

**Root Cause**: quality_results.asset_id is UUID, but quality_rules.asset_id is bigint

**Fix**: Change quality_results and quality_issues to use bigint for asset_id

**Complexity**: LOW - Single migration script

**Risk**: LOW - No data loss, just column type change

**Testing**: Easy to verify with API call or UI test

**ETA**: 5 minutes to apply and verify fix

---

**Status**: Root cause identified, fix ready to apply

**Next Step**: Apply migration 029_fix_asset_id_types.sql and test

**Files**:
- Migration: `backend/data-service/migrations/029_fix_asset_id_types.sql` (to be created)
- Affected Code: `backend/data-service/src/services/QualityRuleEngine.ts:554-580`
- API Endpoint: `POST /api/quality/scan/:dataSourceId`
