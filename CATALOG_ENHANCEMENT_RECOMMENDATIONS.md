# Data Catalog Enhancement Recommendations

## Current State
Your Data Catalog is already using **real data** from connected databases via:
- BullMQ workers for auto-discovery
- Real database connections stored in `data_sources` table
- Discovered assets stored in `assets` table
- Automatic profiling (row counts, PII detection, column metadata)

---

## Industry Best Practices Comparison

### Tools Reference: Atlan, Collibra, Alation, Monte Carlo, DataHub

| Feature | Your System | Industry Standard | Status |
|---------|-------------|-------------------|--------|
| Multi-source connectors | ✅ PostgreSQL, MySQL, MSSQL, MongoDB, S3, etc. | ✅ | COMPLETE |
| Auto-discovery | ✅ Background workers | ✅ | COMPLETE |
| Connection testing | ✅ Test before adding | ✅ | COMPLETE |
| PII detection | ✅ Automatic | ✅ | COMPLETE |
| Schema/table selection | ❌ Scans everything | ✅ User selects what to scan | **NEEDED** |
| Scheduled syncs | ❌ Manual only | ✅ Cron/scheduled auto-sync | **NEEDED** |
| Sample data preview | ❌ | ✅ Show first 100 rows | RECOMMENDED |
| Query history | ❌ | ✅ Track who queries what | RECOMMENDED |
| Data lineage | ⚠️ Basic | ✅ Column-level lineage | ENHANCE |
| Business glossary | ❌ | ✅ Business term mapping | NICE-TO-HAVE |
| Cost tracking | ❌ | ✅ Query cost analysis | NICE-TO-HAVE |

---

## Priority 1: Schema/Table Selection

### Problem
Currently, when you add a data source, the worker scans **ALL** schemas and tables. This:
- Creates noise (system tables, temp tables)
- Wastes resources scanning irrelevant data
- Slow for large databases (1000+ tables)

### Solution: Add Selection Step to Connection Wizard

#### UI Flow Enhancement:

```
Current Flow:
1. Enter connection details
2. Test connection
3. Create → Scans everything automatically

Recommended Flow:
1. Enter connection details
2. Test connection
3. **NEW STEP** → Schema/Table Selection
   ┌─────────────────────────────────────┐
   │ Select schemas to catalog:          │
   ├─────────────────────────────────────┤
   │ ☑ public (45 tables)                │
   │ ☐ information_schema (skip)         │
   │ ☑ analytics (120 tables)            │
   │ ☐ temp (skip)                       │
   │                                     │
   │ Table pattern filter (optional):    │
   │ Include: fact_*, dim_*              │
   │ Exclude: temp_*, staging_*          │
   └─────────────────────────────────────┘
4. Schedule sync (daily/weekly/manual)
5. Create & start discovery
```

#### Backend Implementation:

**1. Update `data_sources` table:**
```sql
ALTER TABLE data_sources ADD COLUMN scan_config JSONB DEFAULT '{
  "schemas": [],          -- Empty = scan all
  "include_patterns": [], -- e.g., ["public.fact_*", "analytics.dim_*"]
  "exclude_patterns": [], -- e.g., ["*.temp_*", "information_schema.*"]
  "sync_schedule": null   -- Cron expression or null for manual
}'::jsonb;
```

**2. Update Discovery Worker:**
```typescript
// worker.ts - modify catalog:profile job
async function discoverTables(dataSourceId: string) {
  const ds = await getDataSource(dataSourceId);
  const scanConfig = ds.scan_config || {};

  // Fetch all schemas
  const allSchemas = await fetchSchemas(ds);

  // Filter based on config
  const schemasToScan = scanConfig.schemas?.length > 0
    ? allSchemas.filter(s => scanConfig.schemas.includes(s.name))
    : allSchemas; // If empty, scan all

  for (const schema of schemasToScan) {
    const tables = await fetchTables(ds, schema.name);

    // Apply include/exclude patterns
    const filteredTables = tables.filter(table => {
      const fullName = `${schema.name}.${table.name}`;

      // Check exclude patterns first
      if (scanConfig.exclude_patterns?.some(p => matchPattern(fullName, p))) {
        return false;
      }

      // If include patterns exist, must match one
      if (scanConfig.include_patterns?.length > 0) {
        return scanConfig.include_patterns.some(p => matchPattern(fullName, p));
      }

      return true; // Include by default if no patterns
    });

    // Profile only filtered tables
    for (const table of filteredTables) {
      await profileTable(ds, schema.name, table.name);
    }
  }
}
```

