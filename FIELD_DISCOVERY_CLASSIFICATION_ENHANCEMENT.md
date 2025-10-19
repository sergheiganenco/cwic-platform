# Field Discovery & Classification Enhancement Plan

## Overview

This document outlines the complete enhancement plan to transform Field Discovery and Classification from mock data to real, dynamic data from your platform, with AI-powered classification capabilities.

## Current State Analysis

### Field Discovery Page ([FieldDiscovery.tsx](frontend/src/pages/FieldDiscovery.tsx))
- ❌ Uses hardcoded mock data
- ❌ Static discoveries array
- ❌ Fake drift alerts
- ❌ No real data integration

### Classification Page ([Classification.tsx](frontend/src/pages/Classification.tsx))
- ❌ Uses hardcoded policies
- ❌ Mock review queue
- ❌ Static statistics
- ❌ No real data integration

### Backend AI Service
- ✅ Has field discovery prompts ([fieldDiscovery.ts](backend/ai-service/src/prompts/fieldDiscovery.ts))
- ✅ OpenAI integration ready
- ❌ No service layer for field discovery
- ❌ No API endpoints

## Enhancement Plan

### Phase 1: Backend Services (✅ 50% COMPLETE)

#### 1.1 Field Discovery Service (✅ CREATED)
**File**: `backend/ai-service/src/services/FieldDiscoveryService.ts`

**Features Implemented**:
- ✅ Fetch real assets from data service
- ✅ Group columns by table
- ✅ AI-powered field analysis using OpenAI
- ✅ Rule-based fallback classification
- ✅ Real-time statistics calculation
- ✅ Drift detection logic
- ✅ Caching for performance

**Key Methods**:
```typescript
// Discover fields from a data source
discoverFieldsFromSource(dataSourceId, options)

// Get all discovered fields with filtering
getDiscoveredFields(filter)

// Get schema drift alerts
getDriftAlerts()

// Get statistics
getStats()
```

#### 1.2 Classification Service (TODO)
**File**: `backend/ai-service/src/services/ClassificationService.ts`

**Features Needed**:
- [ ] Manage classification policies
- [ ] Track classification coverage
- [ ] Human-in-the-loop review queue
- [ ] Bulk classification operations
- [ ] Classification history tracking
- [ ] Policy execution engine

**Suggested Structure**:
```typescript
export class ClassificationService {
  // Get all classification policies
  async getPolicies(filter?): Promise<Policy[]>

  // Create new classification policy
  async createPolicy(policy): Promise<Policy>

  // Run a classification policy
  async runPolicy(policyId): Promise<RunResult>

  // Get review queue items
  async getReviewQueue(filter?): Promise<ReviewItem[]>

  // Approve/reject classification
  async reviewClassification(itemId, decision): Promise<void>

  // Get classification statistics
  async getStats(): Promise<ClassificationStats>

  // Bulk classify assets
  async bulkClassify(assetIds, classification): Promise<void>
}
```

#### 1.3 API Controllers (TODO)

**Field Discovery Controller**:
```typescript
// backend/ai-service/src/controllers/FieldDiscoveryController.ts

export class FieldDiscoveryController {
  // POST /api/ai/field-discovery/discover
  async discoverFields(req, res)

  // GET /api/ai/field-discovery
  async getDiscoveredFields(req, res)

  // GET /api/ai/field-discovery/stats
  async getStats(req, res)

  // GET /api/ai/field-discovery/drift-alerts
  async getDriftAlerts(req, res)

  // PATCH /api/ai/field-discovery/:id/status
  async updateFieldStatus(req, res)

  // POST /api/ai/field-discovery/:id/classify
  async classifyField(req, res)
}
```

**Classification Controller**:
```typescript
// backend/ai-service/src/controllers/ClassificationController.ts

export class ClassificationController {
  // GET /api/ai/classification/policies
  async getPolicies(req, res)

  // POST /api/ai/classification/policies
  async createPolicy(req, res)

  // POST /api/ai/classification/policies/:id/run
  async runPolicy(req, res)

  // GET /api/ai/classification/review-queue
  async getReviewQueue(req, res)

  // POST /api/ai/classification/review/:id
  async reviewItem(req, res)

  // GET /api/ai/classification/stats
  async getStats(req, res)

  // POST /api/ai/classification/bulk
  async bulkClassify(req, res)
}
```

