# How to Execute Quality Rules

## Quick Answer

**To execute quality rules and populate real data, run**:
```bash
node execute_quality_rules.js
```

This will:
- Execute all 136 quality rules against your actual databases
- Store results in `quality_results` table
- UI will automatically show the data

---

## What Happened

### ✅ Successfully Executed

Just now, we ran `execute_quality_rules.js` and got **REAL results**:

**Results Summary**:
- Total Executed: 124 rules
- ✅ Passed: 65 (52%) - tables have data
- ❌ Failed: 59 (48%) - tables are empty
- ⚠️  Errors: 12 (10%) - Feya_DB database doesn't exist

**By Database**:
- **adventureworks**: 36 passed, 4 failed
  - Failed tables: audit_log, product_reviews (empty)
- **cwic_platform**: 29 passed, 55 failed
  - Many internal platform tables are empty (normal)
- **Feya_DB**: 12 errors (database doesn't exist on this server)

###Current State

**Backend API** (verified working):
```bash
# All Servers
curl http://localhost:3002/api/quality/business-impact
→ 133 failed scans, 133 high issues

# adventureworks only
curl http://localhost:3002/api/quality/business-impact?database=adventureworks
→ 12 failed scans, 12 high issues  ✅ FILTERING WORKS!

# cwic_platform only
curl http://localhost:3002/api/quality/business-impact?database=cwic_platform
→ 121 failed scans, 121 high issues  ✅ FILTERING WORKS!
```

**The backend filtering IS working correctly!**

---

## The Problem You're Seeing

You mentioned: **"all the data shows on the All servers level not database level"**

This means when you select a specific database filter in the UI (like "adventureworks"), you're still seeing the "All Servers" metrics (133 issues) instead of the filtered metrics (12 issues for adventureworks).

### Why This Happens

The issue is likely ONE of these:

#### Option 1: Frontend Not Passing Filter
The `selectedDatabases` state in DataQuality.tsx might not be set correctly when you click a database filter.

#### Option 2: Console Shows the Issue
Open your browser console (F12) and you should see logs like:
```
[QualityOverview] Loading data with filters: {
  dataSourceId: undefined,
  database: "adventureworks",  ← Should show the database you selected
  databases: "adventureworks",
  assetType: undefined
}
```

If `database` and `databases` are both `undefined`, then the filter isn't being passed from the parent component.

---

## How to Debug

### Step 1: Check Browser Console

1. Open the UI (http://localhost:3000)
2. Go to Data Quality → Overview tab
3. Open Browser DevTools (F12)
4. Click on a database filter (e.g., "adventureworks")
5. Look for the console log:
   ```
   [QualityOverview] Loading data with filters: {...}
   ```

**What to check**:
- If `database` is `undefined` → Filter not being passed from parent
- If `database` is `"adventureworks"` → Filter IS being passed, backend should work

### Step 2: Check Network Tab

1. In DevTools, go to Network tab
2. Filter by "Fetch/XHR"
3. Click a database filter
4. Look for request to `/api/quality/business-impact`
5. Check the URL - it should have `?database=adventureworks`

**What to check**:
- If URL has no `?database=` → Frontend API isn't appending the filter
- If URL has `?database=adventureworks` → Backend should return filtered data

### Step 3: Check Backend Response

1. In Network tab, click the `/api/quality/business-impact` request
2. Click "Response" tab
3. Check `data.totalFailedScans`

**Expected**:
- All servers: 133
- adventureworks: 12
- cwic_platform: 121

If the response shows 133 even when URL has `?database=adventureworks`, then there's a backend bug.

---

## Most Likely Cause

Based on the code I reviewed, the most likely issue is:

**The DataQuality page might not be updating `selectedDatabases` state when you click a filter.**

The code passes:
```typescript
databases={selectedDatabases.length > 0 ? selectedDatabases.join(',') : undefined}
database={selectedDatabases.length > 0 ? selectedDatabases[0] : undefined}
```

If `selectedDatabases` array is empty or not updating, then both `databases` and `database` will be `undefined`, and the backend will return "All Servers" data.

---

## Solution Options

### Option A: Check if Filter Component is Working

The Data Quality page likely has a filter dropdown or button to select databases. When you click it:
1. Does the UI update to show the selected database?
2. Does the filter state change visually?
3. Check if `selectedDatabases` state is actually being updated

### Option B: Temporary Manual Test

To confirm filtering works end-to-end, you can temporarily hard-code a database:

```typescript
// In QualityOverviewEnhanced.tsx, temporarily change:
const loadQualityData = async () => {
  setLoading(true);
  try {
    // TEMPORARY: Hard-code adventureworks to test
    const testDatabase = 'adventureworks';

    const [summaryResult, businessImpactResult] = await Promise.allSettled([
      qualityAPI.getQualitySummary({
        database: testDatabase  // Hard-coded
      }),
      qualityAPI.getBusinessImpact({
        database: testDatabase  // Hard-coded
      })
    ]);
```

If this shows 12 issues (not 133), then the problem is the filter state not being passed.

---

## Next Steps

1. **Open browser console** and check the filter logs
2. **Check network tab** to see what URL is actually called
3. **Share what you see** in the console/network tab

Once we know if the filter is being passed or not, I can help fix the exact issue!

---

## Summary

- ✅ Backend filtering **WORKS** (tested via curl)
- ✅ Quality rules **EXECUTED** successfully
- ✅ Real data **EXISTS** (133 total issues, 12 for adventureworks, 121 for cwic_platform)
- ⚠️  Frontend **MAY NOT BE** passing the filter to backend

**To verify**: Check browser console when clicking database filter. If you see `database: undefined`, then the filter state isn't being updated in the parent component.

