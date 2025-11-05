# Server-Level Filtering - FIXED ✅

## Problem

User correctly pointed out: **"The entire logic was to have one server-level sources not specific for a database, since we don't want to have redundant sources for every single database"**

I had incorrectly created separate data sources for each database, when the architecture should be:
- **One data source** = One server connection (can access multiple databases)
- **Database filtering** = Filter by database name, not by creating new data sources

---

## Solution Implemented

### Step 1: Remove Redundant Data Source

Deleted the unnecessary "CWIC Platform" data source that was created per-database:

```sql
DELETE FROM data_sources
WHERE name = 'CWIC Platform' AND database_name = 'cwic_platform';
```

### Step 2: Update Postgres to Server-Level

Changed the "Postgres" data source from database-specific to server-level:

```sql
UPDATE data_sources
SET
  database_name = NULL,  -- NULL = server-level, not database-specific
  description = 'PostgreSQL server with multiple databases (adventureworks, cwic_platform)'
WHERE id = '793e4fe5-db62-4aa4-8b48-c220960d85ba';
```

**Before**:
```
Name: Postgres
Database: adventureworks  ← database-specific
```

**After**:
```
Name: Postgres
Database: NULL  ← server-level (can access all databases)
```

### Step 3: Update All Quality Results

Updated all cwic_platform quality_results to use the server-level Postgres data_source_id:

```sql
UPDATE quality_results qres
SET data_source_id = '793e4fe5-db62-4aa4-8b48-c220960d85ba'  -- Postgres server
FROM quality_rules qr
JOIN catalog_assets ca ON ca.id = qr.asset_id
WHERE qres.rule_id = qr.id
  AND ca.database_name IN ('adventureworks', 'cwic_platform');
```

**Result**: 84 quality_results updated

---

## Final State

### Data Sources:
```
1. Postgres (ID: 793e4fe5...)
   - Type: PostgreSQL
   - Scope: SERVER-LEVEL
   - Databases: adventureworks, cwic_platform
   - Quality Results: 124 scans

2. Azure Feya (ID: af910adf...)
   - Type: MSSQL
   - Scope: SERVER-LEVEL
   - Databases: Feya_DB
   - Quality Results: 12 scans (errors)
```

### Quality Results Distribution:
```
Database: adventureworks
  Data Source: Postgres (server-level)
  Count: 40 scans

Database: cwic_platform
  Data Source: Postgres (server-level)
  Count: 84 scans

Database: Feya_DB
  Data Source: NULL (connection errors)
  Count: 12 scans
```

---

## How Filtering Works Now

### Backend Logic (Correct)

The backend filters in this order:

1. **Filter by data_source_id** (if provided)
   ```sql
   WHERE qres.data_source_id = $1  -- Postgres server
   ```

2. **Then filter by database_name** (if provided)
   ```sql
   AND ca.database_name = ANY($2::text[])  -- ['adventureworks', 'cwic_platform']
   ```

This allows:
- **Server-level filtering**: One data source for multiple databases
- **Database-level filtering**: Filter specific databases within that server

### API Tests - All Passing ✅

**Test 1**: Postgres + both databases
```bash
curl "http://localhost:3002/api/quality/business-impact?dataSourceId=793e4fe5&databases=adventureworks,cwic_platform"

Result:
  Total Failed Scans: 59  ✅ (4 adventureworks + 55 cwic_platform)
  Assets Impacted: 46     ✅ (2 + 44)
```

**Test 2**: Postgres + adventureworks only
```bash
curl "http://localhost:3002/api/quality/business-impact?dataSourceId=793e4fe5&databases=adventureworks"

Result:
  Total Failed Scans: 4   ✅
  Assets Impacted: 2      ✅
```

**Test 3**: Postgres + cwic_platform only
```bash
curl "http://localhost:3002/api/quality/business-impact?dataSourceId=793e4fe5&databases=cwic_platform"

Result:
  Total Failed Scans: 55  ✅
  Assets Impacted: 44     ✅
```

**Test 4**: All servers (no filter)
```bash
curl "http://localhost:3002/api/quality/business-impact"

Result:
  Total Failed Scans: 59  ✅ (all databases)
  Assets Impacted: 46     ✅
```

---

## Expected UI Behavior

