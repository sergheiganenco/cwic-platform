# PII Management - Critical Bugs Found & Fixes

## Issues Discovered

### 1. Mark as PII - 404 Not Found ❌

**Error:** `PATCH http://localhost:3000/catalog/columns/771 404 (Not Found)`

**Root Cause:** Vite proxy configuration missing `/catalog` route

**Frontend Request:**
```
PATCH http://localhost:3000/catalog/columns/771
```

**Backend Route:**
```
PATCH http://localhost:3002/catalog/columns/:id  (catalog.ts)
```

**Problem:** Frontend calls port 3000, but route is on port 3002. Vite proxy doesn't include `/catalog` routes.

**Fix Applied:** ✅ Added `/catalog` proxy to `vite.config.ts`:
```typescript
'/catalog': {
  target: 'http://localhost:3002',
  changeOrigin: true,
},
```

**Status:** ✅ FIXED - Restart Vite dev server needed

---

### 2. Mark as NOT PII - Transaction Succeeds But Changes Revert ❌

**Symptoms:**
- API returns: `{success: true, message: "✅ INSTANT UPDATE..."}`
- Backend logs: "✅ COMMIT successful"
- Verification query (inside transaction): `pii_type: null` ✅
- Database (after COMMIT): `pii_type: "name"` ❌ (reverted!)

**Root Cause:** Automatic PII rescan triggered IMMEDIATELY after marking as NOT PII, re-classifying the column

**Evidence:**
```
17:07:00 - Mark as NOT PII completes
17:07:00 - Automatic PII rescan starts
17:07:00 - Column 268 (Firstname) RE-CLASSIFIED as "name"
```

**Why Exclusions Don't Prevent Re-detection:**
```sql
SELECT * FROM pii_exclusions;
-- Returns 0 rows! Table is empty!
```

The exclusion INSERT is **failing silently** or being **rolled back**.

**Debugging Added:**
- Console logging for exclusion creation
- Verification query to check UPDATE worked
- COMMIT error handling

**Status:** ⚠️ INVESTIGATING - Need to see why exclusion INSERT fails

---

### 3. Exclusions Not Being Created ❌

**Expected Behavior:**
```sql
INSERT INTO pii_exclusions (pii_rule_id, column_name, table_name, ...)
VALUES (9, 'Firstname', 'User', ...);
```

**Actual Behavior:**
```sql
SELECT * FROM pii_exclusions;
-- 0 rows (table is empty!)
```

**But API Returns:**
```json
{
  "exclusionId": 13,
  "clearedFromDatabase": true
}
```

**Hypothesis:**
1. **Transaction rollback** - Something after exclusion INSERT fails
2. **Foreign key violation** - `pii_rule_id` doesn't exist
3. **Check constraint violation** - Invalid `exclusion_type` value
4. **Trigger** - Some trigger rolls back the transaction

**Next Steps:**
1. Add try-catch around exclusion INSERT
2. Check if `pii_rule_id = 9` exists in `pii_rule_definitions`
3. Verify `exclusion_type = 'table_column'` is valid

**Status:** ⚠️ INVESTIGATING - Added detailed logging

---

## Testing Summary

### Test 1: Mark Column as PII

**Action:** Select "👤 Full Name" from dropdown on "Gender" column

**Expected:**
```
✅ Column updated: pii_type = 'name'
✅ Alert: "Successfully marked as NAME PII"
✅ UI refreshes instantly
```

**Actual (Before Fix):**
```
❌ 404 Not Found
❌ Error: "Failed to mark as PII"
```

**Actual (After Fix):**
```
⚠️ Need to restart Vite dev server
```

---

### Test 2: Mark Column as NOT PII

**Action:** Click "Mark as Not PII" on "Firstname" column (pii_type="name")

**Expected:**
```
✅ Column updated: pii_type = NULL, is_sensitive = false
✅ Exclusion created in pii_exclusions table
✅ Future rescans skip this column
✅ Alert: "INSTANT UPDATE - No Rescan Needed"
✅ UI refreshes instantly
```

