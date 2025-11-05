# FALSE POSITIVE PII Detection - Critical Bug Found! 🐛

## User's Discovery

**User Question:**
> "how you identified that this 2 fields are PII?"

Looking at columns:
- `CancelledDate` (datetime2) - Marked as **phone** PII ❌
- `IsCancelled` (bit) - Marked as **phone** PII ❌

**This is clearly WRONG!** Neither column contains phone data.

---

## Root Cause Analysis

### The Bug

The Phone Number rule has this column hint: `"cell"`

**Matching Logic:**
```typescript
column_name ILIKE '%cell%'
```

**What It Should Match:**
- ✅ `cell_phone`
- ✅ `cellphone`
- ✅ `mobile_cell`
- ✅ `cell` (exact)

**What It INCORRECTLY Matches:**
- ❌ `Can**cell**edDate` (contains "cell" from "Cancelled")
- ❌ `Is**Cancel**led` (contains "cell" from "Cancelled")
- ❌ `excel**lent**` (contains "cell")
- ❌ `mis**cell**aneous` (contains "cell")
- ❌ `can**cell**ation` (contains "cell")

---

## The Problem: Substring Matching is Too Greedy

### Current Column Name Hints for Phone:

```json
{
  "phone",
  "phone_number",
  "phonenumber",
  "telephone",
  "mobile",
  "mobile_number",
  "cell",          ← THE PROBLEM!
  "cell_phone",
  "cellphone",
  "contact_number",
  "work_phone",
  "home_phone",
  "fax",
  "fax_number"
}
```

### Other Problematic Hints:

| Hint | Matches Correctly | FALSE POSITIVES |
|------|------------------|-----------------|
| `cell` | `cell`, `cell_phone` | `Cancelled`, `Cancel`, `Excel`, `Miscellaneous` |
| `fax` | `fax`, `fax_number` | `ifax`, `ifax_number` (legitimate but different) |
| `phone` | `phone`, `phone_number` | `iphone`, `smartphone`, `telephone` (last one is OK) |

---

## Real-World Examples of False Positives

### From Your Database:

```sql
SELECT column_name, data_type, pii_type
FROM catalog_columns
WHERE column_name ILIKE '%cell%'
  AND pii_type = 'phone';
```

**Results:**
- `CancelledDate` (datetime2) → Incorrectly marked as phone ❌
- `IsCancelled` (bit) → Incorrectly marked as phone ❌

### Potential False Positives in Other Tables:

```
Column Names That Could Be Misdetected:
- cancellation_date  → Matches "cell" → Wrong!
- is_cancelled       → Matches "cell" → Wrong!
- cancelled_by       → Matches "cell" → Wrong!
- cancel_reason      → Matches "cell" → Wrong!
- excel_file_path    → Matches "cell" → Wrong!
- miscellaneous_data → Matches "cell" → Wrong!
```

---

## Impact Assessment

### How Many False Positives Exist?

```sql
-- Find all columns marked as phone PII where column name contains "cancel"
SELECT
  ca.table_name,
  cc.column_name,
  cc.data_type,
  cc.pii_type
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.pii_type = 'phone'
  AND cc.column_name ILIKE '%cancel%';
```

**Expected:** At least 2 (CancelledDate, IsCancelled from TblWish)

---

### Check for Other Greedy Matches

```sql
-- Find columns that might be false positives based on data type
SELECT
  ca.table_name,
  cc.column_name,
  cc.data_type,
  cc.pii_type,
  CASE
    WHEN cc.data_type IN ('bit', 'boolean') THEN 'Boolean - likely false positive'
    WHEN cc.data_type IN ('datetime', 'datetime2', 'timestamp', 'date') THEN 'Date/Time - likely false positive'
    WHEN cc.data_type IN ('int', 'bigint', 'smallint') THEN 'Integer - maybe valid (phone as number)'
    ELSE 'Text - could be valid'
  END as likelihood
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.pii_type IS NOT NULL
  AND cc.data_type IN ('bit', 'boolean', 'datetime', 'datetime2', 'timestamp', 'date')
ORDER BY ca.table_name, cc.column_name;
```

