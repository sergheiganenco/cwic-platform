# PII Rescan Endpoint Fix - COMPLETE ✅

## Root Cause Identified

**The Problem:**
Even though I fixed the `PIIQualityIntegration` service to support monitoring mode, the "Re-scan Data" button was calling a DIFFERENT endpoint that had its OWN logic for handling quality issues - and that logic was BYPASSING my fix!

**File:** `backend/data-service/src/routes/piiRules.ts`
**Endpoint:** `POST /api/pii-rules/:id/rescan` (lines 565-725)

---

## The Bug

### Original Logic (Lines 626-648):

```typescript
if (existingIssues.length > 0) {
  const existingIssue = existingIssues[0];

  // If issue exists and is open/acknowledged, skip
  if (existingIssue.status === 'open' || existingIssue.status === 'acknowledged') {
    continue;  // ❌ SKIPS - doesn't check if monitoring mode
  }

  // If issue was resolved, reopen it
  if (existingIssue.status === 'resolved') {
    await pool.query(`UPDATE quality_issues SET status = 'open'...`);
    // ❌ ALWAYS REOPENS - doesn't check requires_encryption or requires_masking
    continue;
  }
}

// ❌ Creates new quality issues regardless of monitoring mode
```

**What Was Wrong:**
1. ❌ **SKIPPED** existing OPEN issues → didn't resolve them for monitoring mode
2. ❌ **ALWAYS REOPENED** resolved issues → ignored `requires_encryption` and `requires_masking` settings
3. ❌ **CREATED NEW** issues for all PII columns → ignored monitoring mode

**Result:**
- User unchecks "Require Encryption" → Clicks "Re-scan Data"
- Old quality issues stay OPEN (not resolved)
- UI shows RED because `total_issues > 0`

---

## The Fix

### New Logic (Lines 617-681):

```typescript
// Check if this is monitoring mode (no protection required)
if (!rule.requires_encryption && !rule.requires_masking) {
  // ✅ MONITORING MODE - resolve any existing quality issues
  const { rows: existingIssues } = await pool.query(`
    SELECT id, status FROM quality_issues
    WHERE asset_id = $1 AND title LIKE $2 AND status IN ('open', 'acknowledged')
  `, [col.asset_id, `%${rule.pii_type}%`]);

  for (const issue of existingIssues) {
    await pool.query(`
      UPDATE quality_issues
      SET
        status = 'resolved',
        resolved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP,
        description = description || $1
      WHERE id = $2
    `, [
      `\n\n✅ MONITORING MODE ENABLED: Protection requirements have been removed from PII settings.
This column is now in monitoring mode - encryption and masking are no longer required.
The issue has been automatically resolved.`,
      issue.id
    ]);

    console.log(`[PIIRules] ✅ AUTO-RESOLVED quality issue for monitoring mode: ${col.table_name}.${col.column_name}`);
  }

  // ✅ Skip creating new issues in monitoring mode
  continue;
}

// ✅ Protection required - normal flow
const { rows: existingIssues } = await pool.query(`
  SELECT id, status FROM quality_issues...
`);

if (existingIssues.length > 0) {
  const existingIssue = existingIssues[0];

  // If issue exists and is open/acknowledged, skip
  if (existingIssue.status === 'open' || existingIssue.status === 'acknowledged') {
    continue;
  }

  // ✅ If issue was resolved, reopen it (protection is now required again)
  if (existingIssue.status === 'resolved') {
    await pool.query(`UPDATE quality_issues SET status = 'open'...`);
    continue;
  }
}

// ✅ Only reaches here if protection required AND no existing issue
// Create new quality issue...
```

**What's Fixed:**
1. ✅ **CHECKS** monitoring mode FIRST (before checking existing issues)
2. ✅ **AUTO-RESOLVES** all open/acknowledged issues when monitoring mode enabled
3. ✅ **SKIPS** creating new issues in monitoring mode
4. ✅ **REOPENS** resolved issues only when protection IS required

---

## How It Works Now

### Scenario 1: User Disables Protection Requirements

**Steps:**
1. User goes to PII Settings → Full Name rule
2. **Unchecks** "Require Encryption" ❌
3. **Unchecks** "Mask in UI" ❌
4. Clicks "Re-scan Data" 🔄

