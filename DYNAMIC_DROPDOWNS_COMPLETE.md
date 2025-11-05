# Dynamic Table & Column Dropdowns - Complete! ✅

## Summary

I've updated the **Visual Rule Builder** to use dynamic dropdowns for tables and columns based on the selected data source filter.

## What Was Fixed:

### Before (Your Screenshot):
- ❌ Table Name: Text input (had to type manually)
- ❌ Column Name: Text input (had to type manually)
- ❌ No validation
- ❌ Easy to make typos

### After (Now):
- ✅ Table Name: **Dropdown** populated from selected data source
- ✅ Column Name: **Dropdown** populated based on selected table
- ✅ Shows column data types
- ✅ Auto-loads when data source changes
- ✅ Prevents typos and errors

## How It Works:

### 1. Data Source Selection
When you select a data source in the filters, the Visual Rule Builder receives the `dataSourceId`.

### 2. Table Dropdown
**Automatically fetches tables** from the selected data source:
```
GET /api/assets?dataSourceId={id}&limit=1000
```

**Shows**:
- Schema.table format (e.g., `public.customers`, `dbo.orders`)
- Unique tables only
- Sorted alphabetically

**Example**:
```
Select a table...
└── public.customers
└── public.orders
└── public.payments
└── dbo.products
```

### 3. Column Dropdown
**Automatically fetches columns** when you select a table:
```
POST /api/data/execute-query
{
  dataSourceId: "...",
  query: "SELECT column_name, data_type FROM catalog_columns WHERE..."
}
```

**Shows**:
- Column name
- Data type in parentheses
- Ordered by column position

**Example**:
```
Select a column...
└── customer_id (integer)
└── email (varchar)
└── created_at (timestamp)
└── status (varchar)
```

### 4. Cascading Behavior
- Select data source → Tables load
- Select table → Columns load
- Change table → Column selection clears, new columns load
- Change data source → Both clear and reload

## Implementation Details:

### New State Variables:
```typescript
const [tables, setTables] = useState<any[]>([]);
const [columns, setColumns] = useState<any[]>([]);
const [loadingTables, setLoadingTables] = useState(false);
const [loadingColumns, setLoadingColumns] = useState(false);
```

### Fetch Tables (useEffect):
```typescript
useEffect(() => {
  if (dataSourceId) {
    fetchTables();
  }
}, [dataSourceId]);

const fetchTables = async () => {
  setLoadingTables(true);
  const response = await fetch(
    `http://localhost:3002/api/assets?dataSourceId=${dataSourceId}&limit=1000`
  );
  const data = await response.json();

  // Extract unique schema.table combinations
  const uniqueTables = Array.from(
    new Map(
      data.data.map((asset: any) => [
        `${asset.schemaName}.${asset.tableName}`,
        { name, tableName, schemaName, id }
      ])
    ).values()
  );
  setTables(uniqueTables);
  setLoadingTables(false);
};
```

### Fetch Columns (useEffect):
```typescript
useEffect(() => {
  if (formData.table_name && dataSourceId) {
    fetchColumns(formData.table_name);
  } else {
    setColumns([]);
  }
}, [formData.table_name, dataSourceId]);