#### 1.4 API Routes (TODO)

**Field Discovery Routes**:
```typescript
// backend/ai-service/src/routes/fieldDiscovery.ts

const router = Router();
const controller = new FieldDiscoveryController();

router.use(authenticateToken);

router.post('/discover', discoveryRateLimitMw, controller.discoverFields);
router.get('/', controller.getDiscoveredFields);
router.get('/stats', controller.getStats);
router.get('/drift-alerts', controller.getDriftAlerts);
router.patch('/:id/status', controller.updateFieldStatus);
router.post('/:id/classify', controller.classifyField);

export default router;
```

**Classification Routes**:
```typescript
// backend/ai-service/src/routes/classification.ts

const router = Router();
const controller = new ClassificationController();

router.use(authenticateToken);

router.get('/policies', controller.getPolicies);
router.post('/policies', controller.createPolicy);
router.post('/policies/:id/run', controller.runPolicy);
router.get('/review-queue', controller.getReviewQueue);
router.post('/review/:id', controller.reviewItem);
router.get('/stats', controller.getStats);
router.post('/bulk', controller.bulkClassify);

export default router;
```

### Phase 2: Frontend Integration (TODO)

#### 2.1 Field Discovery API Service
**File**: `frontend/src/services/api/fieldDiscovery.ts`

```typescript
export class FieldDiscoveryService {
  async discoverFields(dataSourceId, options)
  async getDiscoveredFields(filter)
  async getStats()
  async getDriftAlerts()
  async updateFieldStatus(fieldId, status)
  async classifyField(fieldId, classification)
}
```

#### 2.2 Classification API Service
**File**: `frontend/src/services/api/classification.ts`

```typescript
export class ClassificationService {
  async getPolicies(filter)
  async createPolicy(policy)
  async runPolicy(policyId)
  async getReviewQueue(filter)
  async reviewItem(itemId, decision)
  async getStats()
  async bulkClassify(assetIds, classification)
}
```

#### 2.3 Updated Field Discovery Page
**File**: `frontend/src/pages/FieldDiscovery.tsx`

**Changes Needed**:
```typescript
import { useFieldDiscovery } from '@/hooks/useFieldDiscovery';

const FieldDiscovery: React.FC = () => {
  const {
    discoveries,
    driftAlerts,
    stats,
    loading,
    error,
    refetch,
    updateStatus,
    triggerScan
  } = useFieldDiscovery();

  // Replace mock data with real data
  // Add loading states
  // Add error handling
  // Add real-time updates
}
```

**Key Features to Add**:
- [ ] Connect to real API
- [ ] Loading skeletons
- [ ] Error handling
- [ ] Pagination
- [ ] Real-time stats
- [ ] Bulk operations
- [ ] Export functionality
- [ ] Filtering and search

#### 2.4 Updated Classification Page
**File**: `frontend/src/pages/Classification.tsx`

**Changes Needed**:
```typescript
import { useClassification } from '@/hooks/useClassification';

const Classification: React.FC = () => {
  const {
    policies,
    reviewQueue,
    stats,
    loading,
    createPolicy,
    runPolicy,
    reviewItem,
    bulkApprove
  } = useClassification();

  // Replace mock data with real data
  // Add CRUD operations for policies
  // Add review workflow
}
```

**Key Features to Add**:
- [ ] Connect to real API
- [ ] Policy CRUD operations
- [ ] Review workflow
- [ ] Bulk approval/rejection
- [ ] Policy execution tracking
- [ ] Statistics dashboard
- [ ] Export and import labels

### Phase 3: Advanced Features (TODO)

#### 3.1 Real-Time Updates
- [ ] WebSocket connections for live updates
- [ ] Real-time drift detection
- [ ] Live classification progress
- [ ] Notification system

#### 3.2 AI Enhancements
- [ ] Confidence threshold tuning
- [ ] Custom classification models
- [ ] Pattern learning from user feedback
- [ ] Automated re-classification

#### 3.3 Workflow Integration
- [ ] Approval workflows
- [ ] Role-based access control
- [ ] Audit trail
- [ ] Integration with data catalog
- [ ] Integration with quality rules

## Implementation Steps

### Step 1: Complete Backend Services (Priority: HIGH)

1. **Create Classification Service**
   ```bash
   # Create the file
   touch backend/ai-service/src/services/ClassificationService.ts
   ```