**Actual:**
```
✅ API returns success
✅ Backend logs: "✅ COMMIT successful"
✅ Verification query: pii_type = NULL (inside transaction)
❌ Database after: pii_type = 'name' (REVERTED!)
❌ Exclusion table: 0 rows (not created)
❌ Auto-rescan re-classifies column immediately
```

---

## Root Cause Analysis

### Why Mark as NOT PII Fails

**Timeline:**
1. User clicks "Mark as Not PII" → Backend receives request
2. `BEGIN` transaction
3. `UPDATE catalog_columns SET pii_type = NULL WHERE id = 268` → ✅ SUCCESS
4. Verification SELECT → Shows `pii_type = NULL` ✅
5. `INSERT INTO pii_exclusions` → ⚠️ Unknown result
6. `COMMIT` → ✅ Says successful
7. **IMMEDIATE:** Auto-rescan triggered (unknown trigger)
8. Auto-rescan finds "Firstname" matches "name" hints
9. `UPDATE catalog_columns SET pii_type = 'name' WHERE id = 268` → ✅ Overrides!
10. User refreshes → Sees `pii_type = 'name'` ❌

**The Real Problem:**
Even if Mark as NOT PII works, an **automatic rescan** immediately undoes it!

**What Triggers Auto-Rescan?**
- ❓ Frontend fetchAssetDetails() ?
- ❓ Backend websocket/polling?
- ❓ Database trigger?
- ❓ Scheduled job?

---

## Immediate Fixes Needed

### Fix 1: Restart Vite Dev Server ✅

**Action:**
```bash
# In frontend directory
npm run dev
```

**Or:** Hard refresh (Ctrl+F5) if Vite auto-reloaded

---

### Fix 2: Find & Stop Auto-Rescan Trigger ⚠️

**Need to investigate:**
1. Check frontend code for auto-fetch after Mark as NOT PII
2. Check if there's a websocket that triggers rescans
3. Check if there's a polling interval
4. Check backend for scheduled jobs

---

### Fix 3: Fix Exclusion Creation ⚠️

**Debugging added:**
```typescript
console.log(`[Mark as Not PII] Creating NEW exclusion for ${columnName}...`);
console.log(`[Mark as Not PII] Exclusion params:`, {...});
// INSERT...
console.log(`[Mark as Not PII] ✅ Created exclusion ID: ${exclusionId}`);
```

**Check logs after restart:**
```bash
docker logs -f cwic-platform-data-service-1 | grep "exclusion"
```

---

## User Action Required

### 1. Restart Vite Dev Server

**Windows:**
```powershell
# Stop current dev server (Ctrl+C)
cd c:\Users\sergh\cwic-platform\frontend
npm run dev
```

Wait for: `Local: http://localhost:3000/`

### 2. Hard Refresh Browser

Press: `Ctrl + F5`

### 3. Test Again

**Test Mark as PII:**
1. Go to Data Quality page
2. Select any table
3. Find a column WITHOUT PII
4. Click "View"
5. Select a PII type from dropdown
6. Check browser DevTools → Network tab
7. Should see: `PATCH /catalog/columns/XXX` → `200 OK`

**Test Mark as NOT PII:**
1. Find a column WITH PII
2. Click "View"
3. Click "Mark as Not PII"
4. Check browser DevTools → Network tab
5. Should see: `POST /api/pii-exclusions/mark-not-pii` → `200 OK`
6. **IMPORTANT:** Check if column reverts after a few seconds

### 4. Report Results

Please share:
1. Screenshot of browser DevTools → Network tab showing the requests
2. Screenshot of any error alerts
3. Whether the column reverts after marking as NOT PII

---

## Files Changed

### Backend
1. `vite.config.ts` - Added `/catalog` proxy
2. `piiExclusions.ts` - Added exclusion creation logging

### Frontend
- No changes needed (waiting for Vite restart)

---

## Next Steps

1. ✅ User restarts Vite dev server
2. ✅ User tests both Mark as PII and Mark as NOT PII
3. ⚠️ Investigate auto-rescan trigger
4. ⚠️ Fix exclusion creation if still failing
5. ⚠️ Prevent auto-rescan from undoing manual changes

---

**The Vite proxy fix should solve Mark as PII immediately. The Mark as NOT PII issue requires more investigation to find what's triggering the auto-rescan.**