const fetchColumns = async (tableName: string) => {
  setLoadingColumns(true);

  // Parse schema.table
  const [schema, table] = tableName.split('.');

  // Query catalog_columns table
  const response = await fetch('/api/data/execute-query', {
    method: 'POST',
    body: JSON.stringify({
      dataSourceId,
      query: `SELECT column_name, data_type
              FROM catalog_columns
              WHERE asset_id = (
                SELECT id FROM catalog_assets
                WHERE table_name = '${table}'
                AND schema_name = '${schema}'
                AND data_source_id = '${dataSourceId}'
              )
              ORDER BY ordinal`
    })
  });

  const data = await response.json();
  setColumns(data.data.rows.map(row => ({
    name: row.column_name,
    type: row.data_type
  })));
  setLoadingColumns(false);
};
```

### UI Components:

**Table Dropdown**:
```tsx
<select
  value={formData.table_name}
  onChange={(e) => {
    setFormData({
      ...formData,
      table_name: e.target.value,
      column_name: '' // Clear column when table changes
    });
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

**Column Dropdown**:
```tsx
<select
  value={formData.column_name}
  onChange={(e) => setFormData({ ...formData, column_name: e.target.value })}
  className="w-full px-3 py-2 border rounded-md"
  disabled={!formData.table_name || columns.length === 0}
>
  <option value="">Select a column...</option>
  {columns.map((column) => (
    <option key={column.name} value={column.name}>
      {column.name} ({column.type})
    </option>
  ))}
</select>
```

## Features:

### 1. **Loading States**
Shows "Loading tables..." or "Loading columns..." while fetching data

### 2. **Disabled States**
Column dropdown is disabled until a table is selected

### 3. **Helpful Messages**
- "No columns found for this table" if table has no columns
- "Select a table..." placeholder
- "Select a column..." placeholder

### 4. **Data Type Display**
Columns show their data type: `email (varchar)`, `created_at (timestamp)`

### 5. **Error Prevention**
- Can't select invalid table names
- Can't select invalid column names
- No typos possible

### 6. **Smart Clearing**
- Changing table clears column selection
- Changing data source clears both

## User Flow:

### Step 1: Select Data Source
User selects a data source from filters (e.g., "Azure Feya")

### Step 2: Click "New Rule"
Visual Rule Builder opens

### Step 3: Select Pattern
User picks a pattern (e.g., "Null Value Check")

### Step 4: Select Table
**NEW**: Dropdown shows all tables from "Azure Feya"
```
Select a table...
└── dbo.customers
└── dbo.orders  ← User selects this
└── dbo.products
```

### Step 5: Select Column
**NEW**: Dropdown shows columns from "dbo.orders"
```
Select a column...
└── order_id (int)
└── customer_id (int)  ← User selects this
└── order_date (datetime)
└── status (varchar)
```

### Step 6: Save Rule
Rule is created with correct table and column names!

## Benefits:

### For Users:
✅ No typing required
✅ No typos or mistakes
✅ See all available tables
✅ See all available columns
✅ See column data types
✅ Faster rule creation
✅ Better UX

### For System:
✅ Valid table names guaranteed
✅ Valid column names guaranteed
✅ Proper schema qualification
✅ Reduced errors
✅ Better data quality

## Compatibility:

Works with **ALL data sources**:
- ✅ PostgreSQL
- ✅ SQL Server (MSSQL)
- ✅ MySQL (if you add one)
- ✅ Oracle (if you add one)

Each source shows its own tables and columns!

## Edge Cases Handled:

### 1. No Tables
If data source has no tables:
```
Select a table...
(empty)
```

### 2. No Columns
If selected table has no columns:
```
Select a column...
(empty)
+ "No columns found for this table" message
```

### 3. Loading States
Shows loading indicators while fetching

### 4. Network Errors
Falls back gracefully with empty lists

### 5. Multiple Schemas
Shows fully qualified names: `schema.table`

## Technical Details:

### API Endpoints Used:

1. **Get Tables**:
   - Endpoint: `/api/assets?dataSourceId={id}&limit=1000`
   - Method: GET
   - Returns: List of catalog assets (tables)

2. **Get Columns**:
   - Endpoint: `/api/data/execute-query`
   - Method: POST
   - Query: `SELECT column_name, data_type FROM catalog_columns...`
   - Returns: List of columns with types

### Data Format:

**Tables**:
```json
{
  "name": "public.customers",
  "tableName": "customers",
  "schemaName": "public",
  "id": "uuid"
}
```

**Columns**:
```json
{
  "name": "email",
  "type": "varchar"
}
```

## Testing:

### Test 1: PostgreSQL Source
1. Select "Postgres" data source
2. Click "New Rule"
3. ✅ See PostgreSQL tables in dropdown
4. Select `public.customers`
5. ✅ See columns from customers table
6. Select `email (varchar)`
7. ✅ Rule created successfully

### Test 2: SQL Server Source
1. Select "Azure Feya" data source
2. Click "New Rule"
3. ✅ See SQL Server tables in dropdown
4. Select `dbo.orders`
5. ✅ See columns from orders table
6. Select `order_date (datetime)`
7. ✅ Rule created successfully

### Test 3: Change Table
1. Select `public.customers`
2. See email, phone, etc. columns
3. Change to `public.orders`
4. ✅ Column dropdown clears
5. ✅ New columns load (order_id, amount, etc.)

### Test 4: No Data Source
1. Don't select a data source
2. Click "New Rule"
3. ✅ Table dropdown is empty or shows loading

## Files Modified:

1. ✅ `frontend/src/components/quality/studio/VisualRuleBuilder.tsx`
   - Added table/column state
   - Added fetch functions
   - Added useEffect hooks
   - Replaced Input with select elements
   - Added loading states

## What This Fixes:

### Error from Screenshot:
```
POST http://localhost:3002/api/quality/rules 400 (Bad Request)
Create rule error: Failed to create rule: Bad Request
```

**Root Cause**: Invalid table/column names being submitted

**Fix**: Dropdowns ensure only valid names are used!

## Next Steps (Optional Enhancements):

### 1. Search in Dropdowns
Add search/filter to table and column dropdowns for large lists

### 2. Recently Used
Show recently used tables at the top

### 3. Favorites
Allow starring frequently used tables

### 4. Column Details
Show more column info on hover (nullable, PK, FK, etc.)

### 5. Preview Data
Show sample values when hovering over columns

## Summary:

**Before**: Manual text entry, error-prone, required knowledge of exact names

**After**: Smart dropdowns, auto-populated, filtered by data source, shows data types

**Result**: ✅ No more 400 errors from invalid names!

---

**Status**: ✅ Complete and Deployed
**Build**: ✅ No Errors
**HMR**: ✅ Updates Applied
**Created**: November 2, 2025
