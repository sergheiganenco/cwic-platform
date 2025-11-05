# Smart PII Detection System

## Overview

The Smart PII Detection system uses context-aware analysis and machine learning to accurately identify Personally Identifiable Information (PII) in your databases while minimizing false positives.

## Key Features

### 1. Context-Aware Detection

The system understands the **context** of data, not just column names. For example:

- ❌ **Traditional PII Detection**: Flags `table_name` in `audit_log` as potential PII
- ✅ **Smart PII Detection**: Recognizes that `table_name` in an audit table is metadata, **not PII**

### 2. Multiple Detection Strategies

The system uses a layered approach:

1. **Manual Overrides** (Highest Priority)
   - User-provided classifications
   - 100% confidence
   - Stored in training database

2. **Metadata Context Analysis**
   - Identifies system tables (audit, log, config, migration)
   - Recognizes metadata columns (table_name, schema_name, etc.)
   - 85% confidence when matched

3. **Machine Learning Predictions**
   - Learns from manual corrections
   - Requires 3+ similar examples
   - Confidence: 70-95%

4. **Pattern-Based Detection**
   - Column name patterns (email, phone, ssn, etc.)
   - Data pattern validation (email regex, phone format, etc.)
   - Confidence: 70-99%

### 3. Machine Learning Training

Every manual classification trains the AI:

```typescript
// When a user marks a column as PII or NOT PII
await piiService.storeManualClassification(
  context,
  isPII,
  piiType,
  userId,
  reason
);
```

This data is stored in the `pii_training_data` table and used to:
- Improve future predictions
- Learn from similar column names and data types
- Reduce false positives over time

## Architecture

### Backend Components

#### 1. SmartPIIDetectionService
Location: `backend/data-service/src/services/SmartPIIDetectionService.ts`

**Key Methods**:
- `detectPII(context)` - Detect PII for a single column
- `batchDetectPII(contexts)` - Detect PII for multiple columns
- `storeManualClassification()` - Store user corrections for ML training
- `getDetectionStats()` - Get PII detection statistics

**Detection Logic**:
```typescript
1. Check manual override
   ↓ (if not found)
2. Check if metadata context (audit table + metadata column)
   ↓ (if not metadata)
3. Check ML prediction (requires 3+ training examples)
   ↓ (if confidence < 80%)
4. Apply pattern-based detection with data validation
   ↓ (if no match)
5. Default: Not PII
```

#### 2. API Endpoints
Location: `backend/data-service/src/routes/catalog.ts`

**POST /api/catalog/pii/classify**
```typescript
// Classify a column as PII (manual override)
{
  dataSourceId: string,
  databaseName: string,
  schemaName: string,
  tableName: string,
  columnName: string,
  dataType: string,
  isPII: boolean,
  piiType: string | null,
  reason?: string,
  userId: string
}
```

**POST /api/catalog/pii/detect**
```typescript
// Auto-detect PII for all columns in a table
{
  dataSourceId: string,
  databaseName: string,
  schemaName: string,
  tableName: string
}
```

**GET /api/catalog/pii/stats/:dataSourceId**
```typescript
// Get PII detection statistics
Response: {
  totalColumns: number,
  piiColumns: number,
  manualOverrides: number,
  topPIITypes: Array<{ piiType: string, count: number }>
}
```

### Frontend Components

#### PIIClassificationControl
Location: `frontend/src/components/features/catalog/PIIClassificationControl.tsx`

A reusable component that allows users to:
- View current PII classification
- Manually override classification with checkbox
- Select PII type from predefined list
- Provide reason for classification
- Save to training database

**Usage Example**:
```tsx
<PIIClassificationControl
  dataSourceId={dataSource.id}
  databaseName="adventureworks"
  schemaName="public"
  tableName="audit_log"
  columnName="table_name"
  dataType="varchar"
  currentIsPII={false}
  currentPIIType={null}
  onClassified={() => refetchData()}
/>
```

### Database Schema

#### pii_training_data Table
```sql
CREATE TABLE pii_training_data (
  id BIGSERIAL PRIMARY KEY,
  data_source_id UUID,
  database_name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  data_type TEXT,

  -- Classification
  is_pii BOOLEAN NOT NULL,
  pii_type VARCHAR(50),
  confidence INTEGER DEFAULT 100,
  reason TEXT,

  -- Training metadata
  training_source VARCHAR(20) NOT NULL, -- 'manual', 'pattern', 'ml'
  trained_by VARCHAR(255),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (database_name, schema_name, table_name, column_name, training_source)
);
```

