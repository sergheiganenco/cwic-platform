# Testing PII Integration with Data Quality

## What Was Fixed

### 1. Automatic Quality Issue Cleanup
When you disable a PII rule in `/pii-settings`, the system now automatically:
- Marks all related quality issues as `resolved`
- Sets resolution reason to "PII rule disabled"
- Updates `resolved_at` and `updated_at` timestamps
- Only affects issues with status `open` or `acknowledged`

**File Modified**: `backend/data-service/src/routes/piiRules.ts` (lines 186-200)

### 2. How It Works

**Before**:
```
User disables "IP Address" PII rule →
Old quality issues remain "open" →
User still sees IP Address violations in Data Quality
```

**After**:
```
User disables "IP Address" PII rule →
System finds all quality_issues where:
  - issue_type = 'pii_detected'
  - metadata->>'piiType' = 'ip_address'
  - status IN ('open', 'acknowledged')
→ Updates all matching issues to 'resolved'
→ Quality dashboard no longer shows these violations
```

## Testing Steps

### Test 1: Disable a PII Rule and Verify Issues Resolved

1. **Go to PII Settings**
   ```
   http://localhost:3000/pii-settings
   ```

2. **Note Current State**
   - Find a PII rule that's currently enabled (e.g., "IP Address")
   - Go to Data Quality dashboard
   - Note how many "PII Detected: IP Address" issues exist

3. **Disable the PII Rule**
   - Toggle OFF the "IP Address" rule in PII Settings
   - Check console - should log: `Closing quality issues for disabled PII rule: ip_address`

4. **Verify Issues Are Resolved**
   - Refresh Data Quality dashboard
   - Filter by status = "Resolved"
   - Find the IP Address issues
   - Should show resolution: "PII rule disabled"
   - Should NOT appear in "Open" issues anymore

5. **Re-enable the Rule**
   - Toggle ON the "IP Address" rule
   - Old issues remain resolved (correct behavior)
   - Run a new PII scan to create fresh issues

### Test 2: Check Database Directly

```sql
-- Before disabling a rule, check quality issues
SELECT
  id,
  title,
  status,
  metadata->>'piiType' as pii_type,
  resolution,
  created_at,
  resolved_at
FROM quality_issues
WHERE issue_type = 'pii_detected'
  AND metadata->>'piiType' = 'ip_address'
ORDER BY created_at DESC;

-- Disable the IP Address rule via API or UI

-- After disabling, verify issues are resolved
SELECT
  id,
  title,
  status,
  metadata->>'piiType' as pii_type,
  resolution,
  resolved_at
FROM quality_issues
WHERE issue_type = 'pii_detected'
  AND metadata->>'piiType' = 'ip_address'
ORDER BY created_at DESC;

-- Should show:
-- status: 'resolved'
-- resolution: 'PII rule disabled'
-- resolved_at: (current timestamp)
```

### Test 3: Full PII Scan Workflow

```bash
# 1. Get data sources
curl http://localhost:8000/api/data-sources

# 2. Get PII rules
curl http://localhost:8000/api/pii-rules

# 3. Run a PII scan
curl -X POST http://localhost:8000/api/pii-rules/scan/{dataSourceId}

# 4. Check quality issues created
curl http://localhost:8000/api/quality/issues | jq '.data[] | select(.issue_type == "pii_detected")'

# 5. Disable a PII rule
curl -X PUT http://localhost:8000/api/pii-rules/{ruleId} \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": false}'

# 6. Verify issues resolved
curl http://localhost:8000/api/quality/issues | jq '.data[] | select(.issue_type == "pii_detected" and .status == "resolved")'
```

### Test 4: Multiple PII Types

1. Enable several PII rules: SSN, Email, Phone, IP Address
2. Run PII scan
3. Verify issues created for each type
4. Disable only "Email" rule
5. Verify:
   - Email PII issues → Resolved
   - SSN, Phone, IP issues → Still Open
6. Re-enable "Email" rule
7. Verify:
   - Old email issues stay resolved
   - Can run new scan to create fresh email issues

## Expected Behavior

### When Disabling a PII Rule

✅ **Should happen**:
- Existing quality issues for that PII type are marked "resolved"
- Resolution message: "PII rule disabled"
- Issues disappear from "Open" filter in Data Quality
- Issues appear in "Resolved" filter

❌ **Should NOT happen**:
- Issues should NOT be deleted
- Issues from other PII types should NOT be affected
- Re-enabling rule should NOT auto-reopen old issues

### When Re-enabling a PII Rule

✅ **Should happen**:
- Rule becomes active again
- Future scans will create new issues
- Old resolved issues stay resolved (audit trail)

❌ **Should NOT happen**:
- Old resolved issues should NOT reopen automatically
- Need to run new scan to create fresh issues

## Issue Status Lifecycle

