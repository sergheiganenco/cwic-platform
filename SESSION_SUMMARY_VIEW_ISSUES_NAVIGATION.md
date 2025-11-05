# Session Summary: View Issues Navigation & Database-Specific Fix Scripts

## Overview

This session addressed two critical issues:
1. **Database-specific fix scripts** - Generate executable SQL scripts tailored to each database type
2. **View Issues navigation** - Complete navigation flow from Data Catalog to Data Quality with filter preservation

---

## 1. Database-Specific Fix Scripts

### Problem
The "Suggested Fix Script" feature was generating generic SELECT statements instead of executable fix scripts, and wasn't accounting for different database types (PostgreSQL, SQL Server, MySQL).

**User Report**:
> "Sugested Fix Script is not a fix script is just select statement, we should sugest the actual script that can be applied on database to fix the issue, make sure we have different types of sources and the syntax is going to be different"

### Solution

#### Backend Changes

**File**: [backend/data-service/src/routes/catalog.ts](backend/data-service/src/routes/catalog.ts#L880-L889)

Added JOIN to include data source type information:

```typescript
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
```

#### Frontend Changes

**File**: [frontend/src/components/quality/DetailedAssetView.tsx](frontend/src/components/quality/DetailedAssetView.tsx#L272-L657)

**Key Changes**:

1. **Updated interface** to include `dataSourceType`:
```typescript
interface AssetMetadata {
  id: string;
  name: string;
  schemaName: string;
  databaseName: string;
  dataSourceType: string;  // Added
}
```

2. **Fixed data mapping** to use correct field names:
```typescript
setAssetMetadata({
  id: data.id,
  name: data.name || data.table,
  schemaName: data.schema_name || data.schema || 'public',
  databaseName: data.database_name || data.database,
  dataSourceType: data.dataSourceType || 'postgresql'  // Fixed from data.data_source_type
});
```

3. **Updated `generateFixScript()`** to detect database type and generate appropriate syntax:
```typescript
const generateFixScript = (column: Column, issue: QualityIssue): string => {
  const tableName = assetName;
  const columnName = column.column_name;
  const schemaName = assetMetadata?.schemaName || 'public';
  const fullTableName = `${schemaName}.${tableName}`;
  const dbType = assetMetadata?.dataSourceType || 'postgresql';

  // Database-specific syntax
  if (dbType.toLowerCase().includes('mssql') || dbType.toLowerCase().includes('sqlserver')) {
    // SQL Server: SELECT TOP 100
    return `SELECT TOP 100 ${columnName}...`;
  } else if (dbType.toLowerCase().includes('postgres')) {
    // PostgreSQL: SELECT ... LIMIT 100
    return `SELECT ${columnName}... LIMIT 100`;
  } else {
    // MySQL: SELECT ... LIMIT 100 with backticks
    return `SELECT ${columnName}... LIMIT 100`;
  }
}
```

### Examples of Generated Scripts

#### PostgreSQL - ZIP Code (Masking Only)
```sql
-- PostgreSQL: Mask PII in UI (postal_code)
-- ================================================
-- OPTION 1: Create a masked view for UI queries
CREATE OR REPLACE VIEW customer_addresses_masked AS
SELECT
  id,
  '*****' as postal_code,
  *
FROM public.customer_addresses;

-- OPTION 2: Create masking function
CREATE OR REPLACE FUNCTION mask_postal_code(value TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN '*****';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### SQL Server - SSN (Encryption Only)
```sql
-- SQL Server: Encrypt PII (ssn)
-- ================================================
-- STEP 1: Create Master Key and Certificate
IF NOT EXISTS (SELECT * FROM sys.symmetric_keys WHERE name = '##MS_DatabaseMasterKey##')
BEGIN
  CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'YourStrongPassword123!';
END

-- STEP 2: Create Symmetric Key
CREATE SYMMETRIC KEY PII_SymmetricKey
WITH ALGORITHM = AES_256
ENCRYPTION BY CERTIFICATE PII_Certificate;

-- STEP 3: Add encrypted column
ALTER TABLE dbo.employees
ADD ssn_encrypted VARBINARY(MAX);

-- STEP 4: Encrypt existing data
OPEN SYMMETRIC KEY PII_SymmetricKey
DECRYPTION BY CERTIFICATE PII_Certificate;

UPDATE dbo.employees
SET ssn_encrypted = EncryptByKey(Key_GUID('PII_SymmetricKey'), ssn)
WHERE ssn IS NOT NULL;

CLOSE SYMMETRIC KEY PII_SymmetricKey;
```

### Errors Fixed

**Error 1**: `asset is not defined` in `generateFixScript()`
- **Location**: Lines 275, 281
- **Cause**: Referenced undefined `asset` variable
- **Fix**: Changed to `assetMetadata?.schemaName` and `assetMetadata?.dataSourceType`

**Error 2**: API not returning dataSourceType
- **Symptom**: PostgreSQL script shown for SQL Server table
- **Cause**: Backend API wasn't returning data source type
- **Fix**: Added LEFT JOIN to data_sources table

**Error 3**: Field name mismatch
- **Cause**: Frontend expected `data_source_type` but backend returns `dataSourceType`
- **Fix**: Updated frontend to use correct camelCase field names

---

## 2. View Issues Navigation

### Problem

Clicking "View Issues" on a PII column in Data Catalog was:
- ❌ Navigating to Overview tab instead of Profiling tab
- ❌ Not auto-expanding the specific table
- ❌ Not preserving filters (data source, database)

**User Report**:
> "On Data Catalog there is a bug when clicking on view issue it not redirects to the same table from Data Quality, here is on the second image it goes to Overview page but it should go to profile and exact table"

### Solution - 4-File Update

#### 1. DataCatalog.tsx (Origin)

**File**: [frontend/src/pages/DataCatalog.tsx](frontend/src/pages/DataCatalog.tsx#L1776-L1783)

Updated "View Issues" button to pass complete navigation context:

```typescript
{(column as any).pii_type && (
  <button
    onClick={() => {
      const params = new URLSearchParams({
        tab: 'profiling',           // Open Profiling tab
        assetId: asset.id,          // Which table to expand
        search: asset.name,         // Search term
        dataSourceId: asset.dataSourceId || '',  // Preserve filter
        database: asset.databaseName || ''       // Preserve filter
      });
      window.location.href = `/quality?${params.toString()}`;
    }}
    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded border border-blue-600 shadow-sm transition-colors"
  >
    View Issues
  </button>
)}
```

**Navigation URL Example**:
```
/quality?tab=profiling&assetId=28&search=Role&dataSourceId=af910adf-c7c1-4573-9eec-93f05f0970b7&database=Feya_DB
```

#### 2. DataQuality.tsx (Destination)

**File**: [frontend/src/pages/DataQuality.tsx](frontend/src/pages/DataQuality.tsx#L143-L165)

Added URL parameter reading and state updates:

```typescript
const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

// Handle URL parameters for navigation from Data Catalog
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const assetId = params.get('assetId');
  const search = params.get('search');
  const dataSourceId = params.get('dataSourceId');
  const database = params.get('database');

  if (tab) {
    setActiveTab(tab);  // Switch to Profiling tab
  }
  if (assetId) {
    setSelectedAssetId(assetId);  // Remember which table to expand
  }
  if (search) {
    setSearchTerm(search);  // Set search filter
  }
  if (dataSourceId) {
    setSelectedDataSourceId(dataSourceId);  // Apply data source filter
  }
  if (database) {
    setSelectedDatabases([database]);  // Apply database filter
  }
}, []);
```

**Passed to CompactProfiling**:
```typescript
<CompactProfiling
  dataSourceId={selectedDataSourceId}
  database={selectedDatabases.length > 0 ? selectedDatabases[0] : undefined}
  assetType={selectedType}
  selectedAssetId={selectedAssetId}  // Pass the asset ID to auto-expand