---

## Solutions

### Option 1: Word Boundary Matching (RECOMMENDED)

Use `\b` word boundaries to match only complete words:

**Current (Broken):**
```typescript
column_name ILIKE '%cell%'  // Matches "Cancelled"
```

**Fixed:**
```typescript
column_name ~* '\bcell\b'  // Only matches word "cell"
```

**PostgreSQL Regex with Word Boundaries:**
```sql
-- Match only if "cell" is a complete word
column_name ~* '\bcell\b'           -- Matches: "cell", "cell_phone"
                                    -- Doesn't match: "Cancelled", "Excel"
```

**Implementation:**
```typescript
// Instead of ILIKE '%hint%'
// Use regex: column_name ~* '\bhint\b'

const hintsCondition = column_name_hints
  .map((hint, idx) => `column_name ~* '\\b${hint}\\b'`)
  .join(' OR ');
```

---

### Option 2: Remove Ambiguous Hints

Remove single-word hints that cause false positives:

**Remove:**
- `cell` (too generic - matches "Cancelled")
- `fax` (too short - could match other things)

**Keep only specific hints:**
- `cell_phone`
- `cellphone`
- `mobile_cell`
- `fax_number`

**SQL Update:**
```sql
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'phone',
  'phone_number',
  'phonenumber',
  'telephone',
  'mobile',
  'mobile_number',
  'cell_phone',        -- Keep this
  'cellphone',         -- Keep this
  'contact_number',
  'work_phone',
  'home_phone',
  'fax_number'         -- Keep this (not just "fax")
]
WHERE pii_type = 'phone';
```

---

### Option 3: Add Negative Filters

Add exclusion patterns to reject obvious false positives:

```typescript
const isMatch = columnName.match(/\bcell\b/i) &&
                !columnName.match(/cancel/i);  // Exclude if contains "cancel"
```

**Implementation:**
```sql
SELECT column_name
FROM catalog_columns
WHERE column_name ~* '\bcell\b'           -- Matches word "cell"
  AND column_name !~* 'cancel'            -- But NOT if contains "cancel"
  AND column_name !~* 'excel';            -- But NOT if contains "excel"
```

---

## Recommended Fix (Combination)

### 1. Update Phone Rule Hints

```sql
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'phone',
  'phone_number',
  'phonenumber',
  'telephone',
  'mobile',
  'mobile_number',
  'cell_phone',        -- Changed: removed standalone "cell"
  'cellphone',
  'contact_number',
  'work_phone',
  'home_phone',
  'fax_number'         -- Changed: removed standalone "fax"
]
WHERE pii_type = 'phone';
```

---

### 2. Update Matching Logic to Use Word Boundaries

**File:** `backend/data-service/src/services/PIIRescanService.ts`

**Current Code (Lines 189-207):**
```typescript
const hintsCondition = rule.column_name_hints
  .map((hint, idx) => `cc.column_name ILIKE $${idx + 2}`)
  .join(' OR ');

const hintsParams = [
  rule.pii_type,
  ...rule.column_name_hints.map((hint) => `%${hint}%`),  // ← PROBLEM: Substring match
];
```

**Fixed Code:**
```typescript
const hintsCondition = rule.column_name_hints
  .map((hint, idx) => `cc.column_name ~* $${idx + 2}`)  // Use regex instead of ILIKE
  .join(' OR ');

const hintsParams = [
  rule.pii_type,
  ...rule.column_name_hints.map((hint) => `\\b${hint}\\b`),  // ← FIX: Word boundary match
];
```

**Effect:**
- Before: `ILIKE '%cell%'` matches `"CancelledDate"` ❌
- After: `~* '\bcell\b'` does NOT match `"CancelledDate"` ✅

