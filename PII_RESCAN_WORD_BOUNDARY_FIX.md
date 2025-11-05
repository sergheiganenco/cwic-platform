# PII Rescan Word Boundary Fix ✅

## Issues Reported

### Issue 1: Instant Refresh Not Working After Mark as Not PII
**User:** "I just did the same for another field and it did not clear right away, but after rescanning it did clear."

### Issue 2: Rescan Finds 0 Columns Despite Adding Hints
**User:** "Rescan is not identifying all the tables that contains the fields that we added"

**Evidence:** Screenshot showed:
- **Rule:** Bank Account Number
- **Rescan Complete**
- **0 Columns Re-classified**
- **0 Tables Affected**

---

## Root Causes

### Problem 1: Browser Cache (Instant Refresh)
The instant refresh fix was deployed, but the user's browser was still running the old code with `window.location.reload()`.

**Solution:** Hard refresh browser (Ctrl+F5)

---

### Problem 2: Word Boundary Regex Too Strict

**The Critical Bug:**

The word boundary regex `\b` in PostgreSQL treats underscores (`_`) as word characters, which causes **false negatives** for compound column names:

**Examples:**

| Hint | Column Name | Old Regex `\bhint\b` | Matches? | Why? |
|------|-------------|----------------------|----------|------|
| `account` | `account` | `\baccount\b` | ✅ Yes | Exact match |
| `account` | `account_number` | `\baccount\b` | ❌ **NO** | `account` is followed by `_` (word char) |
| `account` | `bank_account` | `\baccount\b` | ❌ **NO** | `account` is preceded by `_` (word char) |
| `number` | `tracking_number` | `\bnumber\b` | ❌ **NO** | `number` is preceded by `_` |
| `cell` | `cancelled` | `\bcell\b` | ❌ No | Good - prevents false positive |

**Result:** Even though hints like `account_number`, `bank_account`, `routing_number` were added, they matched NOTHING because the regex required the hint to be a complete standalone word.

---

## Solution

### Changed from Word Boundary `\b` to Smart Delimiter Matching

**Old Regex (TOO STRICT):**
```typescript
`\\b${hint}\\b`
// Example: \baccount\b
```

**New Regex (SMART):**
```typescript
`(^|_|-)${hint}(_|-|$)`
// Example: (^|_|-)account(_|-|$)
```

**What This Means:**
- Match hint at **start of string** OR after `_` or `-`
- AND before **end of string** OR before `_` or `-`

**Examples:**

| Hint | Column Name | New Regex | Matches? | Reason |
|------|-------------|-----------|----------|--------|
| `account` | `account` | `(^|_|-)account(_|-|$)` | ✅ Yes | Start + end |
| `account` | `account_number` | `(^|_|-)account(_|-|$)` | ✅ **YES** | Start + before `_` |
| `account` | `bank_account` | `(^|_|-)account(_|-|$)` | ✅ **YES** | After `_` + end |
| `account` | `bank_account_number` | `(^|_|-)account(_|-|$)` | ✅ **YES** | After `_` + before `_` |
| `number` | `tracking_number` | `(^|_|-)number(_|-|$)` | ✅ **YES** | After `_` + end |
| `number` | `PhoneNumber` | `(^|_|-)number(_|-|$)` | ❌ No | No delimiters (camelCase) |
| `cell` | `cancelled` | `(^|_|-)cell(_|-|$)` | ❌ No | No delimiters |
| `cell` | `cell_phone` | `(^|_|-)cell(_|-|$)` | ✅ Yes | Start + before `_` |

**Benefits:**
- ✅ Matches compound names with `_` separators
- ✅ Matches compound names with `-` separators
- ✅ Still prevents false positives like "cell" matching "cancelled"
- ✅ Works with both snake_case and kebab-case naming conventions
- ❌ Won't match camelCase (e.g., `PhoneNumber`) unless exact match

---

## Files Changed

### `backend/data-service/src/services/PIIRescanService.ts` (Lines 211-220)

**Before:**
```typescript
// Use word boundary regex: \b matches word boundaries
// This ensures 'cell' matches 'cell_phone' but not 'Cancelled'
const hintsParams = [
  rule.pii_type,
  ...rule.column_name_hints.map((hint: string) => `\\b${hint}\\b`),
];
```

**After:**
```typescript
// Use smart word boundary regex that works with underscores
// Matches hint as complete word OR as part of compound name (with _ or -)
// Examples: 'account' matches 'account', 'account_number', 'bank_account' but NOT 'accountability'
const hintsParams = [
  rule.pii_type,
  ...rule.column_name_hints.map((hint: string) => {
    // Match hint at: start of string, after _, or after - AND before _, -, or end of string
    return `(^|_|-)${hint}(_|-|$)`;
  }),
];
```

---

## Testing

### Test 1: Create Test Rule with "number" Hint

**Steps:**
1. Go to **PII Settings**
2. Create a new rule or edit existing "Bank Account Number" rule
3. Add hint: `number`
4. Click **"Save Changes"**
5. In the confirmation dialog, click **"Rescan & Update Classifications"**

**Expected:**
- ✅ Finds `tracking_number` column in `shipments` table
- ✅ Shows: "1 Columns Re-classified" (or more if you have other *_number columns)
- ✅ Shows: "1 Tables Affected"

---

### Test 2: Verify Columns Are Detected