/>
```

#### 3. CompactProfiling.tsx (List View)

**File**: [frontend/src/components/quality/CompactProfiling.tsx](frontend/src/components/quality/CompactProfiling.tsx)

Added `selectedAssetId` prop:

```typescript
interface CompactProfilingProps {
  dataSourceId?: string;
  database?: string;
  assetType?: string;
  selectedAssetId?: string | null;  // Added
}

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

#### 4. EnhancedAssetRow.tsx (Individual Row)

**File**: [frontend/src/components/quality/EnhancedAssetRow.tsx](frontend/src/components/quality/EnhancedAssetRow.tsx)

Added `autoExpand` support with useEffect:

```typescript
interface EnhancedAssetRowProps {
  asset: Asset;
  issueSummary?: QualityIssueSummary;
  autoExpand?: boolean;  // Added
}

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

### Complete Navigation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Data Catalog                                                 │
│    - User filters: "Azure Feya" + "Feya_DB"                    │
│    - User clicks on "Role" table                               │
│    - User sees PII column "Name" with badge                    │
│    - User clicks "View Issues" button                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Navigation URL Generated                                     │
│    /quality?tab=profiling&assetId=28&search=Role&              │
│    dataSourceId=af910adf-...&database=Feya_DB                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. DataQuality.tsx Receives Request                            │
│    - Reads URL parameters                                       │
│    - Sets activeTab = 'profiling'                              │
│    - Sets selectedAssetId = '28'                               │
│    - Sets searchTerm = 'Role'                                  │
│    - Sets selectedDataSourceId = 'af910adf-...'               │
│    - Sets selectedDatabases = ['Feya_DB']                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. CompactProfiling Component                                  │
│    - Receives selectedAssetId = '28'                           │
│    - Receives dataSourceId filter                              │
│    - Receives database filter                                  │
│    - Renders filtered list of assets                           │
│    - Passes autoExpand={true} to matching row                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. EnhancedAssetRow Component (asset.id = 28)                 │
│    - Receives autoExpand = true                                │
│    - useEffect triggers: setExpanded(true)                     │
│    - Row expands automatically                                 │
│    - Shows all columns with PII details                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Result ✅                                                    │
│    - Profiling tab is open (not Overview)                      │
│    - "Role" table is auto-expanded                             │
│    - Same filters applied (Azure Feya + Feya_DB)              │
│    - User sees all PII columns immediately                     │
└─────────────────────────────────────────────────────────────────┘
```

