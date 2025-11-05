# PII Protection Modes Explained

## Overview

The CWIC Platform offers **two separate protection mechanisms** for PII data:

1. **Requires Masking** (UI Display Protection)
2. **Requires Encryption** (Storage Protection)

These can be used **independently or together** depending on your security requirements.

---

## 1. Requires Masking (Masked UI)

### What It Does
**Hides PII data in the user interface** by replacing it with masked characters.

### Purpose
- Protects PII from being **viewed** by unauthorized users in the UI
- Prevents accidental exposure during screen sharing
- Reduces risk of shoulder surfing
- Allows authorized users to see masked preview

### How It Works

**Original Data**: `john.doe@email.com`

**Masked Display**: `j***@e*****.com` or `*************`

### Where Masking Applies
- Data Catalog views
- Sample data displays
- Search results
- Data profiling previews
- Quality issue details

### Example Use Cases
- **Email addresses**: Show first letter and domain
- **Phone numbers**: Show area code only: `(555) ***-****`
- **SSN**: Show last 4 digits: `***-**-1234`
- **Credit cards**: Show last 4: `**** **** **** 5678`

### Impact
✅ Data is **NOT encrypted at rest** in database
✅ Data can still be **queried and processed**
✅ Only affects **UI display**
❌ Does NOT protect data if database is compromised

---

## 2. Requires Encryption

### What It Does
**Encrypts PII data at rest** in the database using encryption algorithms.

### Purpose
- Protects PII if database is **compromised or stolen**
- Meets compliance requirements (GDPR, HIPAA, PCI-DSS)
- Secures backups and exports
- Protects against unauthorized database access

### How It Works

**Original Data**: `john.doe@email.com`

**Encrypted Storage**: `AES256(john.doe@email.com)` → `k8sj2n4m5...` (encrypted blob)

### Where Encryption Applies
- Database storage (at rest)
- Database backups
- Data exports
- Log files (if PII is logged)

### Example Encryption Methods
- **AES-256**: Industry standard symmetric encryption
- **Column-level encryption**: Encrypts specific columns
- **TDE (Transparent Data Encryption)**: Database-level encryption

### Impact
✅ Data is **encrypted at rest** in storage
✅ Protects against **database breaches**
✅ Meets **compliance requirements**
❌ Requires **decryption key management**
❌ May impact **query performance**
❌ Cannot use encrypted columns in WHERE clauses without decryption

---

## 3. Both Masking + Encryption

### What It Does
**Combines both protections** for maximum security.

### Purpose
- **Defense in depth**: Multiple layers of protection
- **Critical PII**: SSN, Credit Cards, Bank Accounts, Passports
- **Compliance**: Often required by regulations

### How It Works

**Storage (Database)**: Encrypted with AES-256
```
Encrypted: k8sj2n4m5p7q9r1t3u5v7w9x...
```

**Display (UI)**: Decrypted then masked
```
john.doe@email.com → j***@e*****.com
```

### Protection Layers

```
User Views UI → Sees Masked Data (j***@email.com)
     ↓
Application decrypts → Gets real data temporarily
     ↓
Database stores → Encrypted blob (k8sj2n4m5...)
```

### Example Use Cases
- **SSN**: Encrypted in DB + Show last 4 digits only
- **Credit Card**: Encrypted in DB + Show last 4 digits only
- **Bank Account**: Encrypted in DB + Fully masked
- **Passport**: Encrypted in DB + Show first 2 chars only

### Impact
✅ **Maximum security**: Protected at rest AND in display
✅ **Compliance**: Meets strictest regulations
✅ **Audit trail**: Can track who accessed encrypted data
❌ **Performance**: Decryption overhead for queries
❌ **Complexity**: Requires key management infrastructure

---

## 4. Neither (Monitoring Mode)

### What It Does
**Detects and tracks PII without enforcing protection**.

### Purpose
- **Discovery phase**: Identify where PII exists
- **Low-risk PII**: Names, general email addresses
- **Internal use**: Data that doesn't require strict protection
- **Monitoring**: Track PII usage without blocking access

### How It Works
- PII is **detected and flagged**
- Quality issues are **NOT created** (no alerts)
- Data is **visible** in UI (not masked)
- Data is **NOT encrypted** in database

### Example Use Cases
- **Employee names**: Internal directory, low risk
- **Email addresses**: Contact information, not sensitive
- **IP addresses**: Logs, analytics
- **Phone numbers**: Customer service, support

### Impact
✅ **No performance impact**: No encryption/decryption
✅ **Easy to query**: No special handling needed
✅ **Visibility**: Track where PII is used
❌ **No protection**: Data fully exposed if breached
❌ **No compliance**: Does NOT meet regulatory requirements

---

## Protection Mode Comparison

| Feature | Masked UI | Requires Encryption | Both | Neither |
|---------|-----------|---------------------|------|---------|
| **UI Display** | Masked (***) | Visible | Masked (***) | Visible |
| **Database Storage** | Plain text | Encrypted | Encrypted | Plain text |
| **Query Performance** | Normal | Slower | Slower | Normal |
| **Database Breach Risk** | High | Low | Low | High |
| **Screen Sharing Risk** | Low | High | Low | High |
| **Compliance** | Partial | Full | Full | None |
| **Key Management** | Not needed | Required | Required | Not needed |
| **Setup Complexity** | Low | High | High | None |

---

## Current Configuration (Your System)

Based on your database query:

### Critical PII (Both Masking + Encryption)
- ✅ SSN (Social Security Number)
- ✅ Credit Card Number
- ✅ Bank Account Number
- ✅ Driver's License
- ✅ Passport Number

