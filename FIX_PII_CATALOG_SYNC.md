# Fix: PII Rules Not Syncing with Catalog

## Problem

When you disable a PII rule (e.g., IP Address), the PII markers still show in the catalog table:
- Column `description` shows `🔑 ip_address` in the PII column
- This is because the PII type is stored in `catalog_assets.data_classification` field
- Disabling the rule only resolves quality issues, not catalog metadata

## Root Cause

There are **two separate places** where PII information is stored:

1. **Quality Issues** (`quality_issues` table)
   - Status: `open`, `resolved`
   - ✅ **Already working** - Auto-resolved when rule disabled

2. **Catalog Metadata** (`catalog_assets` table)
   - Field: `data_classification` (stores PII type)
   - ❌ **Not synced** - Still shows disabled PII types

## Solution Options

### Option 1: Clear PII Metadata When Rule Disabled (Recommended)

Update the PII rule endpoint to also clear catalog metadata:

```typescript
// In backend/data-service/src/routes/piiRules.ts
// After resolving quality issues...

// Also clear PII classification from catalog
await pool.query(`
  UPDATE catalog_assets
  SET data_classification = NULL
  WHERE data_classification = $1
`, [piiType]);  // e.g., 'ip_address'
```

**Pros**:
- Immediate sync
- Catalog reflects current PII rules
- No orphaned PII markers

**Cons**:
- Loses historical PII detection data
- Can't distinguish "never detected" vs "rule disabled"

### Option 2: Add "Resync Catalog" Button

Add a manual sync button to PII Settings that updates catalog based on current rules:

```typescript
POST /api/pii-rules/resync-catalog

// For each enabled PII rule:
//   Scan catalog columns
//   Update data_classification based on current rules

// For disabled rules:
//   Clear data_classification
```

**Pros**:
- User controls when to sync
- Can review changes before applying
- Preserves data until explicit sync

**Cons**:
- Extra user action required
- Catalog can be out of sync

### Option 3: Use Enabled Flag in Frontend

Don't clear catalog data, but filter it in the frontend based on enabled rules:

```typescript
// Frontend checks if PII type is enabled before showing
const enabledPiiTypes = await fetch('/api/pii-rules/enabled')
  .then(r => r.json())
  .then(d => d.data.map(r => r.pii_type));

// Only show PII markers for enabled types
if (column.data_classification &&
    enabledPiiTypes.includes(column.data_classification)) {
  // Show PII marker
}
```

**Pros**:
- No database changes
- Catalog data preserved
- Fast toggle on/off

**Cons**:
- Requires frontend changes
- PII data still in database
- Not reflected in exports/reports

## Recommended Implementation

**Implement Option 1** (Clear metadata) + **Option 3** (Frontend filter) for best results:

### Backend Change

```typescript
// backend/data-service/src/routes/piiRules.ts
// When disabling a PII rule:

if (typeof is_enabled === 'boolean' && !is_enabled && wasEnabled) {
  console.log(`Closing quality issues for disabled PII rule: ${piiType}`);

  // 1. Resolve quality issues (already done)
  await pool.query(`...`);

  // 2. Clear catalog PII markers
  await pool.query(`
    UPDATE catalog_assets
    SET data_classification = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE data_classification = $1
      AND asset_type = 'column'
  `, [piiType]);

  console.log(`Cleared PII markers from catalog for: ${piiType}`);
}
```

### Frontend Change (Optional Enhancement)

```typescript
// frontend/src/components/quality/DetailedAssetView.tsx
// Filter PII display based on enabled rules

const [enabledPiiTypes, setEnabledPiiTypes] = useState<string[]>([]);

useEffect(() => {
  fetch('/api/pii-rules/enabled')
    .then(r => r.json())
    .then(d => setEnabledPiiTypes(d.data.map(r => r.pii_type)));
}, []);

// When rendering PII column:
const shouldShowPII = column.data_classification &&
  enabledPiiTypes.includes(column.data_classification);
```

## Implementation Steps

1. ✅ Update `piiRules.ts` to clear catalog metadata
2. ✅ Add logging for tracking
3. ✅ Test: Disable IP Address rule
4. ✅ Verify: `catalog_assets.data_classification` cleared
5. ✅ Verify: PII column no longer shows `ip_address`
6. ⏳ (Optional) Add frontend filter for extra safety

## Testing

### Before Fix
```sql
SELECT id, column_name, data_classification
FROM catalog_assets
WHERE data_classification = 'ip_address';

-- Returns rows with ip_address classification
```

### Disable IP Address Rule
```bash
curl -X PUT http://localhost:8000/api/pii-rules/8 \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": false}'
```

### After Fix
```sql
SELECT id, column_name, data_classification
FROM catalog_assets
WHERE data_classification = 'ip_address';

-- Should return 0 rows (cleared)
```

### Verify in UI
1. Go to Data Catalog
2. View table with IP address columns
3. PII column should show `-` (no PII detected)
4. Issues count should be `0` or only show non-PII issues

## Expected Behavior

**When disabling a PII rule**:
- ✅ Quality issues → Resolved
- ✅ Catalog PII markers → Cleared
- ✅ Issues count → Updated
- ✅ UI shows no PII for that type

**When re-enabling a PII rule**:
- ⚠️ Quality issues stay resolved (historical)
- ⚠️ Catalog markers stay cleared
- ✅ Need to run new scan to re-detect PII

## Notes

- Clearing catalog metadata is **safe** because it can be regenerated by running a PII scan
- Quality issues are preserved as audit trail (status=resolved)
- Re-enabling a rule doesn't auto-repopulate - must run scan
- This ensures catalog always reflects current PII configuration

