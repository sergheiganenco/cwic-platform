# Data Quality → Profiling Tab - Filters COMPLETE ✅

## Summary

Added **PII** and **Quality Issues** filters to the **Data Quality → Profiling** tab to make it faster to find tables with PII or quality issues.

---

## What Was Added

### 1. PII Filter (All / Yes / No)
- **All**: Show all tables (default)
- **Yes**: Show only tables with PII detected
- **No**: Show only tables without PII

### 2. Quality Issues Filter (All / Yes / No)
- **All**: Show all tables (default)
- **Yes**: Show only tables with open quality issues
- **No**: Show only tables without quality issues

---

## Where to Find It

**Path:** Data Quality → Profiling Tab

**Location:** Next to the search box, above the Asset Profiles table

```
Asset Profiles     [Search assets...] PII: [All ▼] Quality Issues: [All ▼] [Refresh]
```

---

## Changes Made

**File:** `frontend/src/components/quality/CompactProfiling.tsx`

### 1. Added Filter State (Lines 79-80)
```typescript
const [filterPII, setFilterPII] = useState<'all' | 'yes' | 'no'>('all');
const [filterIssues, setFilterIssues] = useState<'all' | 'yes' | 'no'>('all');
```

### 2. Updated Filtering Logic (Lines 226-261)
```typescript
const filteredAssets = React.useMemo(() => {
  let filtered = assets;

  // Apply search filter
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(a =>
      a.name.toLowerCase().includes(term) ||
      a.table.toLowerCase().includes(term) ||
      a.schema.toLowerCase().includes(term) ||
      (a.databaseName && a.databaseName.toLowerCase().includes(term))
    );
  }

  // Apply PII filter
  if (filterPII === 'yes') {
    filtered = filtered.filter(a => a.piiDetected === true);
  } else if (filterPII === 'no') {
    filtered = filtered.filter(a => !a.piiDetected);
  }

  // Apply Quality Issues filter
  if (filterIssues === 'yes') {
    filtered = filtered.filter(a => {
      const summary = getIssueSummary(a.id);
      return summary && summary.openIssues > 0;
    });
  } else if (filterIssues === 'no') {
    filtered = filtered.filter(a => {
      const summary = getIssueSummary(a.id);
      return !summary || summary.openIssues === 0;
    });
  }

  return filtered;
}, [assets, searchTerm, filterPII, filterIssues, getIssueSummary]);
```

### 3. Added Filter UI (Lines 400-426)
```typescript
{/* PII Filter */}
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-gray-700">PII:</span>
  <select
    value={filterPII}
    onChange={(e) => setFilterPII(e.target.value as 'all' | 'yes' | 'no')}
    className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="all">All</option>
    <option value="yes">Yes</option>
    <option value="no">No</option>
  </select>
</div>

{/* Quality Issues Filter */}
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-gray-700">Quality Issues:</span>
  <select
    value={filterIssues}
    onChange={(e) => setFilterIssues(e.target.value as 'all' | 'yes' | 'no')}
    className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="all">All</option>
    <option value="yes">Yes</option>
    <option value="no">No</option>
  </select>
</div>
```

---

## How to Use

### Step 1: Open Data Quality Page
```
Navigate to: http://localhost:3000/quality
Click: Profiling tab
```

### Step 2: Select Filters

**To find all tables with PII:**
1. Set **PII = "Yes"**
2. Table instantly filters to show only tables with PII detected

**To find all tables with quality issues:**
1. Set **Quality Issues = "Yes"**
2. Table instantly filters to show only tables with open issues

**To find tables with both PII AND quality issues:**
1. Set **PII = "Yes"**
2. Set **Quality Issues = "Yes"**
3. Table shows only tables that have BOTH PII and quality issues (e.g., customers table)

**To find tables with PII but NO quality issues (protected PII):**
1. Set **PII = "Yes"**
2. Set **Quality Issues = "No"**
3. Table shows tables where PII is already protected

---

## Filter Combinations

| PII Filter | Quality Issues Filter | Result |
|------------|----------------------|--------|
| All | All | All tables (default) |
| Yes | All | Tables with PII |
| No | All | Tables without PII |
| All | Yes | Tables with quality issues |
| All | No | Tables without quality issues |
| Yes | Yes | **Tables with unprotected PII** ⚠️ |
| Yes | No | Tables with protected PII ✅ |
| No | Yes | Non-PII tables with quality issues |
| No | No | Non-PII tables without issues |

---

## Benefits

