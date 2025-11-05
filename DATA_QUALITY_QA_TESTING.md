# Data Quality - Comprehensive QA Testing Plan

## Test Environment
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3000/api
- **Database**: PostgreSQL (adventureworks)
- **Date**: 2025-10-20

---

## 🎯 QA Test Cases

### 1. FILTER FUNCTIONALITY TESTS

#### Test 1.1: Server Selection Filter
**Steps**:
1. Navigate to Data Quality page
2. Check initial state of "All Servers" dropdown
3. Select "postgres (postgresql)" from dropdown
4. Verify database dropdown appears and is enabled

**Expected**:
- ✅ "All Servers (2)" shows count
- ✅ Selecting server enables database dropdown
- ✅ Database dropdown shows "All Databases (X)"
- ✅ Type dropdown remains visible and enabled

**Status**: ⏳ PENDING

---

#### Test 1.2: Database Selection Filter
**Steps**:
1. Select a server first
2. Observe database dropdown
3. Select "adventureworks" database
4. Verify profiling tab updates

**Expected**:
- ✅ Database dropdown only enabled when server selected
- ✅ Shows correct database count
- ✅ Selecting database filters profiling data
- ✅ Profiling tab shows only tables from selected database

**Status**: ⏳ PENDING

---

#### Test 1.3: Type Filter
**Steps**:
1. Select "All Types (88)" dropdown
2. Change to "Tables"
3. Verify filtering works
4. Change to "Views"
5. Verify filtering works

**Expected**:
- ✅ Filter shows correct count
- ✅ Profiling tab filters by type
- ✅ Overview stats update accordingly

**Status**: ⏳ PENDING

---

#### Test 1.4: Filter Reset Behavior
**Steps**:
1. Select server → database → type
2. Change server selection
3. Verify database resets
4. Verify type filter persists

**Expected**:
- ✅ Changing server resets database to "All Databases"
- ✅ Type filter remains selected
- ✅ No console errors

**Status**: ⏳ PENDING

---

### 2. POSTGRESQL INTEGRATION TESTS

#### Test 2.1: PostgreSQL Connection
**Steps**:
1. Select "postgres (postgresql)" server
2. Verify connection establishes
3. Check databases list

**Expected**:
- ✅ No connection errors in console
- ✅ Databases appear in dropdown
- ✅ adventureworks database is listed

**Status**: ⏳ PENDING

---

#### Test 2.2: PostgreSQL Table Filtering
**Steps**:
1. Select postgres server
2. Select adventureworks database
3. Check profiling tab
4. Verify tables are from adventureworks only

**Expected**:
- ✅ Only shows tables from selected database
- ✅ Table names match database schema
- ✅ No tables from other databases

**Status**: ⏳ PENDING

---

#### Test 2.3: System Tables Filtering
**Steps**:
1. Check if system tables (pg_*, information_schema) appear
2. Verify only user tables are shown

**Expected**:
- ✅ No pg_catalog tables
- ✅ No information_schema tables
- ✅ Only user tables visible

**Status**: ⏳ PENDING

---

### 3. SMART PII DETECTION TESTS

#### Test 3.1: Auto-Detection on Table Expansion
**Steps**:
1. Go to Profiling tab
2. Select postgres + adventureworks
3. Click on any table to expand
4. Observe Smart PII Detection section

**Expected**:
- ✅ "Smart PII Detection" section appears
- ✅ "AI-Powered" badge visible
- ✅ Auto-runs without clicking
- ✅ Shows loading spinner
- ✅ Displays results within 3-5 seconds

**Status**: ⏳ PENDING

---

#### Test 3.2: audit_log.table_name - NOT PII
**Steps**:
1. Expand "audit_log" table
2. Find "table_name" column in results
3. Verify classification

**Expected**:
- ✅ table_name shows as "Safe Columns" (green section)
- ✅ NOT flagged as PII
- ✅ Reason: "Metadata field in audit_log: X% of values contain metadata keywords"
- ✅ Confidence: 85-95%

**Critical Test**: This is the main test case for smart detection!

**Status**: ⏳ PENDING

---

#### Test 3.3: Real PII Detection (email, phone, etc.)
**Steps**:
1. Find a table with actual PII (e.g., customers, users)
2. Expand the table
3. Check for email, phone columns

**Expected**:
- ✅ Email columns flagged as PII - EMAIL
- ✅ Phone columns flagged as PII - PHONE
- ✅ Confidence: 90%+
- ✅ Red "PII Detected" section shows them

**Status**: ⏳ PENDING

---

#### Test 3.4: Manual Override - Mark as NOT PII
**Steps**:
1. Find a column incorrectly flagged as PII
2. Click "Mark as NOT PII" button
3. Verify update

