# Auto-Fix Approval Workflow

## Overview

The new **Preview & Approve** workflow ensures users can review and confirm auto-fix actions before making any database changes. This provides full transparency and control over what will be modified.

## How It Works

### Step 1: Preview the Fix (Review Mode)
Get detailed information about what the fix will do, including SQL preview, affected rows, and warnings.

```bash
GET /api/quality/alerts/:alertId/auto-fix-preview?fixType={fixType}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "alertId": "6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f",
    "alert": {
      "table": "workflow_requests",
      "database": "cwic_platform",
      "issue": "127 duplicate rows found",
      "severity": "high",
      "rowsFailed": 127
    },
    "fix": {
      "type": "remove_duplicates",
      "rowsAffected": 127,
      "sqlPreview": "DELETE FROM cwic_platform.workflow_requests\nWHERE id IN (\n  SELECT id FROM (\n    SELECT id,\n      ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn\n    FROM cwic_platform.workflow_requests\n  ) t\n  WHERE rn > 1\n);",
      "explanation": "This will delete 127 duplicate rows from the table. You can choose which record to keep.",
      "warnings": [
        "Duplicate records will be permanently deleted",
        "Make sure you have a backup before proceeding",
        "Consider if duplicates are intentional (e.g., historical records)"
      ],
      "strategies": [
        {
          "name": "keep_newest",
          "label": "Keep Newest",
          "description": "Keep the most recently created record (recommended for active data)"
        },
        {
          "name": "keep_oldest",
          "label": "Keep Oldest",
          "description": "Keep the first created record (recommended for historical data)"
        },
        {
          "name": "keep_most_complete",
          "label": "Keep Most Complete",
          "description": "Keep the record with the most non-NULL fields (best data preservation)"
        }
      ],
      "estimatedExecutionTime": "1 seconds",
      "riskLevel": "medium"
    },
    "recommendations": [
      "✅ Create a database backup before proceeding",
      "✅ Review the SQL query and affected row count",
      "✅ Test in a non-production environment first",
      "✅ Have a rollback plan ready"
    ]
  }
}
```

### Step 2: Execute the Fix (Approval Required)
After reviewing, execute the fix with explicit confirmation.

```bash
POST /api/quality/alerts/auto-fix
{
  "alertId": "6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f",
  "fixType": "remove_duplicates",
  "strategy": "keep_newest",
  "confirmed": true  # ← REQUIRED for execution
}
```

**Without Confirmation** (confirmed=false or missing):
```json
{
  "success": false,
  "error": "Fix execution requires explicit confirmation. Set confirmed=true to proceed.",
  "hint": "Use GET /api/quality/alerts/:id/auto-fix-preview to review fix details first"
}
```

**With Confirmation** (confirmed=true):
```json
{
  "success": true,
  "data": {
    "id": "fix-abc-123",
    "alertId": "6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f",
    "fixType": "remove_duplicates",
    "status": "completed",
    "rowsAffected": 127,
    "executionTimeMs": 234
  },
  "message": "Auto-fix executed successfully. 127 rows affected."
}
```

## Complete User Flow

### Frontend Workflow

```
1. User sees critical alert
   ↓
2. Clicks "Auto-Fix Available"
   ↓
3. Frontend calls: GET /api/quality/alerts/:id/auto-fix-preview?fixType=remove_duplicates
   ↓
4. Shows MODAL with:
   ┌─────────────────────────────────────────────────────────┐
   │  Auto-Fix Preview                                       │
   ├─────────────────────────────────────────────────────────┤
   │  Alert: workflow_requests table has 127 duplicates      │
   │                                                          │
   │  Proposed Fix:                                          │
   │  • Type: Remove Duplicates                              │
   │  • Rows Affected: 127                                   │
   │  • Risk Level: MEDIUM                                   │
   │  • Estimated Time: 1 seconds                            │
   │                                                          │
   │  Strategy: [Dropdown]                                   │
   │  ○ Keep Newest (recommended)                            │
   │  ○ Keep Oldest                                          │
   │  ○ Keep Most Complete                                   │
   │                                                          │
   │  SQL Preview:                                           │
   │  ┌─────────────────────────────────────────────────┐   │
   │  │ DELETE FROM cwic_platform.workflow_requests    │   │
   │  │ WHERE id IN (...)                               │   │
   │  │ -- Will delete 127 duplicate rows              │   │
   │  └─────────────────────────────────────────────────┘   │
   │                                                          │
   │  ⚠️ Warnings:                                           │
   │  • Duplicate records will be permanently deleted        │
   │  • Make sure you have a backup before proceeding        │
   │  • Consider if duplicates are intentional               │
   │                                                          │
   │  ✅ Recommendations:                                    │
   │  • Create a database backup before proceeding           │
   │  • Review the SQL query and affected row count          │
   │  • Test in non-production environment first             │
   │                                                          │
   │  [Cancel]  [Execute Fix] ← requires user confirmation   │
   └─────────────────────────────────────────────────────────┘
   ↓
5. User reviews and clicks "Execute Fix"
   ↓
6. Frontend calls: POST /api/quality/alerts/auto-fix
   {
     "alertId": "...",
     "fixType": "remove_duplicates",
     "strategy": "keep_newest",
     "confirmed": true
   }
   ↓
7. Backend executes fix (actual DELETE)
   ↓
8. Shows success message: "✅ Fixed! 127 duplicate rows removed"
```