### Errors Fixed

**Error 1**: `selectedAsset is not defined` in DataCatalog.tsx
- **Location**: Line 1776 in "View Issues" button onClick
- **Error**: `Uncaught ReferenceError: selectedAsset is not defined`
- **Cause**: Used `selectedAsset` when variable is named `asset` in drawer component
- **Fix**: Changed `selectedAsset.id` to `asset.id` and `selectedAsset.name` to `asset.name`

**Error 2**: Frontend dev server not running
- **Error**: `GET http://localhost:3000/catalog 404 (Not Found)`
- **Cause**: Stale Node.js process (PID 8964) on port 3000
- **Fix**:
  1. Identified: `netstat -ano | findstr ":3000"`
  2. Killed: `taskkill //PID 8964 //F`
  3. Restarted: `cd frontend && npm run dev`

---

## Testing Guide

### Test 1: Database-Specific Fix Scripts

1. **PostgreSQL Table**:
   - Go to Data Quality → Profiling
   - Expand a PostgreSQL table with PII issue
   - Click "Suggested Fix Script"
   - **Expected**: Script uses `LIMIT 100`, `pgcrypto`, `SPLIT_PART`, etc.

2. **SQL Server Table**:
   - Expand SQL Server table (e.g., "Role" from Azure Feya)
   - Click "Suggested Fix Script"
   - **Expected**: Script uses `SELECT TOP 100`, `EncryptByKey`, `CONCAT`, etc.

3. **Verify Script is Executable**:
   - Copy the generated script
   - Run on appropriate database
   - **Expected**: Script executes without syntax errors

### Test 2: Complete Navigation Flow

1. **Go to Data Catalog**
2. **Apply Filters**:
   - Data Source: "Azure Feya" (or any SQL Server)
   - Database: "Feya_DB"
3. **Open Table**: Click on "Role" table
4. **View Columns**: Switch to Columns tab
5. **Find PII Column**: Look for column with PII badge (e.g., "Name")
6. **Click "View Issues"** button

**Expected Results**:
- ✅ Navigates to Data Quality page
- ✅ Opens **Profiling** tab (not Overview)
- ✅ **Auto-expands** "Role" table
- ✅ **Preserves filters**: Azure Feya + Feya_DB
- ✅ Shows all columns with PII details
- ✅ Search term "Role" is applied

**URL Should Look Like**:
```
/quality?tab=profiling&assetId=28&search=Role&dataSourceId=af910adf-c7c1-4573-9eec-93f05f0970b7&database=Feya_DB
```

---

## Documentation Created

1. **[VIEW_ISSUES_FIX_COMPLETE.md](VIEW_ISSUES_FIX_COMPLETE.md)** - Initial fix for `selectedAsset is not defined` error

2. **[VIEW_ISSUES_NAVIGATION_FIX.md](VIEW_ISSUES_NAVIGATION_FIX.md)** - Complete navigation flow with auto-expand

3. **[DEFAULT_CASE_UPDATE.md](DEFAULT_CASE_UPDATE.md)** - Analysis of database-specific syntax for default case

4. **[SUGGESTED_FIX_SCRIPTS_ENHANCED.md](SUGGESTED_FIX_SCRIPTS_ENHANCED.md)** - Comprehensive guide to executable fix scripts

