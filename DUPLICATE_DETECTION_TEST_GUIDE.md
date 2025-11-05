# Duplicate Detection Testing Guide

## Overview

This guide demonstrates how to test the **complete end-to-end flow** for quality rule execution, from creating a rule to viewing results and fix suggestions.

---

## ✅ Setup Complete

A test rule has been created in the database:

**Rule Details**:
- **ID**: `38510142-db5a-45f0-b472-ea6c2c0f6f45`
- **Name**: TEST: Duplicate Detection - Role.Name
- **Description**: Detects duplicate values in the Name column
- **Target**: Azure Feya → Feya_DB → dbo.Role → Name column
- **Severity**: High
- **Dimension**: Uniqueness
- **Status**: Enabled

**SQL Expression**:
```sql
SELECT Name as dup, COUNT(*) as cnt
FROM dbo.Role
GROUP BY Name
HAVING COUNT(*) > 1
```

---

## 🧪 Manual Testing Steps

### Step 1: View the Rule in UI

1. Open browser: http://localhost:3000
2. Navigate to **Data Quality** page
3. Click **Rules** tab
4. **Expected**: You should see "TEST: Duplicate Detection - Role.Name" in the rules list

**What to Check**:
- ✅ Rule name appears correctly
- ✅ Green dot (enabled status)
- ✅ High severity badge
- ✅ Dimension shows "uniqueness"
- ✅ Action buttons visible (Play, Edit, Enable, Delete)

**Screenshot Reference**:
```
┌──────────────────────────────────────────────────────────────┐
│ [√] [●] TEST: Duplicate Detection - Role.Name  [▶] [✎] [×] │
│     Detects duplicate values in the Name column              │
│     Dimension: uniqueness | Severity: [high]                 │
└──────────────────────────────────────────────────────────────┘
```

---

### Step 2: Execute the Rule

**Method A: Individual Execution**
1. In Rules tab, find "TEST: Duplicate Detection - Role.Name"
2. Click the **Play button (▶)** on the right side
3. **Expected**:
   - Button shows loading spinner
   - Toast notification appears: "✓ Rule executed successfully!"
   - Rule row updates with "Last run" timestamp

**Method B: Bulk Execution**
1. Check the checkbox next to the rule
2. Click **"Run Selected"** button at the top
3. **Expected**:
   - Loading state shows "Scanning..."
   - Scan Results card appears at bottom showing:
     - Executed: 1
     - Passed: 0 or 1 (depending on if duplicates exist)
     - Failed: 1 or 0
     - Duration: ~XXXms

---

### Step 3: View Results in Violations Tab

1. Click **Violations** tab (next to Rules)
2. **Expected - If Duplicates Exist**:

**Summary Cards** (Top Row):
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Open Issues │  │  Critical   │  │ Affected    │  │  Resolved   │
│     +1      │  │      +1     │  │   Rows      │  │      0      │
│             │  │             │  │     X       │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

**Issue Details** (Below cards):
```
┌──────────────────────────────────────────────────────────────┐
│ [high] [uniqueness] [open] dbo.Role                          │
│ Duplicate Values Detected in Column                          │
│                                                              │
│ Found duplicate values in the 'Name' column of table        │
│ dbo.Role. This violates uniqueness constraints.             │
│                                                              │
│ First seen: 10/28/2025  Occurrences: X  Affected: X rows   │
│                                                              │
│ [Acknowledge] [Resolve]                                      │
│                                                              │
│ ┌────────────────────────────────────────────────────┐     │
│ │ 🧠 AI Root Cause Analysis:                         │     │
│ │ Multiple records share the same Name value. This   │     │
│ │ may indicate data entry errors, lack of validation,│     │
│ │ or missing unique constraints.                     │     │
│ │                                                    │     │
│ │ Suggested Fix:                                     │     │
│ │ 1. Review duplicate records                       │     │
│ │ 2. Add UNIQUE constraint to Name column           │     │
│ │ 3. Update application validation                  │     │
│ └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

3. **Expected - If No Duplicates**:
```
┌──────────────────────────────────────────────────────────┐
│              ✅                                          │
│         No quality issues detected                       │
│       Your data quality is excellent!                    │
└──────────────────────────────────────────────────────────┘
```

---

### Step 4: Check Fix Suggestions

If duplicates were found, the issue detail should include:

**1. Problem Description**:
- Clear explanation of what was detected
- Table and column information
- Number of affected rows

**2. Root Cause** (AI-Generated):
- Why this might have happened
- Potential sources of the issue

**3. Suggested Fix** (AI-Generated):
- Step-by-step remediation plan
- SQL scripts if applicable
- Best practices to prevent recurrence

**Example Fix Suggestions**:
```sql
-- Step 1: Identify duplicate records
SELECT Name, COUNT(*) as DuplicateCount
FROM [Feya_DB].dbo.Role
GROUP BY Name
HAVING COUNT(*) > 1;

