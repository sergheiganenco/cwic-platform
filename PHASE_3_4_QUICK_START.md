# Phase 3 & 4 Quick Start Guide

## Quick Reference: New API Endpoints

### Phase 3: Automation

#### 1. Get Recommendations for an Alert
```bash
GET /api/quality/alerts/:alertId/recommendations

# Example
curl http://localhost:3002/api/quality/alerts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/recommendations

# Response
{
  "success": true,
  "data": {
    "alertId": "...",
    "recommendations": [
      {
        "type": "auto_fix",
        "title": "Remove duplicate records",
        "description": "Automatically remove 127 duplicate records",
        "steps": [...],
        "sqlQuery": "...",
        "estimatedTimeMinutes": 5,
        "riskLevel": "low",
        "confidence": 90,
        "priority": 9
      }
    ]
  }
}
```

#### 2. Execute Auto-Fix (Dry Run)
```bash
POST /api/quality/alerts/auto-fix

# Example - Preview changes first
curl -X POST http://localhost:3002/api/quality/alerts/auto-fix \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "fixType": "remove_duplicates",
    "dryRun": true,
    "strategy": "keep_newest"
  }'

# Response
{
  "success": true,
  "data": {
    "id": "fix-123",
    "status": "completed",
    "rowsAffected": 127,
    "executionTimeMs": 234
  }
}
```

#### 3. Execute Auto-Fix (Actual)
```bash
# Execute actual fix
curl -X POST http://localhost:3002/api/quality/alerts/auto-fix \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "fixType": "remove_duplicates",
    "dryRun": false,
    "strategy": "keep_newest"
  }'
```

#### 4. View Auto-Fix History
```bash
GET /api/quality/alerts/:alertId/auto-fix-history

# Example
curl http://localhost:3002/api/quality/alerts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/auto-fix-history
```

#### 5. Get Available Fixes
```bash
GET /api/quality/alerts/:alertId/available-fixes

# Example
curl http://localhost:3002/api/quality/alerts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/available-fixes

# Response
{
  "success": true,
  "data": {
    "availableFixes": [
      "remove_duplicates",
      "set_null_defaults"
    ]
  }
}
```

### Phase 4: Advanced Features

#### 1. Create Quality SLA
```bash
POST /api/quality/sla

# Example - Freshness SLA
curl -X POST http://localhost:3002/api/quality/sla \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Orders Table Freshness",
    "scopeType": "table",
    "scopeValue": "orders",
    "slaType": "freshness",
    "thresholdValue": 1,
    "thresholdOperator": "<",
    "measurementWindowHours": 24,
    "breachSeverity": "critical",
    "enabled": true
  }'

# Example - Completeness SLA
curl -X POST http://localhost:3002/api/quality/sla \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Email Completeness",
    "scopeType": "table",
    "scopeValue": "customers",
    "slaType": "completeness",
    "thresholdValue": 95,
    "thresholdOperator": ">",
    "measurementWindowHours": 24,
    "breachSeverity": "high",
    "enabled": true
  }'
```

#### 2. Get SLA Compliance Report
```bash
GET /api/quality/sla/compliance?scopeType=table&windowHours=24

# Example
curl "http://localhost:3002/api/quality/sla/compliance?scopeType=table&windowHours=24"

# Response
{
  "success": true,
  "data": [
    {
      "slaId": "sla-123",
      "slaName": "Orders Table Freshness",
      "compliant": true,
      "currentValue": 0.5,
      "thresholdValue": 1,
      "uptimePercentage": 99.8,
      "lastCheckedAt": "2025-10-22T10:30:00Z"
    }
  ]
}
```

#### 3. Get Active SLA Breaches
```bash
GET /api/quality/sla/breaches

# Example
curl http://localhost:3002/api/quality/sla/breaches

# Response
{
  "success": true,
  "data": [
    {
      "id": "breach-456",
      "slaId": "sla-123",
      "slaName": "Orders Table Freshness",
      "breachType": "threshold_exceeded",
      "actualValue": 2.5,
      "thresholdValue": 1,
      "severity": "critical",
      "detectedAt": "2025-10-22T10:00:00Z",
      "acknowledged": false
    }
  ]
}
```

