# Auto-Fix Explanation

## What is Auto-Fix?

**Auto-Fix is an AUTOMATED system that actually modifies your data to fix quality issues.**

It's NOT just detection - it **executes SQL UPDATE/DELETE statements** on your database to repair the problems.

## How It Works

### 1. **Dry-Run First (Safe Preview)**
```bash
POST /api/quality/alerts/auto-fix
{
  "alertId": "uuid-here",
  "fixType": "remove_duplicates",
  "dryRun": true,  # ← PREVIEW ONLY - no changes made
  "strategy": "keep_newest"
}

# Response:
{
  "rowsAffected": 127,  # ← Would delete 127 duplicate rows
  "status": "completed"
}
```

### 2. **Actual Fix (Modifies Data)**
```bash
POST /api/quality/alerts/auto-fix
{
  "alertId": "uuid-here",
  "fixType": "remove_duplicates",
  "dryRun": false,  # ← ACTUALLY DELETES DATA
  "strategy": "keep_newest"
}

# Response:
{
  "rowsAffected": 127,  # ← Actually deleted 127 rows
  "status": "completed"
}
```

## Supported Fix Types

### 1. **`set_null_defaults`** - Fill NULL Values
**What it does**: Updates NULL values with a default value you specify

**Example**:
```sql
-- Dry-run counts NULL values
SELECT COUNT(*) FROM customers WHERE email IS NULL;
-- Returns: 45 rows

-- Actual fix
UPDATE customers
SET email = 'unknown@example.com'
WHERE email IS NULL;
-- Updates 45 rows
```

**API Call**:
```bash
curl -X POST http://localhost:3002/api/quality/alerts/auto-fix \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "alert-uuid",
    "fixType": "set_null_defaults",
    "defaultValue": "unknown@example.com",
    "dryRun": false
  }'
```

### 2. **`remove_duplicates`** - Delete Duplicate Records
**What it does**: Deletes duplicate rows, keeping only one based on your strategy

**Strategies**:
- `keep_newest`: Keep the most recently created record
- `keep_oldest`: Keep the first created record
- `keep_most_complete`: Keep the record with the most non-NULL fields

**Example**:
```sql
-- Find duplicates
SELECT email, COUNT(*)
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;
-- Shows: john@example.com has 3 copies

-- Actual fix (keep_newest strategy)
DELETE FROM customers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM customers
  ) t
  WHERE rn > 1  -- Delete all except the newest
);
-- Deletes 2 duplicate rows, keeps 1
```

**API Call**:
```bash
curl -X POST http://localhost:3002/api/quality/alerts/auto-fix \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "alert-uuid",
    "fixType": "remove_duplicates",
    "strategy": "keep_newest",
    "dryRun": true  # Preview first!
  }'
```

### 3. **`correct_invalid_values`** - Fix Invalid Data
**What it does**: Corrects values that violate business rules

**Examples**:

**Fix negative values**:
```sql
-- Find negative ages
SELECT COUNT(*) FROM customers WHERE age < 0;
-- Returns: 12 rows

-- Fix: set to 0
UPDATE customers
SET age = 0
WHERE age < 0;
-- Updates 12 rows
```

**Fix out-of-range values**:
```sql
-- Find ages > 150
SELECT COUNT(*) FROM customers WHERE age > 150;
-- Returns: 5 rows

-- Fix: set to NULL
UPDATE customers
SET age = NULL
WHERE age > 150;
-- Updates 5 rows
```

### 4. **`fix_negative_values`** - Specific Case for Negatives
**What it does**: Sets negative values to 0 (for columns that should always be positive)

**Example**:
```sql
-- Fix negative quantities
UPDATE orders
SET quantity = 0
WHERE quantity < 0;
```

### 5. **`remove_orphaned_records`** - Delete Records Without Parent
**What it does**: Deletes records that reference non-existent parent records

**Example**:
```sql
-- Find orphaned orders (customer doesn't exist)
SELECT COUNT(*)
FROM orders
WHERE customer_id NOT IN (SELECT id FROM customers);
-- Returns: 23 orphaned orders

-- Delete orphans
DELETE FROM orders
WHERE customer_id NOT IN (SELECT id FROM customers);
-- Deletes 23 rows
```

## Safety Features

### 1. **Dry-Run Mode**
Always preview changes before executing:
```bash
# Step 1: Preview
{
  "dryRun": true  # Shows what WOULD happen
}

# Step 2: Execute
{
  "dryRun": false  # Actually makes changes
}
```

### 2. **Execution History**
Every auto-fix is tracked:
```bash
GET /api/quality/alerts/{alertId}/auto-fix-history

# Response:
[
  {
    "id": "fix-123",
    "fixType": "remove_duplicates",
    "status": "completed",
    "rowsAffected": 127,
    "executionTimeMs": 234,
    "dryRun": false,
    "executedAt": "2025-10-22T10:00:00Z"
  }
]
```

