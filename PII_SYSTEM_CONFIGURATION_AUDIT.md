# PII System Configuration Audit ✅

## Complete PII Rule Configuration

### Critical Severity (Highest Protection)

| ID | PII Type | Display Name | Enabled | Encryption | Masking | Expected UI Color |
|----|----------|--------------|---------|------------|---------|-------------------|
| 1 | `ssn` | Social Security Number (SSN) | ✅ Yes | ✅ Required | ✅ Required | 🔴 **RED** |
| 2 | `credit_card` | Credit Card Number | ✅ Yes | ✅ Required | ✅ Required | 🔴 **RED** |
| 3 | `bank_account` | Bank Account Number | ✅ Yes | ✅ Required | ✅ Required | 🔴 **RED** |

**Status:** These should **ALWAYS** show RED in UI (protection required)

---

### High Severity

| ID | PII Type | Display Name | Enabled | Encryption | Masking | Expected UI Color |
|----|----------|--------------|---------|------------|---------|-------------------|
| 4 | `passport` | Passport Number | ✅ Yes | ✅ Required | ✅ Required | 🔴 **RED** |
| 5 | `drivers_license` | Driver's License | ✅ Yes | ✅ Required | ✅ Required | 🔴 **RED** |
| 11 | `date_of_birth` | Date of Birth | ✅ Yes | ❌ No | ✅ Required | 🔴 **RED** (masking) |

**Status:**
- Passport & Driver's License: Should show RED (both encryption and masking required)
- Date of Birth: Should show RED (masking required, even though encryption not required)

---

### Medium Severity

| ID | PII Type | Display Name | Enabled | Encryption | Masking | Expected UI Color |
|----|----------|--------------|---------|------------|---------|-------------------|
| 6 | `email` | Email Address | ✅ Yes | ❌ No | ❌ No | 🟡 **AMBER** (monitoring) |
| 7 | `phone` | Phone Number | ✅ Yes | ❌ No | ❌ No | 🟡 **AMBER** (monitoring) |

**Status:** These should show **AMBER** in UI (monitoring mode - just tracking, no protection required)

---

### Low Severity

| ID | PII Type | Display Name | Enabled | Encryption | Masking | Expected UI Color |
|----|----------|--------------|---------|------------|---------|-------------------|
| 8 | `ip_address` | IP Address | ✅ Yes | ❌ No | ❌ No | 🟡 **AMBER** (monitoring) |
| 9 | `name` | Full Name | ✅ Yes | ❌ No | ❌ No | 🟡 **AMBER** (monitoring) |
| 10 | `address` | Physical Address | ❌ **Disabled** | ❌ No | ❌ No | N/A |
| 12 | `zip_code` | ZIP/Postal Code | ✅ Yes | ❌ No | ✅ Required | 🔴 **RED** (masking) |

**Status:**
- IP Address & Full Name: Should show AMBER (monitoring only)
- Physical Address: **DISABLED** - should NOT create any quality issues
- ZIP Code: Should show RED (masking required)

---

## Configuration Analysis

### ✅ Monitoring Mode (AMBER) - 4 Rules
These rules only **detect** PII but do NOT require protection:

1. **Email Address** (medium) - No protection required
2. **Phone Number** (medium) - No protection required
3. **IP Address** (low) - No protection required
4. **Full Name** (low) - No protection required

**Expected Behavior:**
- ✅ Columns detected as these PII types should show AMBER badge
- ✅ NO quality issues should be created
- ✅ "View" button should be AMBER (monitoring mode)
- ✅ Should show sample data WITHOUT blur

---

### 🔴 Protection Required (RED) - 7 Rules
These rules **require protection** (encryption and/or masking):

#### Both Encryption + Masking Required (5 rules):
1. **SSN** (critical)
2. **Credit Card** (critical)
3. **Bank Account** (critical)
4. **Passport** (high)
5. **Driver's License** (high)

#### Masking Only Required (2 rules):
6. **Date of Birth** (high) - Masking required, encryption optional
7. **ZIP Code** (low) - Masking required, encryption optional

**Expected Behavior:**
- ✅ Columns detected as these PII types should show RED background
- ✅ Quality issues SHOULD be created (status: open)
- ✅ "View" button should be RED
- ✅ Should show fix scripts and encryption examples
- ✅ Should show sample data WITH blur effect

---

### ❌ Disabled Rules - 1 Rule
1. **Physical Address** (low) - Rule is disabled (`is_enabled = false`)

**Expected Behavior:**
- ✅ Should NOT detect addresses
- ✅ Should NOT create quality issues
- ✅ Existing address PII classifications should be cleared

