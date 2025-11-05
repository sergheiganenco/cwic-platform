# Testing Profile Quality Filter Fix

## What Was Fixed

**File**: [frontend/src/components/quality/CompactProfiling.tsx](frontend/src/components/quality/CompactProfiling.tsx#L248-258)

**Bug**: "Quality Issues: Yes" filter showed "No assets found" even when tables had quality issues

**Root Cause**: Filter was checking non-existent field `summary.openIssues` instead of `summary.total_issues`

**Fix**: Changed both filter conditions to use correct field name

---

## How to Test

### 1. Navigate to Data Quality → Profiling Tab

**URL**: `http://localhost:5173/data-quality` → Click "Profiling" tab

### 2. Test Quality Issues Filter

#### Test Case 1: Show All Tables
**Filter Settings**:
- PII: All
- Quality Issues: (default/unset)

**Expected Result**: Shows all tables from all data sources

---

#### Test Case 2: Show Only Tables WITH Quality Issues
**Filter Settings**:
- PII: All
- Quality Issues: **Yes**

**Expected Result**:
- ✅ Shows tables that have `total_issues > 0`
- ✅ Examples: User table (if it has PII issues), Employee table, etc.
- ✅ Should see cards with quality issue badges/counts
- ❌ Should NOT show "No assets found" if quality issues exist

**Before Fix**: Showed "No assets found" ❌
**After Fix**: Shows tables with quality issues ✅

---

#### Test Case 3: Show Only Tables WITHOUT Quality Issues
**Filter Settings**:
- PII: All
- Quality Issues: **No**

**Expected Result**:
- ✅ Shows tables that have `total_issues === 0` or no summary
- ✅ Shows clean tables with no data quality problems
- ❌ Should NOT show tables with quality issues

---

#### Test Case 4: Combined Filters - PII Tables WITH Quality Issues
**Filter Settings**:
- PII: **Yes**
- Quality Issues: **Yes**

**Expected Result**:
- ✅ Shows only tables that contain PII columns AND have quality issues
- ✅ Example: User table with unencrypted SSN column
- ✅ Most restrictive filter - smallest result set

---

#### Test Case 5: Combined Filters - Non-PII Tables WITH Quality Issues
**Filter Settings**:
- PII: **No**
- Quality Issues: **Yes**

**Expected Result**:
- ✅ Shows tables without PII but with other quality issues
- ✅ Example: Tables with completeness issues, accuracy issues, etc.
- ✅ Does NOT show tables with PII

---

## How the Filter Works

### Code Logic

```typescript
// Apply Quality Issues filter
if (filterIssues === 'yes') {
  filtered = filtered.filter(a => {
    const summary = getIssueSummary(a.id);
    return summary && summary.total_issues > 0;  // ✅ Correct field
  });
} else if (filterIssues === 'no') {
  filtered = filtered.filter(a => {
    const summary = getIssueSummary(a.id);
    return !summary || summary.total_issues === 0;  // ✅ Correct field
  });
}
```

### API Endpoint

**GET** `/api/quality/issue-summary`

**Response Format**:
```json
[
  {
    "asset_id": "28",
    "table_name": "User",
    "schema_name": "dbo",
    "database_name": "Feya_DB",
    "pii_column_count": 3,
    "columns_with_issues": 2,
    "total_issues": 5,        // ✅ This field is used
    "critical_issues": 3,
    "high_issues": 2
  }
]
```

---

## Verification Steps

### 1. Check Browser Console
- Open browser DevTools (F12)
- Go to Network tab
- Filter: `issue-summary`
- Verify API call returns quality issue data
- Check that `total_issues` field exists in response

### 2. Check Filter Behavior
- Set "Quality Issues: Yes"
- Verify displayed tables have quality issue badges/counts
- Verify "No assets found" does NOT appear if issues exist

### 3. Check Combined Filters
- Test PII + Quality Issues combinations
- Verify filters work together correctly
- Verify asset count changes appropriately

---

## Expected Data

If you have test data from previous sessions, you should see:

**Tables with Quality Issues** (should appear when "Quality Issues: Yes"):
- User table (Feya_DB.dbo.User) - Has PII issues
- Employee table - Has PII issues
- Customer table - Has PII issues
- Any table with unencrypted PII columns

**Tables without Quality Issues** (should appear when "Quality Issues: No"):
- Tables without PII
- Tables with PII already encrypted/masked
- System tables

---

## Common Issues

### Issue: "No assets found" still appears

**Possible Causes**:
1. No quality issues exist in database yet
2. API endpoint returning empty data
3. Frontend not rebuilding after code change

**Troubleshooting**:
```bash
# Check if quality issues exist
docker exec -it cwic-platform-data-service-1 bash
psql $DATABASE_URL -c "SELECT asset_id, COUNT(*) FROM quality_issues WHERE status = 'open' GROUP BY asset_id;"

# Restart frontend to rebuild
cd frontend
npm run dev
```

### Issue: Filter shows wrong tables

**Possible Causes**:
1. Cache issue with issue summary data
2. API returning stale data

**Troubleshooting**:
- Hard refresh browser (Ctrl+Shift+R)
- Check Network tab for API response
- Verify `total_issues` values in API response

---

## Status

✅ **FIXED** - Profile Quality Filter now works correctly

**Files Changed**:
1. [frontend/src/components/quality/CompactProfiling.tsx](frontend/src/components/quality/CompactProfiling.tsx#L248-258)

**Testing Status**: ⏳ Pending user verification

---

**Ready for testing!** The filter should now correctly show tables with quality issues when "Quality Issues: Yes" is selected.
