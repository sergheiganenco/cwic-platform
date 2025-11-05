# Visual Rule Builder - Column Display Fix Complete ✅

## The Problem
Columns were not displaying in the Visual Rule Builder dropdown, especially for Azure SQL Server tables.

## Root Cause
The Visual Rule Builder was trying to use the Azure data source ID to query `catalog_columns`, but Azure doesn't have real credentials. This caused the query to fail with connection errors.

## The Solution
Changed the Visual Rule Builder to **always use Postgres** to query the `catalog_columns` table, regardless of which data source's tables are being displayed. This works because:

1. The `catalog_columns` table is in our local Postgres database
2. It contains column metadata for ALL data sources (both Postgres and Azure)
3. We query by `asset_id` which uniquely identifies the table

## Code Changes

**File**: `frontend/src/components/quality/studio/VisualRuleBuilder.tsx`

### Before (Line 303-310):
```typescript
body: JSON.stringify({
  dataSourceId: dataSourceId,  // Used original data source (fails for Azure)
  database: asset.databaseName || database || 'cwic_platform',
  query: columnQuery
})
```

### After (Line 307-311):
```typescript
const POSTGRES_DATASOURCE_ID = '793e4fe5-db62-4aa4-8b48-c220960d85ba';

body: JSON.stringify({
  dataSourceId: POSTGRES_DATASOURCE_ID,  // Always use Postgres
  database: 'cwic_platform',              // Catalog is always here
  query: columnQuery
})
```

## How It Works Now

1. **Select any data source** (Postgres or Azure)
2. **Tables populate** from the selected data source's catalog
3. **Select a table** from the dropdown
4. **Columns populate** by querying `catalog_columns` using Postgres

## Testing Results

### Postgres Tables & Columns ✅
```
Table: public.ai_generated_docs
Asset ID: 110
✅ Found 13 columns
  - id (uuid)
  - tenant_id (integer)
  - asset_id (bigint)
```

### Azure Tables & Columns ✅
```
Table: sys.bandwidth_usage
Asset ID: 1950
✅ Found 6 columns
  - time (datetime)
  - database_name (nvarchar)
  - direction (nvarchar)
```

## Benefits

1. **No Azure credentials needed** - Works with mock catalog data
2. **Consistent behavior** - Same query method for all data sources
3. **Better performance** - No failed connection attempts to Azure
4. **Simpler code** - One query path for all column fetching

## How to Verify

1. Go to **Data Quality** page
2. Select **"Azure Feya"** or **"Postgres"** in filters
3. Click **"Rules" → "Create Rule"**
4. Open **Visual Rule Builder**
5. **Tables dropdown** populates
6. Select any table
7. **Columns dropdown** now populates correctly! ✅

## Console Output to Expect

```
[VisualRuleBuilder] Using asset: {
  id: 1950,
  table: "sys.bandwidth_usage",
  database: "master",
  originalDataSource: "af910adf-c7c1-4573-9eec-93f05f0970b7"
}
[VisualRuleBuilder] Column query: SELECT column_name, data_type FROM catalog_columns WHERE asset_id = 1950 ORDER BY ordinal
[VisualRuleBuilder] Using Postgres to query catalog_columns for all data sources
[VisualRuleBuilder] Column query response: {success: true, hasRows: true, rowCount: 6}
[VisualRuleBuilder] Found columns: 6 columns
```

## Status

✅ **COMPLETE AND WORKING**

Both Postgres and Azure tables now show columns correctly in the Visual Rule Builder!

---

**Fixed**: November 2, 2025
**Solution**: Always use Postgres to query catalog_columns table
**Result**: Columns display for all data sources without needing external credentials