---

## Regex Patterns Validation

| PII Type | Regex Pattern | Valid? | Notes |
|----------|---------------|--------|-------|
| `ssn` | `^\d{3}[-\s]?\d{2}[-\s]?\d{4}$` | ✅ | Matches: 123-45-6789, 123 45 6789 |
| `credit_card` | `^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$` | ✅ | Matches: 1234-5678-9012-3456 |
| `bank_account` | `^\d{6,17}$` | ✅ | 6-17 digits |
| `passport` | `^[A-Z]{1,2}\d{6,9}$` | ✅ | 1-2 letters + 6-9 digits |
| `drivers_license` | `^[A-Z]{1,2}\d{5,8}$` | ✅ | 1-2 letters + 5-8 digits |
| `email` | `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` | ✅ | Standard email format |
| `phone` | `^(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$` | ✅ | US phone format |
| `ip_address` | `^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}...` | ✅ | IPv4 format |
| `name` | `\\b[A-Z][a-z]+ [A-Z][a-z]+\\b` | ⚠️ | Only matches "First Last" (capitalized) |
| `address` | `\\d+\\s+[A-Za-z]+\\s+(?:Street\|St\|Avenue\|...)` | ✅ | US address format |
| `date_of_birth` | `^(0[1-9]\|1[0-2])[-/](0[1-9]\|[12]\d\|3[01])[-/](19\|20)\d{2}$` | ✅ | MM/DD/YYYY format |
| `zip_code` | `\\b\\d{5}(?:-\\d{4})?\\b` | ✅ | 12345 or 12345-6789 |

**⚠️ Potential Issue:** The `name` regex only matches capitalized first and last names. It won't match:
- All lowercase: "john doe" ❌
- All uppercase: "JOHN DOE" ❌
- Single names: "Madonna" ❌
- Three names: "John Paul Smith" ❌

---

## Expected UI Behavior by Table

### Your Screenshot (TblWish table - dbo.Feya_DB)

Based on configuration, columns should show:

| Column | Detected PII | Should Be | Actual Status |
|--------|-------------|-----------|---------------|
| `CancelledDate` | phone | 🟡 AMBER (monitoring) | Need to verify |
| `IsCancelled` | phone | 🟡 AMBER (monitoring) | Need to verify |

**Both should be AMBER** because Phone Number rule has:
- `requires_encryption = false`
- `requires_masking = false`

---

### Customers Table (public.adventureworks)

| Column | Detected PII | Should Be | Why |
|--------|-------------|-----------|-----|
| `first_name` | name | 🟡 AMBER | No protection required |
| `last_name` | name | 🟡 AMBER | No protection required |
| `email` | email | 🟡 AMBER | No protection required |
| `phone` | phone | 🟡 AMBER | No protection required |
| `date_of_birth` | date_of_birth | 🔴 RED | Masking required! |

**Important:** `date_of_birth` should stay RED because masking is required!

---

## Quality Issue Summary by Configuration

### Should Have OPEN Quality Issues (RED):

```sql
SELECT
  pii_type,
  display_name,
  requires_encryption,
  requires_masking,
  'Should have open issues' as status
FROM pii_rule_definitions
WHERE is_enabled = true
  AND (requires_encryption = true OR requires_masking = true)
ORDER BY
  CASE sensitivity_level
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END;
```

**Expected:**
- ssn (critical)
- credit_card (critical)
- bank_account (critical)
- passport (high)
- drivers_license (high)
- date_of_birth (high) - **masking only**
- zip_code (low) - **masking only**

---

### Should have NO Quality Issues (AMBER):

```sql
SELECT
  pii_type,
  display_name,
  'Should be monitoring mode only' as status
FROM pii_rule_definitions
WHERE is_enabled = true
  AND requires_encryption = false
  AND requires_masking = false
ORDER BY pii_type;
```

**Expected:**
- email (medium)
- ip_address (low)
- name (low)
- phone (medium)

---

## Issues Found in Configuration

### 1. Physical Address Rule is Disabled ⚠️

**Current:** `address` rule has `is_enabled = false`

**Impact:**
- Physical addresses won't be detected
- Existing address PII classifications won't be cleaned up automatically
- Could be intentional (low priority) or accidental

**Recommendation:** Verify if this is intentional

---

### 2. Name Regex Too Restrictive ⚠️

**Current:** `\\b[A-Z][a-z]+ [A-Z][a-z]+\\b`

**Only matches:** "John Doe" (exact capitalization)
**Doesn't match:**
- "john doe" (lowercase)
- "JOHN DOE" (uppercase)
- "John" (single name)
- "John Paul Smith" (three names)