### 3. **Error Handling**
If a fix fails, it's logged:
```json
{
  "status": "failed",
  "errorMessage": "Foreign key constraint violation",
  "rowsAffected": 0
}
```

## Real-World Example

### Scenario: Duplicate Email Addresses

**1. Quality Rule Detects Issue**:
```sql
-- Rule runs daily
SELECT
  (SELECT COUNT(*) FROM (
    SELECT email FROM customers GROUP BY email HAVING COUNT(*) > 1
  ) dupes) = 0 as passed
-- Returns: passed = false (duplicates found)
```

**2. Critical Alert Created**:
```json
{
  "id": "alert-456",
  "table": "customers",
  "issue": "127 duplicate email addresses found",
  "severity": "high",
  "autoFixAvailable": true
}
```

**3. User Clicks "Auto-Fix"**:

**Step 1 - Preview (Frontend calls API with dryRun=true)**:
```bash
POST /api/quality/alerts/auto-fix
{
  "alertId": "alert-456",
  "fixType": "remove_duplicates",
  "dryRun": true,
  "strategy": "keep_newest"
}

# Response:
{
  "rowsAffected": 127,  # Would delete 127 duplicate rows
  "status": "completed"
}
```

**Step 2 - User Confirms, Execute (dryRun=false)**:
```bash
POST /api/quality/alerts/auto-fix
{
  "alertId": "alert-456",
  "fixType": "remove_duplicates",
  "dryRun": false,
  "strategy": "keep_newest"
}

# This actually executes:
DELETE FROM customers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM customers
  ) t
  WHERE rn > 1
);

# Response:
{
  "rowsAffected": 127,  # Actually deleted 127 rows
  "status": "completed"
}
```

**4. Result**:
- ✅ 127 duplicate customer records **permanently deleted**
- ✅ Only the newest record for each email kept
- ✅ Fix logged in execution history
- ✅ Alert resolved

## Important Warnings

### ⚠️ THIS MODIFIES YOUR DATA
- Auto-fix **ACTUALLY CHANGES YOUR DATABASE**
- It runs **UPDATE** and **DELETE** SQL statements
- Changes are **PERMANENT** (unless you have backups)
- Always use **dry-run first** to preview

### ⚠️ No Built-in Rollback
- Once executed, changes cannot be undone automatically
- You must restore from database backups to rollback
- Always test in a non-production environment first

### ⚠️ Limited to Simple Fixes
Current auto-fix supports:
- ✅ NULL values → Set defaults
- ✅ Duplicates → Delete extras
- ✅ Invalid values → Correct or nullify
- ✅ Orphaned records → Delete

Does NOT support:
- ❌ Complex business logic
- ❌ Data transformations
- ❌ Cross-table cascading fixes
- ❌ Custom repair scripts

## When to Use Auto-Fix

### ✅ Good Use Cases:
1. **Bulk NULL cleanup**: Fill missing emails with a placeholder
2. **Duplicate removal**: Remove duplicate customer records
3. **Range validation**: Fix negative quantities/ages
4. **Orphan cleanup**: Delete orders without valid customers

### ❌ Bad Use Cases:
1. **Critical business data**: Don't auto-delete important records
2. **Uncertain fixes**: If you're not 100% sure what will happen
3. **Production without testing**: Always test in dev/staging first
4. **Complex scenarios**: Use manual SQL for complex logic

## Best Practices

1. **Always dry-run first**
   ```bash
   # GOOD
   { "dryRun": true }  # Preview
   { "dryRun": false } # Execute

   # BAD
   { "dryRun": false } # Direct execution - risky!
   ```

2. **Backup before executing**
   ```bash
   # Create backup
   pg_dump -U user -d database -t customers > backup.sql

   # Then execute auto-fix
   curl -X POST .../auto-fix
   ```

3. **Test in non-production first**
   ```bash
   # Test in dev/staging
   # Verify results
   # Then apply to production
   ```

4. **Review execution history**
   ```bash
   GET /api/quality/alerts/{alertId}/auto-fix-history
   # Check what was done
   ```

## Summary

**Auto-Fix = Automated Database Repair**

- ✅ Actually modifies your data (UPDATE/DELETE statements)
- ✅ Supports 5 common fix types
- ✅ Has dry-run mode for safety
- ✅ Tracks execution history
- ⚠️ Changes are permanent
- ⚠️ Always preview first
- ⚠️ Backup before executing

Think of it like:
- **Quality Rules** = Smoke detector (detects problems)
- **Critical Alerts** = Fire alarm (notifies you)
- **Auto-Fix** = Sprinkler system (automatically puts out the fire)

But unlike sprinklers, auto-fix changes are **permanent** and should be used carefully!