-- Step 2: Review specific duplicates
SELECT *
FROM [Feya_DB].dbo.Role
WHERE Name IN (
  SELECT Name
  FROM [Feya_DB].dbo.Role
  GROUP BY Name
  HAVING COUNT(*) > 1
);

-- Step 3: Create backup
SELECT * INTO dbo.Role_Backup_20251028
FROM dbo.Role;

-- Step 4: Remove duplicates (keep first occurrence)
WITH CTE AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY Name ORDER BY Id) as rn
  FROM dbo.Role
)
DELETE FROM CTE WHERE rn > 1;

-- Step 5: Add unique constraint
ALTER TABLE dbo.Role
ADD CONSTRAINT UQ_Role_Name UNIQUE (Name);
```

---

### Step 5: Verify in Overview Tab

1. Click **Overview** tab
2. **Expected Changes**:
   - Overall quality score may decrease (if duplicates found)
   - Uniqueness dimension score should reflect the issue
   - Open issues count should increase
   - Summary cards should update

**Example**:
```
┌─────────────────────────────────────────────────────────┐
│ Quality Metrics                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Overall Score: 85% 🔄 -3%                             │
│  ████████████████████░░░░░░░░░░░ 85%                   │
│                                                         │
│  Open Issues: 1    Critical: 1    Resolved: 0         │
│                                                         │
│  Dimension Scores:                                      │
│  • Completeness: 95% ████████████████████                │
│  • Accuracy: 88% ████████████████░░                      │
│  • Consistency: 90% ████████████████████                 │
│  • Validity: 82% ████████████████░░░                     │
│  • Uniqueness: 75% ███████████████░░░░░  ← DECREASED    │
│  • Freshness: 92% ████████████████████                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Step 6: Test Profiling Tab Navigation

1. Go to **Profiling** tab
2. Find and expand the **Role** table
3. **Expected**:
   - Table shows quality score (may be lower if duplicates found)
   - Issue count badge appears
   - Name column shows warning indicator (⚠️)
   - Column details show: "X duplicates found"

4. Click **"View Issues"** button
5. **Expected**:
   - Navigates to Violations tab
   - Filters applied for Role table
   - Shows issues specific to Role table

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RULES TAB                                                │
│    - View "TEST: Duplicate Detection - Role.Name"          │
│    - Click Play button (▶)                                  │
│    - See loading spinner                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. EXECUTION                                                │
│    - Backend connects to Azure Feya database                │
│    - Runs SQL: SELECT Name, COUNT(*) FROM Role GROUP BY... │
│    - Detects duplicates (if any)                            │
│    - Creates quality_issues records                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TOAST NOTIFICATION                                       │
│    ✓ Rule executed successfully!                           │
│    Found X violations - see Violations tab                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. RULES TAB UPDATE                                         │
│    - Last run: 10/28/2025 12:39 PM (updated)              │
│    - Pass rate: 75% (updated)                              │
│    - Scan Results card appears (if bulk execution)          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. VIOLATIONS TAB                                           │
│    - Summary cards show increased counts                    │
│    - New issue appears in list:                             │
│      • Title: "Duplicate Values Detected"                   │
│      • Severity: High                                       │
│      • Status: Open                                         │
│      • Affected Rows: X                                     │
│      • AI Analysis with root cause                          │
│      • Fix suggestions with SQL                             │
│    - Action buttons: [Acknowledge] [Resolve]                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. OVERVIEW TAB                                             │
│    - Overall score decreases                                │
│    - Uniqueness dimension score drops                       │
│    - Open issues counter increases                          │
│    - Metrics refresh automatically                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. PROFILING TAB                                            │
│    - Role table shows issue indicator                       │
│    - Name column has warning badge                          │
│    - "View Issues" button available                         │
│    - Clicking navigates to filtered Violations view         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 What to Test

### Functional Tests

1. **Rule Visibility** ✓
   - [ ] Rule appears in Rules tab
   - [ ] Correct name and description
   - [ ] Proper badges (severity, dimension)
   - [ ] Enable/disable toggle works

2. **Rule Execution** ✓
   - [ ] Play button executes single rule
   - [ ] "Run Selected" executes checked rules
   - [ ] Loading states appear correctly
   - [ ] Execution completes within reasonable time

3. **Results Display** ✓
   - [ ] Scan Results card shows after bulk execution
   - [ ] Toast notifications appear
   - [ ] Rule row updates (last run, pass rate)
   - [ ] Violations tab shows new issues

4. **Issue Details** ✓
   - [ ] Issue title and description clear
   - [ ] Severity and dimension correct
   - [ ] Affected rows count accurate
   - [ ] Table and column names correct

