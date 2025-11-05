# PII Filter Fix Complete

## Summary

Fixed the "PII = Yes" filter in the Data Quality Profiling view by adding the `piiDetected` field to the `/api/assets` endpoint response.

---

## Problem

**User Report**: "PII filter = Yes is not working"

**Root Cause**:
- Frontend filter was checking `asset.piiDetected === true` ([CompactProfiling.tsx:242](frontend/src/components/quality/CompactProfiling.tsx#L242))
- Backend `/api/assets` endpoint was NOT returning the `piiDetected` field
- The field exists in `catalog_assets` table but wasn't being joined/returned

---

## Solution

### 1. Added piiDetected to Asset Interface

**File**: [backend/data-service/src/controllers/AssetController.ts](backend/data-service/src/controllers/AssetController.ts#L49)

```typescript
export interface Asset {
  // ... existing fields
  piiDetected?: boolean;  // ✅ Added
  metadata?: {
    // ...
  };
}
```

### 2. Updated Database Query to Join catalog_assets

**File**: [backend/data-service/src/services/AssetService.ts](backend/data-service/src/services/AssetService.ts#L123-L135)

**Before**:
```typescript
const dataQuery = `
  SELECT
    a.*,
    ds.name as data_source_name,
    ds.type as data_source_type
  FROM assets a
  LEFT JOIN data_sources ds ON a.data_source_id = ds.id
  ${whereClause}
  ORDER BY a.updated_at DESC
  LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
`;
```

**After**:
```typescript
const dataQuery = `
  SELECT
    a.*,
    ds.name as data_source_name,
    ds.type as data_source_type,
    COALESCE(ca.pii_detected, false) as pii_detected  // ✅ Added
  FROM assets a
  LEFT JOIN data_sources ds ON a.data_source_id = ds.id
  LEFT JOIN catalog_assets ca ON ca.table_name = a.name AND ca.datasource_id = a.data_source_id::uuid  // ✅ Added JOIN
  ${whereClause}
  ORDER BY a.updated_at DESC
  LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
`;
```

### 3. Added piiDetected to Response Mapping

**File**: [backend/data-service/src/services/AssetService.ts](backend/data-service/src/services/AssetService.ts#L163)

```typescript
const assets: Asset[] = dataResult.rows.map(row => ({
  // ... existing fields
  piiDetected: row.pii_detected || false,  // ✅ Added
}));
```

---

## How It Works Now

### Backend Flow

1. **Database Query**: Joins `assets` table with `catalog_assets` to get `pii_detected` flag
2. **Type Cast**: Converts `a.data_source_id` to UUID to match `ca.datasource_id` type
3. **Default Value**: Uses `COALESCE(ca.pii_detected, false)` to return `false` when no match
4. **Response**: Includes `piiDetected: true/false` in API response

### Frontend Filter

**File**: [frontend/src/components/quality/CompactProfiling.tsx](frontend/src/components/quality/CompactProfiling.tsx#L241-L244)

```typescript
// Apply PII filter
if (filterPII === 'yes') {
  filtered = filtered.filter(a => a.piiDetected === true);  // ✅ Now works!
} else if (filterPII === 'no') {
  filtered = filtered.filter(a => !a.piiDetected);
}
```

---

## API Response Examples

### Before (Missing Field)
```json
{
  "id": "abc123",
  "name": "customers",
  "type": "table",
  "dataSourceId": "xyz",
  "dataSourceName": "AdventureWorks",
  ...
  // ❌ piiDetected missing!
}
```

### After (With Field)
```json
{
  "id": "abc123",
  "name": "customers",
  "type": "table",
  "dataSourceId": "xyz",
  "dataSourceName": "AdventureWorks",
  ...
  "piiDetected": true  // ✅ Now included!
}
```

---

## Testing

### Test PII Filter

1. Navigate to **Data Quality → Profiling** tab
2. Set "PII" filter dropdown to **"Yes"**
3. **Expected**: Only tables with PII columns should appear
4. Set "PII" filter to **"No"**
5. **Expected**: Only tables without PII should appear

### Verify API

```bash
# Check API returns piiDetected field
curl "http://localhost:3002/api/assets?limit=5" | jq '.data[].piiDetected'

# Should output:
# false
# false
# true   ← Tables with PII
# false
# false
```

---

## Important Notes

### Table Relationship

The `assets` table and `catalog_assets` table have different coverage:

- **assets**: Contains tables from ALL data sources (cwic_platform, adventureworks, Feya_DB, etc.)
- **catalog_assets**: Contains profiled/scanned tables with PII detection

**JOIN Logic**:
```sql
LEFT JOIN catalog_assets ca
  ON ca.table_name = a.name
  AND ca.datasource_id = a.data_source_id::uuid
```

This means:
- Tables in both `assets` AND `catalog_assets` → Returns actual `pii_detected` value
- Tables only in `assets` (not profiled yet) → Returns `false` (via COALESCE)

### Type Casting

**Important**: `a.data_source_id` is stored as TEXT in `assets` table, but `ca.datasource_id` is UUID in `catalog_assets`. Must cast to match:

```sql
a.data_source_id::uuid  // ✅ Correct
ca.datasource_id::text  // ❌ Wrong - causes "operator does not exist: text = uuid" error
```

---

## Files Modified

1. **[backend/data-service/src/controllers/AssetController.ts](backend/data-service/src/controllers/AssetController.ts)**
   - Added `piiDetected?: boolean` to Asset interface (line 49)

2. **[backend/data-service/src/services/AssetService.ts](backend/data-service/src/services/AssetService.ts)**
   - Added JOIN to catalog_assets in query (line 131)
   - Added pii_detected to SELECT (line 128)
   - Added piiDetected to response mapping (line 163)

---

## Related Work

This fix complements the exact PII matching and enhanced scan results:

- [EXACT_PII_MATCHING_IMPLEMENTED.md](EXACT_PII_MATCHING_IMPLEMENTED.md) - Exact column name matching
- [CLEAN_PII_RESCAN_COMPLETE.md](CLEAN_PII_RESCAN_COMPLETE.md) - System database exclusions

---

## Status

✅ **COMPLETE** - PII filter now works correctly in Data Quality Profiling view

**Current Behavior**:
- PII = Yes → Shows only tables with PII columns
- PII = No → Shows only tables without PII
- PII = All → Shows all tables

**API**: `/api/assets` now returns `piiDetected: boolean` for all assets
