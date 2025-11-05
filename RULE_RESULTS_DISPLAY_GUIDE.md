# Rule Execution Results - Display Guide

## Overview

When you execute quality rules, the results are displayed in **multiple locations** depending on the action taken. Here's a complete guide showing where and how results appear.

---

## 📍 Result Display Locations

### 1. **Scan Results Card** (Rules Tab)
**Location**: Rules tab → Bottom of page (appears after bulk execution)

**When Displayed**: After running multiple rules using "Run Selected" button

**File**: [DataQuality.tsx:1732-1762](frontend/src/pages/DataQuality.tsx#L1732-L1762)

**What It Shows**:
```
┌─────────────────────────────────────────────┐
│ Scan Results                                │
├─────────────────────────────────────────────┤
│                                             │
│  Executed        Passed         Failed      Duration │
│     5              3              2         847ms    │
│                                             │
│  ████████████████░░░░░░░░ 60%              │
│  (Progress bar showing pass rate)           │
└─────────────────────────────────────────────┘
```

**Details Displayed**:
- **Executed**: Total number of rules run
- **Passed**: Rules that found no issues (green)
- **Failed**: Rules that found violations (red)
- **Duration**: Execution time in milliseconds
- **Progress Bar**: Visual pass rate (passed/total)

**Code**:
```typescript
{scanResult && (
  <Card>
    <CardHeader>
      <CardTitle>Scan Results</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-600">Executed</p>
          <p className="text-lg font-bold">{scanResult.executedRules}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Passed</p>
          <p className="text-lg font-bold text-green-600">{scanResult.passed}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Failed</p>
          <p className="text-lg font-bold text-red-600">{scanResult.failed}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Duration</p>
          <p className="text-lg font-bold">{scanResult.duration}ms</p>
        </div>
      </div>
      <Progress
        value={(scanResult.passed / scanResult.executedRules) * 100}
        className="h-3"
      />
    </CardContent>
  </Card>
)}
```

---

### 2. **Violations Tab** (Main Results View)
**Location**: Data Quality → Violations Tab

**When Displayed**: Always available - shows all quality issues found by rules

**File**: [DataQuality.tsx:1770-1973](frontend/src/pages/DataQuality.tsx#L1770-L1973)

**What It Shows**:

#### A. Summary Cards (Top Row)
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Open Issues │  │  Critical   │  │ Affected    │  │  Resolved   │
│     15      │  │      5      │  │   Rows      │  │      8      │
│             │  │             │  │  12,450     │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

**Metrics**:
- **Open Issues**: Current unresolved violations (red)
- **Critical**: High-severity issues (amber)
- **Affected Rows**: Total rows with quality issues (blue)
- **Resolved**: Fixed issues (green)

#### B. Issues List (Detailed View)
```
┌──────────────────────────────────────────────────────────────────┐
│ Quality Issues                                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [critical] [completeness] [open] customer_orders               │
│  Null Values Detected in Required Column                        │
│  Found 245 null values in the "email" column which is          │
│  marked as required.                                            │
│  First seen: 1/15/2025  Occurrences: 245  Affected: 245        │
│  [Acknowledge] [Resolve]                                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ 🧠 AI Root Cause Analysis:                           │     │
│  │ Missing email validation in signup form. Users can   │     │
│  │ skip the email field. Add client-side and server-    │     │
│  │ side validation.                                      │     │
│  │                                                       │     │
│  │ Suggested Fix:                                        │     │
│  │ 1. Add required attribute to email input            │     │
│  │ 2. Add backend validation in API                     │     │
│  │ 3. Run data cleanup: UPDATE...                       │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [high] [accuracy] [open] 🛡️ PII: EMAIL  user_profiles        │
│  PII Detected: email                                            │
│  This column contains sensitive personal data (email            │
│  addresses) and requires protection.                            │
│                                                                  │
│  📋 FIX PROPOSAL                                                │
│  -- Mask email column                                           │
│  ALTER TABLE user_profiles                                      │
│  ADD COLUMN email_masked VARCHAR(255);                          │
│                                                                  │
│  First seen: 1/10/2025  Occurrences: 1  Affected: 15,234       │
│  [Acknowledge] [Resolve]                                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Issue Details**:
- **Badges**: Severity, Dimension, Status, PII indicator
- **Table Name**: Where issue was found
- **Title**: Issue summary
- **Description**: Detailed explanation
- **Metadata**: First seen date, occurrence count, affected rows
- **Action Buttons**:
  - `Acknowledge` - Mark as acknowledged
  - `Resolve` - Mark as resolved
- **AI Analysis**: (if available)
  - Root cause analysis
  - Suggested remediation plan
- **Fix Proposals**: (for PII issues)
  - Auto-generated SQL scripts
  - Step-by-step instructions

**Special Features**:

1. **PII Issues**: Display purple badge with shield icon
2. **Validation Failures**: Amber box with reopened warning
3. **Fix Proposals**: Blue box with SQL code
4. **AI Insights**: Blue alert box with brain icon

---

### 3. **Individual Rule Results** (Rules Tab)
**Location**: Rules tab → Individual rule row

**When Displayed**: After executing a single rule using the Play button

**What Updates**:
```
┌──────────────────────────────────────────────────────────────────┐
│ [✓] [●] Check Email Validity                    [►] [✎] [On] [×]│
│     Validates email format in customer table                     │
│     Dimension: accuracy | Severity: [high]                       │
│     Last run: 1/28/2025 | Pass rate: 87%  ← UPDATED             │
└──────────────────────────────────────────────────────────────────┘
```

**Updated Fields**:
- **Last Run**: Timestamp of execution
- **Pass Rate**: Percentage of records passing the check
- **Execution Status**: Loading spinner during execution

---

### 4. **Toast Notifications** (Immediate Feedback)
**Location**: Top-right corner of screen

**When Displayed**: After any rule action

**Examples**:
```
┌─────────────────────────────────────────────┐
│ ✓ Rule executed successfully!               │
│   Found 12 violations - see Violations tab  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ✓ Scan completed!                           │
│   5 rules executed, 2 failed                │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ⓘ No issues found                           │
│   Your data quality is excellent!           │
└─────────────────────────────────────────────┘
```

**Types**:
- **Success** (green): Rule executed, scan completed
- **Error** (red): Execution failed
- **Info** (blue): No issues found

---

### 5. **Overview Tab** (Quality Summary)
**Location**: Data Quality → Overview Tab

**When Displayed**: Shows aggregate statistics from all executed rules

**What It Shows**:
```
┌─────────────────────────────────────────────────────────┐
│ Quality Metrics                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Overall Score: 78% 🔄 +5%                             │
│  ████████████████████░░░░░░░░░░░ 78%                   │
│                                                         │
│  Open Issues: 15    Critical: 5    Resolved: 8        │
│                                                         │
│  Dimension Scores:                                      │
│  • Completeness: 85% ████████████████░░                │
│  • Accuracy: 72% ██████████████░░░░░░                  │
│  • Consistency: 90% ████████████████████                │
│  • Validity: 68% ████████████░░░░░░░░                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 6. **Profiling Tab** (Asset-Level Results)
**Location**: Data Quality → Profiling Tab → Asset Details

**When Displayed**: Shows quality issues for specific tables/columns

**What It Shows**:
```
┌──────────────────────────────────────────────────────────┐
│ customer_orders                                          │
├──────────────────────────────────────────────────────────┤
│ Quality Score: 72% | ⚠️ 5 Issues | 📊 15,234 Rows      │
│                                                          │
│ Columns:                                                 │
│  ✓ order_id      INT      ● Primary Key                │
│  ⚠️ email         VARCHAR  ● 245 Nulls                  │
│  ⚠️ order_date    DATE     ● 12 Future Dates            │
│  ✓ amount        DECIMAL  ● Valid                      │
│                                                          │
│ [View Issues] ← Links to Violations tab with filters    │
└──────────────────────────────────────────────────────────┘
```

**Features**:
- Issue count badges
- Column-level warnings
- "View Issues" button (navigates to Violations tab with filters)

---

## 🔄 Complete Execution Flow

### Scenario 1: Bulk Rule Execution

```
USER ACTION: Select rules → Click "Run Selected"
     ↓
RULES TAB: Shows loading spinner "Scanning..."
     ↓
BACKEND: Executes all selected rules
     ↓
RULES TAB: Displays "Scan Results" card
     ↓
     • Executed: 5
     • Passed: 3 (green)
     • Failed: 2 (red)
     • Duration: 847ms
     • Progress bar: 60%
     ↓
TOAST: "✓ Scan completed! 5 rules executed, 2 failed"
     ↓
VIOLATIONS TAB: Auto-refreshes with new issues
     ↓
     • Summary cards update
     • New issues appear in list
     • Affected rows count increases
     ↓
OVERVIEW TAB: Metrics refresh
     ↓
     • Overall score updates
     • Dimension scores recalculate
     • Issue counts update
```

### Scenario 2: Single Rule Execution

```
USER ACTION: Click Play button on specific rule
     ↓
RULES TAB: Shows spinner on that rule's Play button
     ↓
BACKEND: Executes single rule
     ↓
RULES TAB: Rule row updates
     ↓
     • Last run: 1/28/2025 (updated)
     • Pass rate: 87% (updated)
     • Spinner stops
     ↓
TOAST: "✓ Rule executed successfully! Found 12 violations"
     ↓
VIOLATIONS TAB: New issues from this rule appear
     ↓
USER: Clicks "Violations" tab to see details
```

### Scenario 3: Viewing Issue Details

```
USER ACTION: Navigate to Violations tab
     ↓
SUMMARY CARDS: Show aggregate counts
     ↓
     • Open Issues: 15
     • Critical: 5
     • Affected Rows: 12,450
     • Resolved: 8
     ↓
ISSUES LIST: Displays all violations
     ↓
FOR EACH ISSUE:
     • Severity badge
     • PII indicator (if applicable)
     • Table name
     • Description
     • Metadata (first seen, occurrences, affected rows)
     • Action buttons (Acknowledge, Resolve)
     • AI analysis (if available)
     • Fix proposals (if applicable)
     ↓
USER: Can acknowledge or resolve issues
     ↓
STATE UPDATES: Counts refresh immediately
```

---

## 🎯 Quick Reference

| Action | Immediate Feedback | Detailed Results | Summary View |
|--------|-------------------|------------------|--------------|
| **Run Selected Rules** | Toast notification | Scan Results card (Rules tab) | Violations tab |
| **Run Single Rule** | Toast + spinner | Rule row updates | Violations tab |
| **View All Issues** | - | Violations tab (full list) | Summary cards |
| **Check Overall Health** | - | Overview tab | Metric cards |
| **Asset-Level Issues** | - | Profiling tab | Column details |

---

## 📊 Data States

### Loading States
```typescript
const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({
  rules: false,           // Loading rules list
  issues: false,          // Loading violations
  trends: false,          // Loading trends
  aiGeneration: false,    // Generating AI rule
  'rule-{id}': false,     // Executing specific rule
  // ... per-rule loading states
});
```

### Result States
```typescript
const [scanResult, setScanResult] = useState<ScanResult | null>(null);
const [issues, setIssues] = useState<QualityIssue[]>([]);
const [rules, setRules] = useState<QualityRule[]>([]);
```

---

## 💡 Key Features

1. **Multi-Level Display**: Results shown in Rules, Violations, Overview, and Profiling tabs
2. **Real-time Updates**: All tabs refresh automatically after rule execution
3. **Toast Notifications**: Immediate feedback for all actions
4. **Detailed Violations**: Each issue shows full context, metadata, and actions
5. **AI Analysis**: Root cause and remediation suggestions for complex issues
6. **PII Indicators**: Special badges and fix proposals for sensitive data
7. **Action Tracking**: Acknowledge and resolve workflows
8. **Summary Metrics**: Aggregate views in Overview tab
9. **Drill-down**: Navigate from summary to details seamlessly
10. **Empty States**: Helpful messages when no issues found

---

## 🎨 Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| Green checkmark | Rule passed / No issues |
| Red X | Rule failed / Issues found |
| Amber warning | Critical issue |
| Purple shield | PII detected |
| Blue brain | AI analysis available |
| Green dot | Rule enabled |
| Gray dot | Rule disabled |
| Spinner | Execution in progress |

---

## 🔗 Navigation Flows

### From Rules Tab to Violations
```
Rules Tab → Run rules → See scan results
    ↓
Click "Violations" tab
    ↓
View detailed issue list with actions
```

### From Profiling Tab to Violations
```
Profiling Tab → Expand table → See column issues
    ↓
Click "View Issues" button
    ↓
Violations tab opens with filtered view for that table
```

### From Overview Tab to Details
```
Overview Tab → See "15 Open Issues"
    ↓
Click on issue card or "View Details"
    ↓
Violations tab shows all open issues
```

---

## 📝 Summary

**Results are displayed in 6 key locations:**

1. **Scan Results Card** - Immediate summary after bulk execution (Rules tab)
2. **Violations Tab** - Complete list of all issues with details and actions
3. **Individual Rule Updates** - Last run time and pass rate (Rules tab)
4. **Toast Notifications** - Instant feedback for all actions
5. **Overview Tab** - Aggregate quality metrics and scores
6. **Profiling Tab** - Asset-level issue indicators

**Best Practice**:
- Execute rules in **Rules tab**
- View results in **Violations tab**
- Monitor trends in **Overview tab**
- Navigate seamlessly between all views for complete quality management

All tabs are interconnected and update in real-time! 🚀