5. **AI Analysis** ✓
   - [ ] Root cause analysis present
   - [ ] Suggested fix includes SQL
   - [ ] Remediation steps are actionable

6. **Navigation** ✓
   - [ ] "View Issues" from Profiling works
   - [ ] Filters apply correctly
   - [ ] Navigation preserves context

7. **Actions** ✓
   - [ ] Acknowledge button works
   - [ ] Resolve button works
   - [ ] Status updates immediately
   - [ ] Counts refresh after action

### UI/UX Tests

1. **Visual Feedback** ✓
   - [ ] Loading spinners during execution
   - [ ] Toast notifications auto-dismiss
   - [ ] Badge colors appropriate for severity
   - [ ] Icons meaningful and consistent

2. **Responsiveness** ✓
   - [ ] No lag during rule execution
   - [ ] Tabs switch smoothly
   - [ ] Data loads progressively

3. **Error Handling** ✓
   - [ ] Connection errors show user-friendly messages
   - [ ] Validation errors prevent bad inputs
   - [ ] Execution failures display clearly

---

## 📸 Expected Screenshots

### Before Execution
- Rules tab with rule listed, no recent execution
- Violations tab shows 0 or fewer issues
- Overview tab shows baseline quality score

### During Execution
- Loading spinner on Play button
- Toast notification: "Executing rule..."
- Disabled state on action buttons

### After Execution (Duplicates Found)
- Scan Results card with stats
- Toast: "✓ Rule executed! Found X violations"
- Violations tab shows new issue
- Issue includes AI analysis and fix SQL
- Overview tab shows decreased uniqueness score

### After Execution (No Duplicates)
- Toast: "✓ No issues found!"
- Violations tab unchanged or shows "No issues"
- Overview tab maintains or improves score

---

## 🔍 Verification Checklist

- [ ] Rule created successfully (visible in Rules tab)
- [ ] Rule can be executed (Play button works)
- [ ] Execution completes within 5 seconds
- [ ] Results appear in Violations tab
- [ ] Issue details include:
  - [ ] Table name (dbo.Role)
  - [ ] Column name (Name)
  - [ ] Severity (High)
  - [ ] Dimension (Uniqueness)
  - [ ] Affected row count
  - [ ] First seen timestamp
- [ ] AI analysis present:
  - [ ] Root cause description
  - [ ] Suggested fix with SQL
- [ ] Action buttons functional:
  - [ ] Acknowledge changes status
  - [ ] Resolve marks as resolved
- [ ] Overview tab reflects changes:
  - [ ] Issue count updated
  - [ ] Uniqueness score adjusted
  - [ ] Overall score recalculated
- [ ] Profiling tab shows indicator:
  - [ ] Warning badge on Name column
  - [ ] "View Issues" button works
- [ ] Navigation preserves filters:
  - [ ] Data source (Azure Feya)
  - [ ] Database (Feya_DB)
  - [ ] Table (Role)

---

## 🎓 Learning Outcomes

After completing this test, you will have verified:

1. ✅ **Rule Creation**: Rules can be created for specific tables/columns
2. ✅ **Rule Execution**: Rules run against live databases
3. ✅ **Result Display**: Issues appear in multiple tabs with full context
4. ✅ **AI Integration**: Root cause analysis and fix suggestions are generated
5. ✅ **Action Workflow**: Issues can be acknowledged and resolved
6. ✅ **Metric Updates**: Quality scores reflect detected issues
7. ✅ **Navigation**: Seamless navigation between tabs with context preservation

---

## 🚀 Next Steps

1. **Test in browser**: Follow the manual steps above
2. **Verify all checkboxes**: Ensure each feature works as expected
3. **Test different scenarios**:
   - Execute when duplicates exist
   - Execute when no duplicates
   - Acknowledge an issue
   - Resolve an issue
   - Check metric updates
4. **Document any issues**: Note any discrepancies or bugs
5. **Test other rule types**: Try different quality dimensions

---

## 📊 Expected Data

The rule checks the **Role** table in **Azure Feya → Feya_DB** database.

**If duplicates exist**, you'll see results like:
```
Name: "Administrator" - Count: 2
Name: "User" - Count: 3
```

**If no duplicates**, the Violations tab will show:
```
✅ No quality issues detected
Your data quality is excellent!
```

---

## 🔗 Quick Links

- **Rules Tab**: http://localhost:3000/quality?tab=rules
- **Violations Tab**: http://localhost:3000/quality?tab=violations
- **Overview Tab**: http://localhost:3000/quality?tab=overview
- **Profiling Tab**: http://localhost:3000/quality?tab=profiling

---

## ✅ Status

**Rule Created**: ✅ Yes
**Rule ID**: `38510142-db5a-45f0-b472-ea6c2c0f6f45`
**Ready for Testing**: ✅ Yes
**Next Step**: Open browser and test manually following steps above

**Happy Testing!** 🎉