#### 4. Acknowledge SLA Breach
```bash
POST /api/quality/sla/breaches/:breachId/acknowledge

# Example
curl -X POST http://localhost:3002/api/quality/sla/breaches/breach-456/acknowledge \
  -H "Content-Type: application/json" \
  -d '{
    "acknowledgedBy": "john.doe",
    "notes": "Investigating upstream data delay"
  }'
```

#### 5. Get Root Causes for Alert
```bash
GET /api/quality/alerts/:alertId/root-causes

# Example
curl http://localhost:3002/api/quality/alerts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/root-causes

# Response
{
  "success": true,
  "data": {
    "alertId": "...",
    "rootCauses": [
      {
        "causeType": "deployment",
        "causeDescription": "Issue detected 15 minutes after deployment",
        "evidence": {
          "deploymentId": "dep-123",
          "service": "payment-service",
          "version": "v2.3.1",
          "deployedBy": "jane.doe",
          "timeDiffMinutes": 15
        },
        "confidence": 85,
        "identifiedBy": "system"
      }
    ],
    "summary": {
      "totalCauses": 2,
      "highConfidence": 1
    }
  }
}
```

#### 6. Verify Root Cause
```bash
POST /api/quality/alerts/:alertId/root-causes/verify

# Example
curl -X POST http://localhost:3002/api/quality/alerts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/root-causes/verify \
  -H "Content-Type: application/json" \
  -d '{
    "rootCauseId": "rc-789",
    "verified": true,
    "verifiedBy": "john.doe",
    "notes": "Confirmed by deployment logs"
  }'
```

#### 7. Get Root Cause Patterns
```bash
GET /api/quality/root-causes/patterns?windowHours=168

# Example - Get patterns from last 7 days
curl "http://localhost:3002/api/quality/root-causes/patterns?windowHours=168"

# Response
{
  "success": true,
  "data": {
    "patterns": [
      {
        "causeType": "deployment",
        "occurrences": 12,
        "affectedTables": ["orders", "payments"],
        "avgConfidence": 82,
        "firstSeen": "2025-10-15T10:00:00Z",
        "lastSeen": "2025-10-22T10:00:00Z"
      }
    ]
  }
}
```

#### 8. Train ML Anomaly Model
```bash
POST /api/quality/ml/train

# Example
curl -X POST http://localhost:3002/api/quality/ml/train \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "Orders Completeness Anomaly Detector",
    "modelType": "moving_average",
    "scopeType": "table",
    "scopeValue": "orders",
    "ruleId": "rule-uuid-here",
    "windowDays": 30
  }'

# Response
{
  "success": true,
  "data": {
    "modelId": "model-abc-123",
    "modelName": "Orders Completeness Anomaly Detector",
    "modelType": "moving_average",
    "trainingDataPoints": 720
  }
}
```

#### 9. Get ML-Detected Anomalies
```bash
GET /api/quality/ml/anomalies?windowHours=24

# Example
curl "http://localhost:3002/api/quality/ml/anomalies?windowHours=24"

# Response
{
  "success": true,
  "data": [
    {
      "id": "pred-456",
      "ruleId": "rule-123",
      "anomalyScore": 3.2,
      "predictedValue": 125,
      "confidence": 78,
      "predictionTimestamp": "2025-10-22T10:00:00Z",
      "modelName": "Orders Anomaly Detector",
      "modelType": "moving_average"
    }
  ]
}
```

#### 10. Get ML Model Metrics
```bash
GET /api/quality/ml/models/:modelId/metrics

# Example
curl http://localhost:3002/api/quality/ml/models/model-abc-123/metrics

# Response
{
  "success": true,
  "data": {
    "modelId": "model-abc-123",
    "totalPredictions": 1440,
    "anomalyCount": 12,
    "anomalyRate": 0.83,
    "avgConfidence": 76.5,
    "avgAnomalyScore": 2.8,
    "lastPredictionAt": "2025-10-22T10:00:00Z"
  }
}
```

## Common Workflows

