# Data Quality Scanning Best Practices

## Overview

Your CWIC platform supports multiple scanning strategies. This guide explains when and how to use each approach.

---

## 🎯 Scanning Strategies

### Strategy 1: Full Data Source Scan (Recommended for Production)

**What**: Scan ALL enabled rules for an entire data source

**When to use**:
- ✅ Daily/weekly automated quality monitoring
- ✅ Post-ETL/data load validation
- ✅ Monthly compliance reports
- ✅ Initial data source profiling
- ✅ Health check dashboards

**Benefits**:
- Comprehensive quality coverage
- Detects cross-table dependencies
- Consistent baseline metrics
- Single execution session (efficient)
- Complete quality scorecard

**How to execute**:

#### Via UI:
1. Go to http://localhost:3000/quality?tab=rules
2. Select data source: "Azure Feya"
3. **Don't select any rules** (or select all)
4. Click **"Run Selected"**
5. Result: Scans all enabled rules for that data source

#### Via API:
```bash
# Scan all enabled rules for data source
curl -X POST "http://localhost:8000/api/quality/scan/{dataSourceId}" \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
{
  "success": true,
  "data": {
    "dataSourceId": "af910adf-c7c1-4573-9eec-93f05f0970b7",
    "totalRules": 154,
    "executedRules": 154,
    "passed": 140,
    "failed": 14,
    "errors": 0,
    "duration": 8547
  }
}
```

**Example Use Case**:
```
Scenario: Nightly quality check after ETL job

1. ETL loads data from source systems (2:00 AM)
2. Quality scan runs at 3:00 AM:
   - Scans all 154 enabled rules
   - Detects 14 quality issues
   - Sends alert if critical issues found
3. Team reviews violations in morning (9:00 AM)
4. Dashboard shows quality trend over time
```

---

### Strategy 2: Table-Specific Scan (Recommended for Development)

**What**: Scan only rules for a specific table

**When to use**:
- ✅ Testing new rules on one table
- ✅ Investigating specific table issues
- ✅ After table schema changes
- ✅ Incremental quality checks
- ✅ Development and debugging

**Benefits**:
- Faster execution (seconds vs minutes)
- Targeted troubleshooting
- Less resource intensive
- Immediate feedback during development
- Easier to understand results

**How to execute**:

#### Via UI (Using Filters):
1. Go to http://localhost:3000/quality?tab=rules
2. Select data source: "Azure Feya"
3. **Use search box**: Type table name (e.g., "Customer")
4. Rules are filtered to show only Customer table rules
5. Select filtered rules (or click Select All)
6. Click **"Run Selected"**

#### Via API (Filter by table):
```bash
# Get rules for specific table
RULES=$(curl "http://localhost:8000/api/quality/rules?dataSourceId={dsId}&search=Customer" | jq -r '.data[].id')

# Scan only those rules
curl -X POST "http://localhost:8000/api/quality/scan/{dataSourceId}" \
  -H "Content-Type: application/json" \
  -d "{\"ruleIds\": [$RULES]}"

# Response:
{
  "executedRules": 8,  // Only Customer table rules
  "passed": 7,
  "failed": 1
}
```

**Example Use Case**:
```
Scenario: New PII column added to Customer table

1. Developer adds "SSN" column to Customer table
2. QA creates PII detection rule for Customer.SSN
3. Test the rule:
   - Filter rules: search "Customer"
   - Select Customer rules only (8 rules)
   - Click "Run Selected"
   - Verify PII detected correctly
4. Fix any false positives
5. Enable rule for production
```

---

### Strategy 3: Dimension-Specific Scan

**What**: Scan rules for a specific quality dimension (accuracy, completeness, etc.)

**When to use**:
- ✅ Focus on specific quality aspect
- ✅ Compliance audits (e.g., only PII rules)
- ✅ Performance testing (e.g., only fast rules)
- ✅ Phased rollout of quality checks

**How to execute**:

#### Via UI (Using Dimension Filter):
1. Go to http://localhost:3000/quality?tab=rules
2. Select data source
3. **Filter by dimension**: Click dimension dropdown
   - Accuracy
   - Completeness
   - Consistency
   - Timeliness
   - Uniqueness
   - Validity
4. Select filtered rules
5. Click **"Run Selected"**

**Example Use Case**:
```
Scenario: GDPR Compliance Audit

1. Auditor asks: "Show me all PII-related violations"
2. Filter rules by dimension: "Privacy" or tag: "PII"
3. Run scan on all PII rules (23 rules)
4. Generate report showing:
   - PII columns detected: 45
   - PII columns encrypted: 40
   - PII columns needing attention: 5
5. Remediate issues
6. Re-run PII scan to verify fixes
```

---

### Strategy 4: Critical Rules Only (Recommended for Real-Time Monitoring)

**What**: Scan only HIGH/CRITICAL severity rules

