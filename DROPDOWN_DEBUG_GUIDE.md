# Visual Rule Builder - Empty Dropdown Debug Guide

## Issue

The Visual Rule Builder's table and column dropdowns are empty, even though:
- Filters show "Azure Feya" is selected
- The implementation for dynamic dropdowns is complete
- The API endpoints exist and work

## Debug Logging Added

I've added comprehensive debug logging to `VisualRuleBuilder.tsx` to help diagnose the issue.

### How to Check the Logs

1. **Open your browser** (where the app is running)
2. **Open Developer Tools** (Press `F12` or Right-click → Inspect)
3. **Go to Console tab**
4. **Click "New Rule"** button to open the Visual Rule Builder
5. **Look for these log messages**:

```
fetchTables called with dataSourceId: <value>
Fetching tables from: http://localhost:3002/api/assets?dataSourceId=...
fetchTables response: {...}
Unique tables found: <number> [...]
```

## What Each Log Means

### Log 1: `fetchTables called with dataSourceId: <value>`

**What it shows**: Whether `dataSourceId` is being passed to the component

**Possible values**:
- `undefined` or `null` → **PROBLEM**: dataSourceId is not being passed
- A UUID like `793e4fe5-...` → **GOOD**: dataSourceId is provided

**If undefined/null**:
- The Visual Rule Builder is not receiving the `dataSourceId` prop
- Check where it's being instantiated (RuleBuilder.tsx or DataQuality.tsx)
- Verify `selectedDataSourceId` state has a value when the modal opens

### Log 2: `Fetching tables from: <url>`

**What it shows**: The exact API URL being called

**Example**:
```
http://localhost:3002/api/assets?dataSourceId=793e4fe5-db62-4aa4-8b48-c220960d85ba&limit=1000
```

**What to check**:
- Does the dataSourceId match "Azure Feya"?
- You can copy this URL and test it in a new tab to see the raw response

### Log 3: `fetchTables response: {...}`

**What it shows**: The full API response

**Good response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "schemaName": "dbo",
      "tableName": "customers",
      ...
    },
    ...
  ]
}
```

**Bad responses**:
```json
{ "success": false, "error": "..." }  // API error
{ "success": true, "data": [] }        // No tables found
```

### Log 4: `Unique tables found: <number> [...]`

**What it shows**: How many unique tables were extracted

**Examples**:
- `Unique tables found: 15 [{name: "dbo.customers", ...}, ...]` → **GOOD**
- `Unique tables found: 0 []` → **PROBLEM**: No tables in database

**If 0 tables**:
- The data source might not have been scanned yet
- Run a catalog scan for "Azure Feya" first
- Check if tables exist in the catalog for this data source

## Warning Log: `No dataSourceId provided to fetchTables`

**What it means**: The function was called but `dataSourceId` is `undefined`

**This is the root cause!** The Visual Rule Builder is not receiving the `dataSourceId` prop.

**How to fix**:
1. Check where VisualRuleBuilder is instantiated
2. Verify the parent component has `selectedDataSourceId` in state
3. Ensure the prop is passed: `<VisualRuleBuilder dataSourceId={selectedDataSourceId} />`

## Common Scenarios

### Scenario 1: "No dataSourceId provided" warning

**Root Cause**: The prop is not being passed

**Fix**: Update the parent component to pass `dataSourceId`:

```tsx
<VisualRuleBuilder
  dataSourceId={selectedDataSourceId}  // ← Add this
  onSave={...}
  onCancel={...}
/>
```

### Scenario 2: API returns `{ success: true, data: [] }`

**Root Cause**: No tables exist in the catalog for this data source

**Fix**:
1. Go to Data Catalog
2. Select "Azure Feya"
3. Click "Scan Source" to populate the catalog
4. Wait for scan to complete
5. Try creating a rule again

### Scenario 3: API returns `{ success: false, error: "..." }`

**Root Cause**: Backend error (database, permissions, etc.)

**Fix**:
1. Check backend logs: `docker logs cwic-platform-data-service-1`
2. Look for errors related to `/api/assets`
3. Fix the backend issue (database connection, query error, etc.)

### Scenario 4: Logs show tables found, but dropdown is still empty

**Root Cause**: The `tables` state is being cleared or not updating UI

**Debug**:
1. After seeing "Unique tables found: X", type in console:
   ```javascript
   // This won't work in React DevTools, but you can check component state
   ```
2. Check if there are any useEffect dependencies causing re-renders
3. Look for errors in the console that might prevent state updates

## How the Data Flow Works

```
User clicks "New Rule"
  ↓