## API Endpoints

### 1. Preview Auto-Fix
**Endpoint**: `GET /api/quality/alerts/:alertId/auto-fix-preview`

**Query Parameters**:
- `fixType` (required): One of `set_null_defaults`, `remove_duplicates`, `correct_invalid_values`, `fix_negative_values`

**Purpose**: Get detailed preview of what the fix will do

**Returns**:
- Alert details
- Rows that will be affected (dry-run count)
- SQL preview
- Warnings and recommendations
- Available strategies (for duplicates)
- Risk level assessment

### 2. Execute Auto-Fix
**Endpoint**: `POST /api/quality/alerts/auto-fix`

**Body Parameters**:
- `alertId` (required): UUID of the alert
- `fixType` (required): Type of fix to execute
- `confirmed` (required): Must be `true` to execute
- `strategy` (optional): For duplicates - `keep_newest`, `keep_oldest`, `keep_most_complete`
- `defaultValue` (optional): For NULL fixes - value to set

**Purpose**: Execute the fix (requires confirmation)

**Returns**:
- Execution result
- Actual rows affected
- Execution time

## Fix Types & Previews

### 1. Remove Duplicates

**Preview Shows**:
```json
{
  "sqlPreview": "DELETE FROM table WHERE id IN (...)",
  "rowsAffected": 127,
  "strategies": [
    "keep_newest",
    "keep_oldest",
    "keep_most_complete"
  ],
  "warnings": [
    "Duplicate records will be permanently deleted",
    "Make sure you have a backup before proceeding"
  ]
}
```

### 2. Set NULL Defaults

**Preview Shows**:
```json
{
  "sqlPreview": "UPDATE table SET column = '<default>' WHERE column IS NULL",
  "rowsAffected": 45,
  "warnings": [
    "Make sure the default value is appropriate for your business logic",
    "This operation cannot be undone without a backup",
    "Consider if NULL values have business meaning"
  ]
}
```

### 3. Correct Invalid Values

**Preview Shows**:
```json
{
  "sqlPreview": "UPDATE table SET column = CASE WHEN column < 0 THEN 0 ... END",
  "rowsAffected": 12,
  "warnings": [
    "Verify the correction logic matches your business rules",
    "Original values will be overwritten",
    "Consider logging changed values for audit purposes"
  ]
}
```

### 4. Fix Negative Values

**Preview Shows**:
```json
{
  "sqlPreview": "UPDATE table SET column = 0 WHERE column < 0",
  "rowsAffected": 8,
  "warnings": [
    "All negative values will be set to 0",
    "Consider if negative values have business meaning (e.g., refunds)",
    "This is irreversible without a backup"
  ]
}
```

## Example: Complete Workflow

### Step 1: Get Preview
```bash
curl "http://localhost:3002/api/quality/alerts/6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f/auto-fix-preview?fixType=remove_duplicates"
```

**Response**:
```json
{
  "fix": {
    "rowsAffected": 127,
    "sqlPreview": "DELETE FROM...",
    "warnings": [...],
    "strategies": [...]
  }
}
```

### Step 2: Review in UI
User sees:
- ✅ 127 rows will be deleted
- ✅ SQL query to be executed
- ✅ Warnings about permanent deletion
- ✅ Strategy options (keep newest/oldest/most complete)