2. **Create Controllers**
   ```bash
   touch backend/ai-service/src/controllers/FieldDiscoveryController.ts
   touch backend/ai-service/src/controllers/ClassificationController.ts
   ```

3. **Create Routes**
   ```bash
   touch backend/ai-service/src/routes/fieldDiscovery.ts
   touch backend/ai-service/src/routes/classification.ts
   ```

4. **Register Routes in Main App**
   ```typescript
   // backend/ai-service/src/routes/index.ts
   import fieldDiscoveryRoutes from './fieldDiscovery';
   import classificationRoutes from './classification';

   router.use('/field-discovery', fieldDiscoveryRoutes);
   router.use('/classification', classificationRoutes);
   ```

### Step 2: Frontend API Services (Priority: HIGH)

1. **Create API Services**
   ```bash
   touch frontend/src/services/api/fieldDiscovery.ts
   touch frontend/src/services/api/classification.ts
   ```

2. **Create Custom Hooks**
   ```bash
   touch frontend/src/hooks/useFieldDiscovery.ts
   touch frontend/src/hooks/useClassification.ts
   ```

### Step 3: Update UI Components (Priority: MEDIUM)

1. **Update Field Discovery Page**
   - Replace mock data with API calls
   - Add loading states
   - Add error handling

2. **Update Classification Page**
   - Replace mock data with API calls
   - Add CRUD operations
   - Add review workflow

### Step 4: Testing (Priority: HIGH)

1. **Backend Testing**
   ```bash
   # Test field discovery
   curl -X POST http://localhost:8003/api/ai/field-discovery/discover \
     -H "Authorization: Bearer TOKEN" \
     -d '{"dataSourceId": 1}'

   # Test classification
   curl http://localhost:8003/api/ai/classification/policies
   ```

2. **Frontend Testing**
   - Manual testing in browser
   - Check console for errors
   - Verify data loads correctly

### Step 5: Optimization (Priority: LOW)

1. **Performance**
   - Add caching
   - Optimize queries
   - Lazy loading

2. **UX Improvements**
   - Add animations
   - Improve error messages
   - Add help tooltips

## Data Flow

### Field Discovery Flow

```
User clicks "Trigger Scan"
    ↓
Frontend calls POST /api/ai/field-discovery/discover
    ↓
AI Service: FieldDiscoveryService
    ↓
Fetch assets from Data Service (localhost:3002)
    ↓
Group columns by table
    ↓
For each table:
    ├─ OpenAI available?
    │   ├─ YES → AI-powered classification
    │   └─ NO → Rule-based classification
    ↓
Store results (cache/database)
    ↓
Return discovered fields to frontend
    ↓
Update UI with real data
```

### Classification Flow

```
User views Classification page
    ↓
Frontend calls GET /api/ai/classification/policies
    ↓
AI Service: ClassificationService
    ↓
Fetch policies from database
    ↓
For each policy:
    ├─ Calculate coverage
    ├─ Get outstanding reviews
    └─ Get last run time
    ↓
Return policies with stats
    ↓
Display in UI

User clicks "Run policy"
    ↓
POST /api/ai/classification/policies/:id/run
    ↓
Execute policy logic
    ├─ Match assets by criteria
    ├─ Classify matched assets
    ├─ Generate review queue items
    └─ Update statistics
    ↓
Return execution results
    ↓
Update UI
```

## Database Schema Considerations