**3. Add API Endpoint:**
```typescript
// GET /api/data-sources/:id/schemas
// Returns list of schemas for selection UI
router.get('/:id/schemas', async (req, res) => {
  const { id } = req.params;
  const ds = await DataSourceService.getById(id);

  const schemas = await ConnectionTestService.listSchemas(ds);

  res.json({
    success: true,
    data: schemas.map(s => ({
      name: s.name,
      tableCount: s.table_count,
      isSystemSchema: ['information_schema', 'pg_catalog', 'mysql', 'sys'].includes(s.name)
    }))
  });
});
```

**4. Frontend Component:**
```tsx
// AddConnectionWizard.tsx - Add new step
function SchemaSelectionStep({ dataSource, onSelect }) {
  const [schemas, setSchemas] = useState([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    // Fetch schemas after connection test succeeds
    fetch(`/api/data-sources/${dataSource.id}/schemas`)
      .then(r => r.json())
      .then(data => setSchemas(data.data));
  }, [dataSource.id]);

  return (
    <div>
      <h3>Select Schemas to Catalog</h3>
      <p>Choose which schemas you want to include in the data catalog</p>

      <div className="space-y-2">
        {schemas.map(schema => (
          <label key={schema.name} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.includes(schema.name)}
              onChange={e => {
                if (e.target.checked) {
                  setSelected([...selected, schema.name]);
                } else {
                  setSelected(selected.filter(s => s !== schema.name));
                }
              }}
            />
            <span className={schema.isSystemSchema ? 'text-gray-400' : ''}>
              {schema.name}
            </span>
            <span className="text-gray-500">({schema.tableCount} tables)</span>
          </label>
        ))}
      </div>

      <details className="mt-4">
        <summary>Advanced: Pattern Filters</summary>
        <div className="mt-2 space-y-2">
          <input placeholder="Include: fact_*, dim_*" />
          <input placeholder="Exclude: temp_*, staging_*" />
        </div>
      </details>

      <button onClick={() => onSelect(selected)}>
        Next: Schedule Sync
      </button>
    </div>
  );
}
```

---

## Priority 2: Scheduled Syncs

### Problem
Currently, metadata syncs are manual-only. Users must remember to re-sync.

### Solution: Add Sync Scheduling

**1. Update UI:**
```tsx
function SyncScheduleStep({ onSelect }) {
  return (
    <div>
      <h3>Sync Schedule</h3>
      <select onChange={e => onSelect(e.target.value)}>
        <option value="manual">Manual only</option>
        <option value="daily">Daily at 2 AM</option>
        <option value="weekly">Weekly (Sunday 2 AM)</option>
        <option value="hourly">Every hour</option>
        <option value="custom">Custom cron...</option>
      </select>
    </div>
  );
}
```

**2. Backend Cron Job:**
```typescript
// Add to worker.ts or new scheduler.ts
import cron from 'node-cron';

async function scheduleAutoSyncs() {
  // Run every hour, check for data sources that need sync
  cron.schedule('0 * * * *', async () => {
    const sources = await db.query(`
      SELECT id, name, scan_config
      FROM data_sources
      WHERE scan_config->>'sync_schedule' IS NOT NULL
        AND status = 'active'
    `);

    for (const source of sources.rows) {
      const schedule = source.scan_config.sync_schedule;

      // Check if sync is due using cron expression
      if (shouldRunNow(schedule)) {
        await catalogQueue.add('catalog:discover', {
          dataSourceId: source.id
        });
      }
    }
  });
}
```

---

## Priority 3: Sample Data Preview

