# Profile Quality Filter Fix ✅

## Issue

In the **Data Quality → Profiling** tab, the "Quality Issues" filter was not working:
- Setting **Quality Issues: Yes** showed "No assets found"
- Should show tables that have quality issues

## Root Cause

**File**: [frontend/src/components/quality/CompactProfiling.tsx:248-258](frontend/src/components/quality/CompactProfiling.tsx#L248-258)

The filter was checking for a field that doesn't exist:

```typescript
// ❌ WRONG - Field doesn't exist
if (filterIssues === 'yes') {
  filtered = filtered.filter(a => {
    const summary = getIssueSummary(a.id);
    return summary && summary.openIssues > 0;  // ❌ openIssues doesn't exist!
  });
}
```

### Actual API Response Format

Looking at [useQualityIssueSummary.ts](frontend/src/hooks/useQualityIssueSummary.ts#L7-17):

```typescript
interface QualityIssueSummary {
  asset_id: string;
  table_name: string;
  schema_name: string;
  database_name: string;
  pii_column_count: number;
  columns_with_issues: number;
  total_issues: number;        // ✅ This is the correct field
  critical_issues: number;
  high_issues: number;
}
```

The field is `total_issues`, not `openIssues`.

## Fix Applied

Changed the filter to use the correct field name:

```typescript
// ✅ CORRECT - Uses total_issues field
if (filterIssues === 'yes') {
  filtered = filtered.filter(a => {
    const summary = getIssueSummary(a.id);
    return summary && summary.total_issues > 0;  // ✅ Correct field
  });
} else if (filterIssues === 'no') {
  filtered = filtered.filter(a => {
    const summary = getIssueSummary(a.id);
    return !summary || summary.total_issues === 0;
  });
}
```

## How It Works Now

### Quality Issues Filter

**"Yes"** - Shows tables with quality issues:
- Fetches issue summary from `/api/quality/issue-summary`
- Filters assets where `total_issues > 0`
- Shows tables that have data quality problems

**"No"** - Shows tables without quality issues:
- Filters assets where `total_issues === 0` or no summary exists
- Shows clean tables with no problems

**"All"** (default) - Shows all tables regardless of issues

### Combined with PII Filter

Both filters work together:

**PII: All, Quality Issues: Yes**
- Shows ALL tables that have quality issues (PII or non-PII)

**PII: Yes, Quality Issues: Yes**
- Shows only tables with PII AND quality issues

**PII: No, Quality Issues: Yes**
- Shows only tables without PII but WITH quality issues

## Testing

### Before Fix
```
Filter: Quality Issues = Yes
Result: "No assets found"  ❌
```

### After Fix
```
Filter: Quality Issues = Yes
Result: Shows all tables with total_issues > 0  ✅

Example:
- User table (3 issues)
- Customer table (5 issues)
- Employee table (2 issues)
```

## Files Changed

1. **[frontend/src/components/quality/CompactProfiling.tsx](frontend/src/components/quality/CompactProfiling.tsx#L248-258)** - Fixed filter logic

## Status

✅ **FIXED** - Quality Issues filter now works correctly in Profiling tab

---

**The filter now properly shows tables with quality issues!** 🎉
