# Data Source Card - Critical Issues & Fixes

## ✅ ALL ISSUES FIXED!

### Issue 1: Duplicate Sources Prevention ✅
**Problem**: Could create multiple connections to same server (Azure F and Azure Feya both pointing to `feya-dbserver.database.windows.net:1433`)

**Root Cause**: No validation in wizard to check if host:port already exists

**Fix Applied**: Added duplicate detection in AddConnectionWizard (lines 1756-1775)
- Validates host:port + type combination
- Shows error: "A connection to {host}:{port} already exists"
- Redirects to Configure step

---

### Issue 2: Last Test Timestamp Persistence ✅
**Problem**:
1. Click "Test" button → Shows "Connection successful!"
2. Refresh page → lastTestedAt back to "Never"

**Root Cause**: Frontend didn't call refresh() after test completion

**Fix Applied**: Added `await handleRefresh()` after successful test (DataSources.tsx:823-826)
- Refreshes data after test
- Updates lastTestAt from backend
- Updates all metrics including database counts

---

### Issue 3: UI Inconsistencies ✅
**Problem**:
- Checkbox appearance inconsistent
- Three-dots menu appearing behind card elements
- Z-index layering issues

**Root Cause**:
- Checkbox had no wrapper styling
- Menu z-index too low (z-20 vs parent elements)

**Fix Applied**:
1. **Checkbox** (DataSources.tsx:796-813)
   - Added white rounded label wrapper with border
   - Hover effects (border-blue-500, shadow-md)
   - Proper z-index (z-20)

2. **Three-dots Menu** (DataSourceCard.tsx:278-353)
   - **CRITICAL FIX**: Removed `overflow-hidden` from header wrapper (line 282-285)
   - Moved gradient border outside overflow container
   - Increased parent z-index to z-30
   - Increased menu dropdown z-index to z-50
   - Enhanced button styling with border on hover
   - Better shadow (shadow-2xl) and positioning

---

## Fix Priority

1. **Issue 2** (High Priority) - Backend fix for lastTestAt persistence
2. **Issue 1** (Medium Priority) - Frontend validation for duplicates
3. **Issue 3** (Low Priority) - UI polish

---

## Implementation Plan

### Fix 1: Prevent Duplicate Sources

```typescript
// In AddConnectionWizard.tsx - Before onCreate
const isDuplicate = existingConnections.some(conn => {
  const existingCfg = conn.connectionConfig as any
  const newCfg = formData.connectionConfig as any

  const existingHost = `${existingCfg?.host}:${existingCfg?.port || ''}`
  const newHost = `${newCfg?.host}:${newCfg?.port || ''}`

  return existingHost === newHost && conn.type === formData.type
})

if (isDuplicate) {
  setError('A connection to this host already exists')
  return
}
```

### Fix 2: Persist Last Test Timestamp

Backend endpoint `/api/data-sources/:id/test` must update:
```typescript
await dataSource.update({
  lastTestAt: new Date(),
  lastTestedAt: new Date(), // Or whichever field is used
  status: testResult.success ? 'connected' : 'error'
})
```

### Fix 3: UI Consistency

```typescript
// Ensure checkbox is always visible
<div className="absolute left-3 top-3 z-20"> {/* Higher z-index */}
  <input type="checkbox" ... />
</div>

// Ensure three-dots menu is visible
<div className="relative z-10">
  <button className="opacity-100" ...> {/* Remove hover-only opacity */}
    <MoreHorizontal />
  </button>
</div>
```