---

### 3. Clean Up Existing False Positives

After applying the fix, clean up incorrect classifications:

```sql
-- Clear false positive PII classifications
UPDATE catalog_columns
SET
  pii_type = NULL,
  data_classification = NULL,
  is_sensitive = false
WHERE pii_type = 'phone'
  AND column_name ILIKE '%cancel%'
  AND data_type IN ('bit', 'boolean', 'datetime', 'datetime2', 'timestamp', 'date');

-- Delete associated quality issues
DELETE FROM quality_issues
WHERE title ILIKE '%phone%'
  AND description ILIKE '%cancel%';
```

---

## Testing

### Test 1: Verify False Positives Are Cleared

```sql
SELECT
  ca.table_name,
  cc.column_name,
  cc.data_type,
  cc.pii_type
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.column_name IN ('CancelledDate', 'IsCancelled')
  AND ca.id = 27;
```

**Expected After Fix:**
```
table_name | column_name   | data_type | pii_type
-----------+---------------+-----------+---------
TblWish    | CancelledDate | datetime2 | NULL
TblWish    | IsCancelled   | bit       | NULL
```

---

### Test 2: Verify Legitimate Matches Still Work

```sql
-- Should still match these:
SELECT
  'cell_phone' ~* '\bcell_phone\b' as match_cell_phone,
  'user_cellphone' ~* '\bcellphone\b' as match_cellphone,
  'mobile_cell' ~* '\bcell\b' as match_cell_in_mobile_cell;
```

**Expected:**
```
match_cell_phone | match_cellphone | match_cell_in_mobile_cell
-----------------+-----------------+--------------------------
t                | t               | t
```

---

### Test 3: Verify False Positives Are Rejected

```sql
SELECT
  'CancelledDate' ~* '\bcell\b' as should_be_false,
  'IsCancelled' ~* '\bcell\b' as should_be_false_2,
  'excellent' ~* '\bcell\b' as should_be_false_3,
  'miscellaneous' ~* '\bcell\b' as should_be_false_4;
```

**Expected:**
```
should_be_false | should_be_false_2 | should_be_false_3 | should_be_false_4
----------------+-------------------+-------------------+------------------
f               | f                 | f                 | f
```

---

## Other PII Rules to Review

Apply the same word boundary fix to all PII rules:

| PII Type | Problematic Hints | Fix |
|----------|------------------|-----|
| `name` | None | OK |
| `email` | None | OK |
| `phone` | `cell`, `fax` | Remove or use word boundaries |
| `address` | `street`, `road` | Use word boundaries |
| `ssn` | None | OK |
| `credit_card` | `card` | Use word boundaries (might match "discard") |

---

## Summary

### The Bug
- Phone rule hint `"cell"` matches substring in `"CancelledDate"` and `"IsCancelled"`
- These are obviously not phone numbers (one is a datetime, one is a boolean)
- This is a **FALSE POSITIVE** causing incorrect PII classification

### Root Cause
- Substring matching (`ILIKE '%cell%'`) is too greedy
- Matches "cell" anywhere in the column name, not just as a complete word

### The Fix
1. Remove ambiguous hints: `cell` → `cell_phone`, `cellphone`
2. Use word boundaries: `ILIKE '%cell%'` → `~* '\bcell\b'`
3. Clean up existing false positives

### Impact
- At least 2 false positives found in your database
- Could be many more across all tables
- Affects monitoring mode display (shows AMBER for non-PII columns)
- Users see incorrect PII badges

---

## Action Items

- [ ] Update Phone rule hints (remove "cell", keep "cell_phone")
- [ ] Change matching logic to use word boundaries
- [ ] Clean up false positive classifications in database
- [ ] Rescan all tables to apply correct logic
- [ ] Review other PII rules for similar issues
- [ ] Test with real data to verify fix

**Priority:** HIGH - This affects data governance accuracy!