### Workflow 1: Alert Investigation & Auto-Fix
```bash
# 1. Get alert recommendations
curl http://localhost:3002/api/quality/alerts/{alertId}/recommendations

# 2. Check available fixes
curl http://localhost:3002/api/quality/alerts/{alertId}/available-fixes

# 3. Preview fix with dry-run
curl -X POST http://localhost:3002/api/quality/alerts/auto-fix \
  -H "Content-Type: application/json" \
  -d '{"alertId": "{alertId}", "fixType": "remove_duplicates", "dryRun": true}'

# 4. Execute actual fix
curl -X POST http://localhost:3002/api/quality/alerts/auto-fix \
  -H "Content-Type: application/json" \
  -d '{"alertId": "{alertId}", "fixType": "remove_duplicates", "dryRun": false}'

# 5. Verify fix history
curl http://localhost:3002/api/quality/alerts/{alertId}/auto-fix-history
```

### Workflow 2: SLA Setup & Monitoring
```bash
# 1. Create SLA
curl -X POST http://localhost:3002/api/quality/sla \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Critical Table Freshness",
    "scopeType": "table",
    "scopeValue": "orders",
    "slaType": "freshness",
    "thresholdValue": 1,
    "thresholdOperator": "<",
    "breachSeverity": "critical"
  }'

# 2. Monitor compliance
curl "http://localhost:3002/api/quality/sla/compliance?windowHours=24"

# 3. Check for breaches
curl http://localhost:3002/api/quality/sla/breaches

# 4. Acknowledge breach if found
curl -X POST http://localhost:3002/api/quality/sla/breaches/{breachId}/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"acknowledgedBy": "user", "notes": "Investigating"}'
```

### Workflow 3: Root Cause Analysis
```bash
# 1. Get root causes for alert
curl http://localhost:3002/api/quality/alerts/{alertId}/root-causes

# 2. Verify identified root cause
curl -X POST http://localhost:3002/api/quality/alerts/{alertId}/root-causes/verify \
  -H "Content-Type: application/json" \
  -d '{
    "rootCauseId": "{rcId}",
    "verified": true,
    "verifiedBy": "user",
    "notes": "Confirmed"
  }'

# 3. Check for recurring patterns
curl "http://localhost:3002/api/quality/root-causes/patterns?windowHours=168"
```

### Workflow 4: ML Anomaly Detection
```bash
# 1. Train model with historical data
curl -X POST http://localhost:3002/api/quality/ml/train \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "Table Anomaly Detector",
    "modelType": "moving_average",
    "scopeType": "table",
    "scopeValue": "orders",
    "ruleId": "{ruleId}",
    "windowDays": 30
  }'

# 2. Get detected anomalies
curl "http://localhost:3002/api/quality/ml/anomalies?windowHours=24"

# 3. Check model performance
curl http://localhost:3002/api/quality/ml/models/{modelId}/metrics
```

## Fix Types Reference

### Auto-Fix Types
- **set_null_defaults**: Populate NULL values with default values
- **remove_duplicates**: Remove duplicate records (strategies: keep_newest, keep_oldest, keep_most_complete)
- **correct_invalid_values**: Fix values that violate constraints
- **fix_negative_values**: Correct negative values in positive-only columns

### SLA Types
- **freshness**: Hours since last data update (use `<` operator)
- **completeness**: Percentage of non-NULL values (use `>` operator)
- **accuracy**: Percentage of records passing quality checks (use `>` operator)
- **consistency**: Cross-table consistency validation (use `>` operator)

### ML Model Types
- **moving_average**: Z-score based detection with sliding window (good for general trends)
- **seasonal**: Detects anomalies in seasonal patterns (good for hourly/daily cycles)
- **isolation_forest**: Outlier detection (good for identifying rare events)

## Response Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

## Notes

1. **Always use dry-run first**: When executing auto-fixes, always test with `dryRun: true` first
2. **Monitor SLA breaches**: Set up regular checks for SLA breaches
3. **Verify root causes**: Use the verification workflow to build confidence in root cause analysis
4. **Train ML models regularly**: Retrain models periodically with fresh data for better accuracy
5. **Check fix history**: Review auto-fix execution history to ensure fixes are working as expected