#### catalog_columns Updates
```sql
ALTER TABLE catalog_columns
  ADD COLUMN pii_type VARCHAR(50),
  ADD COLUMN is_sensitive BOOLEAN DEFAULT FALSE,
  ADD COLUMN quality_issues JSONB DEFAULT '[]',
  ADD COLUMN encryption_status VARCHAR(50) DEFAULT 'plain_text';
```

#### catalog_assets Updates
```sql
ALTER TABLE catalog_assets
  ADD COLUMN pii_detected BOOLEAN DEFAULT FALSE,
  ADD COLUMN pii_fields JSONB DEFAULT '[]',
  ADD COLUMN quality_last_scanned_at TIMESTAMP,
  ADD COLUMN compliance_status JSONB DEFAULT '{}',
  ADD COLUMN risk_level VARCHAR(20),
  ADD COLUMN quality_tags JSONB DEFAULT '[]';
```

## Supported PII Types

| Type | Description | Column Pattern | Data Pattern |
|------|-------------|----------------|--------------|
| EMAIL | Email addresses | `email`, `e_mail`, `mail` | `user@domain.com` |
| PHONE | Phone numbers | `phone`, `mobile`, `telephone` | `123-456-7890` |
| SSN | Social Security Number | `ssn`, `social_security` | `123-45-6789` |
| CREDIT_CARD | Credit card numbers | `credit_card`, `cc_number` | `1234-5678-9012-3456` |
| NAME | Person names | `first_name`, `last_name`, `full_name` | Alphabetic characters |
| ADDRESS | Physical addresses | `address`, `street`, `city` | N/A |
| DOB | Date of birth | `birth_date`, `dob`, `birthday` | Date format |
| IP_ADDRESS | IP addresses | `ip_address`, `client_ip` | `192.168.1.1` |
| PASSPORT | Passport numbers | `passport`, `passport_number` | Country-specific |
| LICENSE | Driver's license | `license`, `driver_license` | Country-specific |

## Context Rules

### Metadata Tables (NOT PII)
Tables matching these patterns are considered metadata:
- Starts with: `audit_`, `log_`, `system_`, `config_`, `migration_`, `schema_`, `metadata_`
- Ends with: `_audit`, `_log`, `_history`, `_tracking`, `_metadata`
- PostgreSQL system: `pg_*`, `information_schema.*`

### Metadata Columns (NOT PII)
Columns in metadata tables matching these patterns:
- `table_name`, `column_name`, `schema_name`, `database_name`
- `object_name`, `entity_name`, `resource_name`
- `type_name`, `category_name`, `status_name`
- `created_by`, `updated_by`, `modified_by`
- `old_value`, `new_value`
- `change_type`, `operation`, `event_type`

## Usage Examples

### Example 1: Scan Table for PII

```typescript
// Backend
const piiService = new SmartPIIDetectionService(db);

const results = await piiService.batchDetectPII([
  {
    databaseName: 'adventureworks',
    schemaName: 'public',
    tableName: 'customers',
    columnName: 'email',
    dataType: 'varchar',
    sampleValues: ['user@example.com', 'test@test.com'],
  },
  {
    databaseName: 'adventureworks',
    schemaName: 'public',
    tableName: 'audit_log',
    columnName: 'table_name',
    dataType: 'varchar',
  }
]);

// Result:
// [
//   {
//     columnName: 'email',
//     isPII: true,
//     piiType: 'EMAIL',
//     confidence: 95,
//     reason: 'Column name matches EMAIL pattern and 100% of data matches'
//   },
//   {
//     columnName: 'table_name',
//     isPII: false,
//     piiType: null,
//     confidence: 85,
//     reason: 'Metadata field in system/audit table'
//   }
// ]
```

### Example 2: Manual Override

```typescript
// User marks 'user_code' as NOT PII in admin table
await piiService.storeManualClassification(
  {
    databaseName: 'myapp',
    schemaName: 'public',
    tableName: 'admin_users',
    columnName: 'user_code',
    dataType: 'varchar',
  },
  false, // isPII
  null,  // piiType
  'admin-user-123',
  'This is an internal code, not personal information'
);

// Future scans of 'user_code' in similar contexts will use this classification
```

### Example 3: Get Statistics

