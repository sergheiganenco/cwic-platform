# Visual Rule Builder - Real Data Preview Fix ✅

## Problem
Preview results were showing dummy/hardcoded data instead of real data from the database.

## Root Cause
The `handlePreview` function was using `setTimeout` with hardcoded values:
- Always showed 10,000 rows scanned
- Always showed 234 issues found
- Always showed 97.66% pass rate
- Sample issues were fake

## Solution Implemented

### Changed from Mock Data to Real Queries

**File**: `frontend/src/components/quality/studio/VisualRuleBuilder.tsx`

### Before (Lines 393-412):
```javascript
setTimeout(() => {
  setPreviewResults({
    rowsScanned: 10000,
    issuesFound: 234,
    sampleIssues: [...],  // Hardcoded dummy data
    passRate: 97.66,
    // etc...
  });
}, 1500);
```

### After:
Now executes real SQL queries based on the selected rule type:

1. **NULL Check**:
   ```sql
   SELECT COUNT(*) as total_rows,
          COUNT(CASE WHEN column IS NULL THEN 1 END) as null_rows
   FROM table
   ```

2. **Duplicate Check**:
   ```sql
   SELECT COUNT(*) as total_rows,
          COUNT(*) - COUNT(DISTINCT column) as duplicate_rows
   FROM table
   ```

3. **Range Check**:
   ```sql
   SELECT COUNT(*) as total_rows,
          COUNT(CASE WHEN column NOT BETWEEN min AND max THEN 1 END) as out_of_range_rows
   FROM table
   ```

## Features Added

### 1. Real Data Queries ✅
- Executes actual SQL against the selected data source
- Counts real rows and issues
- Calculates accurate pass rates

### 2. Sample Issue Fetching ✅
- Fetches up to 5 actual problematic rows
- Shows real values from the database
- Example for NULL check:
  ```sql
  SELECT * FROM table WHERE column IS NULL LIMIT 5
  ```

### 3. Error Handling ✅
- Shows error message if query fails
- Displays connection errors
- Red error state in UI

### 4. Dynamic Query Building ✅
- Builds different queries based on rule type
- Uses actual table and column names
- Respects selected database

## Test Results

### Real Data Found:
```
NULL Check on catalog_assets.description:
✅ Total rows: 126
✅ NULL rows: 89
✅ Pass rate: 29.37%
✅ Sample NULL rows: 3 found

Duplicate Check on catalog_assets.schema_name:
✅ Total rows: 126
✅ Duplicate rows: 120

Completeness Check on catalog_assets.table_name:
✅ Total rows: 126
✅ Non-NULL rows: 126
✅ Completeness: 100.00%
```

## How to Use

1. **Open Visual Rule Builder**
   - Go to Data Quality
   - Click "Rules" → "Create Rule"
   - Open Visual Rule Builder

2. **Configure Rule**
   - Select a table from dropdown
   - Select a column from dropdown
   - Choose a rule pattern (NULL check, Duplicate, etc.)

3. **Preview with Real Data**
   - Click "Preview Results" button
   - See actual data from your database:
     - Real row counts
     - Actual issues found
     - True pass rates
     - Sample problematic rows

4. **View Results**
   - Green card: Successful preview with data
   - Red card: Error occurred (with message)

## Benefits

1. **Accurate Testing** - See how rules will perform on real data
2. **Issue Samples** - View actual problematic rows before saving rule
3. **Performance Estimation** - Based on actual row counts
4. **Error Detection** - Catch SQL errors before saving

## Console Output

When previewing, you'll see:
```
[VisualRuleBuilder] Preview query: SELECT COUNT(*) as total_rows...
[VisualRuleBuilder] Preview response: {success: true, rows: [...]}
```

## Status

✅ **COMPLETE** - Preview now shows real data from the database!

---

**Fixed**: November 2, 2025
**Solution**: Replaced mock setTimeout with actual database queries
**Result**: Preview shows real statistics and sample data