### Data Source Dropdown:
```
┌─────────────────────┐
│ Select Server:      │
├─────────────────────┤
│ All Servers         │ ← Shows all databases across all servers
│ Postgres            │ ← Server-level (adventureworks, cwic_platform)
│ Azure Feya          │ ← Server-level (Feya_DB)
└─────────────────────┘
```

### When "Postgres" is selected:

**Database Checkboxes**:
```
┌─────────────────────────┐
│ Select Databases:       │
├─────────────────────────┤
│ ☑ adventureworks        │
│ ☑ cwic_platform         │
└─────────────────────────┘
```

**Filtering Options**:

1. **Default (all databases checked)**:
   - Filters: `dataSourceId=Postgres`
   - Shows: Combined data from adventureworks + cwic_platform
   - Results: 46 tables with issues (2 + 44)

2. **Only adventureworks checked**:
   - Filters: `dataSourceId=Postgres&databases=adventureworks`
   - Shows: Only adventureworks data
   - Results: 2 tables with issues

3. **Only cwic_platform checked**:
   - Filters: `dataSourceId=Postgres&databases=cwic_platform`
   - Shows: Only cwic_platform data
   - Results: 44 tables with issues

4. **Both databases checked**:
   - Filters: `dataSourceId=Postgres&databases=adventureworks,cwic_platform`
   - Shows: Combined data from both
   - Results: 46 tables with issues (2 + 44)

---

## Architecture - Correct Approach

### ✅ Server-Level Data Sources (Current)

```
Data Source = Server Connection
   │
   ├─ Database 1
   │    ├─ Table 1
   │    └─ Table 2
   │
   └─ Database 2
        ├─ Table 3
        └─ Table 4

Example:
  Postgres (data source)
    ├─ adventureworks (database)
    │    ├─ customers (table)
    │    └─ orders (table)
    │
    └─ cwic_platform (database)
         ├─ catalog_assets (table)
         └─ quality_rules (table)
```

### ❌ Database-Level Data Sources (Previous - Incorrect)

```
Data Source 1 = Database 1
Data Source 2 = Database 2
Data Source 3 = Database 3  ← Redundant!

Example (incorrect):
  Postgres - adventureworks (data source)
  Postgres - cwic_platform (data source)  ← Redundant!
  Postgres - another_db (data source)     ← Redundant!
```

**Problem**: Creates redundant data sources for every database on the same server.

---

## Summary of Changes

### Files Created:
1. ✅ [fix_server_level_filtering.js](fix_server_level_filtering.js) - Fixes to use server-level approach

### Database Changes:
1. ✅ Deleted redundant "CWIC Platform" data source
2. ✅ Updated "Postgres" to server-level (database_name = NULL)
3. ✅ Updated 84 quality_results to use Postgres data_source_id

### Backend Code:
- ✅ **No changes needed** - Already supports server-level filtering correctly
- Filters by `data_source_id` first (server)
- Then filters by `database_name` (specific databases)

### Quality Results:
```
adventureworks: 40 scans → data_source_id = Postgres ✅
cwic_platform:  84 scans → data_source_id = Postgres ✅
Feya_DB:        12 scans → data_source_id = NULL     ✅
```

---

## Verification

Run the fix script:
```bash
node fix_server_level_filtering.js
```

Output:
```
✅ Removed redundant data source
✅ Updated Postgres to server-level connection
✅ Updated 84 quality_results to use Postgres data_source_id

Quality Results by Database:
  adventureworks: Postgres (server-level) - 40 scans
  cwic_platform: Postgres (server-level) - 84 scans
  Feya_DB: NULL - 12 scans
```

---

## Status

✅ **Server-Level Filtering**: One data source per server
✅ **Database Filtering**: Filter by database name within server
✅ **API Tests**: All filtering combinations work correctly
✅ **No Redundancy**: No duplicate data sources per database
✅ **Architecture**: Follows correct server-level design

**Date**: 2025-10-22
**Approach**: Server-level data sources (correct)
**Issue**: Fixed - removed database-level redundancy

---

## UI Expected Behavior

When you select "Postgres" server and check both databases:
- ✅ Shows combined metrics from adventureworks + cwic_platform
- ✅ Total: 46 tables with issues (2 + 44)
- ✅ No longer shows 0%

The filtering now works correctly with the **server-level architecture**!
