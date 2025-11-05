# Testing Visual Rule Builder Dropdowns

## Current Status

### ✅ Postgres Data Source - WORKING
- **Tables**: Populate correctly (87 tables available)
- **Columns**: Query works and returns column data
- **Connection**: Properly configured with local database

### ⚠️ Azure Feya Data Source - NEEDS CREDENTIALS
- **Tables**: May show from cached catalog data
- **Columns**: Will fail with connection error
- **Issue**: Has placeholder credentials that need to be updated

## How to Test Successfully

### Option 1: Test with Postgres (RECOMMENDED)

1. **Go to Data Quality page**
2. **In filters, select "Postgres"** (not Azure Feya)
3. **Click "Rules" → "Create Rule"**
4. **Open Visual Rule Builder**
5. **Select a table** like:
   - `public.catalog_assets`
   - `public.quality_rules`
   - `public.data_sources`
6. **Columns should populate automatically**

### Option 2: Fix Azure Credentials

If you have real Azure SQL credentials, update them:

```javascript
// Run this script after updating credentials
const { Pool } = require('pg');

async function updateAzureCredentials() {
  const pool = new Pool({
    connectionString: 'postgresql://cwic_user:cwic_secure_pass@localhost:5432/cwic_platform'
  });

  const azureConfig = {
    host: 'YOUR-ACTUAL-SERVER.database.windows.net',  // <-- Update this
    port: 1433,
    database: 'YOUR-DATABASE',                        // <-- Update this
    username: 'YOUR-USERNAME',                        // <-- Update this
    password: 'YOUR-PASSWORD',                        // <-- Update this
    options: {
      encrypt: true,
      trustServerCertificate: false
    }
  };

  await pool.query(
    `UPDATE data_sources
     SET connection_config = $1::jsonb
     WHERE id = 'af910adf-c7c1-4573-9eec-93f05f0970b7'`,
    [JSON.stringify(azureConfig)]
  );

  console.log('✅ Azure credentials updated');
  await pool.end();
}
```

## Console Output to Expect

### When Working Correctly (Postgres):
```
[VisualRuleBuilder] fetchTables called with dataSourceId: 793e4fe5-db62-4aa4-8b48-c220960d85ba
[VisualRuleBuilder] Filtered 87 tables from 102 total assets
[VisualRuleBuilder] Sample tables: ["public.pipeline_step_logs", "public.business_glossary_terms", ...]
[VisualRuleBuilder] fetchColumns called for table: public.catalog_assets
[VisualRuleBuilder] Column query response: {success: true, hasData: true, rowCount: 34}
[VisualRuleBuilder] Columns found: 34
```

### When Failing (Azure without credentials):
```
[VisualRuleBuilder] fetchColumns called for table: dbo.TblWish
[VisualRuleBuilder] Column query response: {success: false, error: "Azure SQL connection error..."}
[VisualRuleBuilder] No columns found for table: dbo.TblWish
```

## Quick Test Commands

### Test Postgres Tables API:
```bash
curl -s "http://localhost:3002/catalog/assets?dataSourceId=793e4fe5-db62-4aa4-8b48-c220960d85ba&limit=10" | jq '.data.assets[0:3]'
```

### Test Postgres Columns API:
```bash
node test-postgres-columns.js
```

Expected output: 34 columns from catalog_assets table

### Check Data Source Configs:
```bash
node check-all-datasources.js
```

## Troubleshooting

### If Postgres tables don't show:
1. Check if catalog has been scanned
2. Run: `node check-catalog-assets.js`
3. Go to Data Catalog and scan if needed

### If columns don't populate for Postgres:
1. Check console for errors
2. Verify database service is running: `docker ps | grep db`
3. Test connection: `node test-postgres-columns.js`

### If you see "No tables found":
1. The data source hasn't been scanned in Data Catalog
2. Go to Data Catalog page
3. Select the data source
4. Click "Scan" to populate tables

## Summary

✅ **Postgres is fully working** - Use this for testing
⚠️ **Azure needs real credentials** - Update connection config when available

The system is working correctly. The Azure error is expected because it has placeholder credentials. Test with Postgres to see the full functionality!