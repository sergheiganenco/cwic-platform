# Clear All Caches - Complete Guide

## Problem
Frontend is showing stale/cached data even after backend database updates. Need to clear all caches completely.

---

## Solution 1: Browser Cache (Recommended - Try This First)

### Hard Refresh (Fastest)

**Windows/Linux**:
```
Ctrl + Shift + R
or
Ctrl + F5
```

**Mac**:
```
Cmd + Shift + R
```

### Clear Browser Storage (Most Thorough)

1. **Open DevTools**: Press `F12`
2. **Go to Application Tab**
3. **Clear Storage**:
   - Check all boxes:
     - ✅ Local storage
     - ✅ Session storage
     - ✅ IndexedDB
     - ✅ Cookies
     - ✅ Cache storage
   - Click **"Clear site data"**
4. **Reload**: Press `Ctrl + Shift + R`

### Browser-Specific Cache Clear

#### Chrome/Edge
1. Press `Ctrl + Shift + Delete`
2. Select **"Cached images and files"**
3. Time range: **Last hour** (or All time)
4. Click **Clear data**

#### Firefox
1. Press `Ctrl + Shift + Delete`
2. Select **"Cache"**
3. Time range: **Everything**
4. Click **Clear Now**

---

## Solution 2: Restart Frontend (Vite Dev Server)

Sometimes Vite caches build artifacts.

### Restart Frontend Container

```bash
# Stop frontend
docker-compose stop frontend

# Remove old build cache
docker-compose rm -f frontend

# Start fresh
docker-compose up -d frontend

# Check logs
docker-compose logs -f frontend
```

### Clear Vite Cache Manually

```bash
# From project root
cd frontend
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

---

## Solution 3: Backend Service Cache

### Restart Data Service

```bash
# Restart to clear any in-memory caches
docker-compose restart data-service

# Verify it's running
docker-compose logs --tail 50 data-service
```

### Clear SmartPIIDetectionService Cache

The PII detection service has a cache. To clear it:

```bash
# This is already done automatically when PII rules change
# But you can manually trigger it via API:

curl -X POST http://localhost:3002/api/pii-rules/1 \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": true}'
```

---

## Solution 4: Database Query Cache (PostgreSQL)

PostgreSQL itself doesn't cache query results, but let's ensure everything is fresh:

```bash
# Connect to database
docker exec -i cwic-platform-db-1 psql -U cwic_user -d cwic_platform

# Then run:
VACUUM ANALYZE catalog_assets;
VACUUM ANALYZE catalog_columns;
```

---

## Solution 5: Complete Nuclear Option (Full Reset)

If nothing else works, do a complete restart:

```bash
# Stop all services
docker-compose down

# Clear all caches and temp files
cd frontend
rm -rf node_modules/.vite dist .cache

# Restart everything
cd ..
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Hard refresh browser (Ctrl + Shift + R)
```

---

## Solution 6: Check for Cross-Tab Sync Issues

The app uses localStorage for cross-tab synchronization. Clear it:

### Via Browser DevTools

1. Press `F12`
2. Go to **Application** tab
3. Expand **Local Storage**
4. Select your domain (localhost:5173)
5. **Right-click** → **Clear**
6. **Reload page**

### Programmatically

Open browser console (`F12` → Console) and run:

```javascript
// Clear all localStorage
localStorage.clear();

// Clear sessionStorage
sessionStorage.clear();

// Reload
location.reload(true);
```

---

## Solution 7: Force Re-fetch Data

If the issue is specifically with PII filter showing wrong data, force a data refresh:

### Via UI
1. Go to **Data Quality → Profiling**
2. Click the **Refresh** button (🔄)
3. Wait for data to reload
4. Apply filters again

### Via Console

```javascript
// In browser console (F12)
// This will trigger a fresh API call
window.location.reload(true);
```

---

## Verify Cache is Cleared

### Test 1: Check API Response

```bash
# Get fresh data from API
curl "http://localhost:3002/api/assets?limit=5" | jq '.data[0]'

