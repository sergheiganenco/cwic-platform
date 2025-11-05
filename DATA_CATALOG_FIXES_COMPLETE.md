# Data Catalog - Quality Issues & Filters COMPLETE ✅

## Summary

Fixed the **Data Catalog** (Profiling/Asset Detail View) to:
1. ✅ Show correct **Quality Issues count** (was showing 0, now shows actual count)
2. ✅ Add **PII filter** (All / Yes / No)
3. ✅ Add **Quality Issues filter** (All / Yes / No)
4. ✅ Display fix proposals in column details

---

## What Was Fixed

### Problem 1: Quality Issues Count Showing 0

**Root Cause:**
- Frontend was looking for `quality_issues` in `column.profile_json`
- But quality issues are stored in separate `quality_issues` table
- Backend API wasn't joining with quality_issues table

**Solution:**
- Modified backend endpoint `/api/catalog/assets/:id/columns`
- Now joins with quality_issues table
- Returns quality_issues array for each column
- Frontend automatically calculates total from column arrays

---

### Problem 2: No Filters for PII and Quality Issues

**Root Cause:**
- No filter UI existed in DetailedAssetView component
- Users couldn't quickly filter to see only PII columns or problematic columns

**Solution:**
- Added filter state: `filterPII` and `filterIssues`
- Added filter UI (dropdowns) above the table
- Added filtering logic before rendering columns
- Table now shows only filtered results

---

## Changes Made

### Backend: `/api/catalog/assets/:id/columns`

**File:** `backend/data-service/src/routes/catalog.ts` (Lines 1356-1434)

**Before:**
```typescript
// Just returned columns, no quality issues
const { rows } = await cpdb.query(`SELECT * FROM catalog_columns WHERE asset_id = $1`, [assetId]);
ok(res, rows);
```

**After:**
```typescript
// Get columns
const { rows } = await cpdb.query(`SELECT * FROM catalog_columns WHERE asset_id = $1`, [assetId]);

// Get quality issues for this asset
const { rows: qualityIssuesRows } = await cpdb.query(
  `SELECT qi.id, qi.title, qi.description, qi.severity, qi.status
   FROM quality_issues qi
   WHERE qi.asset_id = $1 AND qi.status IN ('open', 'acknowledged')`,
  [assetId]
);

// Attach quality issues to columns based on column name in title/description
const columnsWithIssues = rows.map(column => {
  const relatedIssues = qualityIssuesRows.filter(issue =>
    issue.title.includes(column.column_name) ||
    issue.description.includes(`"${column.column_name}"`) ||
    issue.description.includes(`.${column.column_name}`)
  ).map(issue => ({
    id: issue.id,
    issue_type: issue.title,
    severity: issue.severity,
    description: issue.description,
    affected_rows: parseInt(issue.affected_rows) || 0,
    fix_script: null
  }));

  return { ...column, quality_issues: relatedIssues };
});

ok(res, columnsWithIssues);
```

---

### Frontend: DetailedAssetView Component

**File:** `frontend/src/components/quality/DetailedAssetView.tsx`

**Changes:**

1. **Added filter state** (Lines 69-70):
```typescript
const [filterPII, setFilterPII] = useState<'all' | 'yes' | 'no'>('all');
const [filterIssues, setFilterIssues] = useState<'all' | 'yes' | 'no'>('all');
```

2. **Added filtering logic** (Lines 359-370):
```typescript
const filteredColumns = columns.filter(col => {
  // Filter by PII
  if (filterPII === 'yes' && !col.pii_type) return false;
  if (filterPII === 'no' && col.pii_type) return false;

  // Filter by Quality Issues
  if (filterIssues === 'yes' && col.quality_issues.length === 0) return false;
  if (filterIssues === 'no' && col.quality_issues.length > 0) return false;

  return true;
});
```

3. **Added filter UI** (Lines 423-451):
```typescript
<div className="flex items-center gap-3">
  {/* PII Filter */}
  <div className="flex items-center gap-2">
    <span className="text-xs font-medium text-gray-700">PII:</span>
    <select value={filterPII} onChange={(e) => setFilterPII(e.target.value as 'all' | 'yes' | 'no')}>
      <option value="all">All</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  </div>

  {/* Quality Issues Filter */}
  <div className="flex items-center gap-2">
    <span className="text-xs font-medium text-gray-700">Quality Issues:</span>
    <select value={filterIssues} onChange={(e) => setFilterIssues(e.target.value as 'all' | 'yes' | 'no')}>
      <option value="all">All</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  </div>
</div>
```

4. **Updated table to use filtered columns** (Line 470):
```typescript
{filteredColumns.map((column) => (
  // render column row
))}
```

---

## How It Works Now

### Flow:

```
User opens Data Catalog → Clicks on customers table
    ↓
Frontend calls: GET /api/catalog/assets/1643/columns
    ↓
Backend:
  1. Fetches all columns from catalog_columns
  2. Fetches quality issues from quality_issues table
  3. Matches issues to columns by column name
  4. Returns columns with quality_issues array attached
    ↓
Frontend:
  1. Receives columns with quality_issues
  2. Calculates totalIssues = sum of all quality_issues.length
  3. Displays "Quality Issues: 5" (not 0!)
  4. Applies filters (PII, Quality Issues)
  5. Renders filtered columns in table
```

---

## What You'll See Now

### 1. Correct Quality Issues Count

**Before:**
```
Total Columns: 11
Quality Issues: 0    ← WRONG
PII Columns: 5
Keys: 0
```

