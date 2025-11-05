# Mark as PII - Dynamic Dropdown Fix

## Problem Reported

User noticed that the "Mark as PII" dropdown showed ALL PII types, including **disabled** ones like "address".

**Issue**: When a PII rule is disabled in PII Settings, users should NOT be able to mark columns with that PII type because:
1. Disabled PII types won't be detected on scans
2. Quality issues won't be created for disabled types
3. It's confusing to allow marking with disabled types
4. Violates the principle of least surprise

---

## Root Cause

The "Mark as PII" dropdown in [DetailedAssetView.tsx](frontend/src/components/quality/DetailedAssetView.tsx) was **hardcoded** with all possible PII types:

```tsx
// BEFORE (Hardcoded - Bad)
<select>
  <option value="">🏷️ Mark as PII...</option>
  <option value="name">👤 Full Name</option>
  <option value="email">📧 Email</option>
  <option value="phone">📞 Phone Number</option>
  <option value="ssn">🔢 SSN</option>
  <option value="credit_card">💳 Credit Card</option>
  <option value="date_of_birth">🎂 Date of Birth</option>
  <option value="address">🏠 Address</option>  {/* ❌ This is DISABLED! */}
  <option value="ip_address">🌐 IP Address</option>
  <option value="driver_license">🚗 Driver License</option>
  <option value="passport">✈️ Passport</option>
  <option value="zip_code">📮 ZIP Code</option>
  <option value="bank_account">🏦 Bank Account</option>
</select>
```

**Problem**: "address" PII type is disabled (`is_enabled = false`) but still appears in the dropdown.

---

## Solution

Made the dropdown **dynamic** by fetching from the `/api/pii-rules/enabled` endpoint.

### Changes Made

**File**: [frontend/src/components/quality/DetailedAssetView.tsx](frontend/src/components/quality/DetailedAssetView.tsx)

#### 1. Added State for Enabled PII Rules

```typescript
interface PIIRuleOption {
  pii_type: string;
  display_name: string;
  sensitivity_level: string;
}

const [enabledPIIRules, setEnabledPIIRules] = useState<PIIRuleOption[]>([]);
```

#### 2. Added Fetch Function

```typescript
const fetchEnabledPIIRules = async () => {
  try {
    const response = await fetch('/api/pii-rules/enabled');
    const result = await response.json();

    if (result.success && result.data) {
      setEnabledPIIRules(result.data);
    }
  } catch (error) {
    console.error('Failed to fetch enabled PII rules:', error);
    setEnabledPIIRules([]);
  }
};
```

#### 3. Updated useEffect to Fetch on Mount

```typescript
useEffect(() => {
  fetchAssetDetails();
  fetchEnabledPIIRules();  // ✅ Fetch enabled rules
}, [assetId]);
```

#### 4. Updated Cross-Tab Sync to Refresh Rules

```typescript
const refreshDataSeamlessly = () => {
  console.log('[DetailedAssetView] PII config changed, refreshing columns and PII rules...');
  fetchAssetDetails();
  fetchEnabledPIIRules();  // ✅ Refresh when PII config changes
};
```

#### 5. Made Dropdown Dynamic

```tsx
// AFTER (Dynamic - Good)
<select>
  <option value="">🏷️ Mark as PII...</option>
  {enabledPIIRules.map(rule => {
    const getIcon = (type: string) => {
      const icons: Record<string, string> = {
        name: '👤',
        email: '📧',
        phone: '📞',
        ssn: '🔢',
        credit_card: '💳',
        date_of_birth: '🎂',
        address: '🏠',
        ip_address: '🌐',
        drivers_license: '🚗',
        passport: '✈️',
        zip_code: '📮',
        bank_account: '🏦'
      };
      return icons[type] || '🔒';
    };

    return (
      <option key={rule.pii_type} value={rule.pii_type}>
        {getIcon(rule.pii_type)} {rule.display_name}
      </option>
    );
  })}
</select>
```

---

