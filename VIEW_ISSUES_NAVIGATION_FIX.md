# View Issues Navigation Fix - Complete

## Problem Fixed

When clicking "View Issues" on a PII column in the **Data Catalog**, it was navigating to the Data Quality **Overview** tab instead of the **Profiling** tab with the specific table expanded.

**Before**: `/quality?search=column_name` → Overview tab with search
**After**: `/quality?tab=profiling&assetId=28&search=Role` → Profiling tab with table ID 28 auto-expanded

## Root Cause

The "View Issues" button was only passing a `search` parameter, which:
1. Didn't specify which tab to open
2. Didn't identify the specific table/asset to expand
3. Resulted in landing on the Overview tab by default

## Solution Implemented

### 1. Updated Data Catalog Button

**File**: `frontend/src/pages/DataCatalog.tsx` (line ~1776)

**Changed**:
```typescript
// Before
window.location.href = `/quality?search=${column.column_name}`;

// After
window.location.href = `/quality?tab=profiling&assetId=${selectedAsset.id}&search=${selectedAsset.name}`;
```

**What it does**: Passes three parameters:
- `tab=profiling` → Opens the Profiling tab
- `assetId=28` → Identifies which table to expand
- `search=Role` → Sets search term for filtering

### 2. Added URL Parameter Handling to DataQuality

**File**: `frontend/src/pages/DataQuality.tsx`

**Added**:
```typescript
const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

// Handle URL parameters for navigation from Data Catalog
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const assetId = params.get('assetId');
  const search = params.get('search');

  if (tab) {
    setActiveTab(tab);  // Switch to Profiling tab
  }
  if (assetId) {
    setSelectedAssetId(assetId);  // Remember which table to expand
  }
  if (search) {
    setSearchTerm(search);  // Set search filter
  }
}, []);
```

**Updated**:
```typescript
<CompactProfiling
  dataSourceId={selectedDataSourceId}
  database={selectedDatabases.length > 0 ? selectedDatabases[0] : undefined}
  assetType={selectedType}
  selectedAssetId={selectedAssetId}  // Pass the asset ID
/>
```

### 3. Updated CompactProfiling Component

**File**: `frontend/src/components/quality/CompactProfiling.tsx`

**Updated interface**:
```typescript
interface CompactProfilingProps {
  dataSourceId?: string;
  database?: string;
  assetType?: string;
  selectedAssetId?: string | null;  // Added
}
```

**Updated component**:
```typescript
const CompactProfiling: React.FC<CompactProfilingProps> = ({
  dataSourceId,
  database,
  assetType,
  selectedAssetId,  // Accept the prop
}) => {
  // ...
  {filteredAssets.map((asset) => (
    <EnhancedAssetRow
      key={asset.id}
      asset={asset}
      issueSummary={getIssueSummary(asset.id)}
      autoExpand={selectedAssetId === asset.id}  // Auto-expand if IDs match
    />
  ))}
}
```

### 4. Updated EnhancedAssetRow Component

**File**: `frontend/src/components/quality/EnhancedAssetRow.tsx`

**Updated interface**:
```typescript
interface EnhancedAssetRowProps {
  asset: Asset;
  issueSummary?: QualityIssueSummary;
  autoExpand?: boolean;  // Added
}
```

**Updated component**:
```typescript
const EnhancedAssetRow: React.FC<EnhancedAssetRowProps> = ({
  asset,
  issueSummary,
  autoExpand  // Accept the prop
}) => {
  const [expanded, setExpanded] = useState(autoExpand || false);

  // Auto-expand when autoExpand prop changes
  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
    }
  }, [autoExpand]);

  // ... rest of component
}
```

## How It Works Now

1. User views "Role" table in Data Catalog
2. User clicks "View Issues" on a PII column
3. **Navigation**: `/quality?tab=profiling&assetId=28&search=Role`
4. **DataQuality page**:
   - Reads URL parameters
   - Sets `activeTab = 'profiling'` → Shows Profiling tab
   - Sets `selectedAssetId = '28'` → Remembers which table
   - Sets `searchTerm = 'Role'` → Filters to this table
5. **CompactProfiling**:
   - Receives `selectedAssetId='28'`
   - Passes `autoExpand={true}` to the matching EnhancedAssetRow
6. **EnhancedAssetRow**:
   - Sets `expanded = true` automatically
   - Shows the detailed column view immediately

## Result

✅ Clicking "View Issues" now:
- Opens the **Profiling** tab (not Overview)
- **Auto-expands** the specific table
- Shows **all columns** with quality issues
- User can immediately see the detailed PII information

## Files Modified

1. `frontend/src/pages/DataCatalog.tsx` - Updated View Issues button navigation
2. `frontend/src/pages/DataQuality.tsx` - Added URL parameter handling and selectedAssetId state
3. `frontend/src/components/quality/CompactProfiling.tsx` - Added selectedAssetId prop and passed autoExpand
4. `frontend/src/components/quality/EnhancedAssetRow.tsx` - Added autoExpand support with useEffect

## Testing

To test:
1. Go to Data Catalog
2. Click on a table (e.g., "Role" from Azure Feya → dbo)
3. Go to Columns tab
4. Find a column with PII badge (e.g., "Name")
5. Click "View Issues" button
6. **Expected**: Data Quality page opens on Profiling tab with "Role" table expanded showing all columns

The fix ensures smooth navigation between Data Catalog and Data Quality for investigating PII issues.
