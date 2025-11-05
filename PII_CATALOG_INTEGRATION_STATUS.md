# PII Rules & Catalog Integration Status

## Current State

### ✅ What's Working

1. **PII Rules API** - All endpoints functional
   - GET /api/pii-rules - List all rules ✅
   - PUT /api/pii-rules/:id - Update rule settings ✅
   - POST /api/pii-rules/scan/:dataSourceId - Scan for PII ✅

2. **PII Settings UI** - Configuration page functional
   - Toggle rules on/off ✅
   - View all 12 default PII types ✅
   - See statistics (total, enabled, etc.) ✅

3. **Quality Issues Resolution** - Partially working
   - Disabling a rule tries to resolve quality issues ⚠️
   - Backend logic is in place ✅
   - Schema mismatch preventing full execution ❌

### ❌ What's Not Working

1. **Catalog PII Markers Not Clearing**
   - Problem: PII markers (`🔑 ip_address`) still show in catalog even after disabling rule
   - Root Cause: PII info stored in database during profiling/scanning
   - Impact: Disabled PII types still appear in UI

2. **Quality Issues Not Actually Resolving**
   - Problem: UPDATE query failing due to schema mismatch
   - Root Cause: `quality_issues` table structure doesn't match code expectations
   - Impact: Quality issues stay "open" even after disabling rule

## Root Causes

### Schema Mismatches

The code assumes certain columns exist in `quality_issues` table, but they don't:

**Expected** (by code):
```sql
quality_issues:
  - issue_type VARCHAR  -- ❌ Doesn't exist
  - resolution_notes TEXT  -- ❌ Doesn't exist
```

**Actual** (in database):
```sql
quality_issues:
  - title VARCHAR  -- ✅ Exists
  - status VARCHAR  -- ✅ Exists
  - resolved_at TIMESTAMP  -- ✅ Exists
  - rule_id UUID  -- ✅ Exists
```

### PII Storage Location Unknown

The catalog displays PII markers (`🔑 ip_address`), but we don't know where this data is stored:
- Not in `catalog_assets.data_classification` (column doesn't exist)
- Possibly in `catalog_columns` table
- Or generated dynamically from quality rules

## Recommended Solution

### Option 1: Database Migration (Best Long-term)

Add missing columns to `quality_issues` table:

```sql
-- Migration: 026_add_quality_issues_columns.sql
ALTER TABLE quality_issues
  ADD COLUMN IF NOT EXISTS issue_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Backfill issue_type from title
UPDATE quality_issues
SET issue_type = 'pii_detected'
WHERE title LIKE '%PII%';
```

Then update catalog schema to track PII:

```sql
ALTER TABLE catalog_assets
  ADD COLUMN IF NOT EXISTS pii_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pii_enabled BOOLEAN DEFAULT true;

-- Clear PII when rules disabled
UPDATE catalog_assets
SET pii_enabled = false
WHERE pii_type = 'ip_address';
```

### Option 2: Frontend Filtering (Quick Fix)

Don't change database, just filter in the UI:

```typescript
// Frontend: Fetch enabled PII types
const enabledPiiTypes = await fetch('/api/pii-rules/enabled')
  .then(r => r.json())
  .then(d => d.data.map(r => r.pii_type));

// Only show PII markers for enabled types
const shouldShowPII = column.pii_type &&
  enabledPiiTypes.includes(column.pii_type);

// In the table:
{shouldShowPII && <PII Badge piiType={column.pii_type} />}
```

**Pros**:
- No database changes required
- Works immediately
- Can toggle PII display on/off instantly

**Cons**:
- PII data still in database
- Doesn't fix quality issues resolution
- Not reflected in exports/API responses

### Option 3: Simplify to Quality Issues Only (Pragmatic)

Remove catalog PII markers entirely, only track in quality issues:

1. Stop storing PII type in catalog
2. Only create quality issues for PII violations
3. UI shows PII by querying quality issues, not catalog

**Pros**:
- Simpler data model
- Single source of truth
- Easier to maintain

**Cons**:
- Catalog loses PII information
- Slower queries (must join quality_issues)

## Immediate Actions

### For You to Test

1. **Go to PII Settings**: `http://localhost:3000/pii-settings`
2. **Toggle IP Address OFF**
3. **Refresh catalog page**
4. **Check if** `🔑 ip_address` still shows

### Expected Current Behavior

- ❌ PII marker still shows (catalog not updated)
- ❌ Quality issues still "open" (schema mismatch)
- ✅ Rule shows as disabled in PII Settings
- ✅ API returns success

### What We Can Do Now

**Quick Win**: Implement Option 2 (Frontend Filtering)
- Add endpoint: GET /api/pii-rules/enabled-types
- Frontend calls this on load
- Filter PII display client-side
- **Time**: ~30 minutes
- **Impact**: Immediate visual fix

**Long-term Fix**: Implement Option 1 (Database Migration)
- Create migration for missing columns
- Update code to use new schema
- Test end-to-end
- **Time**: ~2 hours
- **Impact**: Complete solution

## Current Code Status

**File**: `backend/data-service/src/routes/piiRules.ts`

**Lines 186-204**: PII rule disable handler

```typescript
// Currently tries to:
// 1. Resolve quality issues (FAILS - schema mismatch)
// 2. Clear catalog markers (REMOVED - column doesn't exist)

// Actual effect:
// - Rule gets disabled ✅
// - Quality issues stay open ❌
// - Catalog markers stay visible ❌
```

## Next Steps

**Choose one**:

1. ✅ **Quick Frontend Fix** (Recommended for now)
   - I can implement this right now
   - Filters PII display based on enabled rules
   - Doesn't fix underlying data, but UI looks correct

2. ⏳ **Full Database Fix** (Better long-term)
   - Requires migration
   - Fixes root cause
   - Takes longer to implement

3. 🤔 **Investigate Schema** (If unsure)
   - Find where PII markers are actually stored
   - Understand current data model
   - Then decide on approach

**What would you prefer?**