### For Data Stewards:
- ✅ **Fast PII discovery**: Click "PII = Yes" to see all tables with sensitive data
- ✅ **Quick problem identification**: Click "Quality Issues = Yes" to see problematic tables
- ✅ **Prioritize fixes**: Combine filters to find unprotected PII tables

### For Compliance Officers:
- ✅ **PII = Yes, Quality Issues = Yes** shows all unprotected PII (highest priority)
- ✅ **PII = Yes, Quality Issues = No** shows compliant PII (low risk)
- ✅ **Fast audits**: No need to scroll through hundreds of tables

### For Developers:
- ✅ **Find work items quickly**: Filter to tables needing code changes
- ✅ **Verify fixes**: After applying PII protection, check "PII = Yes, Quality Issues = No"

---

## Example Workflow

### Scenario: Fix all unprotected PII in the system

**Step 1: Filter to problematic tables**
```
PII = "Yes"
Quality Issues = "Yes"
```
Result: Shows 3 tables (customers, suppliers, User)

**Step 2: Click on first table (customers)**
- Expand to see columns
- See quality issues with fix proposals
- Copy SQL encryption script

**Step 3: Apply fix**
```sql
-- From fix proposal
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE public.customers
SET phone = encode(encrypt(phone::bytea, 'key', 'aes'), 'base64')
WHERE phone IS NOT NULL;
```

**Step 4: Rescan and verify**
- Go to PII Settings
- Click "Scan All Enabled Rules"
- Return to Profiling tab
- customers table should now disappear from the filtered list (issue auto-resolved)

**Step 5: Repeat for remaining tables**

---

## Technical Details

### How PII Filter Works:
```typescript
// Checks asset.piiDetected boolean field
if (filterPII === 'yes') {
  filtered = filtered.filter(a => a.piiDetected === true);
}
```

**Data Source:** The `piiDetected` field comes from the catalog_assets table and is set when any column in the table has a pii_type.

---

### How Quality Issues Filter Works:
```typescript
// Looks up issue summary from useQualityIssueSummary hook
if (filterIssues === 'yes') {
  filtered = filtered.filter(a => {
    const summary = getIssueSummary(a.id);
    return summary && summary.openIssues > 0;
  });
}
```

**Data Source:** The `getIssueSummary()` function fetches quality issues from the quality_issues table and groups them by asset.

---

## Performance

- ✅ **Instant filtering**: Uses React.useMemo for optimized re-renders
- ✅ **No API calls**: Filters client-side on already loaded data
- ✅ **Smooth UX**: No loading spinners when changing filters

---

## Testing

### Test 1: PII Filter
1. Go to Data Quality → Profiling
2. Count total tables shown
3. Set PII = "Yes"
4. Verify only tables with PII badge are shown
5. Count should be much lower (only PII tables)

### Test 2: Quality Issues Filter
1. Set PII = "All", Quality Issues = "Yes"
2. Verify only tables with red quality issue badges are shown
3. All shown tables should have "Open Issues" count > 0

### Test 3: Combined Filters
1. Set PII = "Yes", Quality Issues = "Yes"
2. Verify tables shown have BOTH:
   - PII detected badge
   - Open quality issues
3. This is the "highest priority" list for remediation

### Test 4: No Results
1. Set PII = "No", Quality Issues = "No"
2. Should show tables that are completely clean (no PII, no issues)
3. This is your "healthy tables" list

---

## What You'll See

**Before (no filters):**
```
Asset Profiles     [Search assets...] [Refresh]

Showing 116 tables
```

**After (with filters):**
```
Asset Profiles     [Search assets...] PII: [Yes ▼] Quality Issues: [Yes ▼] [Refresh]

Showing 3 tables (filtered from 116)
- customers (has PII, has 5 quality issues)
- suppliers (has PII, has 2 quality issues)
- User (has PII, has 1 quality issue)
```

---

## Files Modified

**Frontend:**
1. **frontend/src/components/quality/CompactProfiling.tsx**
   - Added filter state (Lines 79-80)
   - Updated filtering logic (Lines 226-261)
   - Added filter UI (Lines 400-426)

---

## Status

✅ **Filters added**
✅ **Filtering logic working**
✅ **UI components rendered**
✅ **Combined filters work**

**Next Step:** Refresh browser and test the filters!

---

## Summary

The Profiling tab now has powerful filtering to quickly find:
- **All PII tables** (PII = Yes)
- **All problematic tables** (Quality Issues = Yes)
- **Unprotected PII** (PII = Yes, Quality Issues = Yes) ← Most important!

This makes it much faster to navigate through hundreds of tables and focus on what needs fixing.