```typescript
const stats = await piiService.getDetectionStats(dataSourceId);

// Result:
// {
//   totalColumns: 150,
//   piiColumns: 23,
//   manualOverrides: 5,
//   topPIITypes: [
//     { piiType: 'EMAIL', count: 8 },
//     { piiType: 'PHONE', count: 5 },
//     { piiType: 'NAME', count: 10 }
//   ]
// }
```

## Integration Points

### 1. Data Quality Scan
When running quality scans, integrate PII detection:

```typescript
// In quality scan process
const piiResults = await piiService.batchDetectPII(columns);

// Update catalog_assets with PII information
await db.query(
  `UPDATE catalog_assets
   SET pii_detected = $1,
       pii_fields = $2,
       risk_level = $3
   WHERE id = $4`,
  [
    piiResults.some(r => r.isPII),
    JSON.stringify(piiResults.filter(r => r.isPII)),
    calculateRiskLevel(piiResults),
    assetId
  ]
);
```

### 2. Data Catalog UI
Display PII badges next to columns:

```tsx
{column.is_sensitive && (
  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
    PII: {column.pii_type}
  </span>
)}

<PIIClassificationControl
  {...columnProps}
  onClassified={() => refetchColumns()}
/>
```

### 3. Compliance Reporting
Generate compliance reports based on PII detection:

```sql
-- Tables with PII that need GDPR compliance
SELECT
  table_name,
  pii_fields,
  compliance_status->>'GDPR' as gdpr_status
FROM catalog_assets
WHERE pii_detected = true
  AND (compliance_status->>'GDPR' IS NULL
       OR compliance_status->>'GDPR' != 'compliant');
```

## Future Enhancements

1. **Advanced ML Model**
   - Train neural network on manual classifications
   - Analyze actual data patterns, not just column names
   - Cross-table relationship analysis

2. **Automated Remediation**
   - Suggest encryption for PII columns
   - Recommend data masking strategies
   - Auto-generate compliance documentation

3. **Real-time Monitoring**
   - Alert when new PII columns are detected
   - Track PII data movement across systems
   - Compliance drift detection

4. **Integration with Data Lineage**
   - Track PII data flow through transformations
   - Identify downstream systems with PII exposure
   - Generate data flow diagrams for compliance

## Testing

### Test the Smart Detection

```bash
# Test metadata context (should NOT be PII)
curl -X POST http://localhost:3000/api/catalog/pii/detect \
  -H "Content-Type: application/json" \
  -d '{
    "dataSourceId": "...",
    "databaseName": "adventureworks",
    "schemaName": "public",
    "tableName": "audit_log"
  }'

# Expected: table_name, column_name, etc. marked as NOT PII
```

### Test Manual Classification

```bash
# Mark a column as PII
curl -X POST http://localhost:3000/api/catalog/pii/classify \
  -H "Content-Type: application/json" \
  -d '{
    "dataSourceId": "...",
    "databaseName": "adventureworks",
    "schemaName": "public",
    "tableName": "customers",
    "columnName": "email",
    "dataType": "varchar",
    "isPII": true,
    "piiType": "EMAIL",
    "reason": "Customer email addresses",
    "userId": "test-user"
  }'

# Check training data was stored
SELECT * FROM pii_training_data
WHERE column_name = 'email'
  AND training_source = 'manual';
```

## Troubleshooting

### False Positives
If the system incorrectly marks a column as PII:
1. Use the PIIClassificationControl UI to mark it as NOT PII
2. Provide a reason so the AI can learn
3. The system will remember this for similar columns

### False Negatives
If the system misses actual PII:
1. Manually mark the column as PII
2. Select the correct PII type
3. The pattern will be learned for future scans

### Low Confidence Scores
If confidence scores are consistently low:
1. Add more manual classifications (need 3+ for ML to activate)
2. Provide sample data for pattern validation
3. Review column naming conventions for clarity

## Security Considerations

1. **No Actual PII Storage**: The training system stores column metadata, not actual PII data
2. **Hashed Samples**: If sample data is stored, it's hashed using secure algorithms
3. **Access Control**: PII classification endpoints should require appropriate permissions
4. **Audit Trail**: All manual classifications are logged with user ID and timestamp
5. **Encryption**: PII columns should be encrypted at rest and in transit

## Conclusion

The Smart PII Detection system provides:
- ✅ **Accuracy**: Context-aware analysis reduces false positives
- ✅ **Learning**: Improves over time with manual corrections
- ✅ **Transparency**: Clear confidence scores and reasoning
- ✅ **Control**: Manual overrides for edge cases
- ✅ **Compliance**: Supports GDPR, HIPAA, PCI-DSS, and other frameworks