### High-Risk PII (Masking Only)
- ✅ Date of Birth
- ✅ ZIP/Postal Code

### Low-Risk PII (Monitoring Mode - Neither)
- 📊 Email Address
- 📊 Phone Number
- 📊 Full Name
- 📊 IP Address
- 📊 Physical Address

---

## Can They Be Used Together?

**YES!** This is actually the **recommended approach** for critical PII.

### Configuration Options

```
┌─────────────────────┬─────────────────┬───────────────────┐
│ requires_masking    │ requires_       │ Result            │
│                     │ encryption      │                   │
├─────────────────────┼─────────────────┼───────────────────┤
│ ✅ true             │ ✅ true         │ Both (Maximum)    │
│ ✅ true             │ ❌ false        │ Masking Only      │
│ ❌ false            │ ✅ true         │ Encryption Only   │
│ ❌ false            │ ❌ false        │ Monitoring Mode   │
└─────────────────────┴─────────────────┴───────────────────┘
```

### Best Practice Recommendations

#### Use Both (Masking + Encryption) For:
- SSN
- Credit Card Numbers
- Bank Account Numbers
- Passport Numbers
- Driver's License Numbers
- Medical Record Numbers
- National ID Numbers

#### Use Masking Only For:
- Date of Birth
- ZIP Codes
- Partial email addresses (when full encryption not needed)
- Last 4 digits of phone numbers

#### Use Encryption Only For:
- Full medical records
- Financial transactions
- Legal documents
- Data that needs to be searched/queried but protected at rest

#### Use Neither (Monitoring) For:
- Generic email addresses
- Public phone numbers
- Employee names
- IP addresses (logs)
- General contact information

---

## Impact on Quality Issues

The protection settings determine **whether quality issues are created**:

### Both or Either Protection Required
```
requires_masking = true OR requires_encryption = true
→ Creates quality issue: "PII Detected: Requires Protection"
→ Severity: Based on sensitivity_level
→ Action: Encrypt/Mask the data
```

### Neither (Monitoring Mode)
```
requires_masking = false AND requires_encryption = false
→ NO quality issue created
→ PII is tracked but not flagged as a problem
→ Action: None required
```

### Example

**SSN Rule** (`requires_masking=true`, `requires_encryption=true`):
```
✅ PII detected in column: employees.ssn
⚠️ Quality Issue Created:
   Title: "PII Detected: ssn"
   Severity: critical
   Description: "Column contains SSN PII data.
                 ⚠️ ENCRYPT this column immediately
                 🔒 MASK in UI displays"
```

**Email Rule** (`requires_masking=false`, `requires_encryption=false`):
```
✅ PII detected in column: customers.email
📊 Monitoring Only: No quality issue created
   - Email is tracked as PII
   - No protection required
   - No alerts generated
```

---

## How to Configure

### Via PII Settings UI

1. Go to **Data Quality → PII Settings**
2. Click **Edit** on any PII rule
3. Configure protection:
   - ☑️ **Requires Masking**: Check to mask in UI
   - ☑️ **Requires Encryption**: Check to encrypt at rest
   - Can check **both**, **one**, or **neither**
4. **Save** changes
5. **Rescan** to apply new settings

### Via API

```bash
# Enable both masking and encryption for SSN
curl -X PUT http://localhost:3002/api/pii-rules/1 \
  -H "Content-Type: application/json" \
  -d '{
    "requires_masking": true,
    "requires_encryption": true
  }'

# Enable monitoring mode (neither) for email
curl -X PUT http://localhost:3002/api/pii-rules/8 \
  -H "Content-Type: application/json" \
  -d '{
    "requires_masking": false,
    "requires_encryption": false
  }'
```

### Via Database

```sql
-- Enable both for passport
UPDATE pii_rule_definitions
SET
  requires_masking = true,
  requires_encryption = true,
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'passport';

-- Enable monitoring mode for name
UPDATE pii_rule_definitions
SET
  requires_masking = false,
  requires_encryption = false,
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'name';
```

---

## Common Questions

### Q: Should I always use both?
**A**: No. Use based on sensitivity:
- Critical PII (SSN, Credit Card) → Both
- Sensitive PII (DOB, ZIP) → Masking only
- Low-risk PII (Name, Email) → Neither (monitoring)

### Q: Does masking slow down the application?
**A**: No. Masking is client-side transformation (fast).

### Q: Does encryption impact performance?
**A**: Yes. Encryption/decryption adds overhead. Use for critical PII only.

### Q: Can I change settings after deployment?
**A**: Yes! Change anytime and rescan to apply new rules.

### Q: What happens to existing quality issues when I change settings?
**A**:
- Disable protection → Issues auto-resolve
- Enable protection → New issues created for unprotected PII

### Q: Can users with permission still see encrypted data?
**A**: Yes, if they have decryption permissions. Masking is additional UI layer.

---

## Summary

### Quick Decision Matrix

| Sensitivity | Example | Masking | Encryption |
|-------------|---------|---------|------------|
| **Critical** | SSN, Credit Card | ✅ Yes | ✅ Yes |
| **High** | DOB, Passport | ✅ Yes | ⚠️ Maybe |
| **Medium** | Email, Phone | ⚠️ Maybe | ❌ No |
| **Low** | Name, IP | ❌ No | ❌ No |

**Remember**:
- **Masking** = UI protection (what users see)
- **Encryption** = Storage protection (how data is saved)
- **Both** = Maximum security (recommended for critical PII)
- **Neither** = Monitoring only (tracking without protection)

Choose based on your **security requirements**, **compliance needs**, and **risk assessment**!