### Step 3: User Chooses Strategy & Confirms
User selects "Keep Newest" and clicks "Execute Fix"

### Step 4: Execute with Confirmation
```bash
curl -X POST "http://localhost:3002/api/quality/alerts/auto-fix" \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f",
    "fixType": "remove_duplicates",
    "strategy": "keep_newest",
    "confirmed": true
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Auto-fix executed successfully. 127 rows affected."
}
```

### Step 5: Verify Execution
```bash
curl "http://localhost:3002/api/quality/alerts/6ec7fb86-3ecd-4c9d-af95-b9a2a5ee089f/auto-fix-history"
```

**Response**:
```json
[
  {
    "id": "fix-123",
    "fixType": "remove_duplicates",
    "status": "completed",
    "rowsAffected": 127,
    "executedAt": "2025-10-22T10:00:00Z"
  }
]
```

## Safety Features

### 1. Two-Step Process
- **Step 1**: Preview (read-only, shows what will happen)
- **Step 2**: Execute (requires `confirmed=true`)

### 2. Explicit Confirmation Required
```javascript
// This will fail:
{ "confirmed": false }  // Error: confirmation required

// This will succeed:
{ "confirmed": true }   // Executes the fix
```

### 3. SQL Preview
Users can see the exact SQL that will be executed

### 4. Warnings & Recommendations
Each fix type shows specific warnings relevant to that operation

### 5. Risk Level Assessment
- **Low**: < 100 rows affected
- **Medium**: 100-1000 rows affected
- **High**: > 1000 rows affected

### 6. Execution History
All fixes are logged and can be audited

## Best Practices

### For Frontend Developers:
1. **Always show preview first** before allowing execution
2. **Display SQL query** in a code block for review
3. **Highlight warnings** in red/orange
4. **Require checkbox** or button confirmation before enabling "Execute"
5. **Show row count** prominently (e.g., "Will affect 127 rows")
6. **Add loading state** during execution
7. **Show success/error** messages after execution

### For Users:
1. **Review the SQL** before confirming
2. **Check row count** - does it seem reasonable?
3. **Read all warnings** - understand the risks
4. **Create backups** before executing (especially for high-risk fixes)
5. **Test in non-production** first when possible
6. **Choose strategy carefully** (for duplicates)

## Frontend Implementation Example

```typescript
// Step 1: Get preview
const preview = await fetch(
  `/api/quality/alerts/${alertId}/auto-fix-preview?fixType=remove_duplicates`
);

// Step 2: Show modal with preview
<Modal>
  <h2>Auto-Fix Preview</h2>
  <p>{preview.fix.explanation}</p>
  <p>Rows affected: {preview.fix.rowsAffected}</p>

  <CodeBlock language="sql">
    {preview.fix.sqlPreview}
  </CodeBlock>

  <Warnings items={preview.fix.warnings} />

  <StrategySelect options={preview.fix.strategies} />

  <Checkbox onChange={setConfirmed}>
    I have reviewed the SQL and understand this will modify my database
  </Checkbox>

  <Button
    onClick={executeFixWithConfirmation}
    disabled={!confirmed}
  >
    Execute Fix
  </Button>
</Modal>

// Step 3: Execute with confirmation
const executeFixWithConfirmation = async () => {
  const result = await fetch('/api/quality/alerts/auto-fix', {
    method: 'POST',
    body: JSON.stringify({
      alertId,
      fixType: 'remove_duplicates',
      strategy: selectedStrategy,
      confirmed: true  // ← Required
    })
  });

  if (result.success) {
    showSuccess(`Fixed! ${result.data.rowsAffected} rows affected`);
  }
};
```

## Summary

**Before**: Auto-fix directly modified data
**After**: Two-step preview → approve → execute workflow

**Benefits**:
- ✅ Full transparency (see exact SQL)
- ✅ User control (must confirm)
- ✅ Risk assessment (warnings + risk level)
- ✅ Strategy selection (for duplicates)
- ✅ Audit trail (execution history)

**User Journey**:
1. See critical alert
2. Click "Auto-Fix"
3. **Review** SQL preview, warnings, and row count
4. **Choose** strategy (if applicable)
5. **Confirm** execution
6. **Execute** fix
7. **Verify** results in history