```
┌─────────────────────────────────────────────────┐
│         PII Rule: ENABLED                       │
├─────────────────────────────────────────────────┤
│  Scan runs → PII detected → Issue created      │
│  Status: OPEN                                   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│      User disables PII rule                     │
├─────────────────────────────────────────────────┤
│  System finds matching issues                   │
│  Updates status: OPEN → RESOLVED                │
│  Sets resolution: "PII rule disabled"           │
│  Sets resolved_at: NOW()                        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│         PII Rule: DISABLED                      │
├─────────────────────────────────────────────────┤
│  Issues remain RESOLVED (audit trail)           │
│  Future scans skip this PII type                │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│      User re-enables PII rule                   │
├─────────────────────────────────────────────────┤
│  Old issues stay RESOLVED                       │
│  New scans create fresh OPEN issues             │
└─────────────────────────────────────────────────┘
```

## Database Schema

### quality_issues Table (Relevant Columns)

```sql
- id: UUID (primary key)
- issue_type: VARCHAR -- 'pii_detected' for PII violations
- status: VARCHAR -- 'open', 'acknowledged', 'resolved', 'false_positive'
- severity: VARCHAR -- 'critical', 'high', 'medium', 'low'
- title: VARCHAR -- "PII Detected: Social Security Number (SSN)"
- description: TEXT
- metadata: JSONB -- { piiType: 'ssn', sensitivityLevel: 'critical', ... }
- resolution: VARCHAR -- "PII rule disabled", "Fixed", etc.
- resolved_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### pii_rule_definitions Table

```sql
- id: SERIAL (primary key)
- pii_type: VARCHAR -- 'ssn', 'email', 'phone', 'ip_address', etc.
- display_name: VARCHAR
- is_enabled: BOOLEAN -- Controls if rule is active
- sensitivity_level: VARCHAR -- 'critical', 'high', 'medium', 'low'
- requires_encryption: BOOLEAN
- requires_masking: BOOLEAN
- compliance_flags: TEXT[] -- ['GDPR', 'HIPAA', 'PCI-DSS']
```

## API Endpoints

### GET /api/pii-rules
Get all PII rule definitions

### PUT /api/pii-rules/:id
Update a PII rule (triggers issue cleanup if disabled)

**Request Body**:
```json
{
  "is_enabled": false,  // Triggers cleanup
  "sensitivity_level": "high",
  "requires_encryption": true,
  "requires_masking": false
}
```

**Cleanup Logic** (when is_enabled changes from true → false):
```typescript
await pool.query(`
  UPDATE quality_issues
  SET
    status = 'resolved',
    resolution = 'PII rule disabled',
    resolved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE issue_type = 'pii_detected'
    AND metadata->>'piiType' = $1
    AND status IN ('open', 'acknowledged')
`, [piiType]);
```

### POST /api/pii-rules/scan/:dataSourceId
Scan data source for PII using enabled rules

**Returns**:
```json
{
  "success": true,
  "data": {
    "dataSource": { "id": "...", "name": "..." },
    "scan": {
      "totalColumns": 150,
      "violationsFound": 12,
      "criticalViolations": 3,
      "highViolations": 2,
      "mediumViolations": 5,
      "lowViolations": 2,
      "violations": [...]
    }
  }
}
```

### GET /api/quality/issues
Get all quality issues (including PII violations)

**Filter by PII issues**:
```
/api/quality/issues?issue_type=pii_detected
```

**Filter by status**:
```
/api/quality/issues?status=resolved
```

## Common Issues & Solutions

### Issue: PII violations still showing after disabling rule

**Cause**: Browser cache or need to refresh
**Solution**:
1. Hard refresh (Ctrl+Shift+R)
2. Check API directly: `curl http://localhost:8000/api/quality/issues`
3. Verify rule is actually disabled: `curl http://localhost:8000/api/pii-rules`

### Issue: No quality issues created after scan

**Cause**: No PII rules enabled or no matching data
**Solution**:
1. Check enabled rules: `curl http://localhost:8000/api/pii-rules/enabled`
2. Verify columns exist: `curl http://localhost:8000/api/catalog/assets?asset_type=column`
3. Check scan results for details

### Issue: Real-samples endpoint 500 error

**Cause**: Trying to fetch samples from columns that don't exist in source
**Solution**: This is expected for some issue types. The endpoint should handle gracefully but may return empty samples.

## Next Steps

After verifying the integration works:

1. **Add UI Feedback**
   - Show toast notification when PII rule is disabled
   - Display count of issues resolved
   - Add confirmation dialog: "Disable this rule will resolve X open issues. Continue?"

2. **Scheduled Scans**
   - Add cron job to scan for PII weekly
   - Email notifications for new PII detections

3. **Remediation Tracking**
   - Add "remediation_status" field to track encryption/masking progress
   - Dashboard showing compliance percentile

4. **Audit Reports**
   - Generate PII inventory reports
   - Export for compliance audits (GDPR, HIPAA, etc.)

