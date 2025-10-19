# How to Test Lineage Discovery with Your Existing Data Sources

## Quick Start

You have **2 data sources** configured:
1. **PostgreSQL** - AdventureWorks database (local)
2. **Azure SQL** - Feya database (cloud - requires firewall access)

---

## Method 1: Run the Test Script (Easiest)

### PowerShell (Windows):
```powershell
.\test-lineage-discovery.ps1
```

### Bash (Linux/Mac):
```bash
bash test-lineage-discovery.sh
```

This will:
- ✓ Show current lineage counts
- ✓ Trigger sync for all data sources
- ✓ Display discovery results
- ✓ Show examples of relationships found

---

## Method 2: Manual Testing via API

### Step 1: Trigger Sync for PostgreSQL
```bash
curl -X POST http://localhost:8000/api/data-sources/793e4fe5-db62-4aa4-8b48-c220960d85ba/sync
```

### Step 2: Watch the Logs
```bash
docker-compose logs -f data-service | grep -i lineage
```

You should see:
```
Exact match method found X relationships
FK pattern method found Y relationships
Semantic similarity method found Z relationships
Cardinality analysis method found W relationships
Lineage discovery complete: TOTAL relationships found
```

### Step 3: Check Results in Database
```bash
docker exec b48c1096c0b9_cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
SELECT
  edge_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM catalog_lineage
GROUP BY edge_type
ORDER BY count DESC;
"
```

---

## Method 3: Test via UI

### Step 1: Open Data Catalog
Navigate to: http://localhost:3000/catalog

### Step 2: Select a Data Source
Use the filter dropdown to select "PostgreSQL" or "Azure Feya"

### Step 3: Click on Any Table
Example: Click on "customers" table

### Step 4: Go to Lineage Tab
Click the "Lineage" tab in the detail panel

### Step 5: Verify Relationships
You should see:
- **Upstream dependencies** (tables this table depends on)
- **Downstream dependencies** (tables that depend on this table)
- **Column badges** showing exact column mappings (e.g., `customer_id → id`)

### Step 6: Test Navigation
Click on any lineage item (upstream or downstream) and verify:
- ✓ Panel navigates to the clicked table
- ✓ Table name displays at the top
- ✓ Lineage refreshes for the new table

---

## Current Test Results

From your PostgreSQL data source, we discovered:

### Total Relationships: **442**

| Discovery Method | Count | Percentage | Confidence |
|-----------------|-------|------------|------------|
| Semantic Similarity 🆕 | 358 | 81.0% | Medium |
| FK Pattern | 64 | 14.5% | High |
| Column Match | 20 | 4.5% | High |

### Example Relationships Found:

**AdventureWorks Database:**
```
✓ customers.customer_id → customer_addresses.customer_id (column_match)
✓ customers.customer_id → orders.customer_id (column_match)
✓ employees.employee_id → orders.employee_id (fk_pattern)
✓ departments.department_id → employees.department_id (column_match)
✓ countries.country_id → customer_addresses.country_id (column_match)
```

**CWIC Platform Database (Semantic Matches):**
```
✓ quality_rules.datasource_id ≈ v_asset_overview.data_source_id (semantic_match, distance: 1)
✓ catalog_assets.data_source_id ≈ quality_rules.datasource_id (semantic_match, distance: 1)
✓ data_profiles.datasource_id ≈ v_asset_overview.data_source_id (semantic_match, distance: 1)
```

---

## Troubleshooting

### Issue: Azure SQL sync fails
**Cause:** Firewall blocks your IP address
**Solution:** Add your IP to Azure SQL firewall rules or skip Azure testing

### Issue: No semantic matches found
**Cause:** fuzzystrmatch extension not installed
**Solution:** Run:
```bash
docker exec b48c1096c0b9_cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;"
```

### Issue: Too many false positives
**Cause:** Semantic matching is too aggressive
**Solution:** Adjust Levenshtein distance threshold in [SimpleLineageService.ts:253](backend/data-service/src/services/SimpleLineageService.ts#L253)
- Current: `<= 3` (aggressive)
- Recommended: `<= 2` (balanced)
- Conservative: `<= 1` (strict)

### Issue: Lineage not showing in UI
**Cause:** Asset changes not refreshing
**Solution:** Clear browser cache or hard refresh (Ctrl+Shift+R)

---

## Next Steps

### Add More Data Sources
Test with different database types:
- MySQL
- MongoDB
- Oracle
- Snowflake

Each will show different discovery patterns!

### Fine-tune Discovery Rules
Edit [SimpleLineageService.ts](backend/data-service/src/services/SimpleLineageService.ts) to:
- Add custom column name patterns
- Adjust confidence thresholds
- Add business-specific rules

### Enable Cardinality Analysis
Requires profiling data:
```bash
# Profile all tables
curl -X POST http://localhost:8000/api/catalog/profile/{dataSourceId}
```

Then re-run discovery to see cardinality matches!

---

## For More Details

📖 **[LINEAGE_DISCOVERY_STRATEGIES.md](LINEAGE_DISCOVERY_STRATEGIES.md)** - Complete technical documentation

🔧 **[SimpleLineageService.ts](backend/data-service/src/services/SimpleLineageService.ts)** - Implementation code

💬 **Questions?** Check the logs: `docker-compose logs data-service`