## API Endpoint Used

**GET** `/api/pii-rules/enabled`

**Implementation**: [backend/data-service/src/routes/piiRules.ts:67-94](backend/data-service/src/routes/piiRules.ts#L67-94)

```typescript
router.get('/enabled', async (req: Request, res: Response) => {
  try {
    const tenantId = 1;

    const { rows } = await pool.query(
      `SELECT
        pii_type,
        display_name,
        regex_pattern,
        column_name_hints,
        sensitivity_level,
        compliance_flags,
        requires_encryption,
        requires_masking
       FROM pii_rule_definitions
       WHERE tenant_id = $1 AND is_enabled = true  -- ✅ Only enabled rules
       ORDER BY
         CASE sensitivity_level
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END`,
      [tenantId]
    );

    ok(res, rows);
  } catch (error: any) {
    console.error('Error fetching enabled PII rules:', error);
    fail(res, 500, error.message);
  }
});
```

**Response** (as of now):
```json
{
  "success": true,
  "data": [
    {"pii_type": "ssn", "display_name": "Social Security Number (SSN)", ...},
    {"pii_type": "bank_account", "display_name": "Bank Account Number", ...},
    {"pii_type": "credit_card", "display_name": "Credit Card Number", ...},
    {"pii_type": "date_of_birth", "display_name": "Date of Birth", ...},
    {"pii_type": "drivers_license", "display_name": "Driver's License", ...},
    {"pii_type": "passport", "display_name": "Passport Number", ...},
    {"pii_type": "email", "display_name": "Email Address", ...},
    {"pii_type": "phone", "display_name": "Phone Number", ...},
    {"pii_type": "name", "display_name": "Full Name", ...},
    {"pii_type": "ip_address", "display_name": "IP Address", ...},
    {"pii_type": "zip_code", "display_name": "ZIP/Postal Code", ...}
    // ❌ "address" NOT included because is_enabled = false
  ]
}
```

---

## Current PII Rule Status

From database:
```sql
SELECT pii_type, display_name, is_enabled FROM pii_rule_definitions;
```

| PII Type | Display Name | Enabled |
|----------|--------------|---------|
| ssn | Social Security Number (SSN) | ✅ true |
| bank_account | Bank Account Number | ✅ true |
| credit_card | Credit Card Number | ✅ true |
| date_of_birth | Date of Birth | ✅ true |
| drivers_license | Driver's License | ✅ true |
| passport | Passport Number | ✅ true |
| email | Email Address | ✅ true |
| phone | Phone Number | ✅ true |
| name | Full Name | ✅ true |
| ip_address | IP Address | ✅ true |
| **address** | **Physical Address** | ❌ **false** |
| zip_code | ZIP/Postal Code | ✅ true |

**Total**: 12 PII types defined, 11 enabled, 1 disabled

---

## Benefits of Dynamic Dropdown

### 1. Respects PII Rule Configuration
- If admin disables a PII type, it immediately disappears from all "Mark as PII" dropdowns
- No stale or inconsistent UI

### 2. Prevents User Errors
- Users can't mark columns with disabled PII types
- Avoids confusion when disabled types don't create quality issues

### 3. Real-Time Updates
- When PII rules are enabled/disabled in PII Settings, the dropdown updates automatically
- Cross-tab synchronization ensures all open tabs stay in sync

### 4. Future-Proof
- When new PII types are added, they automatically appear in dropdowns
- No need to update frontend code for new PII types

### 5. Centralized Control
- Single source of truth: `pii_rule_definitions.is_enabled`
- Backend controls what's available in UI

---

## Testing

### Test Case 1: Verify "address" is NOT in Dropdown

**Before Fix**:
1. Open Data Catalog
2. View any table (e.g., Feya_DB.dbo.User)
3. Click on a column without PII
4. Check "Mark as PII" dropdown
5. ❌ "🏠 Address" appears in the list

**After Fix**:
1. Open Data Catalog
2. View any table
3. Click on a column without PII
4. Check "Mark as PII" dropdown
5. ✅ "🏠 Address" does NOT appear
6. ✅ Only 11 enabled PII types show

### Test Case 2: Enable/Disable PII Rule

**Steps**:
1. Go to Data Quality → PII Settings
2. Find "address" PII rule
3. Toggle "Enabled" switch to ON
4. Go back to Data Catalog → View table
5. ✅ "🏠 Address" now appears in dropdown
6. Go back to PII Settings
7. Toggle "address" to OFF
8. Go back to Data Catalog
9. ✅ "🏠 Address" disappears from dropdown

**Expected**: Dropdown updates in real-time with cross-tab sync

### Test Case 3: Create New PII Rule

**Steps**:
1. Go to PII Settings
2. Create new PII rule (e.g., "employee_id")
3. Set `is_enabled = true`
4. Go to Data Catalog → View table
5. ✅ New "Employee ID" appears in dropdown

---

## Cross-Tab Synchronization

The fix includes cross-tab sync so that changes in PII Settings are immediately reflected in all open Data Catalog tabs:

```typescript
const refreshDataSeamlessly = () => {
  console.log('[DetailedAssetView] PII config changed, refreshing columns and PII rules...');
  fetchAssetDetails();        // Refresh columns (PII classifications)
  fetchEnabledPIIRules();     // Refresh dropdown options
};

const handleStorageChange = (e: StorageEvent) => {
  if (e.key === 'pii-config-update' && e.newValue) {
    const timestamp = parseInt(e.newValue, 10);
    if (timestamp > lastProcessedTimestamp) {
      lastProcessedTimestamp = timestamp;
      refreshDataSeamlessly();
    }
  }
};

window.addEventListener('storage', handleStorageChange);
```

**How it works**:
1. User enables/disables PII rule in PII Settings
2. PII Settings triggers `localStorage.setItem('pii-config-update', Date.now())`
3. All other tabs listen for `storage` events
4. When detected, they refresh enabled PII rules
5. Dropdowns update automatically

---

## Error Handling

If API call fails, dropdown gracefully degrades to empty:

```typescript
const fetchEnabledPIIRules = async () => {
  try {
    const response = await fetch('/api/pii-rules/enabled');
    const result = await response.json();

    if (result.success && result.data) {
      setEnabledPIIRules(result.data);
    }
  } catch (error) {
    console.error('Failed to fetch enabled PII rules:', error);
    setEnabledPIIRules([]);  // ✅ Empty array - dropdown shows only "Mark as PII..."
  }
};
```

**User Experience**:
- If API fails, dropdown shows: "🏷️ Mark as PII..." with no options
- User can still use "Mark as Not PII" if column is already classified
- No crashes or blank screens

---

## Summary

### Before
- ❌ Hardcoded list of 12 PII types
- ❌ Showed disabled "address" PII type
- ❌ Required frontend changes for new PII types
- ❌ Inconsistent with PII Settings

### After
- ✅ Dynamic list from `/api/pii-rules/enabled`
- ✅ Only shows 11 enabled PII types
- ✅ Automatically includes new PII types
- ✅ Consistent with PII Settings
- ✅ Real-time updates with cross-tab sync

### User's Question
> "One more thing it's a bug or feature I just marked on column as PII from the list but the PII Rule is disabled, we should restrict that from marking as PII or display only active PII in Mark PII"

**Answer**: You're absolutely right - this was a bug! We've now fixed it to only show active (enabled) PII rules in the "Mark as PII" dropdown. The "address" PII type is disabled and will no longer appear in the dropdown.

---

## Status

✅ **FIXED** - Mark as PII dropdown now dynamically shows only enabled PII rules

**Files Changed**:
1. [frontend/src/components/quality/DetailedAssetView.tsx](frontend/src/components/quality/DetailedAssetView.tsx)

**Ready for Testing**: The dropdown will now only show enabled PII types, and will update automatically when PII rules are enabled/disabled.