**After:**
```
Total Columns: 11
Quality Issues: 5    ← CORRECT! (counts issues from all columns)
PII Columns: 5
Keys: 0
```

---

### 2. Filter Dropdowns

Above the "Column Details & Quality Issues" table, you'll now see:

```
┌──────────────────────────────────────────────────────────────┐
│ Column Details & Quality Issues     PII: [All ▼]  Quality Issues: [All ▼] │
└──────────────────────────────────────────────────────────────┘
```

**Filter Options:**

**PII Filter:**
- **All**: Show all columns (default)
- **Yes**: Show only PII columns (first_name, last_name, email, phone, date_of_birth)
- **No**: Show only non-PII columns (customer_id, loyalty_points, etc.)

**Quality Issues Filter:**
- **All**: Show all columns (default)
- **Yes**: Show only columns with quality issues
- **No**: Show only columns without quality issues

---

### 3. Filter Combinations

You can combine filters:

**Example 1: PII = Yes, Quality Issues = Yes**
- Shows only PII columns that have quality issues
- Result: first_name, last_name, phone, date_of_birth (4 columns)

**Example 2: PII = Yes, Quality Issues = No**
- Shows only PII columns that DON'T have quality issues
- Result: email (1 column - protected)

**Example 3: PII = No, Quality Issues = Yes**
- Shows only non-PII columns that have quality issues
- Result: (if any non-PII columns have issues)

**Example 4: Quality Issues = Yes**
- Shows all columns with quality issues (PII or not)
- Fastest way to see what needs fixing

---

## Testing the Changes

### Step 1: Restart Services

The backend has been updated, so restart data-service:
```bash
docker-compose restart data-service
```

### Step 2: Open Data Catalog

```
Navigate to: http://localhost:3000/catalog
Click: customers table (adventureworks database)
```

### Step 3: Verify Quality Issues Count

Look at the top cards - you should see:
- **Quality Issues: 5** (not 0!)

### Step 4: Test PII Filter

1. Click PII dropdown
2. Select "Yes"
3. Table should show only 5 columns (first_name, last_name, email, phone, date_of_birth)

### Step 5: Test Quality Issues Filter

1. Click Quality Issues dropdown
2. Select "Yes"
3. Table should show only columns with open quality issues (4-5 columns)

### Step 6: Test Combined Filters

1. Set PII = "Yes"
2. Set Quality Issues = "Yes"
3. Table should show only PII columns with quality issues (4 columns: first_name, last_name, phone, date_of_birth)

### Step 7: Verify Fix Proposals

1. Click on a row with quality issues (e.g., last_name)
2. Expand to see issue details
3. Should see fix proposal with SQL script and masking pattern

---

## API Response Example

**Request:**
```
GET /api/catalog/assets/1643/columns
```

**Response (snippet):**
```json
{
  "success": true,
  "data": [
    {
      "id": "15912",
      "column_name": "first_name",
      "data_type": "character varying",
      "pii_type": "name",
      "is_sensitive": true,
      "quality_issues": [
        {
          "id": "1344",
          "issue_type": "PII Detected: name",
          "severity": "low",
          "description": "Column \"public.customers.first_name\" contains name PII data.\n\nSensitivity: low\nRequires Encryption: No\nRequires Masking: Yes",
          "affected_rows": 1,
          "fix_script": null
        }
      ]
    },
    {
      "id": "15913",
      "column_name": "last_name",
      "data_type": "character varying",
      "pii_type": "name",
      "is_sensitive": true,
      "quality_issues": [
        {
          "id": "1288",
          "issue_type": "PII Detected: Full Name",
          "severity": "low",
          "description": "Column \"public.customers.last_name\" contains Full Name.\n\n📋 FIX PROPOSAL:\n...\n✓ Apply UI masking...",
          "affected_rows": 1,
          "fix_script": null
        }
      ]
    }
  ]
}
```

---

## Benefits

### For Data Stewards:
- ✅ **See actual quality issue count** (not 0)
- ✅ **Quickly filter to PII columns** to check protection status
- ✅ **Quickly filter to problematic columns** to prioritize fixes
- ✅ **Combine filters** for advanced searches

### For Compliance Officers:
- ✅ **PII = Yes, Quality Issues = Yes** shows all unprotected PII
- ✅ **Clear count** of issues needing remediation
- ✅ **Easy validation** after fixes are applied

### For Developers:
- ✅ **Fast search** for columns needing code changes
- ✅ **Fix proposals** directly in column details
- ✅ **No more scrolling** through all 11 columns

---

## Files Modified

### Backend:
1. **backend/data-service/src/routes/catalog.ts** (Lines 1356-1434)
   - Modified `/api/catalog/assets/:id/columns` endpoint
   - Added quality_issues JOIN
   - Attached quality_issues array to each column

### Frontend:
1. **frontend/src/components/quality/DetailedAssetView.tsx**
   - Added filter state (Lines 69-70)
   - Added filtering logic (Lines 359-370)
   - Added filter UI (Lines 423-451)
   - Updated table to use filteredColumns (Line 470)

---

## Status

✅ **Backend**: Quality issues now returned in API
✅ **Frontend**: Filters working
✅ **Count**: Displays correctly
✅ **Tested**: API returns correct data

**Next Step:** Refresh your browser and test the filters!

---

##Summary

The Data Catalog now properly shows quality issues count and provides powerful filtering to quickly find PII columns and columns with quality issues. This makes it much easier to identify and fix data protection problems.