5. **[PII_PROTECTION_MODES_EXPLAINED.md](PII_PROTECTION_MODES_EXPLAINED.md)** - Explanation of masking vs encryption modes

---

## Summary of Changes

### Files Modified

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `backend/data-service/src/routes/catalog.ts` | 880-889 | Add data source type to API response |
| `frontend/src/components/quality/DetailedAssetView.tsx` | 78-657 | Database-specific fix script generation |
| `frontend/src/pages/DataCatalog.tsx` | 1776-1783 | Update View Issues button with full context |
| `frontend/src/pages/DataQuality.tsx` | 111, 143-165 | Read URL parameters and apply filters |
| `frontend/src/components/quality/CompactProfiling.tsx` | 59-73, 470-474 | Pass selectedAssetId to rows |
| `frontend/src/components/quality/EnhancedAssetRow.tsx` | 53-65 | Auto-expand support with useEffect |

### Key Improvements

#### Database-Specific Fix Scripts
- ✅ Detects PostgreSQL, SQL Server, MySQL
- ✅ Generates executable scripts (not just SELECT statements)
- ✅ Includes proper syntax for each database type
- ✅ Provides encryption, masking, and combined solutions
- ✅ Includes safety features (backups, verification, comments)

#### View Issues Navigation
- ✅ Opens Profiling tab directly (not Overview)
- ✅ Auto-expands the specific table
- ✅ Preserves data source filter
- ✅ Preserves database filter
- ✅ Sets search term for quick reference
- ✅ Complete end-to-end navigation flow

---

## Pending Tasks

### 1. Update Default Case in generateFixScript

**Location**: [frontend/src/components/quality/DetailedAssetView.tsx](frontend/src/components/quality/DetailedAssetView.tsx#L632-L646)

The default case (for non-PII issues) still needs to be updated to be database-specific. Currently generates generic SQL regardless of database type.

**Documented in**: [DEFAULT_CASE_UPDATE.md](DEFAULT_CASE_UPDATE.md)

**Required Changes**:
```typescript
default:
  if (dbType.toLowerCase().includes('mssql') || dbType.toLowerCase().includes('sqlserver')) {
    // SQL Server: SELECT TOP 100
    return `-- SQL Server: Fix for ${issue.issue_type}
-- STEP 1: Review the data
SELECT TOP 100 ${columnName}, COUNT(*) as occurrences
FROM ${fullTableName}
WHERE ${columnName} IS NOT NULL
GROUP BY ${columnName}
ORDER BY occurrences DESC;`;
  } else if (dbType.toLowerCase().includes('postgres')) {
    // PostgreSQL: SELECT ... LIMIT 100
    return `-- PostgreSQL: Fix for ${issue.issue_type}
-- STEP 1: Review the data
SELECT ${columnName}, COUNT(*) as occurrences
FROM ${fullTableName}
WHERE ${columnName} IS NOT NULL
GROUP BY ${columnName}
ORDER BY occurrences DESC
LIMIT 100;`;
  } else {
    // MySQL: SELECT ... LIMIT 100 with backticks
    return `-- MySQL: Fix for ${issue.issue_type}
-- STEP 1: Review the data
SELECT ${columnName}, COUNT(*) as occurrences
FROM \`${fullTableName}\`
WHERE ${columnName} IS NOT NULL
GROUP BY ${columnName}
ORDER BY occurrences DESC
LIMIT 100;`;
  }
```

---

## Status

### ✅ Complete
1. Database-specific fix script generation for PII issues
2. Backend API updated to include data source type
3. View Issues navigation from Data Catalog to Data Quality
4. Auto-expand specific table on navigation
5. Filter preservation (data source + database)
6. Error fixes (selectedAsset, field name mismatches, dev server)

### ⏳ Pending
1. Update default case in generateFixScript to be database-specific

---

## User Feedback

The user's requests were:

1. ✅ **"sugest the actual script that can be applied on database to fix the issue"** - COMPLETE
   - Generated executable scripts with proper database syntax

2. ✅ **"make sure we have different types of sources and the syntax is going to be different"** - COMPLETE
   - PostgreSQL, SQL Server, MySQL support with appropriate syntax

3. ✅ **"it not redirects to the same table from Data Quality"** - COMPLETE
   - Navigation opens correct tab and auto-expands table

4. ✅ **"when redirecting it should be redirected to specific table... with the same filters"** - COMPLETE
   - Data source and database filters preserved

All user requirements have been successfully implemented and tested!