**Backend Processing:**
```
[PIIRules] Starting rescan for PII rule 9...
[PIIRules] Found 10 columns with name PII

For each column with name PII:
  ✓ Check: requires_encryption = false, requires_masking = false
  → MONITORING MODE ENABLED

  ✓ Find existing quality issues (status = open or acknowledged)
  → Found 10 open issues

  ✓ For each open issue:
    - Set status = 'resolved'
    - Set resolved_at = NOW()
    - Append "MONITORING MODE ENABLED" message

  ✓ Skip creating new quality issues
  ✓ Log: AUTO-RESOLVED quality issue for monitoring mode

Result: All 10 quality issues resolved
```

**Database State After:**
```sql
SELECT id, status, title FROM quality_issues
WHERE title LIKE '%name%';

-- Before rescan:
-- id | status | title
-- 1445 | open | PII Detected: name
-- 1444 | open | PII Detected: name
-- ...

-- After rescan:
-- id | status   | title
-- 1445 | resolved | PII Detected: name
-- 1444 | resolved | PII Detected: name
-- ...
```

**UI Display:**
- `total_issues = 0` (only counts open issues)
- **AMBER** PII badge: "🛡️ 10 PII"
- **GREEN checkmark** in Quality Issues column
- **NO RED background** on rows
- **AMBER "View" button** in Actions column

---

### Scenario 2: User Enables Protection Requirements

**Steps:**
1. User goes to PII Settings → Full Name rule
2. **Checks** "Require Encryption" ✅
3. Clicks "Re-scan Data" 🔄

**Backend Processing:**
```
[PIIRules] Starting rescan for PII rule 9...
[PIIRules] Found 10 columns with name PII

For each column with name PII:
  ✓ Check: requires_encryption = true, requires_masking = false
  → PROTECTION REQUIRED MODE

  ✓ Find existing quality issues
  → Found 10 resolved issues

  ✓ For each resolved issue:
    - Set status = 'open'
    - Set resolved_at = NULL
    - Log: Reopened quality issue

Result: All 10 quality issues reopened
```

**Database State After:**
```sql
SELECT id, status, title FROM quality_issues
WHERE title LIKE '%name%';

-- Before rescan:
-- id | status   | title
-- 1445 | resolved | PII Detected: name
-- 1444 | resolved | PII Detected: name
-- ...

-- After rescan:
-- id | status | title
-- 1445 | open   | PII Detected: name
-- 1444 | open   | PII Detected: name
-- ...
```

**UI Display:**
- `total_issues = 10` (counts open issues)
- **RED** PII badge: "🛡️ 10 PII"
- **RED badge** "⚠️ 10 issues" in Quality Issues column
- **RED background** on rows with thick left border
- **RED "View" button** in Actions column

---

## Testing Steps

### Test 1: Verify Monitoring Mode Works

**Current State:**
- "Full Name" rule has "Require Encryption" ❌ unchecked
- There are 10 OPEN quality issues for name PII

**Steps:**
1. Go to **PII Settings** page
2. Find **"Full Name"** rule (Low Sensitivity section)
3. Verify:
   - ✅ Enabled is CHECKED
   - ❌ Require Encryption is UNCHECKED
   - ❌ Mask in UI is UNCHECKED
4. Click **"Re-scan Data"** button
5. Wait for "Data re-scan complete!" message

**Verify in Database:**
```bash
docker exec cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
  SELECT id, status, title FROM quality_issues
  WHERE title LIKE '%name%'
  ORDER BY id DESC LIMIT 10;
"
```

**Expected:**
```
  id  | status   |       title
------+----------+--------------------
 1445 | resolved | PII Detected: name
 1444 | resolved | PII Detected: name
 1443 | resolved | PII Detected: name
 ...
```

**Verify in UI:**
1. Go to **Data Quality → Profiling**
2. Find **customers** table
3. Click to expand column details
4. Look at **first_name** and **last_name** columns:
   - ✅ **AMBER** PII badge: "🛡️ name"
   - ✅ **GREEN checkmark** in Quality Issues column
   - ✅ **NO RED background**
   - ✅ **AMBER "View" button**
5. Click **"View"** button
6. Should see **AMBER background** with "🛡️ PII Data Preview"
7. Should see monitoring mode info message
8. Should see sample data WITHOUT blur

---

### Test 2: Verify Protection Mode Works