### Implementation:
```typescript
// GET /api/assets/:id/sample
router.get('/:id/sample', async (req, res) => {
  const { id } = req.params;
  const asset = await AssetService.getById(id);

  // Connect to data source and fetch sample
  const sample = await ConnectionService.querySample(
    asset.dataSourceId,
    `SELECT * FROM ${asset.schema}.${asset.tableName} LIMIT 100`
  );

  res.json({
    success: true,
    data: {
      rows: sample.rows,
      columns: sample.columns,
      totalRows: asset.metadata.rowCount
    }
  });
});
```

---

## Quick Wins (Easy Implementations)

### 1. Add "Sync Now" Button
```tsx
<button onClick={() => sync(dataSource.id)}>
  🔄 Sync Metadata Now
</button>
```

### 2. Show Last Sync Time
```tsx
<p>Last synced: {formatDistanceToNow(dataSource.lastSyncedAt)} ago</p>
```

### 3. Exclude System Schemas by Default
```typescript
const DEFAULT_EXCLUDED = [
  'information_schema',
  'pg_catalog',
  'mysql',
  'sys',
  'performance_schema'
];
```

---

## Comparison with Top Tools

### **Atlan Approach:**
1. Add connector → Test → **Select schemas/databases**
2. Set sync schedule (hourly/daily/weekly)
3. Preview discovered assets before saving
4. Tag assets during discovery

### **Alation Approach:**
1. Add data source → Test
2. Configure sampling settings
3. **Select schemas** with preview
4. Set extraction schedule
5. Enable query log harvesting

### **Your Recommended Flow:**
```
Step 1: Connection Details
  ├─ Type (PostgreSQL, MySQL, etc.)
  ├─ Host, Port, Database
  ├─ Username, Password
  └─ SSL settings

Step 2: Test Connection ✓

Step 3: Schema Selection (NEW)
  ├─ List all available schemas
  ├─ Checkboxes to include/exclude
  ├─ Show table counts
  ├─ Advanced: Pattern filters
  └─ Recommend excluding system schemas

Step 4: Sync Schedule (NEW)
  ├─ Manual only
  ├─ Hourly / Daily / Weekly
  └─ Custom cron expression

Step 5: Confirm & Create
  ├─ Review selections
  ├─ Start initial discovery
  └─ Redirect to data source details
```

---

## Implementation Priority

### Phase 1 (MVP - 1 week):
1. ✅ Schema selection in wizard
2. ✅ Save scan_config to database
3. ✅ Filter discovery based on config
4. ✅ "Sync Now" button

### Phase 2 (Enhanced - 2 weeks):
1. ✅ Scheduled syncs with cron
2. ✅ Pattern-based filters (include/exclude)
3. ✅ Sample data preview endpoint
4. ✅ Last sync timestamp display

### Phase 3 (Advanced - 1 month):
1. ✅ Incremental syncs (only changed tables)
2. ✅ Query history tracking
3. ✅ Column-level lineage parsing
4. ✅ Business glossary

---

## Database Schema Updates

```sql
-- Add to migration
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS scan_config JSONB DEFAULT '{
  "schemas": [],
  "include_patterns": [],
  "exclude_patterns": [],
  "sync_schedule": null,
  "last_sync_at": null,
  "next_sync_at": null
}'::jsonb;

ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'idle';
-- Values: 'idle', 'syncing', 'completed', 'failed'

CREATE INDEX idx_data_sources_sync_schedule ON data_sources
  USING GIN (scan_config)
  WHERE (scan_config->>'sync_schedule') IS NOT NULL;
```

---

## Summary

**Your current system is solid!** You're already:
- Using real data (not mocks) ✓
- Auto-discovering assets ✓
- Profiling metadata ✓

**Top 3 improvements to match industry leaders:**
1. **Schema/table selection** - Don't scan everything
2. **Scheduled syncs** - Keep metadata fresh automatically
3. **Sample data preview** - Let users see actual data

These changes will make your Data Catalog experience match tools like Atlan and Alation while keeping your lightweight, cost-effective architecture.