Parent component opens <VisualRuleBuilder dataSourceId={...} />
  ↓
useEffect detects dataSourceId is set
  ↓
fetchTables() is called
  ↓
API: GET /api/assets?dataSourceId=...&limit=1000
  ↓
Extract unique schema.table combinations
  ↓
setTables([...]) updates state
  ↓
Dropdown renders with <option> elements
  ↓
User sees table list!
```

**If any step fails, the dropdown stays empty.**

## Testing the API Manually

You can test the API endpoint directly to verify it works:

### Step 1: Get your data source ID

From the browser console or Network tab, find the UUID for "Azure Feya".

Or query the database:
```sql
SELECT id, name, type FROM data_sources WHERE name LIKE '%Feya%';
```

### Step 2: Test the API

Open a new browser tab and visit:
```
http://localhost:3002/api/assets?dataSourceId=<YOUR-UUID>&limit=10
```

Example:
```
http://localhost:3002/api/assets?dataSourceId=793e4fe5-db62-4aa4-8b48-c220960d85ba&limit=10
```

### Step 3: Check the response

**Good response** (tables exist):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "tableName": "customers",
      "schemaName": "dbo",
      "assetType": "table",
      ...
    }
  ],
  "total": 50
}
```

**Bad response** (no tables):
```json
{
  "success": true,
  "data": [],
  "total": 0
}
```

**Error response**:
```json
{
  "success": false,
  "error": "..."
}
```

## What I Implemented

### Files Modified

**`frontend/src/components/quality/studio/VisualRuleBuilder.tsx`**

1. Added state for tables and columns
2. Added loading states
3. Created `fetchTables()` function
4. Created `fetchColumns()` function
5. Added useEffect hooks to trigger fetching
6. Replaced Input fields with select dropdowns
7. **Added debug logging** (just now)

### The Code

#### Fetch Tables Function:
```typescript
const fetchTables = async () => {
  console.log('fetchTables called with dataSourceId:', dataSourceId);
  if (!dataSourceId) {
    console.warn('No dataSourceId provided to fetchTables');
    return;
  }

  setLoadingTables(true);
  try {
    const url = `http://localhost:3002/api/assets?dataSourceId=${dataSourceId}&limit=1000`;
    console.log('Fetching tables from:', url);
    const response = await fetch(url);
    const data = await response.json();
    console.log('fetchTables response:', data);

    if (data.success && data.data) {
      const uniqueTables = Array.from(
        new Map(
          data.data.map((asset: any) => [
            `${asset.schemaName}.${asset.tableName}`,
            {
              name: `${asset.schemaName}.${asset.tableName}`,
              tableName: asset.tableName,
              schemaName: asset.schemaName,
              id: asset.id
            }
          ])
        ).values()
      );
      console.log('Unique tables found:', uniqueTables.length, uniqueTables);
      setTables(uniqueTables);
    } else {
      console.warn('No tables found or unsuccessful response');
    }
  } catch (error) {
    console.error('Failed to fetch tables:', error);
  } finally {
    setLoadingTables(false);
  }
};
```

#### UseEffect Hook:
```typescript
useEffect(() => {
  if (dataSourceId) {
    fetchTables();
  }
}, [dataSourceId]);
```

#### Dropdown Rendering:
```tsx
<select
  id="table_name"
  value={formData.table_name}
  onChange={(e) => {
    setFormData({ ...formData, table_name: e.target.value, column_name: '' });
  }}
  className="w-full px-3 py-2 border rounded-md"
>
  <option value="">Select a table...</option>
  {tables.map((table) => (
    <option key={table.name} value={table.name}>
      {table.name}
    </option>
  ))}
</select>
```

## Next Steps

1. **Open the app** in your browser (http://localhost:3000)
2. **Open Developer Tools** (F12 → Console)
3. **Select "Azure Feya"** in the filters (if not already selected)
4. **Click "New Rule"** to open Visual Rule Builder
5. **Check the console logs** to see what's happening
6. **Report back** what you see in the logs

The logs will tell us exactly where the problem is:
- ✅ If dataSourceId is being passed
- ✅ If the API is being called
- ✅ If tables are being returned
- ✅ If tables are being set in state

Once we see the logs, we'll know exactly what to fix!

---

**Status**: ✅ Debug logging added
**HMR**: ✅ Changes applied (8:59:31 AM)
**Ready to test**: ✅ Yes
**Created**: November 2, 2025