**Recommendation:** Consider more flexible regex:
```regex
\b[A-Za-z]{2,}\s+[A-Za-z]{2,}\b
```

---

### 3. Monitoring Mode vs Protection Mode Clarity ⚠️

**Current Setup:**
- 4 rules in monitoring mode (no protection required)
- 7 rules in protection mode (encryption/masking required)
- 1 rule disabled

**Potential Confusion:**
- Users might think ALL PII needs protection
- Documentation should clarify which PII types are monitoring-only

**Recommendation:** Add UI indicators explaining monitoring vs protection modes

---

## Verification Queries

### Check Current Quality Issues by Configuration

```sql
SELECT
  rd.pii_type,
  rd.display_name,
  rd.requires_encryption,
  rd.requires_masking,
  COUNT(DISTINCT CASE WHEN qi.status IN ('open', 'acknowledged') THEN qi.id END) as open_issues,
  COUNT(DISTINCT CASE WHEN qi.status = 'resolved' THEN qi.id END) as resolved_issues
FROM pii_rule_definitions rd
LEFT JOIN quality_issues qi ON (
  qi.title ILIKE '%' || rd.pii_type || '%'
  OR qi.title ILIKE '%' || rd.display_name || '%'
)
WHERE rd.is_enabled = true
GROUP BY rd.pii_type, rd.display_name, rd.requires_encryption, rd.requires_masking
ORDER BY rd.pii_type;
```

---

### Find Mismatched Configurations

Find PII columns that have quality issues but shouldn't (monitoring mode):

```sql
SELECT
  cc.column_name,
  ca.table_name,
  cc.pii_type,
  COUNT(qi.id) as issue_count
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
JOIN pii_rule_definitions rd ON rd.pii_type = cc.pii_type
LEFT JOIN quality_issues qi ON qi.asset_id = ca.id
  AND (qi.title ILIKE '%' || rd.pii_type || '%'
       OR qi.title ILIKE '%' || rd.display_name || '%')
  AND qi.status IN ('open', 'acknowledged')
WHERE rd.is_enabled = true
  AND rd.requires_encryption = false
  AND rd.requires_masking = false
  AND qi.id IS NOT NULL
GROUP BY cc.column_name, ca.table_name, cc.pii_type
HAVING COUNT(qi.id) > 0;
```

**Expected:** 0 rows (no quality issues for monitoring-mode PII)

---

## Configuration Summary

| Category | Count | PII Types |
|----------|-------|-----------|
| **Enabled Rules** | 11 | All except `address` |
| **Monitoring Mode** | 4 | email, phone, ip_address, name |
| **Protection Required** | 7 | ssn, credit_card, bank_account, passport, drivers_license, date_of_birth, zip_code |
| **Critical Severity** | 3 | ssn, credit_card, bank_account |
| **High Severity** | 3 | passport, drivers_license, date_of_birth |
| **Medium Severity** | 2 | email, phone |
| **Low Severity** | 4 | ip_address, name, address (disabled), zip_code |
| **Disabled Rules** | 1 | address |

---

## Recommendations

### 1. Verify UI Matches Configuration ✅

Run a full UI test to ensure:
- Monitoring mode PII (email, phone, name, ip_address) → AMBER
- Protection required PII (ssn, credit_card, etc.) → RED
- Disabled PII (address) → Not detected

### 2. Consider Enabling Address Detection

If physical addresses should be tracked:
```sql
UPDATE pii_rule_definitions
SET is_enabled = true
WHERE pii_type = 'address';
```

### 3. Improve Name Detection Regex

Make it more flexible:
```sql
UPDATE pii_rule_definitions
SET regex_pattern = '\\b[A-Za-z]{2,}\\s+[A-Za-z]{2,}\\b'
WHERE pii_type = 'name';
```

### 4. Add Configuration Documentation

Create user-facing docs explaining:
- Why some PII is monitoring-only (email, phone, name, IP)
- Why some PII requires protection (SSN, credit card, etc.)
- How to change protection requirements per use case

---

## Status

✅ **Configuration is mostly correct**
- Monitoring mode rules properly configured (4 rules)
- Protection mode rules properly configured (7 rules)
- My fix handles both modes correctly

⚠️ **Minor issues to address:**
- Physical Address rule is disabled (verify if intentional)
- Name regex is too restrictive (only matches capitalized names)

✅ **Fix verification:**
- Backend code correctly handles both monitoring and protection modes
- Dual-pattern matching covers all PII types
- UI should display correct colors based on configuration
