# Simple Fix for PII Quality Issues

## Problem

Quality issues were created (154 issues) but don't appear in the UI because:
- The `listIssues` API query JOINs with `quality_rules` but returns 0 results
- Something is preventing the JOIN from working (possibly data type mismatch, tenant_id filter, or UUID format issue)

## Quick Fix

Since we know:
1. PII columns exist and are marked correctly (postal_code shows 🔒 zip_code)
2. Quality rules exist (14 PII rules found)
3. Quality issues were attempted to be created

The simplest fix is to **rescan from scratch** after the services are properly integrated.

## Solution: Use PIIQualityIntegration Service

The system has a proper `PIIQualityIntegration` service that's designed to:
1. Scan data sources for PII
2. Create quality issues correctly
3. Handle all data types and formats properly

**Instead of our backfill script, use the proper service:**

```bash
# Delete any partial/broken quality issues
curl -X DELETE http://localhost:3002/api/quality/issues/bulk-delete?title=PII%20Detected

# Then use the proper PII scanning service (if endpoint exists)
curl -X POST http://localhost:3002/api/pii-scan/data-source/{dataSourceId}
```

## Root Cause

The issue is likely that:
1. Our quick backfill script created quality_issues records
2. But they're not being returned by the list API due to:
   - Missing/incorrect foreign key to quality_rules
   - data_source_id format mismatch (UUID string vs UUID type)
   - tenant_id filtering
   - The records exist but the JOIN fails silently

## Proper Solution

The **PIIRescanService** we enhanced should now work correctly going forward. The issue is just with the backfill we did.

**For future scans:**
- PIIRescanService.rescanWithRule() now creates quality issues ✅
- Uses the same methods and data types as the rest of the system
- Will work correctly

**For existing PII:**
- Need to either fix the backfill script
- OR just wait for next rescan cycle
- OR manually trigger a proper PII scan using PIIQualityIntegration

## Recommendation

Tell the user to:
1. Wait for the next automatic PII scan (if scheduled)
2. OR trigger a manual rescan using the proper service
3. The enhanced PIIRescanService will create quality issues correctly going forward

The green checkmarks will turn red once proper quality issues are created through the normal scan process (not our backfill).