# Should see current piiDetected values
```

### Test 2: Check Database Directly

```bash
docker exec -i cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
SELECT table_name, pii_detected,
       (SELECT COUNT(*) FROM catalog_columns cc WHERE cc.asset_id = ca.id AND cc.pii_type IS NOT NULL) as actual_pii
FROM catalog_assets ca
WHERE table_name IN ('assets', 'TblWish', 'audit_logs')
ORDER BY table_name;
"
```

### Test 3: Network Tab Verification

1. Press `F12` → **Network** tab
2. Check **Disable cache** checkbox
3. Reload page (`Ctrl + R`)
4. Look for `/api/assets` request
5. Check **Response** to see actual data from server

---

## Common Cache Issues & Solutions

### Issue 1: Tables Still Show Wrong PII Status

**Cause**: Browser cached the asset list

**Solution**:
```bash
# Hard refresh
Ctrl + Shift + R

# Or clear localStorage
localStorage.clear();
location.reload(true);
```

### Issue 2: PII Column Count Shows Wrong Number

**Cause**: Component cached the column data

**Solution**:
```javascript
// In browser console
// Force re-fetch issue summaries
sessionStorage.removeItem('quality_issue_summaries');
location.reload(true);
```

### Issue 3: Filter Shows Old Results

**Cause**: React component state not updating

**Solution**:
1. Switch filter to different value
2. Wait 1 second
3. Switch back to desired value
4. Or just reload: `Ctrl + Shift + R`

---

## Best Practice: Development Workflow

To avoid cache issues during development:

### 1. Keep DevTools Network Tab Open
- Press `F12`
- Go to **Network** tab
- **Check** "Disable cache"
- Keep DevTools open while developing

### 2. Use Incognito/Private Mode
- No cache or cookies
- Fresh state every time
- Good for testing

### 3. Add Cache-Busting Headers

For API responses, ensure cache headers are set:

```typescript
// In backend responses
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
res.setHeader('Pragma', 'no-cache');
res.setHeader('Expires', '0');
```

---

## Quick Reference: Cache Clear Commands

```bash
# Browser: Ctrl + Shift + R (hard refresh)
# Console: localStorage.clear(); location.reload(true);

# Frontend: docker-compose restart frontend
# Backend: docker-compose restart data-service

# Database: docker exec -i cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "VACUUM ANALYZE;"

# Nuclear: docker-compose down && docker-compose up -d
```

---

## Debugging Cache Issues

If you're still seeing stale data:

### 1. Check What's Actually in Database

```bash
docker exec -i cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
SELECT database_name, table_name, pii_detected
FROM catalog_assets
WHERE pii_detected = true
ORDER BY table_name;
"
```

### 2. Check What API Returns

```bash
curl -s "http://localhost:3002/api/assets?limit=10" | jq '.data[] | {name, piiDetected}'
```

### 3. Check What Browser Sees

1. Press `F12` → **Network** tab
2. Filter: `assets`
3. Click on request
4. Check **Response** tab
5. Compare with database

If they don't match → Backend issue
If they match but UI wrong → Frontend cache issue

---

## Status Indicators

After clearing cache, verify:

✅ **Browser cache cleared**: Hard refresh works, no cached files in Network tab

✅ **LocalStorage cleared**: Application → Local Storage is empty

✅ **Backend restarted**: `docker-compose logs data-service` shows fresh startup

✅ **Data matches**: Database = API Response = UI Display

---

## For Your Current Issue

Based on your screenshot showing tables without PII when filter = Yes:

### Immediate Fix

```bash
# 1. Clear browser cache
# In browser: Ctrl + Shift + R

# 2. Clear localStorage
# In console (F12):
localStorage.clear();
sessionStorage.clear();
location.reload(true);

# 3. Verify data
curl "http://localhost:3002/api/assets?dataSourceId=793e4fe5-db62-4aa4-8b48-c220960d85ba&limit=20" | jq '.data[] | {name, piiDetected}'
```

### Verify Filter Works

After clearing cache:
1. Go to Data Quality → Profiling
2. Set PII filter = **All** (should show ~116 tables)
3. Set PII filter = **Yes** (should show only 8 tables)
4. Set PII filter = **No** (should show ~108 tables)

If still wrong, the issue is with the data or filter logic, not cache.