**When to use**:
- ✅ Real-time monitoring during data loads
- ✅ Pre-deployment validation
- ✅ Circuit breaker patterns (stop pipeline if critical issues)
- ✅ Fast health checks (< 30 seconds)

**How to execute**:

#### Via UI (Using Severity Filter):
1. Go to http://localhost:3000/quality?tab=rules
2. **Filter by severity**: Select "High" or "Critical"
3. Select filtered rules
4. Click **"Run Selected"**

#### Via API:
```bash
# Get only high severity rules
CRITICAL_RULES=$(curl "http://localhost:8000/api/quality/rules?severity=high" | jq -r '.data[].id')

# Scan only critical rules (fast)
curl -X POST "http://localhost:8000/api/quality/scan/{dataSourceId}" \
  -H "Content-Type: application/json" \
  -d "{\"ruleIds\": [$CRITICAL_RULES]}"
```

**Example Use Case**:
```
Scenario: Real-time ETL pipeline validation

1. ETL pipeline loads 1M records
2. Before committing data:
   - Run critical rules only (10 rules, 15 seconds)
   - Check: NULL in required fields, invalid formats, referential integrity
3. If critical issues found:
   - HALT pipeline
   - Send alert
   - Rollback transaction
4. If all critical rules pass:
   - Commit data
   - Schedule full scan for later (all 154 rules)
```

---

## 📊 Comparison Matrix

| Strategy | Speed | Coverage | Use Case | Frequency |
|----------|-------|----------|----------|-----------|
| **Full Data Source** | Slow (5-10 min) | 100% | Production monitoring | Daily/Weekly |
| **Table-Specific** | Fast (10-30 sec) | 5-10% | Development/Testing | On-demand |
| **Dimension-Specific** | Medium (1-3 min) | 20-30% | Compliance audits | Monthly |
| **Critical Only** | Very Fast (< 30 sec) | 10-15% | Real-time checks | Continuous |

---

## 🏗️ Recommended Architecture

### Tier 1: Real-Time Checks (During Data Load)
- **What**: 10-15 critical rules
- **When**: During ETL pipeline execution
- **Duration**: < 30 seconds
- **Action**: HALT pipeline if failures

### Tier 2: Fast Validation (Post-Load)
- **What**: 40-50 high/medium rules
- **When**: Immediately after data load
- **Duration**: 2-3 minutes
- **Action**: Alert if failures

### Tier 3: Comprehensive Scan (Scheduled)
- **What**: All 150+ rules
- **When**: Daily at 3:00 AM
- **Duration**: 5-10 minutes
- **Action**: Report and dashboard

### Tier 4: Deep Dive (On-Demand)
- **What**: Table/dimension-specific scans
- **When**: User-triggered or issue investigation
- **Duration**: Variable
- **Action**: Detailed analysis and remediation

---

## 🎨 UI Workflow Examples

### Example 1: "I want to scan the Customer table only"

```
Step 1: Select data source
  → Choose: "Azure Feya"

Step 2: Filter rules
  → Search box: Type "Customer"
  → Result: 8 rules shown (out of 154)

Step 3: Select rules
  → Option A: Click "Select All" (selects visible 8 rules)
  → Option B: Manually check boxes for specific rules

Step 4: Execute
  → Click "Run Selected"
  → Wait 10 seconds

Step 5: View results
  → Scan Results card shows:
    - Executed: 8
    - Passed: 7
    - Failed: 1
  → Click failed rule to see details
```

### Example 2: "I want to check all PII rules across all tables"

```
Step 1: Select data source
  → Choose: "Azure Feya"

Step 2: Filter by dimension or tag
  → Option A: Filter by dimension: "Privacy"
  → Option B: Search: "PII"
  → Result: 23 PII rules shown

Step 3: Select and execute
  → Click "Select All"
  → Click "Run Selected"
  → Wait 45 seconds

Step 4: Review violations
  → Switch to "Violations" tab
  → Filter by severity: "High"
  → See: 5 PII violations requiring encryption
```

### Example 3: "I want to run a full quality assessment"

```
Step 1: Select data source
  → Choose: "Azure Feya"

Step 2: Don't filter anything
  → Leave search empty
  → No severity filter
  → No dimension filter
  → Result: All 154 rules shown

Step 3: Select all rules
  → Option A: Click "Select All"
  → Option B: Don't select anything (defaults to all enabled)

Step 4: Execute full scan
  → Click "Run Selected"
  → Wait 5-8 minutes (grab coffee ☕)

Step 5: View comprehensive report
  → Scan Results: 154 executed, 140 passed, 14 failed
  → Switch to "Overview" tab for metrics
  → Switch to "Violations" tab for issues
  → Export report for stakeholders
```

---

## 🔧 API Examples for Automation

### Automated Daily Scan (Cron Job)

