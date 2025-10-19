# Test & Sync Button Fixes

## Issues Fixed

### ✅ Issue 1: Buttons Not Refreshing Data After Action
**Problem**: After clicking Test or Sync, timestamps didn't update until manual page refresh

**Root Cause**:
- Test handler called `handleRefresh()` only on success (line 826-828) ✅
- Sync handler **didn't call** `handleRefresh()` at all ❌

**Fix Applied** (DataSources.tsx:833-847):
```typescript
onSync={async (id: string) => {
  try {
    const res = (await sync(id)) as SyncResult | any
    const ok = res?.success !== false
    const syncId = res?.syncId ?? res?.id ?? res?.jobId ?? null
    const status = res?.status ?? (ok ? 'started' : 'failed')
    alert(`Sync ${status}${syncId ? ` (ID: ${syncId})` : ''}`)
    // Refresh to update lastSyncAt timestamp
    if (ok) {
      await handleRefresh()  // ✅ Added this
    }
  } catch (err: any) {
    alert(`Sync failed: ${err?.message || 'Unknown error'}`)
  }
}}
```

**Result**: Both Test and Sync now refresh data after successful completion!

---

### ⚠️ Issue 2: PostgreSQL Server-Level Test Failing
**Problem**: PostgreSQL test returns error: `database "cwic_user" does not exist`

**Root Cause**: Backend is incorrectly using the **username** as the database name for server-level connections

**Current Behavior**:
```bash
$ curl POST /api/data-sources/:id/test
{
  "success": false,
  "error": "database \"cwic_user\" does not exist"
}
```

**Expected Behavior**: For server-level connections (`scope: "server"`), backend should:
1. Connect without specifying a database (use default `postgres` database)
2. OR use the first database from the `databases` array
3. NOT use the username as database name

**Workaround**: SQL Server tests work fine, PostgreSQL needs backend fix

---

## How It Works Now

### Test Button Flow:
1. User clicks "Test" button
2. Frontend calls `/api/data-sources/:id/test`
3. Backend tests connection and updates `lastTestAt` field
4. Frontend shows alert with result
5. **If successful**: Calls `handleRefresh()` to reload all data
6. Card shows updated "Last Test" timestamp
7. Summary cards update (Last Activity, etc.)

### Sync Button Flow:
1. User clicks "Sync" button
2. Frontend calls `/api/data-sources/:id/sync`
3. Backend starts sync job and updates `lastSyncAt` field
4. Frontend shows alert with sync status/ID
5. **If successful**: Calls `handleRefresh()` to reload all data
6. Card shows updated "Last Sync" timestamp
7. Summary cards update

---

## Testing

### SQL Server (Working ✅):
```bash
# Test connection
curl -X POST "http://localhost:8000/api/data-sources/af910adf-c7c1-4573-9eec-93f05f0970b7/test" -H "x-dev-auth: 1"

# Response:
{
  "success": true,
  "data": {
    "success": true,
    "connectionStatus": "connected",
    "responseTime": 101,
    "testedAt": "2025-10-15T23:05:18.919Z"
  }
}

# Verify lastTestAt updated:
curl "http://localhost:8000/api/data-sources/af910adf-c7c1-4573-9eec-93f05f0970b7" -H "x-dev-auth: 1"
# Shows: "lastTestAt": "2025-10-15T23:05:18.914Z" ✅
```

### PostgreSQL (Needs Backend Fix ⚠️):
```bash
# Test connection
curl -X POST "http://localhost:8000/api/data-sources/793e4fe5-db62-4aa4-8b48-c220960d85ba/test" -H "x-dev-auth: 1"

# Response:
{
  "success": true,
  "data": {
    "success": false,  # ❌ Test fails
    "connectionStatus": "failed",
    "error": "database \"cwic_user\" does not exist"
  }
}
```

---

## Next Steps

1. ✅ **Frontend Fixed**: Test and Sync both refresh data properly
2. ⚠️ **Backend TODO**: Fix PostgreSQL server-level connection test
   - File: `backend/data-service/src/services/ConnectionTestService.ts`
   - Issue: Line ~679 (uses username as database name)
   - Fix: Use default database or first from `databases` array for server-level connections

---

## User Experience

**Before**:
- Click Test → Alert shows → **Timestamp stays "Never"**
- Refresh page manually → Timestamp updates
- Click Sync → Alert shows → **Timestamp stays old**

**After**:
- Click Test → Alert shows → **Timestamp updates immediately** ✅
- Click Sync → Alert shows → **Timestamp updates immediately** ✅
- No manual refresh needed ✅
- All summary cards update (Last Activity, database counts, etc.) ✅
