# View Issues Button - Error Fixed

## The Error

```
DataCatalog.tsx:1776 Uncaught ReferenceError: selectedAsset is not defined
```

## Root Cause

The "View Issues" button was using `selectedAsset` variable which doesn't exist in the drawer component's scope. The correct variable name is `asset`.

## The Fix

**File**: `frontend/src/pages/DataCatalog.tsx` (line 1776)

**Before** (Incorrect):
```typescript
window.location.href = `/quality?tab=profiling&assetId=${selectedAsset.id}&search=${selectedAsset.name}`;
```

**After** (Correct):
```typescript
window.location.href = `/quality?tab=profiling&assetId=${asset.id}&search=${asset.name}`;
```

## Why This Works

In the `AssetDrawer` component (the drawer that shows when you click on a table in Data Catalog), the prop is named `asset`, not `selectedAsset`:

```typescript
// Line 1567 - The drawer receives 'asset' prop
return (
  <>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
    <div className="fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 overflow-y-auto flex flex-col">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{asset.name || asset.table}</h2>
            //                                                        ^^^^^ Uses 'asset'
```

Throughout the drawer component, the variable is consistently called `asset`:
- Line 1555: `fetch(\`/api/catalog/assets/\${asset.id}/lineage\`)`
- Line 1574: `{asset.name || asset.table}`
- Line 1594: `onClick={() => onPreview(asset.id)}`

## Testing

✅ **Now Working**:
1. Go to Data Catalog
2. Click on "Role" table (Azure Feya → dbo → Role)
3. Click Columns tab
4. Find a PII column (e.g., "Name" with PII: NAME badge)
5. Click "View Issues" button
6. **Result**: Navigates to `/quality?tab=profiling&assetId=28&search=Role`
   - Opens Data Quality page
   - Shows Profiling tab
   - Auto-expands the Role table
   - Shows all columns with quality issues

## Complete Navigation Flow

1. **Data Catalog** → Click "View Issues"
2. **Navigation**: `/quality?tab=profiling&assetId=28&search=Role`
3. **DataQuality.tsx** → Reads URL params, sets activeTab='profiling', selectedAssetId='28'
4. **CompactProfiling.tsx** → Receives selectedAssetId='28'
5. **EnhancedAssetRow.tsx** → Auto-expands when asset.id matches selectedAssetId
6. **Result**: User sees the expanded table with all PII details immediately

## Files Modified

- ✅ `frontend/src/pages/DataCatalog.tsx` - Fixed variable from `selectedAsset` to `asset`
- ✅ `frontend/src/pages/DataQuality.tsx` - Added URL parameter handling
- ✅ `frontend/src/components/quality/CompactProfiling.tsx` - Added selectedAssetId prop
- ✅ `frontend/src/components/quality/EnhancedAssetRow.tsx` - Added autoExpand support

The navigation now works correctly end-to-end!