**Expected**:
- ✅ Button click sends API request
- ✅ Column moves to "Safe Columns"
- ✅ No errors in console
- ✅ Classification stored in database

**Status**: ⏳ PENDING

---

#### Test 3.5: Manual Override - Mark as PII
**Steps**:
1. Find a non-PII column
2. Click "Mark as PII" button
3. Select PII type
4. Verify update

**Expected**:
- ✅ Shows PII type selector
- ✅ Saves classification
- ✅ Column moves to "PII Columns"
- ✅ Training data stored

**Status**: ⏳ PENDING

---

#### Test 3.6: Confidence Scores
**Steps**:
1. Expand multiple tables
2. Observe confidence scores

**Expected**:
- ✅ Green badges for 90%+ confidence
- ✅ Yellow badges for 70-89% confidence
- ✅ Orange badges for <70% confidence
- ✅ Scores make sense for the data

**Status**: ⏳ PENDING

---

#### Test 3.7: Re-scan Functionality
**Steps**:
1. Expand a table (PII detection runs)
2. Click "Re-scan" button
3. Verify fresh detection

**Expected**:
- ✅ Shows loading spinner
- ✅ Fetches fresh data
- ✅ Updates results
- ✅ No errors

**Status**: ⏳ PENDING

---

#### Test 3.8: Show/Hide Details Toggle
**Steps**:
1. Click "Hide Details" button
2. Verify safe columns section hides
3. Click "Show Details"
4. Verify section shows again

**Expected**:
- ✅ Toggle works smoothly
- ✅ Icon changes (Eye/EyeOff)
- ✅ Layout adjusts properly

**Status**: ⏳ PENDING

---

### 4. PROFILING TAB TESTS

#### Test 4.1: Profile Loading
**Steps**:
1. Select server + database
2. Go to Profiling tab
3. Observe loading state

**Expected**:
- ✅ Shows loading spinner
- ✅ Loads profiles within 5 seconds
- ✅ Displays table list
- ✅ Shows quality scores

**Status**: ⏳ PENDING

---

#### Test 4.2: Table Expansion
**Steps**:
1. Click on a table row
2. Verify expansion animation
3. Check expanded content

**Expected**:
- ✅ Smooth expansion animation
- ✅ Quality Dimensions displayed
- ✅ Smart PII Detection visible
- ✅ Compliance Status visible
- ✅ Risks & Suggested Fixes visible

**Status**: ⏳ PENDING

---

#### Test 4.3: Quality Dimensions Display
**Steps**:
1. Expand a table
2. Check Quality Dimensions section

**Expected**:
- ✅ Shows 6 dimensions: Complete, Accurate, Unique, Valid, Fresh, Consistent
- ✅ Each has percentage score
- ✅ Color-coded (green >90%, blue 75-89%, yellow 60-74%, red <60%)

**Status**: ⏳ PENDING

---

#### Test 4.4: Preview Data Feature
**Steps**:
1. Find "Preview Top 100 Affected Rows" button
2. Click it
3. Verify data preview loads

**Expected**:
- ✅ Shows data preview modal/section
- ✅ Displays up to 100 rows
- ✅ Columns formatted properly
- ✅ No 500 errors

**Status**: ⏳ PENDING

---

### 5. OVERVIEW TAB TESTS

#### Test 5.1: Summary Stats Display
**Steps**:
1. Select server + database
2. Go to Overview tab
3. Check KPI cards

**Expected**:
- ✅ Shows quality score
- ✅ Shows total assets
- ✅ Shows quality issues
- ✅ Stats update when filters change

**Status**: ⏳ PENDING

---

#### Test 5.2: Filter Impact on Overview
**Steps**:
1. Change server selection
2. Verify overview updates
3. Change database
4. Verify overview updates again

**Expected**:
- ✅ Stats re-calculate on filter change
- ✅ No stale data
- ✅ Loading indicators shown

**Status**: ⏳ PENDING

---

### 6. RULES TAB TESTS

#### Test 6.1: Rules List Display
**Steps**:
1. Go to Rules tab
2. Observe rules list

**Expected**:
- ✅ Shows quality rules
- ✅ Can create new rules
- ✅ Can edit existing rules
- ✅ Can delete rules

**Status**: ⏳ PENDING

---

### 7. VIOLATIONS TAB TESTS

#### Test 7.1: Violations List
**Steps**:
1. Go to Violations tab
2. Check violations list

**Expected**:
- ✅ Shows quality violations
- ✅ Grouped by severity
- ✅ Can filter by status
- ✅ Can resolve violations

**Status**: ⏳ PENDING

---

### 8. TRENDS TAB TESTS

