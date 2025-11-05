# How Quality Issues Are Calculated in CWIC Platform

## Quick Answer

**"Issues Found" in the Overview tab = Quality Rule Failures + Rule Errors**

The calculation is: `failed + error` from the `quality_results` table

This does **NOT** include PII violations directly - PII violations are tracked separately in the `quality_issues` table.

---

## Detailed Explanation

### Overview Tab Metrics

When you look at the Data Quality → Overview tab, you see these cards:

1. **RULES EXECUTED** - Total quality rules executed
2. **PASSED RULES** - Rules that passed validation
3. **FAILED RULES** - Rules that failed validation
4. **ASSET COVERAGE** - How many assets are monitored

And in the hero section at the top:
- **71 Issues Found** (in your screenshot)

---

## The Two Types of "Issues" in CWIC Platform

### 1. Quality Rule Execution Results (`quality_results` table)

**Source**: Quality rules that run SQL checks against your data

**Tracked in**: `quality_results` table

**Statuses**:
- `passed` - Rule validation succeeded
- `failed` - Rule validation failed (data doesn't meet quality criteria)
- `error` - Rule execution encountered an error (SQL error, timeout, etc.)
- `skipped` - Rule was skipped
- `timeout` - Rule execution timed out

**What it measures**:
- Completeness rules (null checks, missing values)
- Accuracy rules (data format validation, range checks)
- Consistency rules (referential integrity, cross-table checks)
- Validity rules (data type validation, constraint checks)
- Freshness rules (last updated timestamp checks)
- Uniqueness rules (duplicate detection)

**Example**:
```sql
-- Rule: "Email addresses should not be null"
SELECT COUNT(*) AS failed_rows
FROM User
WHERE Email IS NULL;
-- If failed_rows > 0, this rule result is "failed"
```

---

### 2. Quality Issues (PII Violations, Data Quality Problems) (`quality_issues` table)

**Source**: Detected data quality problems and PII violations

**Tracked in**: `quality_issues` table

**What it includes**:
- **PII Violations**: Unencrypted sensitive data (SSN, Credit Card, Email, etc.)
- **Data Quality Issues**: Specific problems found during profiling
- **Schema Issues**: Missing constraints, indexes, etc.
- **Compliance Issues**: Regulatory compliance violations

**Status**:
- `open` - Issue needs attention
- `acknowledged` - Issue has been seen but not fixed
- `resolved` - Issue has been fixed
- `false_positive` - Issue was incorrectly flagged

**Severity**:
- `critical` - Requires immediate attention (e.g., unencrypted SSN)
- `high` - Important but not critical
- `medium` - Should be addressed
- `low` - Nice to fix

**Example Quality Issue**:
```json
{
  "issue_type": "pii_violation",
  "severity": "critical",
  "title": "Unencrypted SSN column detected",
  "description": "Column 'SSN' in table 'User' contains unencrypted SSN data",
  "asset_id": 28,
  "column_id": 123,
  "status": "open"
}
```

---

## How "Issues Found" is Calculated

### In the Overview Tab

**Location**: Data Quality → Overview → Hero Section (top card)

**Calculation**:
```typescript
// frontend/src/components/quality/ProductionQualityOverview.tsx:479
data.totals.failed + data.totals.error
```

**SQL Query** (from `/api/quality/summary` endpoint):
```sql
SELECT
  COUNT(*)::int AS total,
  SUM(CASE WHEN status = 'passed'  THEN 1 ELSE 0 END)::int AS passed,
  SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END)::int AS failed,
  SUM(CASE WHEN status = 'error'   THEN 1 ELSE 0 END)::int AS error,
  SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END)::int AS skipped,
  SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END)::int AS timeout,
  COALESCE(AVG(execution_time_ms), 0)::float AS avg_exec_ms
FROM quality_results
WHERE run_at >= $1  -- Timeframe filter (7d, 30d, etc.)
  AND data_source_id = $2  -- Data source filter (optional)
```

**What it represents**:
- **Failed rules**: Quality rules that detected problems
- **Error rules**: Quality rules that couldn't execute properly

**Example from your screenshot**:
- 71 Issues Found = 59 failed rules + 12 error rules

---

## How PII Issues Are Tracked

### PII Violations vs Quality Rule Failures

**PII violations are NOT included in "Issues Found" on the Overview tab.**

Instead, PII violations are:
1. **Created in `quality_issues` table** when PII is detected
2. **Displayed in the Violations tab** (Data Quality → Violations)
3. **Shown in the Profiling tab** with PII badge
4. **Listed in PII Settings page**

### When PII Quality Issues Are Created

**Automatic PII Detection**:
```typescript
// backend/data-service/src/services/PIIQualityIntegration.ts
async createQualityIssueForPIIViolation(violation: PIIViolation) {
  // Only create quality issue if PII rule requires protection
  if (violation.requiresEncryption || violation.requiresMasking) {
    await db.query(`
      INSERT INTO quality_issues (
        asset_id, column_id, issue_type, severity, status,
        title, description, detected_at
      ) VALUES ($1, $2, 'pii_violation', $3, 'open', $4, $5, NOW())
    `, [
      violation.assetId,
      violation.columnId,
      violation.sensitivityLevel,  // critical, high, medium, low
      `Unencrypted ${violation.piiDisplayName} detected`,
      `Column '${violation.columnName}' contains ${violation.piiDisplayName} that requires ${violation.requiresEncryption ? 'encryption' : 'masking'}`
    ]);
  }
}
```

**Manual "Mark as PII"**:
```typescript
// backend/data-service/src/routes/catalog.ts:2550-2673
// When user manually marks a column as PII, we create quality issue
// based on the PII rule's requirements (requires_encryption, requires_masking)
```

**PII Rule Configuration**:
```sql
-- pii_rule_definitions table
SELECT pii_type, sensitivity_level, requires_encryption, requires_masking
FROM pii_rule_definitions;

-- Examples:
-- ssn:          critical, requires_encryption=true,  requires_masking=true
-- credit_card:  critical, requires_encryption=true,  requires_masking=true
-- email:        medium,   requires_encryption=false, requires_masking=false
-- phone:        medium,   requires_encryption=false, requires_masking=true
```

---

## Summary Tables

### Overview Tab Metrics

| Metric | Source | Calculation |
|--------|--------|-------------|
| **Rules Executed** | `quality_results` | `COUNT(*)` |
| **Passed Rules** | `quality_results` | `COUNT(*) WHERE status = 'passed'` |
| **Failed Rules** | `quality_results` | `COUNT(*) WHERE status = 'failed'` |
| **Pass Rate** | `quality_results` | `(passed / total) * 100` |
| **Issues Found** | `quality_results` | `failed + error` |
| **Assets Tracked** | `quality_results` | `COUNT(DISTINCT asset_id)` |

### Violations Tab Metrics

| Metric | Source | Calculation |
|--------|--------|-------------|
| **Total Issues** | `quality_issues` | `COUNT(*) WHERE status = 'open'` |
| **Critical Issues** | `quality_issues` | `COUNT(*) WHERE severity = 'critical' AND status = 'open'` |
| **PII Violations** | `quality_issues` | `COUNT(*) WHERE issue_type = 'pii_violation' AND status = 'open'` |
| **Resolved Issues** | `quality_issues` | `COUNT(*) WHERE status = 'resolved'` |

---

## API Endpoints

### Get Quality Summary (Overview Tab Data)

**Endpoint**: `GET /api/quality/summary`

**Query Parameters**:
- `timeframe` - `24h`, `7d`, `30d`, `90d` (default: `7d`)
- `dataSourceId` - Filter by data source UUID
- `databases` - Filter by databases (comma-separated)
- `database` - Filter by single database
- `assetType` - Filter by asset type (`table`, `view`)

**Response**:
```json
{
  "success": true,
  "data": {
    "timeframe": "7d",
    "from": "2025-10-19T00:00:00.000Z",
    "to": "2025-10-26T00:00:00.000Z",
    "totals": {
      "total": 136,        // Total rules executed
      "passed": 65,        // Rules that passed
      "failed": 59,        // Rules that failed ⚠️
      "error": 12,         // Rules with errors ⚠️
      "skipped": 0,
      "timeout": 0,
      "passRate": 47.8,    // Percentage of passed rules
      "avgExecMs": 1,      // Average execution time
      "overallScore": 96   // Overall quality health score
    },
    "assetCoverage": {
      "total": 0,          // Total assets
      "monitored": 0,      // Assets with quality rules
      "unmonitored": 0     // Assets without quality rules
    },
    "dimensions": {
      "completeness": 99.4,
      "accuracy": 95.2,
      "consistency": 98.1,
      "validity": 97.3,
      "freshness": 89.5,
      "uniqueness": 96.7
    }
  }
}
```

**Issues Found Calculation**:
```javascript
const issuesFound = data.totals.failed + data.totals.error;
// 71 = 59 + 12
```

---

### Get Quality Issues (Violations Tab Data)

**Endpoint**: `GET /api/quality/issues`

**Query Parameters**:
- `assetId` - Filter by asset
- `severity` - Filter by severity (`critical`, `high`, `medium`, `low`)
- `status` - Filter by status (`open`, `acknowledged`, `resolved`)
- `issueType` - Filter by type (`pii_violation`, `data_quality`, `schema`, `compliance`)

**Response**:
```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "id": 1452,
        "asset_id": 28,
        "column_id": 123,
        "issue_type": "pii_violation",
        "severity": "critical",
        "status": "open",
        "title": "Unencrypted Credit Card detected",
        "description": "Column 'CreditCard' contains credit_card that requires encryption",
        "detected_at": "2025-10-26T12:00:00Z",
        "resolved_at": null
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 50,
      "offset": 0
    }
  }
}
```

---

## Key Differences

| Aspect | Quality Rule Results | Quality Issues |
|--------|---------------------|----------------|
| **Table** | `quality_results` | `quality_issues` |
| **What** | Execution outcomes of quality rules | Detected problems and violations |
| **When Created** | Every time a quality rule runs | When PII is detected or rule fails |
| **Shown In** | Overview tab, Rules tab | Violations tab, Profiling tab |
| **Statuses** | passed, failed, error, skipped, timeout | open, acknowledged, resolved, false_positive |
| **Persistence** | Historical record of all executions | Current state of issues |
| **Example** | "Email null check" failed on 2025-10-26 | "Unencrypted SSN in User.SSN column" |

---

## Real-World Example

### Scenario: User Table with PII

**Table**: `Feya_DB.dbo.User`

**Columns**:
- `Id` (int)
- `Firstname` (varchar) - Marked as PII type: `name`
- `Lastname` (varchar) - Marked as PII type: `name`
- `Email` (varchar) - Marked as PII type: `email`
- `SSN` (varchar) - Marked as PII type: `ssn`
- `CreditCard` (varchar) - Marked as PII type: `credit_card`

### What Happens:

#### 1. PII Detection (Automatic or Manual)

**Email column** (requires_encryption=false, requires_masking=false):
- ❌ **No quality issue created** (monitoring mode)
- ✅ Column marked as PII in `catalog_columns`
- ✅ Shown with PII badge in UI

**SSN column** (requires_encryption=true, requires_masking=true):
- ✅ **Quality issue created** in `quality_issues` table
- ✅ Column marked as PII in `catalog_columns`
- ✅ Shown with PII badge + critical alert in UI
- ✅ Appears in Violations tab

**CreditCard column** (requires_encryption=true, requires_masking=true):
- ✅ **Quality issue created** in `quality_issues` table
- ✅ Column marked as PII in `catalog_columns`
- ✅ Shown with PII badge + critical alert in UI
- ✅ Appears in Violations tab

#### 2. Quality Rules Execution

**Rule**: "Email addresses should not be null"
```sql
SELECT COUNT(*) AS failed_rows FROM User WHERE Email IS NULL;
```

**Result**:
- If `failed_rows = 0` → Result status = `passed` ✅
- If `failed_rows > 0` → Result status = `failed` ❌
- Recorded in `quality_results` table
- Counted in "Issues Found" if failed

**Rule**: "SSN must match format XXX-XX-XXXX"
```sql
SELECT COUNT(*) AS failed_rows FROM User WHERE SSN !~ '^\d{3}-\d{2}-\d{4}$';
```

**Result**:
- Recorded in `quality_results` table
- Counted in "Issues Found" if failed or error

### Final Counts:

**Overview Tab (quality_results)**:
- Rules Executed: 136
- Passed: 65
- Failed: 59
- Errors: 12
- **Issues Found: 71** (59 failed + 12 errors)

**Violations Tab (quality_issues)**:
- Total Issues: 45
- Critical Issues: 12 (including SSN and CreditCard PII violations)
- PII Violations: 8
- Resolved: 3

---

## Conclusion

**To answer your question**:

> "How do you calculate the issues? Is it quality issues or PII or all together?"

**Answer**:

1. **"Issues Found" in Overview tab** = Quality rule failures + errors from `quality_results` table
   - Does **NOT** directly include PII violations
   - Shows: Rule execution outcomes

2. **PII violations** are tracked separately in `quality_issues` table
   - Only created if PII rule requires encryption/masking
   - Shown in: Violations tab, Profiling tab

3. **They are separate but related**:
   - Quality rules can detect data quality problems
   - PII detection creates quality issues when protection is required
   - Both contribute to overall data quality health

**Summary**:
- **Overview → Issues Found**: Quality rule failures (from rule execution results)
- **Violations → Total Issues**: Quality issues including PII violations (from detected problems)
- **They measure different things but both indicate data quality problems**

---

## Files Referenced

### Backend
- [backend/data-service/src/services/StatsService.ts:45-354](backend/data-service/src/services/StatsService.ts#L45-354) - Quality summary calculation
- [backend/data-service/src/controllers/QualityController.ts:287-354](backend/data-service/src/controllers/QualityController.ts#L287-354) - Summary endpoint
- [backend/data-service/src/services/PIIQualityIntegration.ts](backend/data-service/src/services/PIIQualityIntegration.ts) - PII issue creation
- [backend/data-service/src/routes/catalog.ts:2550-2673](backend/data-service/src/routes/catalog.ts#L2550-2673) - Manual PII marking

### Frontend
- [frontend/src/components/quality/ProductionQualityOverview.tsx:479](frontend/src/components/quality/ProductionQualityOverview.tsx#L479) - Issues Found display
- [frontend/src/components/quality/ProductionQualityOverview.tsx:272-320](frontend/src/components/quality/ProductionQualityOverview.tsx#L272-320) - Data fetching

### Database
- `quality_results` table - Rule execution results
- `quality_issues` table - Detected quality problems and PII violations
- `quality_rules` table - Quality rule definitions
- `pii_rule_definitions` table - PII type configurations
