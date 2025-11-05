# Auto-Fix Approval Workflow - Implementation Summary

## What Changed

✅ **NEW: Two-Step Approval Process**

Instead of directly executing fixes, users now:
1. **Preview** the fix (see SQL, warnings, affected rows)
2. **Confirm** to execute (requires `confirmed=true`)

## New Endpoints

### 1. Preview Endpoint (NEW)
```bash
GET /api/quality/alerts/:alertId/auto-fix-preview?fixType=remove_duplicates
```

**Shows**:
- Exact SQL that will be executed
- Number of rows that will be affected (dry-run)
- Warnings specific to the fix type
- Available strategies (for duplicates)
- Risk level assessment (low/medium/high)
- Recommendations before executing

### 2. Execute Endpoint (UPDATED)
```bash
POST /api/quality/alerts/auto-fix
{
  "alertId": "uuid",
  "fixType": "remove_duplicates",
  "confirmed": true,  # ← NOW REQUIRED
  "strategy": "keep_newest"
}
```

**Changed**:
- Now **requires `confirmed=true`** to execute
- Without confirmation → returns error with hint to use preview first
- Removed `dryRun` parameter (preview does dry-run automatically)

## Example Usage

### Step 1: Preview (Safe - No Changes)
```bash
curl "http://localhost:3002/api/quality/alerts/abc-123/auto-fix-preview?fixType=remove_duplicates"
```

**Response**:
```json
{
  "fix": {
    "type": "remove_duplicates",
    "rowsAffected": 127,
    "sqlPreview": "DELETE FROM table WHERE id IN (...)",
    "explanation": "This will delete 127 duplicate rows",
    "warnings": [
      "Duplicate records will be permanently deleted",
      "Make sure you have a backup before proceeding"
    ],
    "strategies": [
      {"name": "keep_newest", "label": "Keep Newest"},
      {"name": "keep_oldest", "label": "Keep Oldest"},
      {"name": "keep_most_complete", "label": "Keep Most Complete"}
    ],
    "riskLevel": "medium"
  }
}
```

### Step 2: Execute (Requires Confirmation)
```bash
# Without confirmation - FAILS:
curl -X POST "http://localhost:3002/api/quality/alerts/auto-fix" \
  -H "Content-Type: application/json" \
  -d '{"alertId":"abc-123","fixType":"remove_duplicates","confirmed":false}'

# Returns:
{
  "error": "Fix execution requires explicit confirmation. Set confirmed=true to proceed."
}

# With confirmation - EXECUTES:
curl -X POST "http://localhost:3002/api/quality/alerts/auto-fix" \
  -H "Content-Type: application/json" \
  -d '{"alertId":"abc-123","fixType":"remove_duplicates","confirmed":true,"strategy":"keep_newest"}'

# Returns:
{
  "success": true,
  "message": "Auto-fix executed successfully. 127 rows affected."
}
```

## UI Flow

```
User clicks "Auto-Fix" button
         ↓
Modal shows:
┌─────────────────────────────────────┐
│ Auto-Fix Preview                    │
├─────────────────────────────────────┤
│ Will delete 127 duplicate rows      │
│                                      │
│ SQL Preview:                         │
│ DELETE FROM table...                 │
│                                      │
│ ⚠️ Warnings:                        │
│ • Permanent deletion                 │
│ • Make backup first                  │
│                                      │
│ Strategy: [Keep Newest ▼]           │
│                                      │
│ [Cancel] [Execute Fix]              │
└─────────────────────────────────────┘
         ↓
User clicks "Execute Fix"
         ↓
POST with confirmed=true
         ↓
✅ Success: 127 rows deleted
```

## Benefits

### For Users:
✅ **Know exactly what will happen** before it happens
✅ **See the SQL** that will be executed
✅ **Choose strategy** (for duplicates)
✅ **Review warnings** specific to the fix type
✅ **Cannot accidentally execute** (requires explicit confirmation)

### For Developers:
✅ **Safe by default** (preview before execute)
✅ **Audit trail** (all executions logged)
✅ **Type safety** (validation on fixType, strategy)
✅ **Clear error messages** (hints when confirmation missing)

## Migration Guide

### Old Way (Direct Execution):
```javascript
// ❌ OLD - Direct execution with dryRun
fetch('/api/quality/alerts/auto-fix', {
  method: 'POST',
  body: JSON.stringify({
    alertId: 'abc-123',
    fixType: 'remove_duplicates',
    dryRun: false  // Execute immediately
  })
});
```

### New Way (Preview → Confirm → Execute):
```javascript
// ✅ NEW - Step 1: Preview
const preview = await fetch(
  '/api/quality/alerts/abc-123/auto-fix-preview?fixType=remove_duplicates'
).then(r => r.json());

// Show modal with preview.fix.sqlPreview, warnings, etc.

// ✅ NEW - Step 2: Execute with confirmation
const result = await fetch('/api/quality/alerts/auto-fix', {
  method: 'POST',
  body: JSON.stringify({
    alertId: 'abc-123',
    fixType: 'remove_duplicates',
    confirmed: true,  // ← Required
    strategy: 'keep_newest'
  })
}).then(r => r.json());
```

## Testing

All tests passed:

✅ **Preview endpoint returns detailed fix information**
```bash
curl "http://localhost:3002/api/quality/alerts/6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f/auto-fix-preview?fixType=remove_duplicates"
# Returns: rowsAffected, sqlPreview, warnings, strategies
```

✅ **Execute without confirmation fails**
```bash
curl -X POST "http://localhost:3002/api/quality/alerts/auto-fix" \
  -H "Content-Type: application/json" \
  -d '{"alertId":"6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f","fixType":"remove_duplicates","confirmed":false}'
# Returns: Error with hint to use preview first
```

✅ **Execute with confirmation works**
```bash
curl -X POST "http://localhost:3002/api/quality/alerts/auto-fix" \
  -H "Content-Type: application/json" \
  -d '{"alertId":"6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f","fixType":"remove_duplicates","confirmed":true}'
# Returns: Success (would execute if there were duplicates)
```

## Files Modified

1. **backend/data-service/src/controllers/EnhancedCriticalAlertsController.ts**
   - Added `previewAutoFix()` method (lines 644-803)
   - Updated `executeAutoFix()` to require confirmation (lines 809-857)

2. **backend/data-service/src/routes/quality.ts**
   - Added preview route (lines 1037-1048)
   - Updated execute route to validate `confirmed` parameter (lines 1055-1069)

3. **Documentation**
   - Created [AUTOFIX_APPROVAL_WORKFLOW.md](AUTOFIX_APPROVAL_WORKFLOW.md) - Full workflow documentation
   - Created [AUTOFIX_APPROVAL_SUMMARY.md](AUTOFIX_APPROVAL_SUMMARY.md) - Quick reference

## Next Steps

To use this in your frontend:

1. **Update Auto-Fix Button Click**:
   - Call preview endpoint first
   - Show modal with SQL, warnings, row count
   - Add confirmation checkbox or button

2. **Add Modal Component**:
   - Display `sqlPreview` in code block
   - Show `warnings` as alert messages
   - Show `strategies` as radio buttons (for duplicates)
   - Add "Execute" button (disabled until user confirms)

3. **Handle Execution**:
   - Call execute endpoint with `confirmed: true`
   - Show loading state
   - Display success/error message
   - Refresh alerts list

See [AUTOFIX_APPROVAL_WORKFLOW.md](AUTOFIX_APPROVAL_WORKFLOW.md) for complete implementation examples!