### Field Discovery Table
```sql
CREATE TABLE discovered_fields (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id),
  field_name VARCHAR(255),
  schema_name VARCHAR(255),
  table_name VARCHAR(255),
  data_type VARCHAR(100),
  classification VARCHAR(50),
  sensitivity VARCHAR(50),
  description TEXT,
  suggested_tags TEXT[],
  suggested_rules JSONB,
  data_patterns TEXT[],
  business_context TEXT,
  confidence DECIMAL(3,2),
  status VARCHAR(50),
  detected_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(255),
  is_ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Classification Policy Table
```sql
CREATE TABLE classification_policies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sensitivity VARCHAR(50),
  owner VARCHAR(255),
  criteria JSONB,
  actions JSONB,
  coverage_percent DECIMAL(5,2),
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Review Queue Table
```sql
CREATE TABLE classification_reviews (
  id SERIAL PRIMARY KEY,
  policy_id INTEGER REFERENCES classification_policies(id),
  asset_id INTEGER REFERENCES assets(id),
  field_name VARCHAR(255),
  suggested_classification VARCHAR(50),
  suggested_sensitivity VARCHAR(50),
  confidence DECIMAL(3,2),
  reason TEXT,
  status VARCHAR(50),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  decision VARCHAR(50),
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration

### Environment Variables

```env
# AI Service
DATA_SERVICE_URL=http://localhost:3002
OPENAI_API_KEY=sk-...
ENABLE_AI_CLASSIFICATION=true
CLASSIFICATION_CONFIDENCE_THRESHOLD=0.7
```

### Feature Flags

```typescript
const features = {
  aiClassification: process.env.ENABLE_AI_CLASSIFICATION === 'true',
  realTimeUpdates: process.env.ENABLE_REALTIME_UPDATES === 'true',
  bulkOperations: process.env.ENABLE_BULK_OPERATIONS === 'true',
};
```

## API Documentation

### Field Discovery Endpoints

#### POST /api/ai/field-discovery/discover
Trigger field discovery for a data source.

**Request:**
```json
{
  "dataSourceId": 1,
  "schemas": ["public", "sales"],
  "tables": ["customers", "orders"],
  "forceRefresh": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "disc-123",
    "status": "running",
    "estimatedTime": "2 minutes"
  }
}
```

#### GET /api/ai/field-discovery
Get discovered fields with filtering.

**Query Parameters:**
- `status`: pending | accepted | needs-review | rejected
- `classification`: General | PII | PHI | Financial
- `sensitivity`: Low | Medium | High | Critical
- `search`: string
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "fields": [...],
    "total": 245
  }
}
```

### Classification Endpoints

#### GET /api/ai/classification/policies
Get all classification policies.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Customer PII Classification",
      "sensitivity": "Restricted",
      "coverage": 68,
      "outstandingReviews": 5,
      "lastRun": "2025-10-13T10:30:00Z"
    }
  ]
}
```

#### POST /api/ai/classification/policies/:id/run
Execute a classification policy.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "class-456",
    "assetsProcessed": 120,
    "classificationsApplied": 95,
    "reviewQueueItems": 25
  }
}
```

## Testing Checklist

### Backend Tests
- [ ] Field discovery service fetches real data
- [ ] AI classification works with OpenAI
- [ ] Rule-based fallback works without OpenAI
- [ ] Caching works correctly
- [ ] Statistics calculate accurately
- [ ] Drift detection identifies changes
- [ ] API endpoints respond correctly
- [ ] Error handling works

### Frontend Tests
- [ ] Pages load without errors
- [ ] API calls succeed
- [ ] Loading states display
- [ ] Error states display
- [ ] Real data displays correctly
- [ ] Filters work
- [ ] Search works
- [ ] Pagination works
- [ ] Bulk operations work
- [ ] Export works

## Success Metrics

- **Coverage**: % of fields that have been classified
- **Accuracy**: % of AI classifications that are accepted
- **Review Time**: Average time to review a classification
- **Automation Rate**: % of classifications auto-approved
- **User Adoption**: Number of users actively using the feature

## Timeline Estimate

- **Phase 1 (Backend)**: 2-3 days
- **Phase 2 (Frontend)**: 2-3 days
- **Phase 3 (Advanced)**: 1-2 weeks
- **Testing & Polish**: 2-3 days

**Total**: 1-2 weeks for basic implementation
**Total with Advanced Features**: 3-4 weeks

## Next Steps

1. ✅ Field Discovery Service created
2. ⏳ Create Classification Service
3. ⏳ Create Controllers and Routes
4. ⏳ Create Frontend API Services
5. ⏳ Update UI Components
6. ⏳ Test End-to-End
7. ⏳ Deploy and Monitor

## Resources

- **Field Discovery Service**: `backend/ai-service/src/services/FieldDiscoveryService.ts` ✅
- **AI Prompts**: `backend/ai-service/src/prompts/fieldDiscovery.ts` ✅
- **Frontend Pages**:
  - `frontend/src/pages/FieldDiscovery.tsx`
  - `frontend/src/pages/Classification.tsx`
- **Documentation**: This file

---

**Status**: Phase 1 - 50% Complete
**Last Updated**: October 13, 2025
**Next Priority**: Complete Classification Service