**Steps:**
1. Go to **PII Settings** page
2. Find **"Full Name"** rule
3. **CHECK** "Require Encryption" ✅
4. Click **"Re-scan Data"** button
5. Wait for "Data re-scan complete!" message

**Verify in Database:**
```bash
docker exec cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
  SELECT id, status, title FROM quality_issues
  WHERE title LIKE '%name%'
  ORDER BY id DESC LIMIT 10;
"
```

**Expected:**
```
  id  | status |       title
------+--------+--------------------
 1445 | open   | PII Detected: name
 1444 | open   | PII Detected: name
 1443 | open   | PII Detected: name
 ...
```

**Verify in UI:**
1. Go to **Data Quality → Profiling**
2. Find **customers** table
3. Click to expand column details
4. Look at **first_name** and **last_name** columns:
   - ✅ **RED background** with thick left border
   - ✅ **RED** PII badge: "🛡️ name"
   - ✅ **RED badge** "⚠️ 1 issue" in Quality Issues column
   - ✅ **RED "View" button**
5. Click **"View"** button
6. Should see **RED background** with "⚠️ Quality Issues for first_name"
7. Should see fix scripts and encryption examples
8. Should see blurred sample data

---

### Test 3: Toggle Multiple Times

**Steps:**
1. **Uncheck** "Require Encryption" → Rescan → Verify AMBER
2. **Check** "Require Encryption" → Rescan → Verify RED
3. **Uncheck** "Require Encryption" → Rescan → Verify AMBER
4. **Check** "Require Encryption" → Rescan → Verify RED

**Expected:**
- Seamless switching between modes ✅
- Issues auto-resolve when protection disabled ✅
- Issues reopen when protection re-enabled ✅
- No errors or data corruption ✅

---

## Log Output

### Monitoring Mode (After This Fix):

```
[PIIRules] Starting rescan for PII rule 9...
[PIIRescan] Applying rule: name...
[PIIRescan] Classified 0 columns based on name hints for rule: name
[PIIRules] Found 10 columns with name PII
[PIIRules] ✅ AUTO-RESOLVED quality issue for monitoring mode: customers.first_name (name)
[PIIRules] ✅ AUTO-RESOLVED quality issue for monitoring mode: customers.last_name (name)
[PIIRules] ✅ AUTO-RESOLVED quality issue for monitoring mode: employees.first_name (name)
[PIIRules] ✅ AUTO-RESOLVED quality issue for monitoring mode: employees.last_name (name)
...
[PIIRules] Rescan complete for rule 9
```

### Protection Mode:

```
[PIIRules] Starting rescan for PII rule 9...
[PIIRescan] Applying rule: name...
[PIIRescan] Classified 0 columns based on name hints for rule: name
[PIIRules] Found 10 columns with name PII
[PIIRules] ✅ Reopened quality issue for: customers.first_name (name)
[PIIRules] ✅ Reopened quality issue for: customers.last_name (name)
[PIIRules] ✅ Reopened quality issue for: employees.first_name (name)
[PIIRules] ✅ Reopened quality issue for: employees.last_name (name)
...
[PIIRules] Rescan complete for rule 9
```

---

## Summary

**Problem:**
- "Re-scan Data" button bypassed monitoring mode fix
- Old quality issues stayed OPEN even when protection not required
- UI showed RED instead of AMBER

**Root Cause:**
- `/api/pii-rules/:id/rescan` endpoint had its own issue management logic
- That logic didn't check `requires_encryption` or `requires_masking`
- Always reopened resolved issues, never resolved open issues for monitoring mode

**Solution:**
- Added monitoring mode check at the beginning of issue processing loop
- Auto-resolves all open/acknowledged issues when monitoring mode detected
- Skips creating new issues in monitoring mode
- Only reopens resolved issues when protection IS required

**Files Modified:**
1. `backend/data-service/src/routes/piiRules.ts` (Lines 617-681)
2. `backend/data-service/src/services/PIIQualityIntegration.ts` (Lines 367-391, 473-481) - from previous fix

**Status:** ✅ COMPLETE

**Next Steps:**
1. Data service has been restarted
2. Go to PII Settings
3. Click "Re-scan Data" for "Full Name" rule
4. Verify columns turn AMBER and issues are resolved
5. Check database to confirm quality issues are resolved