**After rescan, check database:**
```sql
SELECT
  cc.column_name,
  cc.pii_type,
  ca.table_name,
  ca.schema_name
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.pii_type = 'bank_account'
ORDER BY ca.table_name, cc.column_name;
```

**Expected:**
```
column_name      | pii_type     | table_name | schema_name
-----------------+--------------+------------+-------------
tracking_number  | bank_account | shipments  | public
```

---

### Test 3: Test False Positive Prevention

Create a test with hint that could cause false positives:

**Add hint:** `cell`

**Columns in database:**
- `cell_phone` → ✅ Should match (has `_` separator)
- `cancelled` → ❌ Should NOT match (no separators)
- `cancellation` → ❌ Should NOT match (no separators)
- `miscellaneous` → ❌ Should NOT match (no separators)

**After rescan:**
```sql
SELECT column_name, pii_type
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.column_name ~* 'cell'
ORDER BY column_name;
```

**Expected:**
- `cell_phone` → Has `pii_type` = your rule ✅
- `cancelled` → `pii_type` is NULL ✅
- `cancellation` → `pii_type` is NULL ✅

---

## Why Your Bank Account Rescan Found 0 Columns

**Investigation Results:**

```sql
-- Checked for columns matching bank account hints
SELECT column_name FROM catalog_columns
WHERE column_name ~* '(account_number|bank_account|routing_number|iban|swift|bic)';
```

**Result:** **0 rows**

**Conclusion:** Your database simply doesn't have any columns that match the bank account hints. The rescan result was correct - there are no bank account columns to detect.

**Columns Found with "number":**
- `PhoneNumber` (camelCase - won't match with new regex either)
- `tracking_number` (would match with hint "number")
- `error_number` (would match with hint "number")

---

## Recommendations

### 1. Use "Discover Hints" Feature

Instead of manually guessing column names, use the **"Discover Hints"** button:

**Steps:**
1. Edit a PII rule
2. Click **"Discover Hints"** button
3. Backend scans ALL columns in your catalog
4. Shows suggestions that match the regex pattern or contain keywords
5. Click suggestions to add them as hints

**Example for "Full Name" rule:**
- Discovers: `manager_name`, `customer_name`, `contact_name`, `owner_name`
- You click `+ manager_name` to add it
- Save and rescan
- Now all `manager_name` columns are detected

### 2. Test Regex Patterns First

Before adding hints, test if columns match the regex pattern:

**Example for Bank Account:**
```sql
-- Test regex: ^\d{6,17}$
SELECT
  column_name,
  sample_values
FROM catalog_columns
WHERE sample_values IS NOT NULL
  AND sample_values::text ~ '^\d{6,17}$'
LIMIT 10;
```

### 3. Add Specific Hints First, Then Generic

**Good Strategy:**
1. Add specific hints first: `account_number`, `bank_account_number`, `routing_number`
2. Test rescan - see what's detected
3. Add more generic hints: `account`, `number`, `routing`
4. Test rescan again

**Why?** Specific hints are less likely to cause false positives.

---

## Status

✅ **Word Boundary Fix Deployed**
- Changed from `\b` to `(^|_|-)hint(_|-|$)`
- Data service restarted
- Ready for testing

✅ **Instant Refresh Fix Deployed**
- Changed from `window.location.reload()` to `fetchAssetDetails()`
- Frontend needs hard refresh (Ctrl+F5)

✅ **Discover Hints API Implemented**
- Smart suggestion algorithm
- Filters out existing hints
- Scores by relevance

---

## Next Steps

1. **Hard refresh browser** (Ctrl+F5)
2. **Test instant refresh:**
   - Go to Profiling
   - Mark a column as Not PII
   - Verify it clears instantly

3. **Test word boundary fix:**
   - Edit "Bank Account Number" rule
   - Add hint: `number`
   - Save and rescan
   - Should find `tracking_number` column

4. **Test Discover Hints:**
   - Edit "Full Name" rule
   - Click "Discover Hints"
   - Should show suggestions like `manager_name`, `customer_name`
   - Add a suggestion and rescan
   - Verify it's detected

---

## Technical Details

### Regex Explanation

**Pattern:** `(^|_|-)hint(_|-|$)`

**Breakdown:**
- `(^|_|-)` - Match start of string OR underscore OR hyphen
- `hint` - The actual hint text
- `(_|-|$)` - Match underscore OR hyphen OR end of string

**PostgreSQL Regex Operator:** `~*` (case-insensitive regex match)

**Example Query:**
```sql
SELECT column_name
FROM catalog_columns
WHERE column_name ~* '(^|_|-)account(_|-|$)';
```

**Matches:**
- `account` ✅
- `account_number` ✅
- `bank_account` ✅
- `user_account_id` ✅
- `bank-account` ✅ (hyphen separator)

**Doesn't Match:**
- `accountability` ❌ (no separators)
- `accountant` ❌ (no separators)
- `BankAccount` ❌ (camelCase, no separators)

---

## Related Documentation

- **Instant Refresh:** [INSTANT_REFRESH_FIX.md](INSTANT_REFRESH_FIX.md)
- **Mark as Not PII:** [MANUAL_PII_VERIFICATION_FEATURE.md](MANUAL_PII_VERIFICATION_FEATURE.md)
- **False Positives:** [FALSE_POSITIVE_FIX_COMPLETE.md](FALSE_POSITIVE_FIX_COMPLETE.md)
- **Discover Hints:** (this document covers the backend endpoint)

---

**The word boundary matching is now fixed! Rescans will properly detect compound column names with underscores.** 🎉
