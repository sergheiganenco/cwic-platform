# View Issues Navigation - Database Name Mapping Fix

## Issue

When clicking "View Issues" button in Data Catalog on a PII column, the navigation to Data Quality is not working correctly because the `database` parameter is empty.

### Root Cause

The asset detail API response doesn't map `database_name` (snake_case from database) to `databaseName` (camelCase for frontend).

### Evidence

1. **List API (`/api/catalog/assets`) - CORRECT** ✅
   - Backend: [catalog.ts:841](backend/data-service/src/routes/catalog.ts#L841)
   - Maps: `databaseName: row.database_name`
   - Returns camelCase field

2. **Detail API (`/api/catalog/assets/:id`) - MISSING** ❌
   - Backend: [catalog.ts:880-890](backend/data-service/src/routes/catalog.ts#L880-L890)
   - Returns: `a.*` (all raw fields from catalog_assets table)
   - No mapping from `database_name` to `databaseName`

3. **Frontend Mapping - INCOMPLETE** ⚠️
   - File: [DataCatalog.tsx:1848-1863](frontend/src/pages/DataCatalog.tsx#L1848-L1863)
   - Maps most fields (dataSourceId, dataSourceName, etc.)
   - **MISSING**: `databaseName` mapping

### Current Navigation Code

```typescript
// DataCatalog.tsx:1776-1783
{(column as any).pii_type && (
  <button
    onClick={() => {
      const params = new URLSearchParams({
        tab: 'profiling',
        assetId: asset.id,
        search: asset.name,
        dataSourceId: asset.dataSourceId || '',  // ✅ Works
        database: asset.databaseName || ''        // ❌ Undefined!
      });
      window.location.href = `/quality?${params.toString()}`;
    }}
  >
    View Issues
  </button>
)}
```

## Solution

Added `databaseName` mapping in frontend for asset detail responses:

### File Changes

**frontend/src/pages/DataCatalog.tsx** (Lines ~1848-1863)

```typescript
// Transform snake_case to camelCase and map field names for frontend compatibility
const asset = {
  ...data.data,
  // Map data source fields
  dataSourceId: data.data.datasource_id || data.data.dataSourceId,
  dataSourceName: data.data.datasource_name || data.data.dataSourceName,
  dataSourceType: data.data.datasource_type || data.data.dataSourceType,
  // Map asset name fields
  name: data.data.name || data.data.table_name,
  table: data.data.table || data.data.table_name,
  // Map schema
  schema: data.data.schema || data.data.schema_name,
  // Map database name ← ADDED
  databaseName: data.data.database_name || data.data.databaseName,
  // Map other common fields
  trustScore: data.data.trust_score || data.data.trustScore,
  qualityScore: data.data.quality_score || data.data.qualityScore,
};
```

**Note**: This mapping was applied to both occurrences in the file (lineage navigation and asset selection).

## Testing

### Test Steps

1. Go to **Data Catalog**
2. Apply filters:
   - Data Source: "Azure Feya"
   - Database: "Feya_DB"
3. Open the "Role" table
4. Switch to **Columns** tab
5. Find a column with PII badge (e.g., "Name")
6. Click **"View Issues"** button

### Expected Result

Navigation URL should be:
```
/quality?tab=profiling&assetId=28&search=Role&dataSourceId=af910adf-c7c1-4573-9eec-93f05f0970b7&database=Feya_DB
```

**Key**: `database=Feya_DB` parameter should be present (not empty)

### Expected Behavior

1. ✅ Opens Data Quality page
2. ✅ Shows Profiling tab (not Overview)
3. ✅ Auto-expands "Role" table
4. ✅ Preserves data source filter ("Azure Feya")
5. ✅ Preserves database filter ("Feya_DB")
6. ✅ Shows all PII columns for the table

## Alternative Solution (Backend)

If frontend mapping becomes complex, we could also fix this in the backend by updating the `getAsset` function to map all fields like `listAssets` does:

```typescript
// backend/data-service/src/routes/catalog.ts
const getAsset = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { rows } = await cpdb.query(
      `SELECT a.*,
              ds.name as "dataSourceName",
              ds.type as "dataSourceType",
              jsonb_agg(c ORDER BY c.ordinal) AS columns,
              EXISTS(SELECT 1 FROM catalog_bookmarks WHERE object_id = a.id AND user_id = $2) as is_bookmarked
       FROM catalog_assets a
       LEFT JOIN data_sources ds ON ds.id = a.datasource_id
       LEFT JOIN catalog_columns c ON c.asset_id = a.id
       WHERE a.id::text = $1
       GROUP BY a.id, ds.name, ds.type`,
      [req.params.id, userId]
    );
    if (!rows[0]) return fail(res, 404, 'Not found');

    const asset = rows[0];

    // Map snake_case to camelCase ← ADD THIS
    const mapped = {
      ...asset,
      dataSourceId: asset.datasource_id,
      dataSourceName: asset.dataSourceName,
      dataSourceType: asset.dataSourceType,
      databaseName: asset.database_name,  // ← KEY FIX
      schemaName: asset.schema_name,
      tableName: asset.table_name,
      assetType: asset.asset_type,
      // ... map other fields
    };

    ok(res, mapped);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
};
```

**Recommended**: Use frontend mapping for now (already implemented), but consider backend standardization in future refactoring.

## Related Files

1. [backend/data-service/src/routes/catalog.ts](backend/data-service/src/routes/catalog.ts)
   - Line 754-873: `listAssets` function (correct mapping)
   - Line 876-904: `getAsset` function (missing mapping)

2. [frontend/src/pages/DataCatalog.tsx](frontend/src/pages/DataCatalog.tsx)
   - Line 1776-1783: "View Issues" button navigation
   - Line 1848-1863: Asset detail mapping (FIXED)
   - Line 1920-1926: Lineage navigation mapping (FIXED)

3. [frontend/src/pages/DataQuality.tsx](frontend/src/pages/DataQuality.tsx)
   - Line 143-165: URL parameter handling (reads `database` param)

## Status

✅ **FIXED** - Frontend mapping added for `databaseName` field

The "View Issues" navigation should now correctly pass the database name from Data Catalog to Data Quality.