#### Test 8.1: Trends Visualization
**Steps**:
1. Go to Trends tab
2. Observe charts

**Expected**:
- ✅ Shows quality score trends
- ✅ Time-series data visible
- ✅ Charts render properly

**Status**: ⏳ PENDING

---

### 9. PERFORMANCE TESTS

#### Test 9.1: Initial Page Load
**Steps**:
1. Navigate to Data Quality
2. Measure load time

**Expected**:
- ✅ Page loads in <2 seconds
- ✅ No layout shift
- ✅ Filters render immediately

**Status**: ⏳ PENDING

---

#### Test 9.2: Filter Change Performance
**Steps**:
1. Change filter selection
2. Measure response time

**Expected**:
- ✅ Filter change applies in <500ms
- ✅ UI remains responsive
- ✅ No lag or freezing

**Status**: ⏳ PENDING

---

#### Test 9.3: Smart PII Detection Speed
**Steps**:
1. Expand table (triggers PII detection)
2. Measure detection time

**Expected**:
- ✅ Detection completes in <5 seconds
- ✅ Shows progress/loading indicator
- ✅ Doesn't block UI

**Status**: ⏳ PENDING

---

### 10. ERROR HANDLING TESTS

#### Test 10.1: Network Error Handling
**Steps**:
1. Disconnect network
2. Try to load profiles
3. Observe error message

**Expected**:
- ✅ Shows user-friendly error
- ✅ Suggests retry action
- ✅ Doesn't crash page

**Status**: ⏳ PENDING

---

#### Test 10.2: Invalid Data Source
**Steps**:
1. Select a disconnected/invalid source
2. Observe behavior

**Expected**:
- ✅ Shows error message
- ✅ Doesn't break page
- ✅ Allows switching to valid source

**Status**: ⏳ PENDING

---

### 11. ACCESSIBILITY TESTS

#### Test 11.1: Keyboard Navigation
**Steps**:
1. Use Tab key to navigate
2. Use Enter/Space to activate

**Expected**:
- ✅ Can navigate with keyboard
- ✅ Focus indicators visible
- ✅ All interactive elements accessible

**Status**: ⏳ PENDING

---

#### Test 11.2: Screen Reader Compatibility
**Steps**:
1. Test with screen reader
2. Verify labels and ARIA attributes

**Expected**:
- ✅ Meaningful labels
- ✅ ARIA attributes present
- ✅ Logical reading order

**Status**: ⏳ PENDING

---

## 🐛 KNOWN ISSUES TO VERIFY

### Issue 1: PostgreSQL Not Working
**Description**: User reported "postgres is not working"
**Priority**: HIGH
**Test**: Verify PostgreSQL connection and data loading

### Issue 2: Database Filter Dependency
**Description**: Database dropdown should only show databases for selected server
**Priority**: HIGH
**Test**: Verify database list filters correctly

### Issue 3: Smart PII False Positives
**Description**: Ensure table_name in audit_log is NOT flagged as PII
**Priority**: CRITICAL
**Test**: Verify audit_log.table_name is correctly classified

---

## 📊 QA SUMMARY

### Test Coverage:
- [ ] Filters: 0/4 tests
- [ ] PostgreSQL: 0/3 tests
- [ ] Smart PII: 0/8 tests
- [ ] Profiling: 0/4 tests
- [ ] Overview: 0/2 tests
- [ ] Rules: 0/1 tests
- [ ] Violations: 0/1 tests
- [ ] Trends: 0/1 tests
- [ ] Performance: 0/3 tests
- [ ] Error Handling: 0/2 tests
- [ ] Accessibility: 0/2 tests

**Total Tests**: 0/31 passed

---

## 🔧 BUGS TO FIX

### Priority 1 (Critical):
1. [ ] Verify PostgreSQL connection works
2. [ ] Verify database filtering works
3. [ ] Verify Smart PII detects audit_log.table_name as NOT PII

### Priority 2 (High):
4. [ ] Verify filter reset behavior
5. [ ] Verify system tables are filtered out
6. [ ] Verify manual PII override works

### Priority 3 (Medium):
7. [ ] Verify preview data works (no 500 errors)
8. [ ] Verify all tabs load correctly
9. [ ] Verify performance is acceptable

---

## 📝 TESTING NOTES

**Next Steps**:
1. Start with Filter Functionality Tests
2. Test PostgreSQL Integration
3. Test Smart PII Detection (critical!)
4. Test remaining tabs
5. Performance testing
6. Fix any bugs found

**Testing Environment Ready**:
- ✅ data-service rebuilt and running
- ✅ frontend running on localhost:3000
- ✅ Database accessible
- ✅ Smart PII endpoints deployed