```bash
#!/bin/bash
# daily-quality-scan.sh
# Run at 3:00 AM daily

DATA_SOURCE_ID="af910adf-c7c1-4573-9eec-93f05f0970b7"
API_BASE="http://localhost:8000/api"

# Full scan
RESULT=$(curl -s -X POST "$API_BASE/quality/scan/$DATA_SOURCE_ID" \
  -H "Content-Type: application/json" \
  -d '{}')

# Parse results
EXECUTED=$(echo "$RESULT" | jq -r '.data.executedRules')
PASSED=$(echo "$RESULT" | jq -r '.data.passed')
FAILED=$(echo "$RESULT" | jq -r '.data.failed')

echo "Quality Scan Complete: $EXECUTED executed, $PASSED passed, $FAILED failed"

# Alert if failures
if [ "$FAILED" -gt 0 ]; then
  echo "⚠️ Quality issues detected! Sending alert..."
  # Send email/Slack notification
fi
```

### Table-Specific Scan (CI/CD Pipeline)

```javascript
// test-customer-table-quality.js
// Run in CI/CD after deploying Customer table changes

const dataSourceId = 'af910adf-c7c1-4573-9eec-93f05f0970b7';
const apiBase = 'http://localhost:8000/api';

async function testCustomerTableQuality() {
  // Get all Customer table rules
  const rulesRes = await fetch(`${apiBase}/quality/rules?search=Customer`);
  const rulesData = await rulesRes.json();
  const customerRuleIds = rulesData.data.map(r => r.id);

  console.log(`Found ${customerRuleIds.length} rules for Customer table`);

  // Scan only Customer rules
  const scanRes = await fetch(`${apiBase}/quality/scan/${dataSourceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruleIds: customerRuleIds })
  });

  const scanData = await scanRes.json();
  const { executedRules, passed, failed } = scanData.data;

  console.log(`Scan complete: ${passed} passed, ${failed} failed`);

  // Fail CI/CD if critical issues
  if (failed > 0) {
    console.error('❌ Quality check FAILED! Cannot deploy.');
    process.exit(1);
  }

  console.log('✅ Quality check PASSED! Safe to deploy.');
}

testCustomerTableQuality();
```

---

## 💡 Recommendations

### For Your Current Setup (154 Rules)

**Production Strategy**:
1. **Daily Full Scan** (3:00 AM)
   - All 154 rules
   - 5-10 minute duration
   - Email report to team

2. **Critical Rules Monitor** (Every 4 hours)
   - 15 high severity rules only
   - 30 second duration
   - Alert on failures

3. **On-Demand Table Scans** (User-triggered)
   - Use UI filters
   - Targeted troubleshooting
   - Immediate feedback

**Development Workflow**:
1. Create rule for specific table
2. Filter to that table
3. Test rule (10-30 seconds)
4. Fix any issues
5. Enable for production
6. Next daily scan includes it

---

## 🎯 Quick Decision Guide

**"How should I scan?"**

```
┌─ Is this for monitoring/reporting?
│   YES → Full Data Source Scan (all rules)
│   NO  → Continue...
│
├─ Is this for testing a new rule?
│   YES → Table-Specific Scan (filter by table)
│   NO  → Continue...
│
├─ Is this for compliance audit?
│   YES → Dimension-Specific Scan (filter by dimension)
│   NO  → Continue...
│
└─ Is this for real-time validation?
    YES → Critical Rules Only (filter by severity: high)
```

---

## 📈 Performance Considerations

### Scanning 154 Rules

- **Per-Table Rules**: ~8 rules average per table
- **Per-Rule Execution**: 50-200ms each
- **Full Scan**: 154 rules × 150ms = ~23 seconds (parallel) or 5-8 minutes (serial)
- **Table Scan**: 8 rules × 150ms = ~1.2 seconds

**Optimization Tips**:
1. ✅ Disable unused rules (reduces scan time)
2. ✅ Use table-specific scans during development
3. ✅ Schedule full scans during low-traffic hours
4. ✅ Use critical-only scans for real-time checks
5. ✅ Consider parallel execution for large data sources

---

## 🎊 Summary

**Best Practice Answer**:

> **For production monitoring**: Scan ALL enabled rules for the data source (comprehensive)
>
> **For development/testing**: Scan table-specific rules (fast and targeted)
>
> **For compliance**: Scan dimension-specific rules (e.g., all PII rules)
>
> **For real-time**: Scan critical rules only (fast health check)

**Current Implementation**:
- ✅ Your system supports all strategies
- ✅ UI has filtering (search, severity, dimension)
- ✅ API accepts rule IDs array for custom scans
- ✅ Bulk operations work without rate limiting

**Recommended Setup**:
- Daily: Full scan (3:00 AM) - comprehensive baseline
- Hourly: Critical rules - fast health check
- On-demand: Table/dimension scans - targeted investigation

---

**Ready to Test**: Go to http://localhost:3000/quality?tab=rules and try different scanning strategies!
