# Data Quality Testing Guide - Complete Setup

## Overview

To test all enterprise data quality features, you need:
1. ✅ Data sources already configured (Azure SQL - Feya)
2. 🔧 Quality issues in the data (we'll create these)
3. 🔧 API endpoints for new services (we'll add these)
4. ✅ Lineage relationships (already discovered)
5. 🔧 Test scripts for validation

---

## Current Setup Status

### ✅ What You Already Have

1. **Data Source**: Azure SQL (Feya) - `af910adf-c7c1-4573-9eec-93f05f0970b7`
   - 10 tables (User, Role, TblWish, Notifications, etc.)
   - 11 lineage relationships discovered
   - Quality profiling capability

2. **Database Schema**:
   - All quality enhancement tables created (migration 016)
   - Enhanced quality_issues table
   - Ready for healing, impact analysis, ROI tracking

3. **Services Implemented**:
   - ✅ DataHealingService
   - ✅ QualityImpactAnalysisService
   - ✅ QualityROIService

### 🔧 What We Need to Add

1. **API Endpoints** - Expose new services via REST API
2. **Test Data** - Create quality issues for testing
3. **Test Scripts** - Automated testing scenarios

---

## Step 1: Create API Endpoints

We need to add routes for the new services. Let me check what endpoints exist:

**Existing Quality Endpoints** (check `/api/quality`):
- GET `/api/quality/profiles` - Get data profiles
- POST `/api/quality/profile/:dataSourceId` - Profile a data source
- GET `/api/quality/rules` - Get quality rules
- POST `/api/quality/rules` - Create rule
- POST `/api/quality/scan/:dataSourceId` - Scan for issues
- GET `/api/quality/issues` - Get quality issues

**New Endpoints Needed**:

### Healing Endpoints
```
POST /api/quality/healing/analyze/:issueId
  → Analyze healing options for an issue

POST /api/quality/healing/heal/:issueId
  Body: { actionId, dryRun, backupFirst, requireApproval }
  → Execute healing action

POST /api/quality/healing/rollback/:healingId
  → Rollback a healing attempt

GET /api/quality/healing/recommendations/:dataSourceId
  → Get auto-heal recommendations

POST /api/quality/healing/batch
  Body: { issueIds, dryRun, maxConcurrent }
  → Batch heal multiple issues
```

### Impact Analysis Endpoints
```
GET /api/quality/impact/:issueId
  Query: { maxDepth }
  → Analyze issue impact via lineage

GET /api/quality/impact/summary/:dataSourceId
  → Get impact summary for all issues

POST /api/quality/impact/simulate/:issueId
  Query: { scenario: 'best_case' | 'worst_case' | 'realistic' }
  → Simulate issue propagation
```

### ROI Endpoints
```
GET /api/quality/roi/:dataSourceId
  Query: { period: 'day' | 'week' | 'month' | 'quarter' | 'year' }
  → Calculate ROI for data source

GET /api/quality/roi/trend/:dataSourceId
  Query: { days }
  → Get ROI trend over time

GET /api/quality/roi/initiative/:dataSourceId/:initiative
  → Calculate ROI for specific initiative

GET /api/quality/roi/compare
  Query: { period }
  → Compare ROI across data sources
```

---

## Step 2: Create Test Data with Quality Issues

We'll use the existing Azure SQL (Feya) database and introduce controlled quality issues.

### Option A: Insert Bad Data (Safe - Separate Test Table)

```sql
-- Create a test table with quality issues
CREATE TABLE quality_test_data (
  id INT PRIMARY KEY IDENTITY(1,1),
  email VARCHAR(255),          -- Will have invalid emails
  phone VARCHAR(50),            -- Will have invalid phone formats
  created_date VARCHAR(50),     -- Will have date format issues
  amount DECIMAL(10,2),         -- Will have outliers
  status VARCHAR(50),           -- Will have inconsistent values
  user_id INT,                  -- Will have broken references
  duplicate_key VARCHAR(100)    -- Will have duplicates
);

-- Insert data with issues
INSERT INTO quality_test_data (email, phone, created_date, amount, status, user_id, duplicate_key) VALUES
-- NULL issues
(NULL, '123-456-7890', '2024-01-01', 100.00, 'active', 1, 'KEY001'),
('user@example.com', NULL, '2024-01-02', 200.00, 'active', 2, 'KEY002'),

-- Format issues
('invalid-email', '555-1234', '2024-01-03', 300.00, 'ACTIVE', 3, 'KEY003'),
('user  @test.com', '(555) 555-1234', 'January 5, 2024', 400.00, 'Active', 4, 'KEY004'),

-- Outliers
('user5@test.com', '555-5555', '2024-01-05', 999999.99, 'active', 5, 'KEY005'),
('user6@test.com', '555-6666', '2024-01-06', -100.00, 'inactive', 6, 'KEY006'),

-- Duplicates
('user7@test.com', '555-7777', '2024-01-07', 700.00, 'active', 7, 'DUP001'),
('user8@test.com', '555-8888', '2024-01-08', 800.00, 'active', 8, 'DUP001'),

-- Broken references (user_id doesn't exist)
('user9@test.com', '555-9999', '2024-01-09', 900.00, 'active', 99999, 'KEY009');
```

### Option B: Use Existing Tables (More Realistic)

Check existing tables for natural quality issues:
```sql
-- Check for NULL values
SELECT 'User table - NULL emails' as issue,
       COUNT(*) as count
FROM [User]
WHERE Email IS NULL OR Email = '';

-- Check for format issues
SELECT 'Invalid email formats' as issue,
       COUNT(*) as count
FROM [User]
WHERE Email NOT LIKE '%@%.%';

-- Check for duplicates
SELECT 'Duplicate emails' as issue,
       Email,
       COUNT(*) as count
FROM [User]
GROUP BY Email
HAVING COUNT(*) > 1;
```

---

## Step 3: Testing Workflow

### Phase 1: Profile the Data Source

```bash
# 1. Profile the data source to discover quality issues
curl -X POST http://localhost:8000/api/quality/profile/af910adf-c7c1-4573-9eec-93f05f0970b7

# Expected result:
# - Data profiles created
# - Quality scores calculated
# - Auto-generated quality rules
# - Issues detected and stored in quality_issues table
```

### Phase 2: Test Automated Healing

```bash
# 2. Get quality issues
curl http://localhost:8000/api/quality/issues?dataSourceId=af910adf-c7c1-4573-9eec-93f05f0970b7

# 3. Pick an issue and analyze healing options
curl -X POST http://localhost:8000/api/quality/healing/analyze/{issueId}

# Expected result:
# {
#   "issueType": "invalid_email",
#   "strategy": { "name": "Email Correction", "confidence": 0.90 },
#   "actions": [
#     {
#       "id": "action_1",
#       "name": "Lowercase and Trim",
#       "confidence": 0.95,
#       "sqlPreview": "UPDATE ... SET email = LOWER(TRIM(email))",
#       "estimatedImpact": { "rowsAffected": 15, "reversible": true }
#     }
#   ]
# }

# 4. Execute healing (dry run first)
curl -X POST http://localhost:8000/api/quality/healing/heal/{issueId} \
  -H "Content-Type: application/json" \
  -d '{"actionId": "action_1", "dryRun": true}'

# 5. Execute for real with backup
curl -X POST http://localhost:8000/api/quality/healing/heal/{issueId} \
  -H "Content-Type: application/json" \
  -d '{"actionId": "action_1", "dryRun": false, "backupFirst": true}'

# 6. If needed, rollback
curl -X POST http://localhost:8000/api/quality/healing/rollback/{healingId}
```

### Phase 3: Test Impact Analysis

```bash
# 7. Analyze impact of a quality issue
curl http://localhost:8000/api/quality/impact/{issueId}?maxDepth=5

# Expected result:
# {
#   "impactScore": 75,
#   "impactedAssets": [
#     {
#       "assetName": "UserRoles",
#       "depth": 1,
#       "propagationProbability": 0.85,
#       "estimatedAffectedRows": 120,
#       "impactSeverity": "high"
#     }
#   ],
#   "criticalPaths": [...],
#   "businessImpact": {
#     "estimatedCost": 2500,
#     "potentialRevenueLoss": 5000
#   }
# }

# 8. Simulate propagation
curl -X POST "http://localhost:8000/api/quality/impact/simulate/{issueId}?scenario=worst_case"

# 9. Get overall impact summary
curl http://localhost:8000/api/quality/impact/summary/af910adf-c7c1-4573-9eec-93f05f0970b7
```

### Phase 4: Test ROI Calculation

```bash
# 10. Calculate monthly ROI
curl "http://localhost:8000/api/quality/roi/af910adf-c7c1-4573-9eec-93f05f0970b7?period=month"

# Expected result:
# {
#   "period": "month",
#   "costs": {
#     "issueCosts": 5000,
#     "remediationCosts": 1500,
#     "totalCosts": 6500
#   },
#   "benefits": {
#     "preventionSavings": 3000,
#     "timeSavings": 6000,
#     "totalBenefits": 9000
#   },
#   "netBenefit": 2500,
#   "roi": 38.5,
#   "projections": {
#     "annual": 30000
#   }
# }

# 11. Get ROI trend
curl "http://localhost:8000/api/quality/roi/trend/af910adf-c7c1-4573-9eec-93f05f0970b7?days=90"

# 12. Compare data sources
curl "http://localhost:8000/api/quality/roi/compare?period=month"
```

---

## Step 4: Full Integration Test Script

Create a test script that runs all scenarios:

```bash
#!/bin/bash

echo "🧪 Data Quality Enterprise Testing"
echo "===================================="

DATA_SOURCE_ID="af910adf-c7c1-4573-9eec-93f05f0970b7"
BASE_URL="http://localhost:8000/api"

# 1. Profile data source
echo "📊 Step 1: Profiling data source..."
curl -X POST "$BASE_URL/quality/profile/$DATA_SOURCE_ID"
sleep 5

# 2. Get issues
echo "🔍 Step 2: Fetching quality issues..."
ISSUES=$(curl "$BASE_URL/quality/issues?dataSourceId=$DATA_SOURCE_ID")
ISSUE_ID=$(echo $ISSUES | jq -r '.data[0].id')

if [ -z "$ISSUE_ID" ]; then
  echo "❌ No issues found. Need to create test data first."
  exit 1
fi

echo "Found issue: $ISSUE_ID"

# 3. Analyze healing
echo "💊 Step 3: Analyzing healing options..."
curl -X POST "$BASE_URL/quality/healing/analyze/$ISSUE_ID"

# 4. Execute dry run
echo "🧪 Step 4: Executing healing (dry run)..."
HEALING_RESULT=$(curl -X POST "$BASE_URL/quality/healing/heal/$ISSUE_ID" \
  -H "Content-Type: application/json" \
  -d '{"actionId": "action_1", "dryRun": true}')

# 5. Analyze impact
echo "📈 Step 5: Analyzing impact..."
curl "$BASE_URL/quality/impact/$ISSUE_ID?maxDepth=3"

# 6. Calculate ROI
echo "💰 Step 6: Calculating ROI..."
curl "$BASE_URL/quality/roi/$DATA_SOURCE_ID?period=month"

echo "✅ Testing complete!"
```

---

## Step 5: Validate Lineage Integration

The impact analysis uses lineage data. Verify it's working:

```sql
-- Check lineage exists
SELECT
  ca1.table_name as from_table,
  ca2.table_name as to_table,
  cl.edge_type
FROM catalog_lineage cl
JOIN catalog_assets ca1 ON ca1.id = cl.from_asset_id
JOIN catalog_assets ca2 ON ca2.id = cl.to_asset_id
WHERE ca1.datasource_id = 'af910adf-c7c1-4573-9eec-93f05f0970b7';

-- Expected: 11 relationships
-- Notifications → User, TblWish
-- UserRoles → User, Role
-- etc.
```

---

## Step 6: UI Testing (When Available)

Once UI components are built:

1. **Navigate to Data Quality page**
2. **Select Azure SQL (Feya) data source**
3. **Tab 1 - Overview**
   - See overall quality score
   - View quality dimensions
   - Quick actions available

4. **Tab 2 - Profiling**
   - Click "Start Deep Scan"
   - See profiled assets appear
   - View quality scores per table

5. **Tab 3 - Rules**
   - View auto-generated rules
   - See AI-generated rules
   - Enable/disable rules

6. **Tab 4 - Violations**
   - See detected issues
   - For each issue:
     - Click "View Impact" → See downstream effects
     - Click "Auto-Heal" → See healing options
     - Execute healing → Monitor progress

7. **New Tab - ROI Dashboard** (to be built)
   - View cost breakdown
   - See ROI percentage
   - Historical ROI trend
   - Cost comparison across sources

---

## Quick Start Testing (No Additional Setup)

You can test with **existing data** right now:

```bash
# 1. Check what data sources you have
curl http://localhost:8000/api/datasources

# 2. Use Azure SQL (Feya)
DATA_SOURCE="af910adf-c7c1-4573-9eec-93f05f0970b7"

# 3. Profile it (this will find real quality issues)
curl -X POST http://localhost:8000/api/quality/profile/$DATA_SOURCE

# 4. Check for issues found
curl "http://localhost:8000/api/quality/issues?dataSourceId=$DATA_SOURCE"

# 5. If issues exist, test healing on one
# (Get issue ID from step 4)
curl -X POST http://localhost:8000/api/quality/healing/analyze/{ISSUE_ID}
```

---

## Next Steps

1. **Add API Endpoints** - Create quality routes file
2. **Run Migration** - Ensure schema is up to date
3. **Test with Real Data** - Use existing Azure SQL source
4. **Create Test Data** (optional) - For controlled testing
5. **Build UI Components** - Visualize healing, impact, ROI

---

## Expected Results

### After Full Testing:

✅ **Automated Healing**
- Issues detected automatically
- Healing options ranked by confidence
- Dry-run successful
- Real execution with backup successful
- Rollback working

✅ **Impact Analysis**
- Downstream assets identified via lineage
- Propagation probability calculated
- Business cost estimated
- Critical paths highlighted

✅ **ROI Tracking**
- Costs calculated correctly
- Savings measured
- ROI % computed
- Trends tracked over time

---

## Troubleshooting

### No Issues Found
- Run profiling first
- Create test data with known issues
- Check quality rules are enabled

### Impact Analysis Shows 0 Assets
- Verify lineage relationships exist
- Run lineage discovery
- Check issue is on a table with downstream dependencies

### ROI Shows $0
- Need quality issues over time
- Historical data required for trends
- Run profiling multiple times

---

## Summary

**What You Need:**
- ✅ Data source (you have Azure SQL)
- ✅ Database schema (migration ran)
- ✅ Services (implemented)
- 🔧 API endpoints (need to create)
- 🔧 Test data (use real data or create test table)

**Testing Flow:**
1. Profile → 2. Analyze → 3. Heal → 4. Verify Impact → 5. Calculate ROI

**Ready to Start!** 🚀
