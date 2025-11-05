# Server-Level Data Source Fix - Summary

## Problem Recap

**User's Correct Observation:**
> "As you remember we built the Data Source to be server level not database level to avoid redundant connections"

**My Mistake:**
I initially thought the data source needed a connection_string with the database name. But the architecture is:
- **Data Source** = Server-level (host, port, username, password)
- **Catalog Asset** = Has the specific database name

## Solution Implemented

### Changes Made:

#### 1. PIIFixValidator.ts - Updated to Use Database from catalog_assets

**ColumnInfo Interface:**
```typescript
export interface ColumnInfo {
  dataSourceId: string;
  databaseName: string; // ← ADDED: Database name from catalog_assets
  schemaName: string;
  tableName: string;
  columnName: string;
  requiresEncryption: boolean;
  requiresMasking: boolean;
}
```

**Connection Building:**
```typescript
// OLD (Wrong):
const config = this.parseConnectionString(dataSource.connection_string);
// connection_string was empty!

// NEW (Correct):
const config = {
  host: dataSource.host,           // From data_sources table (server-level)
  port: dataSource.port,            // From data_sources table (server-level)
  user: dataSource.username,        // From data_sources table (server-level)
  password: dataSource.password_encrypted,
  database: databaseName,           // From catalog_assets table (asset-specific)
  ssl: dataSource.connection_config?.ssl || false
};
```

#### 2. PIIQualityIntegration.ts - Updated PIIViolation Interface

**Added databaseName field:**
```typescript
export interface PIIViolation {
  columnId: string;
  assetId: string;
  dataSourceId: string;
  databaseName: string; // ← ADDED
  schemaName: string;
  tableName: string;
  columnName: string;
  ...
}
```

**Updated all validatePIIFix calls (3 locations):**
```typescript
const validationResult = await this.validator.validatePIIFix({
  dataSourceId: violation.dataSourceId,
  databaseName: violation.databaseName, // ← ADDED
  schemaName: violation.schemaName,
  tableName: violation.tableName,
  columnName: violation.columnName,
  requiresEncryption: violation.requiresEncryption,
  requiresMasking: violation.requiresMasking
});
```

---

## Remaining Issue

### Problem: PIIViolation Objects Don't Have databaseName

The `PIIViolation` objects are created in PIIRescanService or similar code. Those objects need to be updated to include the database name from catalog_assets.

**Where violations are created:**
- Likely in `PIIRescanService.ts`
- Or in the PII scanning/detection code
- Need to query `catalog_assets.database_name` when creating violations

---

## Verification Needed

### Test Query:
```sql
-- Check if data source has server-level info
SELECT id, name, host, port, username, database_name
FROM data_sources
WHERE id = '793e4fe5-db62-4aa4-8b48-c220960d85ba';

Expected:
- host: 'db'
- port: 5432
- username: 'cwic_user'
- database_name: NULL (because it's server-level)

-- Check if asset has database name
SELECT id, table_name, database_name, datasource_id
FROM catalog_assets
WHERE table_name = 'customers';

Expected:
- database_name: 'adventureworks'
```

---

## Next Steps

### Option 1: Update PIIRescanService (Recommended)

Find where `PIIViolation` objects are created and add:

```typescript
// When creating violation, get database_name from catalog_assets
const violation: PIIViolation = {
  columnId: column.id,
  assetId: asset.id,
  dataSourceId: asset.datasource_id,
  databaseName: asset.database_name, // ← ADD THIS
  schemaName: column.schema_name,
  tableName: asset.table_name,
  ...
};
```

### Option 2: Make Validator Query Database Name (Simpler)

If databaseName is missing from violation, have the validator query it:

```typescript
async validatePIIFix(columnInfo: ColumnInfo): Promise<PIIFixValidationResult> {
  let { databaseName } = columnInfo;

  // If database name not provided, query it from catalog_assets
  if (!databaseName) {
    const { rows } = await this.pool.query(
      `SELECT ca.database_name
       FROM catalog_assets ca
       JOIN catalog_columns cc ON ca.id = cc.asset_id
       WHERE ca.datasource_id = $1
         AND ca.schema_name = $2
         AND ca.table_name = $3
       LIMIT 1`,
      [columnInfo.dataSourceId, columnInfo.schemaName, columnInfo.tableName]
    );

    if (rows.length > 0) {
      databaseName = rows[0].database_name;
    }
  }

  // Continue with validation...
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│ DATA_SOURCES (Server Level)            │
│                                         │
│ - id: 793e4fe5...                      │
│ - name: "Postgres"                     │
│ - host: "db"                           │
│ - port: 5432                           │
│ - username: "cwic_user"                │
│ - password_encrypted: "..."            │
│ - database_name: NULL ← Server-level   │
└─────────────────────────────────────────┘
                 │
                 │ One server can have
                 │ multiple databases
                 ↓
┌─────────────────────────────────────────┐
│ CATALOG_ASSETS (Database Level)        │
│                                         │
│ - id: 1643                             │
│ - table_name: "customers"              │
│ - schema_name: "public"                │
│ - database_name: "adventureworks" ←    │
│ - datasource_id: 793e4fe5...           │
└─────────────────────────────────────────┘
                 │
                 │ Assets belong to
                 │ specific databases
                 ↓
┌─────────────────────────────────────────┐
│ PIIFixValidator Connects To:           │
│                                         │
│ postgresql://cwic_user@db:5432/         │
│              └─┬──┘  └─┬─┘ └──┬──┘      │
│                │       │      │         │
│          From DS   From DS  From Asset │
└─────────────────────────────────────────┘
```

---

## Files Modified

1. **backend/data-service/src/services/PIIFixValidator.ts**
   - Line 28: Added `databaseName: string` to ColumnInfo interface
   - Lines 47-52: Changed query to get host/port/username instead of connection_string
   - Lines 138-151: Updated checkColumnEncryption to accept and use databaseName parameter
   - Lines 145-151: Build connection config from server-level data + database name

2. **backend/data-service/src/services/PIIQualityIntegration.ts**
   - Line 31: Added `databaseName: string` to PIIViolation interface
   - Lines 369, 419, 474: Added `databaseName: violation.databaseName` to all validatePIIFix calls

---

## Status

### ✅ Completed:
- Updated validator to use server-level data source + database from asset
- Updated interfaces to include databaseName
- Updated all validation calls
- Restarted backend

### ❌ Still Needed:
- Update PIIRescanService (or wherever violations are created) to populate `databaseName` field
- Test that validation actually works with correct database connection
- Verify quality issues are created for unencrypted PII

---

## Testing Plan

1. **Find where PIIViolation objects are created**
2. **Add database_name to those objects**
3. **Delete existing quality issues:**
   ```sql
   DELETE FROM quality_issues WHERE title LIKE 'PII Detected:%';
   ```
4. **Trigger rescan:**
   ```bash
   POST /api/pii-rules/rescan-all
   ```
5. **Verify issues created:**
   ```sql
   SELECT COUNT(*) FROM quality_issues WHERE status = 'open';
   -- Should return: 5 (for 5 unencrypted PII columns)
   ```
6. **Check logs:**
   ```bash
   docker-compose logs data-service | grep "quality issue"
   ```

---

## Summary

**Root Cause:** Data sources are server-level (correct architecture), but validator was trying to use empty connection_string

**Solution:** Build connection from server-level fields (host/port/username) + asset-level database name

**Remaining Work:** Ensure PIIViolation objects include database name when created during scans
