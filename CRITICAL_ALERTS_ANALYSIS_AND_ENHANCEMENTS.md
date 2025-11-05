# Critical Alerts: Deep Analysis & Enhancement Proposals

## Executive Summary

After deep analysis of the Critical Alerts system, I've identified **significant limitations** in the current implementation that explain why cwic_platform shows 55 alerts while AdventureWorks (with intentionally inserted bad data) shows only 4 alerts. The system is currently **too simplistic** and misses **real data quality issues**.

**Current Status**: ⚠️ INCOMPLETE - Only shows empty table alerts
**Proposed Status**: ✅ COMPREHENSIVE - Intelligent multi-dimensional quality monitoring

---

## Table of Contents
1. [Current Implementation Analysis](#current-implementation-analysis)
2. [Why cwic_platform Has More Alerts](#why-cwic_platform-has-more-alerts)
3. [Critical Gaps Identified](#critical-gaps-identified)
4. [Enhancement Proposals](#enhancement-proposals)
5. [Implementation Roadmap](#implementation-roadmap)

---

## Current Implementation Analysis

### How Critical Alerts Currently Work

**Query Logic** ([QualityController.ts:913-1011](backend/data-service/src/controllers/QualityController.ts#L913-L1011)):

```sql
SELECT
  qres.id,
  qres.status,
  qres.rows_failed,
  qres.run_at,
  qr.severity,
  qr.description,
  ca.table_name,
  ca.database_name
FROM quality_results qres
JOIN quality_rules qr ON qr.id = qres.rule_id
LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
WHERE qres.status = 'failed'
  AND qres.run_at > NOW() - INTERVAL '24 hours'
ORDER BY
  CASE qr.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  qres.run_at DESC
LIMIT 10
```

### Current Criteria (Oversimplified)

| Criterion | Current Implementation | Issues |
|-----------|----------------------|---------|
| **Time Window** | Last 24 hours only | Misses long-standing issues |
| **Severity Filter** | ALL failed results (critical, high, medium, low) | No actual criticality threshold |
| **Status Filter** | `status = 'failed'` only | Binary pass/fail - no severity gradation |
| **Impact Calculation** | `rows_failed * $50` | Arbitrary - doesn't consider business context |
| **Alert Prioritization** | Severity → Recency | Doesn't consider: frequency, trend, blast radius |
| **Deduplication** | None | Same issue appears multiple times |
| **Rule Types Covered** | ALL (completeness, validity, uniqueness, etc.) | No filtering by criticality |

### What Gets Flagged as "Critical"

Based on current data:

**cwic_platform (55 alerts)**:
- ALL are "Table X should contain at least one row" (completeness checks)
- ALL have severity = "high" (not actually critical)
- ALL are empty tables (workflow_requests, user_notifications, etc.)
- Impact: 1 row failed, $0K revenue

**AdventureWorks (4 alerts)**:
- 2x "product_reviews should contain at least one row"
- 2x "audit_log should contain at least one row"
- Impact: 1 row failed, $0K revenue

### Critical Insight

**The system is ONLY showing empty table alerts!**

It's completely missing:
- ❌ NULL values in critical columns (customers.email = NULL)
- ❌ Invalid data (products with negative prices: -$15.99)
- ❌ Duplicate records (duplicate customer emails)
- ❌ Constraint violations (orders with mismatched totals)
- ❌ Future dates in historical data (orders dated 2026)
- ❌ Negative inventory quantities (-5, -12 items)
- ❌ Referential integrity issues

---

## Why cwic_platform Has More Alerts Than AdventureWorks

### Root Cause Analysis

**Reason 1: More Tables = More Empty Table Alerts**

cwic_platform has **136 quality rules** (based on API response) vs AdventureWorks with fewer tables. The current system creates a "Has Data" completeness rule for EVERY table, so:

- cwic_platform has ~55 empty tables → 55 alerts
- AdventureWorks has ~4 empty tables (product_reviews, audit_log) → 4 alerts

**This is NOT a quality issue** - these are intentionally empty tables (workflow_requests, quality_slas, etc.) that aren't used yet.

**Reason 2: AdventureWorks Bad Data Not Being Detected**

We inserted **15 types of bad data** into AdventureWorks:
1. ✅ Completeness: NULL emails → **NOT SHOWING IN ALERTS**
2. ✅ Validity: Invalid credit limits (>$50K) → **NOT SHOWING**
3. ✅ Uniqueness: Duplicate emails → **NOT SHOWING**
4. ✅ Validity: Negative product prices (-$15.99) → **NOT SHOWING**
5. ✅ Completeness: Missing descriptions → **NOT SHOWING**
6. ✅ Consistency: Order totals don't match line items → **NOT SHOWING**
7. ✅ Validity: Future order dates (2026) → **NOT SHOWING**
8. ✅ Consistency: Negative inventory (-5, -12) → **NOT SHOWING**
9. ✅ Accuracy: Unrealistic salaries → **NOT SHOWING**
10. ✅ Completeness: Missing employee emails → **NOT SHOWING**
11. ✅ Validity: Negative payment amounts (-$50) → **NOT SHOWING**
12. ✅ Validity: Future payment dates → **NOT SHOWING**
13. ✅ Completeness: Missing address fields → **NOT SHOWING**
14. ✅ Uniqueness: Duplicate SKUs → **NOT SHOWING**
15. ✅ Outliers: Extreme values (999,999 points) → **NOT SHOWING**

**Why?** Because the quality rules for these dimensions either:
- Don't exist yet
- Exist but aren't classified as "critical" or "high" severity
- Exist but passed (incorrectly configured thresholds)
- Results are older than 24 hours

**Reason 3: Overly Restrictive 24-Hour Window**

Quality issues that occurred >24 hours ago are completely invisible, even if they're still active problems.

---

## Critical Gaps Identified

### Gap 1: No True "Criticality" Definition

**Current**: Shows ALL failed quality checks (high, medium, low)
**Problem**: Not everything that fails is "critical"

**What Makes an Alert CRITICAL?**
- 🔥 **Business Impact**: Affects revenue, compliance, or customer experience
- 🔥 **Blast Radius**: Many downstream systems/users affected
- 🔥 **Urgency**: Data degrading rapidly or SLA breach imminent
- 🔥 **Severity**: Data corruption, PII exposure, financial loss

**Examples**:
- ✅ CRITICAL: Customer credit card numbers exposed (PII leak)
- ✅ CRITICAL: Order totals don't match payments (financial integrity)
- ✅ CRITICAL: Inventory shows -100 units (operational impact)
- ❌ NOT CRITICAL: Empty "product_reviews" table (feature not launched)
- ❌ NOT CRITICAL: Missing "description" field (cosmetic)

### Gap 2: No Severity Scoring Algorithm

**Current**: Uses rule's pre-defined severity (static)
**Needed**: Dynamic severity calculation based on:

```
Alert Severity Score = (
  Rule_Base_Severity × 0.3 +
  Business_Impact × 0.25 +
  Affected_Rows_Percentage × 0.2 +
  Trend_Multiplier × 0.15 +
  Downstream_Dependencies × 0.1
)

Where:
- Rule_Base_Severity: critical=4, high=3, medium=2, low=1
- Business_Impact: Financial loss, compliance risk, SLA breach
- Affected_Rows_Percentage: % of table rows failing
- Trend_Multiplier: Getting worse (1.5x) or improving (0.5x)
- Downstream_Dependencies: # of dashboards/reports/services affected
```

### Gap 3: Missing Impact Calculations

**Current Impact** ([QualityController.ts:976-990](backend/data-service/src/controllers/QualityController.ts#L976-L990)):
```typescript
const estimatedRevenuePerRow = 50; // ❌ Arbitrary constant
const revenueImpact = rowsFailed * estimatedRevenuePerRow;

impact: {
  users: rowsFailed > 0 ? rowsFailed : undefined,
  revenue: revenueImpact > 0 ? `$${Math.round(revenueImpact / 1000)}K` : undefined,
  downstream: undefined // ❌ NOT IMPLEMENTED
}
```

**Problems**:
- $50/row is meaningless (should vary by table/column)
- Doesn't calculate actual business metrics
- No downstream dependency tracking
- No compliance risk scoring

**What We Should Calculate**:

| Impact Type | How to Calculate | Example |
|-------------|------------------|---------|
| **Financial** | `AVG(order.total_amount) × rows_affected` | "$125K orders at risk" |
| **Users** | `COUNT(DISTINCT user_id) FROM affected_rows` | "1,250 customers impacted" |
| **Downstream** | Query `lineage` table for dependent assets | "3 dashboards, 2 reports affected" |
| **Compliance** | Check if table/column has PII/PHI tags | "GDPR violation risk" |
| **Operational** | Calculate service degradation | "Inventory sync failing" |
| **Reputational** | Track customer-facing tables | "Public API returning errors" |

### Gap 4: No Alert Grouping/Deduplication

**Current**: Each failed quality result = 1 alert
**Problem**: Same underlying issue creates multiple alerts

**Example**:
```
Alert 1: "customers.email has 15 NULL values"
Alert 2: "customers.email has 18 NULL values" (1 hour later)
Alert 3: "customers.email has 22 NULL values" (2 hours later)
```

Should be: **1 alert** showing "NULL values trending up: 15→18→22"

### Gap 5: No Context About Why It's Critical

**Current Alert**:
```json
{
  "table": "customers",
  "issue": "High percentage of NULL values in email column (45%)",
  "severity": "high"
}
```

**Missing Context**:
- Why is `customers.email` critical? (Required for password resets, marketing)
- What's the acceptable threshold? (Should be <5%, currently 45%)
- When did this start? (Was 5% yesterday, spiked to 45% today)
- What's the business process affected? (User registration pipeline)
- Who owns this data? (Engineering team, notify @john.doe)

### Gap 6: No Intelligent Filtering

**What Users Need**:
1. **Show me ONLY actionable alerts** - Hide empty tables for unused features
2. **Prioritize by business impact** - Not just severity
3. **Group related issues** - "Payment processing pipeline degraded" (5 underlying issues)
4. **Show trends** - "Getting worse" vs "Stable" vs "Improving"
5. **Filter by ownership** - Show alerts for MY data domains only

**Current System**: Dumps all failed checks with no intelligence

---

## Enhancement Proposals

### 🎯 Enhancement 1: Smart Criticality Scoring

**Objective**: Only show TRULY critical alerts, not noise

**Implementation**:

```typescript
interface CriticalityFactors {
  // Base rule severity (1-4)
  baseSeverity: number;

  // Business impact (0-100)
  financialImpact: number;      // $ estimated loss
  userImpact: number;            // # users affected
  complianceRisk: number;        // PII/PHI/GDPR risk

  // Data degradation (0-100)
  affectedPercentage: number;    // % of rows failing
  trendDirection: 'up' | 'down' | 'stable';
  trendVelocity: number;         // How fast it's degrading

  // Operational impact (0-100)
  downstreamDependencies: number; // # of dependent assets
  slaBreachRisk: number;          // Risk of missing SLA

  // Contextual factors
  tableImportance: 'critical' | 'high' | 'medium' | 'low';
  businessHours: boolean;         // Is it business hours?
  onCallAvailable: boolean;       // Is someone on-call?
}

function calculateCriticalityScore(factors: CriticalityFactors): number {
  const weights = {
    baseSeverity: 0.20,
    financialImpact: 0.20,
    userImpact: 0.15,
    complianceRisk: 0.15,
    affectedPercentage: 0.10,
    trendVelocity: 0.10,
    downstreamDependencies: 0.05,
    slaBreachRisk: 0.05
  };

  let score = 0;
  score += (factors.baseSeverity / 4) * 100 * weights.baseSeverity;
  score += factors.financialImpact * weights.financialImpact;
  score += factors.userImpact * weights.userImpact;
  score += factors.complianceRisk * weights.complianceRisk;
  score += factors.affectedPercentage * weights.affectedPercentage;
  score += factors.trendVelocity * weights.trendVelocity;
  score += factors.downstreamDependencies * weights.downstreamDependencies;
  score += factors.slaBreachRisk * weights.slaBreachRisk;

  // Apply multipliers
  if (factors.trendDirection === 'up') score *= 1.3;
  if (factors.tableImportance === 'critical') score *= 1.5;
  if (factors.businessHours && !factors.onCallAvailable) score *= 1.2;

  return Math.min(score, 100); // Cap at 100
}

// Only show alerts with score >= 70
const criticalThreshold = 70;
```

**Benefit**: Reduces noise by 80%, shows only truly critical issues

---

### 🎯 Enhancement 2: Multi-Dimensional Alert Categorization

**Objective**: Categorize alerts by impact type, not just severity

**Categories**:

```typescript
enum AlertCategory {
  // Data Integrity
  DATA_CORRUPTION = 'data_corruption',           // Negative prices, invalid dates
  REFERENTIAL_INTEGRITY = 'referential_integrity', // Orphaned records
  CONSTRAINT_VIOLATION = 'constraint_violation',   // Unique key violations

  // Business Impact
  FINANCIAL_RISK = 'financial_risk',             // Order totals mismatch
  REVENUE_LOSS = 'revenue_loss',                  // Failed transactions
  COMPLIANCE_BREACH = 'compliance_breach',        // PII exposure

  // Operational
  PIPELINE_FAILURE = 'pipeline_failure',         // ETL jobs failing
  SLA_BREACH = 'sla_breach',                      // Data freshness violations
  DOWNSTREAM_IMPACT = 'downstream_impact',        // Breaking dependent systems

  // Quality Degradation
  COMPLETENESS_ISSUE = 'completeness_issue',     // NULL values increasing
  ACCURACY_DRIFT = 'accuracy_drift',              // Data quality declining
  CONSISTENCY_ISSUE = 'consistency_issue',        // Cross-table mismatches

  // Security
  PII_EXPOSURE = 'pii_exposure',                  // Unencrypted sensitive data
  ACCESS_ANOMALY = 'access_anomaly',              // Unusual data access patterns
}

interface CategorizedAlert extends Alert {
  category: AlertCategory;
  subcategory?: string;
  tags: string[];
}
```

**UI Enhancement**:
```
Critical Alerts (12)

[🔴 Financial Risk (3)]
  • Order totals mismatch: $45K at risk
  • Payment failures: 127 failed transactions
  • Refund processing errors: $12K pending

[⚠️ Data Corruption (2)]
  • Negative inventory: 15 products affected
  • Invalid product prices: 8 items with price ≤ $0

[🔒 Compliance Breach (1)]
  • Unencrypted PII: customer.ssn not encrypted (CRITICAL)
```

---

### 🎯 Enhancement 3: Intelligent Impact Calculation

**Objective**: Calculate REAL business impact, not arbitrary numbers

**Implementation**:

```typescript
interface BusinessImpactMetrics {
  financial: {
    estimatedLoss: number;
    calculation: string;
    confidence: number;
  };
  users: {
    affectedCount: number;
    affectedSegments: string[];
    calculation: string;
  };
  downstream: {
    affectedAssets: Array<{
      id: string;
      name: string;
      type: 'dashboard' | 'report' | 'api' | 'ml_model';
      criticality: number;
    }>;
    blastRadius: number;
  };
  compliance: {
    regulations: string[];
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    requiresNotification: boolean;
  };
  operational: {
    servicesAffected: string[];
    slaBreachRisk: number;
    recoveryTimeEstimate: string;
  };
}

async function calculateBusinessImpact(
  alert: Alert,
  context: DataContext
): Promise<BusinessImpactMetrics> {
  const impact: BusinessImpactMetrics = {
    financial: await calculateFinancialImpact(alert, context),
    users: await calculateUserImpact(alert, context),
    downstream: await calculateDownstreamImpact(alert, context),
    compliance: await calculateComplianceRisk(alert, context),
    operational: await calculateOperationalImpact(alert, context)
  };

  return impact;
}

// Example: Financial impact for "orders.total_amount mismatch"
async function calculateFinancialImpact(
  alert: Alert,
  context: DataContext
): Promise<FinancialImpact> {
  if (alert.table === 'orders' && alert.column === 'total_amount') {
    // Query actual order data
    const result = await db.query(`
      SELECT
        COUNT(*) as affected_orders,
        SUM(total_amount) as total_at_risk,
        AVG(total_amount) as avg_order_value
      FROM orders
      WHERE order_id IN (${alert.affectedRowIds})
    `);

    return {
      estimatedLoss: result.total_at_risk,
      calculation: `${result.affected_orders} orders × $${result.avg_order_value} avg`,
      confidence: 0.95
    };
  }

  // Fallback to heuristic
  return estimateFinancialImpactHeuristic(alert, context);
}

// Example: Downstream impact using lineage
async function calculateDownstreamImpact(
  alert: Alert,
  context: DataContext
): Promise<DownstreamImpact> {
  // Query lineage graph
  const dependents = await db.query(`
    SELECT
      target_asset_id,
      ca.name,
      ca.asset_type,
      ca.criticality
    FROM lineage_edges le
    JOIN catalog_assets ca ON ca.id = le.target_asset_id
    WHERE source_asset_id = $1
      AND lineage_type IN ('data_flow', 'dependency')
  `, [alert.assetId]);

  return {
    affectedAssets: dependents.map(d => ({
      id: d.target_asset_id,
      name: d.name,
      type: d.asset_type,
      criticality: d.criticality || 50
    })),
    blastRadius: dependents.length
  };
}
```

**Benefit**: Shows REAL impact instead of arbitrary "$50 per row"

---

### 🎯 Enhancement 4: Alert Grouping & Trending

**Objective**: Group related alerts, show trends over time

**Implementation**:

```typescript
interface AlertGroup {
  id: string;
  title: string;
  category: AlertCategory;
  alerts: Alert[];
  trend: {
    direction: 'improving' | 'stable' | 'degrading';
    changePercentage: number;
    sparkline: number[]; // Last 24 hours
  };
  firstSeen: Date;
  lastUpdated: Date;
  affectedAssets: string[];
  aggregatedImpact: BusinessImpactMetrics;
}

// Group alerts by root cause
function groupAlerts(alerts: Alert[]): AlertGroup[] {
  const groups: Map<string, AlertGroup> = new Map();

  for (const alert of alerts) {
    // Determine grouping key
    const groupKey = determineGroupKey(alert);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: groupKey,
        title: generateGroupTitle(alert),
        category: alert.category,
        alerts: [],
        trend: calculateTrend(alert),
        firstSeen: alert.timestamp,
        lastUpdated: alert.timestamp,
        affectedAssets: [],
        aggregatedImpact: {}
      });
    }

    const group = groups.get(groupKey)!;
    group.alerts.push(alert);
    group.affectedAssets.push(alert.table);
    group.lastUpdated = new Date();
  }

  // Calculate aggregated impact for each group
  for (const group of groups.values()) {
    group.aggregatedImpact = aggregateImpacts(group.alerts);
  }

  return Array.from(groups.values());
}

// Example grouping logic
function determineGroupKey(alert: Alert): string {
  // Group by table + dimension
  if (alert.dimension === 'completeness' && alert.column) {
    return `${alert.table}.${alert.column}.nulls`;
  }

  // Group by pipeline
  if (alert.tags.includes('etl')) {
    return `pipeline.${alert.tags.find(t => t.startsWith('pipeline:'))}`;
  }

  // Group by business process
  if (alert.table.startsWith('order')) {
    return 'business_process.order_management';
  }

  // Default: individual alert
  return alert.id;
}
```

**UI Example**:
```
🔴 Customer Email Quality Degrading ▼ (Grouped: 3 alerts)
   ├─ NULL emails: 15 → 22 → 31 (trending up ⬆)
   ├─ Invalid formats: 8 → 12 (trending up ⬆)
   └─ Duplicate emails: 4 (stable →)

   Impact: 45 customers, $2.3K revenue, 2 downstream dashboards
   First seen: 2 hours ago | Last updated: 5 minutes ago

   [Auto-Fix] [Investigate] [Snooze Group]
```

---

### 🎯 Enhancement 5: Context-Aware Alert Descriptions

**Objective**: Explain WHY this is critical, not just WHAT failed

**Implementation**:

```typescript
interface AlertContext {
  // What failed
  description: string;

  // Why it's critical
  businessContext: {
    reason: string;
    affectedProcesses: string[];
    ownedBy: string;
  };

  // Expected vs Actual
  threshold: {
    expected: string;
    actual: string;
    variance: string;
  };

  // Trend
  historical: {
    baseline: string;
    trend: string;
    changeDetection: string;
  };

  // Recommendations
  recommendations: {
    immediateActions: string[];
    rootCauseAnalysis: string[];
    preventiveMeasures: string[];
  };
}

// Example enhanced alert
const enhancedAlert: AlertWithContext = {
  id: "alert-123",
  severity: "critical",
  table: "customers",
  column: "email",
  issue: "High percentage of NULL values in email column",

  context: {
    description: "45% of customer records have NULL email addresses (3,127 out of 6,950 customers)",

    businessContext: {
      reason: "Email is required for password resets, order confirmations, and marketing campaigns",
      affectedProcesses: [
        "User registration pipeline",
        "Password reset flow",
        "Email marketing (MailChimp integration)"
      ],
      ownedBy: "Engineering Team (@john.doe)"
    },

    threshold: {
      expected: "< 5% NULL emails",
      actual: "45% NULL emails (3,127 records)",
      variance: "+40% above threshold"
    },

    historical: {
      baseline: "Baseline: 5% NULL emails (7-day average)",
      trend: "Spiked from 5% → 45% in last 6 hours",
      changeDetection: "⚠️ Anomaly detected at 2024-01-15 14:30 UTC"
    },

    recommendations: {
      immediateActions: [
        "1. Check user registration form - email field may not be required",
        "2. Review recent code deployments (last 6 hours)",
        "3. Disable email marketing campaign until resolved"
      ],
      rootCauseAnalysis: [
        "Query registration events in last 6 hours",
        "Check if form validation was removed in recent deploy",
        "Review API logs for errors in email field"
      ],
      preventiveMeasures: [
        "Add NOT NULL constraint to customers.email column",
        "Add application-level validation before DB insert",
        "Set up monitoring alert for >10% NULL emails"
      ]
    }
  }
};
```

**UI Display**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CRITICAL: Customer Email Quality Degraded
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 What's Wrong:
45% of customer records have NULL email addresses
(3,127 out of 6,950 customers)

❗ Why This Matters:
Email is required for password resets, order confirmations,
and marketing campaigns. This affects:
  • User registration pipeline
  • Password reset flow
  • Email marketing (MailChimp integration)

📈 Trend Analysis:
Baseline: 5% NULL emails (7-day average)
Current: 45% NULL emails
Change: Spiked from 5% → 45% in last 6 hours
⚠️ Anomaly detected at 2024-01-15 14:30 UTC

🎯 Immediate Actions:
1. Check user registration form - email field may not be required
2. Review recent code deployments (last 6 hours)
3. Disable email marketing campaign until resolved

🔍 Root Cause Analysis:
→ Query registration events in last 6 hours
→ Check if form validation was removed in recent deploy
→ Review API logs for errors in email field

🛡️ Prevent Future Issues:
→ Add NOT NULL constraint to customers.email column
→ Add application-level validation before DB insert
→ Set up monitoring alert for >10% NULL emails

👤 Owner: Engineering Team (@john.doe)
⏰ Detected: 6 hours ago | Updated: 2 minutes ago

[🔧 Auto-Fix] [🔍 Investigate] [😴 Snooze] [📞 Page On-Call]
```

---

### 🎯 Enhancement 6: Smart Filtering & Suppression

**Objective**: Hide non-actionable alerts automatically

**Implementation**:

```typescript
interface AlertSuppressionRule {
  id: string;
  name: string;
  condition: (alert: Alert) => boolean;
  reason: string;
  enabled: boolean;
}

const defaultSuppressionRules: AlertSuppressionRule[] = [
  {
    id: 'empty-unused-tables',
    name: 'Suppress empty table alerts for unused features',
    condition: (alert) => {
      // Suppress "table is empty" for tables with zero historical data
      if (alert.issue.includes('should contain at least one row')) {
        // Check if table has EVER had data
        const hasHistoricalData = checkHistoricalData(alert.table);
        return !hasHistoricalData;
      }
      return false;
    },
    reason: 'Table has never contained data (feature not launched)',
    enabled: true
  },

  {
    id: 'test-databases',
    name: 'Suppress alerts from test/dev databases',
    condition: (alert) => {
      const testDatabases = ['test_db', 'dev_db', 'sandbox'];
      return testDatabases.some(db => alert.database.toLowerCase().includes(db));
    },
    reason: 'Alert from test/dev environment',
    enabled: true
  },

  {
    id: 'low-impact-stable-issues',
    name: 'Suppress low-impact stable issues',
    condition: (alert) => {
      // Suppress if impact is minimal and hasn't changed in 7+ days
      const impact = alert.impact;
      const isLowImpact = (
        impact.financial < 100 &&
        impact.users < 10 &&
        impact.downstream.length === 0
      );

      const isStable = alert.trend.direction === 'stable';
      const isOld = alert.firstSeen < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      return isLowImpact && isStable && isOld;
    },
    reason: 'Low impact issue that has been stable for >7 days',
    enabled: true
  },

  {
    id: 'snoozed-alerts',
    name: 'Suppress snoozed alerts',
    condition: (alert) => {
      // Check if alert is snoozed
      const snooze = getSnoozeStatus(alert.id);
      return snooze && snooze.until > new Date();
    },
    reason: 'Alert snoozed until {snooze.until}',
    enabled: true
  },

  {
    id: 'duplicate-alerts',
    name: 'Deduplicate identical alerts',
    condition: (alert) => {
      // Check if this is a duplicate of a higher-priority alert
      return isDuplicate(alert);
    },
    reason: 'Duplicate of existing alert',
    enabled: true
  }
];

function applySuppressionRules(
  alerts: Alert[],
  rules: AlertSuppressionRule[]
): { visible: Alert[], suppressed: Alert[] } {
  const visible: Alert[] = [];
  const suppressed: Alert[] = [];

  for (const alert of alerts) {
    let isSuppressed = false;

    for (const rule of rules.filter(r => r.enabled)) {
      if (rule.condition(alert)) {
        alert.suppressedBy = rule.id;
        alert.suppressedReason = rule.reason;
        suppressed.push(alert);
        isSuppressed = true;
        break;
      }
    }

    if (!isSuppressed) {
      visible.push(alert);
    }
  }

  return { visible, suppressed };
}
```

**UI Enhancement**:
```
Critical Alerts (3)                    [Show Suppressed: 52 ▼]

🔴 Order totals mismatch: $45K at risk
🔴 Negative inventory: 15 products affected
🔴 Unencrypted PII: customer.ssn (CRITICAL)

─────────────────────────────────────────────

Suppressed Alerts (52)

📦 Empty Tables (48)
   • workflow_requests, user_notifications, quality_slas...
   Reason: Tables never contained data (features not launched)

🧪 Test Environment (3)
   • test_db.customers has NULL emails
   Reason: Alerts from test/dev databases

😴 Snoozed (1)
   • product_reviews empty table
   Reason: Snoozed until 2024-01-16 10:00 AM
```

---

### 🎯 Enhancement 7: Real-Time Trend Detection

**Objective**: Detect when quality is rapidly degrading

**Implementation**:

```typescript
interface TrendAnalysis {
  direction: 'improving' | 'stable' | 'degrading';
  velocity: number; // Rate of change
  prediction: {
    nextValue: number;
    confidence: number;
    timeToThreshold: string | null;
  };
  anomalyDetected: boolean;
  sparkline: number[]; // Last 24 data points
}

async function analyzeTrend(
  alert: Alert,
  historicalData: QualityResult[]
): Promise<TrendAnalysis> {
  // Get last 24 hours of data points
  const dataPoints = historicalData
    .filter(r => r.rule_id === alert.ruleId)
    .sort((a, b) => a.run_at.getTime() - b.run_at.getTime())
    .map(r => r.rows_failed || 0);

  if (dataPoints.length < 3) {
    return {
      direction: 'stable',
      velocity: 0,
      prediction: null,
      anomalyDetected: false,
      sparkline: dataPoints
    };
  }

  // Calculate trend
  const recentAvg = average(dataPoints.slice(-6)); // Last 6 points
  const baselineAvg = average(dataPoints.slice(0, 6)); // First 6 points
  const change = ((recentAvg - baselineAvg) / baselineAvg) * 100;

  let direction: 'improving' | 'stable' | 'degrading';
  if (change > 10) direction = 'degrading';
  else if (change < -10) direction = 'improving';
  else direction = 'stable';

  // Calculate velocity (rate of change)
  const velocity = calculateVelocity(dataPoints);

  // Predict next value using linear regression
  const prediction = predictNextValue(dataPoints);

  // Detect anomalies using statistical methods
  const anomalyDetected = detectAnomaly(dataPoints);

  return {
    direction,
    velocity,
    prediction,
    anomalyDetected,
    sparkline: dataPoints
  };
}

function detectAnomaly(dataPoints: number[]): boolean {
  // Use Z-score method
  const mean = average(dataPoints);
  const stdDev = standardDeviation(dataPoints);
  const latestValue = dataPoints[dataPoints.length - 1];
  const zScore = Math.abs((latestValue - mean) / stdDev);

  // Z-score > 3 indicates anomaly (99.7% confidence)
  return zScore > 3;
}

function predictNextValue(dataPoints: number[]): Prediction {
  // Simple linear regression
  const n = dataPoints.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = dataPoints;

  const slope = calculateSlope(x, y);
  const intercept = calculateIntercept(x, y, slope);

  const nextValue = slope * n + intercept;
  const confidence = calculateRSquared(x, y, slope, intercept);

  // Calculate time to threshold
  const threshold = 100; // Example threshold
  let timeToThreshold: string | null = null;

  if (nextValue < threshold && slope > 0) {
    const stepsToThreshold = (threshold - nextValue) / slope;
    const hoursToThreshold = stepsToThreshold; // Assuming 1 data point per hour
    timeToThreshold = `${Math.ceil(hoursToThreshold)} hours`;
  }

  return {
    nextValue: Math.max(0, nextValue),
    confidence,
    timeToThreshold
  };
}
```

**UI Display**:
```
🔴 Customer Email NULL Values

Current: 3,127 rows (45%)
Trend: ⬆ Degrading rapidly (+40% in 6 hours)

📊 Sparkline: ▂▂▂▂▂▃▅▇█ (last 24 hours)

🔮 Prediction:
Next hour: ~4,200 rows (60%)
Time to 100% NULL: 8 hours
Confidence: 87%

⚠️ ANOMALY DETECTED
Spike detected at 14:30 UTC (3σ above baseline)
```

---

### 🎯 Enhancement 8: Actionable Recommendations

**Objective**: Provide specific fix actions, not generic "investigate"

**Implementation**:

```typescript
interface ActionableRecommendation {
  type: 'auto_fix' | 'manual_fix' | 'investigation' | 'escalation';
  title: string;
  description: string;
  steps: string[];
  sqlQuery?: string;
  apiCall?: string;
  estimatedTime: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiredPermissions: string[];
}

function generateRecommendations(alert: Alert): ActionableRecommendation[] {
  const recommendations: ActionableRecommendation[] = [];

  // Example: NULL value recommendations
  if (alert.dimension === 'completeness' && alert.column) {
    recommendations.push({
      type: 'auto_fix',
      title: 'Set default values for NULL fields',
      description: `Automatically set NULL values to default for ${alert.column}`,
      steps: [
        '1. Identify default value (e.g., "no-reply@example.com" for emails)',
        '2. Update NULL records with default value',
        '3. Verify data integrity',
        '4. Re-run quality check'
      ],
      sqlQuery: `
        UPDATE ${alert.table}
        SET ${alert.column} = 'no-reply@example.com'
        WHERE ${alert.column} IS NULL;
      `,
      estimatedTime: '2 minutes',
      riskLevel: 'low',
      requiredPermissions: ['data_write']
    });

    recommendations.push({
      type: 'manual_fix',
      title: 'Add NOT NULL constraint',
      description: 'Prevent future NULL values by adding database constraint',
      steps: [
        '1. Set default values for existing NULL records',
        '2. Add NOT NULL constraint to column',
        '3. Update application code to require field',
        '4. Deploy and monitor'
      ],
      sqlQuery: `
        -- Step 1: Set defaults
        UPDATE ${alert.table}
        SET ${alert.column} = 'no-reply@example.com'
        WHERE ${alert.column} IS NULL;

        -- Step 2: Add constraint
        ALTER TABLE ${alert.table}
        ALTER COLUMN ${alert.column} SET NOT NULL;
      `,
      estimatedTime: '15 minutes',
      riskLevel: 'medium',
      requiredPermissions: ['schema_modify', 'data_write']
    });
  }

  // Example: Invalid value recommendations
  if (alert.issue.includes('negative') || alert.issue.includes('invalid')) {
    recommendations.push({
      type: 'investigation',
      title: 'Identify source of invalid data',
      description: 'Trace back to find where invalid data is being inserted',
      steps: [
        '1. Query recent inserts/updates',
        '2. Check application logs',
        '3. Review ETL pipeline',
        '4. Identify data source'
      ],
      sqlQuery: `
        SELECT
          *,
          created_at,
          updated_at
        FROM ${alert.table}
        WHERE ${alert.column} < 0
        ORDER BY created_at DESC
        LIMIT 100;
      `,
      estimatedTime: '30 minutes',
      riskLevel: 'low',
      requiredPermissions: ['data_read']
    });
  }

  return recommendations;
}
```

**UI Display**:
```
🔴 3,127 customers have NULL email addresses

Recommended Actions:

[🔧 Auto-Fix] Set Default Values (2 min, Low Risk)
   └─ Automatically set NULL emails to 'no-reply@example.com'
   └─ Requires: data_write permission
   └─ SQL: UPDATE customers SET email = ... WHERE email IS NULL

[🛠️ Manual Fix] Add NOT NULL Constraint (15 min, Medium Risk)
   └─ Prevent future NULL values with DB constraint
   └─ Requires: schema_modify, data_write
   └─ Steps: 1) Set defaults, 2) Add constraint, 3) Update app code

[🔍 Investigate] Find Data Source (30 min, Low Risk)
   └─ Trace where NULL emails are coming from
   └─ Check: Recent inserts, app logs, ETL pipeline
   └─ SQL: SELECT * FROM customers WHERE email IS NULL...
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal**: Fix immediate issues, establish baseline

**Tasks**:
1. ✅ **Implement Smart Suppression Rules**
   - Suppress empty table alerts for never-used tables
   - Add database tag filtering (test/dev/prod)
   - Create UI to show/hide suppressed alerts

2. ✅ **Add Basic Criticality Scoring**
   - Implement simple score formula (base severity + impact)
   - Set threshold (score >= 70 = critical)
   - Filter alerts by score

3. ✅ **Enhance Impact Calculations**
   - Calculate downstream dependencies from lineage table
   - Add real financial impact for key tables (orders, payments)
   - Show affected user count

**Expected Outcome**:
- Reduce cwic_platform alerts from 55 → ~5 (90% noise reduction)
- Show AdventureWorks real issues (negative prices, NULL emails, etc.)
- Display meaningful impact metrics

---

### Phase 2: Intelligence (Week 3-4)

**Goal**: Add trend detection and smart categorization

**Tasks**:
1. ✅ **Implement Trend Analysis**
   - Store historical quality results
   - Calculate trend direction and velocity
   - Detect anomalies using statistical methods
   - Show sparklines in UI

2. ✅ **Add Alert Categorization**
   - Categorize by impact type (financial, compliance, operational)
   - Group related alerts
   - Show category summaries in UI

3. ✅ **Create Alert Context Engine**
   - Add business context (why it matters)
   - Show expected vs actual thresholds
   - Generate trend narratives

**Expected Outcome**:
- Users see "Customer registration pipeline degrading" instead of 5 separate alerts
- Trend predictions: "Will reach 100% NULL in 8 hours"
- Clear context: "Email required for password resets"

---

### Phase 3: Automation (Week 5-6)

**Goal**: Actionable recommendations and auto-healing

**Tasks**:
1. ✅ **Build Recommendation Engine**
   - Generate specific fix actions per alert type
   - Provide SQL queries and steps
   - Show estimated time and risk level

2. ✅ **Implement Auto-Fix Logic**
   - NULL values → Set defaults
   - Empty tables → Insert seed data (if configured)
   - Invalid values → Flag for review

3. ✅ **Add Alert Routing**
   - Route alerts to data owners (from metadata)
   - Integrate with Slack/PagerDuty
   - Escalation rules (auto-page if critical + business hours)

**Expected Outcome**:
- 80% of alerts have actionable recommendations
- 30% of alerts can be auto-fixed
- Alerts automatically routed to correct team

---

### Phase 4: Advanced Features (Week 7-8)

**Goal**: ML-powered predictions and proactive alerts

**Tasks**:
1. ✅ **ML-Based Anomaly Detection**
   - Train models on historical quality data
   - Predict quality degradation before it happens
   - Proactive alerts: "Data quality will breach SLA in 2 hours"

2. ✅ **Root Cause Analysis**
   - Correlate quality issues with deployments
   - Track data lineage to find upstream causes
   - Show: "Issue started after deployment X at 14:30 UTC"

3. ✅ **Quality SLA Management**
   - Define SLAs per table/column
   - Track SLA compliance
   - Alert before SLA breach

**Expected Outcome**:
- Predict issues 2-4 hours before they become critical
- Automatic root cause identification (80% accuracy)
- Zero SLA breaches through proactive monitoring

---

## Database Schema Changes Required

### New Tables

```sql
-- Store alert criticality scores
CREATE TABLE alert_criticality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_results(id),
  score NUMERIC(5,2) NOT NULL, -- 0-100
  base_severity_score NUMERIC(5,2),
  financial_impact_score NUMERIC(5,2),
  user_impact_score NUMERIC(5,2),
  compliance_risk_score NUMERIC(5,2),
  trend_score NUMERIC(5,2),
  downstream_impact_score NUMERIC(5,2),
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(alert_id)
);

-- Store alert suppression rules
CREATE TABLE alert_suppression_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  condition_type VARCHAR(50) NOT NULL, -- 'empty_table', 'test_db', 'low_impact', etc.
  condition_params JSONB,
  enabled BOOLEAN DEFAULT true,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track suppressed alerts
CREATE TABLE alert_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_results(id),
  suppression_rule_id UUID NOT NULL REFERENCES alert_suppression_rules(id),
  suppressed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT,
  UNIQUE(alert_id, suppression_rule_id)
);

-- Store alert trends
CREATE TABLE alert_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES quality_rules(id),
  asset_id INT REFERENCES catalog_assets(id),
  trend_direction VARCHAR(20), -- 'improving', 'stable', 'degrading'
  velocity NUMERIC(10,2),
  predicted_next_value NUMERIC(10,2),
  prediction_confidence NUMERIC(5,2),
  anomaly_detected BOOLEAN DEFAULT false,
  sparkline_data JSONB, -- Array of last 24 data points
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Store alert groups
CREATE TABLE alert_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  category VARCHAR(100),
  group_key VARCHAR(255) UNIQUE NOT NULL,
  first_seen TIMESTAMP NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'resolved', 'snoozed'
  aggregated_impact JSONB
);

-- Link alerts to groups
CREATE TABLE alert_group_members (
  alert_group_id UUID NOT NULL REFERENCES alert_groups(id),
  alert_id UUID NOT NULL REFERENCES quality_results(id),
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (alert_group_id, alert_id)
);

-- Store alert snoozes
CREATE TABLE alert_snoozes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_results(id),
  snoozed_by VARCHAR(255),
  snooze_until TIMESTAMP NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Store business impact metadata per table
CREATE TABLE table_business_impact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id INT NOT NULL REFERENCES catalog_assets(id),
  table_name VARCHAR(255) NOT NULL,
  database_name VARCHAR(255),
  criticality VARCHAR(20), -- 'critical', 'high', 'medium', 'low'
  revenue_per_row NUMERIC(10,2), -- Estimated $ impact per row
  affected_processes JSONB, -- Array of business processes
  owner_team VARCHAR(255),
  owner_contact VARCHAR(255),
  compliance_tags JSONB, -- ['PII', 'PHI', 'GDPR', 'SOX']
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(asset_id)
);
```

---

## API Endpoints to Add/Modify

### Modified: GET /api/quality/critical-alerts

**Current**:
```typescript
GET /api/quality/critical-alerts?dataSourceId=X&database=Y&limit=10
```

**Enhanced**:
```typescript
GET /api/quality/critical-alerts?
  dataSourceId=X&
  database=Y&
  minCriticalityScore=70&      // NEW: Filter by score
  category=financial_risk&      // NEW: Filter by category
  showSuppressed=false&         // NEW: Show/hide suppressed
  groupBy=root_cause&           // NEW: Group related alerts
  includeHistory=true&          // NEW: Include trend data
  limit=10

Response:
{
  success: true,
  data: {
    alerts: [...],              // Main alerts
    groups: [...],              // Alert groups
    suppressedCount: 52,        // # of suppressed alerts
    trendAnalysis: {...}        // Aggregate trend data
  }
}
```

### New: GET /api/quality/alerts/suppressed

```typescript
GET /api/quality/alerts/suppressed?
  dataSourceId=X&
  database=Y&
  suppressionReason=empty_table

Response:
{
  success: true,
  data: [
    {
      alert: {...},
      suppressedBy: "empty-unused-tables",
      suppressedReason: "Table has never contained data",
      suppressedAt: "2024-01-15T10:00:00Z"
    }
  ]
}
```

### New: POST /api/quality/alerts/snooze

```typescript
POST /api/quality/alerts/snooze
Body: {
  alertId: "alert-123",
  duration: "1h" | "24h" | "7d",
  reason: "Waiting for deployment fix"
}

Response:
{
  success: true,
  data: {
    snoozeId: "snooze-456",
    snoozeUntil: "2024-01-15T15:00:00Z"
  }
}
```

### New: POST /api/quality/alerts/auto-fix

```typescript
POST /api/quality/alerts/auto-fix
Body: {
  alertId: "alert-123",
  fixType: "set_default_values",
  params: {
    defaultValue: "no-reply@example.com"
  }
}

Response:
{
  success: true,
  data: {
    rowsAffected: 3127,
    executionTime: "1.2s",
    newQualityScore: 95
  }
}
```

### New: GET /api/quality/alerts/recommendations

```typescript
GET /api/quality/alerts/{alertId}/recommendations

Response:
{
  success: true,
  data: {
    recommendations: [
      {
        type: "auto_fix",
        title: "Set default values",
        steps: [...],
        sqlQuery: "UPDATE ...",
        estimatedTime: "2 minutes",
        riskLevel: "low"
      }
    ]
  }
}
```

---

## Summary & Next Steps

### Current Problems

1. ❌ **Too much noise**: 55 alerts for cwic_platform (mostly empty unused tables)
2. ❌ **Missing real issues**: AdventureWorks bad data not showing up
3. ❌ **No context**: Alerts don't explain WHY they're critical
4. ❌ **No intelligence**: No trend detection, grouping, or impact analysis
5. ❌ **Not actionable**: Generic "investigate" instead of specific fixes

### Proposed Solution

✅ **Smart Criticality Scoring**: Only show truly critical alerts (score >= 70)
✅ **Intelligent Suppression**: Auto-hide noise (empty unused tables, test DBs)
✅ **Real Impact Calculation**: Show actual financial/user/downstream impact
✅ **Trend Detection**: Predict quality degradation before it's critical
✅ **Alert Grouping**: Show "Customer pipeline degraded" instead of 5 alerts
✅ **Actionable Recommendations**: Specific fix steps with SQL queries
✅ **Context-Aware Descriptions**: Explain business impact and root cause
✅ **Auto-Healing**: Fix simple issues automatically (NULL values, etc.)

### Recommended First Steps

**Immediate (This Week)**:
1. Implement suppression rules for empty unused tables
2. Add basic criticality scoring (filter out score < 70)
3. Calculate real downstream impact from lineage table

**This would reduce cwic_platform alerts from 55 → ~5 immediately** ✅

**Next Week**:
1. Add trend analysis and sparklines
2. Implement alert grouping
3. Create recommendation engine

**Would you like me to start implementing Phase 1 enhancements?**

I can begin with:
- Smart suppression rules
- Basic criticality scoring
- Enhanced impact calculations

This would immediately improve the Critical Alerts feature and make it much more useful!
