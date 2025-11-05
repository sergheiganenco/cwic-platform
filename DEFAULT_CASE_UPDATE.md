# Default Case Update - Database-Specific Fix Scripts

## Answer to Your Question

The script you showed:
```sql
-- Fix for PII Detected: Credit Card Number
-- Review the data to determine appropriate fix
SELECT company_name, COUNT(*) as occurrences
FROM public.suppliers
WHERE company_name IS NOT NULL
GROUP BY company_name
ORDER BY occurrences DESC
LIMIT 100;
```

**Type**: This is **PostgreSQL syntax** (generic SQL that works in PostgreSQL)

**Why**: This script is generated from the `default` case in the `generateFixScript()` function, which currently doesn't check the database type.

## The Problem

The `default` case (line 632-645) generates **generic SQL** regardless of the actual database type. For a SQL Server table like `suppliers`, it should generate SQL Server-specific syntax.

### What's Wrong

- **LIMIT 100** is PostgreSQL/MySQL syntax
- SQL Server uses **TOP 100** instead
- The table reference `public.suppliers` works in PostgreSQL but SQL Server uses `dbo.suppliers`

## The Fix Needed

Update the `default` case to check `dbType` and generate database-specific syntax:

```typescript
default:
  if (dbType.toLowerCase().includes('mssql') || dbType.toLowerCase().includes('sqlserver') || dbType.toLowerCase().includes('sql server')) {
    // SQL Server syntax
    return `-- SQL Server: Fix for ${issue.issue_type}
-- STEP 1: Review the data
SELECT TOP 100 ${columnName}, COUNT(*) as occurrences
FROM ${fullTableName}
WHERE ${columnName} IS NOT NULL
GROUP BY ${columnName}
ORDER BY occurrences DESC;

-- STEP 2: Update (modify as needed)
-- UPDATE ${fullTableName}
-- SET ${columnName} = 'corrected_value'
-- WHERE ${columnName} = 'problematic_value';`;
  } else if (dbType.toLowerCase().includes('postgres')) {
    // PostgreSQL syntax (current default)
    return `-- PostgreSQL: Fix for ${issue.issue_type}
-- STEP 1: Review the data
SELECT ${columnName}, COUNT(*) as occurrences
FROM ${fullTableName}
WHERE ${columnName} IS NOT NULL
GROUP BY ${columnName}
ORDER BY occurrences DESC
LIMIT 100;

-- STEP 2: Update (modify as needed)
-- UPDATE ${fullTableName}
-- SET ${columnName} = 'corrected_value'
-- WHERE ${columnName} = 'problematic_value';`;
  } else {
    // MySQL syntax
    return `-- MySQL: Fix for ${issue.issue_type}
-- STEP 1: Review the data
SELECT ${columnName}, COUNT(*) as occurrences
FROM ${fullTableName}
WHERE ${columnName} IS NOT NULL
GROUP BY ${columnName}
ORDER BY occurrences DESC
LIMIT 100;

-- STEP 2: Update (modify as needed)
-- UPDATE ${fullTableName}
-- SET ${columnName} = 'corrected_value'
-- WHERE ${columnName} = 'problematic_value';`;
  }
```

## Key Differences

### PostgreSQL
- Uses `LIMIT 100` at the end
- Table format: `schema.table`
- Example: `SELECT * FROM public.suppliers LIMIT 100`

### SQL Server
- Uses `SELECT TOP 100` at the beginning
- Table format: `schema.table` (same)
- Example: `SELECT TOP 100 * FROM dbo.suppliers`

### MySQL
- Uses `LIMIT 100` at the end (like PostgreSQL)
- Table format with backticks: `` `schema`.`table` ``
- Example: ``SELECT * FROM `mydb`.`suppliers` LIMIT 100``

## After the Fix

For your SQL Server `suppliers` table, the script will show:

```sql
-- SQL Server: Fix for PII Detected: Credit Card Number
-- STEP 1: Review the data
SELECT TOP 100 company_name, COUNT(*) as occurrences
FROM dbo.suppliers
WHERE company_name IS NOT NULL
GROUP BY company_name
ORDER BY occurrences DESC;

-- STEP 2: Update (modify as needed)
-- UPDATE dbo.suppliers
-- SET company_name = 'corrected_value'
-- WHERE company_name = 'problematic_value';
```

**Notice**:
- ✅ `SELECT TOP 100` (SQL Server syntax)
- ✅ `dbo.suppliers` (correct schema)
- ✅ No `LIMIT` clause
- ✅ Header says "SQL Server"
