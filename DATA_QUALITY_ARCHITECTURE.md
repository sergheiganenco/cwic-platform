# CWIC Data Quality Architecture - Modern Implementation

## Overview
Complete redesign of Data Quality system based on industry best practices from Monte Carlo, Soda, Great Expectations, and Microsoft Purview.

## Core Principles

### 6 Data Quality Dimensions (Industry Standard)
1. **Completeness** - Null rates, missing values, required fields
2. **Accuracy** - Data correctness, outlier detection, range validation
3. **Consistency** - Referential integrity, cross-table validation
4. **Validity** - Format compliance, type checking, regex patterns
5. **Freshness** - Data recency, staleness alerts, update frequency
6. **Uniqueness** - Duplicate detection, primary key validation

### AI-Powered Capabilities
- **Auto-Profiling**: Automatically analyze data sources and suggest quality rules
- **Anomaly Detection**: ML-based detection of unusual patterns
- **Smart Thresholds**: Learn normal data patterns and auto-adjust thresholds
- **Natural Language**: Create rules using AI from plain English descriptions
- **Root Cause Analysis**: AI-powered investigation of quality issues

## System Architecture

### Backend Services

#### 1. Data Profiling Service (`backend/data-service/src/services/ProfilingService.ts`)
```typescript
class ProfilingService {
  // Auto-profile a data source
  async profileDataSource(dataSourceId: string): Promise<ProfileReport>

  // Profile specific table/asset
  async profileAsset(assetId: string): Promise<AssetProfile>

  // Suggest quality rules based on profiling
  async suggestRules(assetId: string): Promise<RuleSuggestion[]>
}

interface AssetProfile {
  assetId: string
  rowCount: number
  columns: ColumnProfile[]
  inferredRules: InferredRule[]
  dataQualityScore: number
}

interface ColumnProfile {
  name: string
  dataType: string
  nullRate: number
  uniqueRate: number
  min?: any
  max?: any
  avg?: number
  stdDev?: number
  topValues: Array<{ value: any; count: number }>
  anomalies: string[]
}
```

#### 2. Quality Rule Engine (`backend/data-service/src/services/QualityRuleEngine.ts`)
```typescript
class QualityRuleEngine {
  // Execute rule against data
  async executeRule(rule: QualityRule, context: ExecutionContext): Promise<RuleResult>

  // Bulk execute rules for a data source
  async scanDataSource(dataSourceId: string, ruleIds?: string[]): Promise<ScanResult>

  // Schedule recurring scans
  async scheduleRecurringScan(config: ScanSchedule): Promise<void>
}

interface QualityRule {
  id: string
  name: string
  dimension: 'completeness' | 'accuracy' | 'consistency' | 'validity' | 'freshness' | 'uniqueness'
  severity: 'low' | 'medium' | 'high' | 'critical'
  assetId: string
  columnName?: string
  ruleType: 'threshold' | 'sql' | 'ai_anomaly' | 'pattern'
  config: RuleConfig
  enabled: boolean
}
```

#### 3. AI Service Integration (`backend/ai-service/src/services/DataQualityAI.ts`)
```typescript
class DataQualityAI {
  // Generate quality rules from natural language
  async generateRuleFromText(prompt: string, context: AssetContext): Promise<QualityRule>

  // Detect anomalies using ML
  async detectAnomalies(data: TimeSeriesData, config: AnomalyConfig): Promise<Anomaly[]>

  // Explain quality issue
  async explainIssue(violation: Violation): Promise<string>

  // Suggest remediation
  async suggestRemediation(violation: Violation): Promise<RemediationPlan>
}
```

### Database Schema Updates

#### New Tables
```sql
-- Enhanced quality rules table
CREATE TABLE quality_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  dimension VARCHAR(50) NOT NULL CHECK (dimension IN ('completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  asset_id UUID REFERENCES catalog_assets(id),
  data_source_id UUID REFERENCES data_sources(id),
  column_name VARCHAR(255),
  rule_type VARCHAR(50) NOT NULL,
  rule_config JSONB NOT NULL,
  threshold_config JSONB,
  enabled BOOLEAN DEFAULT true,
  auto_generated BOOLEAN DEFAULT false,
  ml_model_id VARCHAR(255),
  schedule_cron VARCHAR(100),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Data profiling results
CREATE TABLE data_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES catalog_assets(id),
  profile_date TIMESTAMP DEFAULT now(),
  row_count BIGINT,
  column_count INT,
  profile_data JSONB NOT NULL,
  quality_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT now()
);

-- Enhanced quality results with detailed metrics
CREATE TABLE quality_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES quality_rules(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES catalog_assets(id),
  data_source_id UUID REFERENCES data_sources(id),
  run_at TIMESTAMP DEFAULT now(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed', 'warning', 'error', 'timeout')),
  metric_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  rows_checked BIGINT,
  rows_failed BIGINT,
  execution_time_ms INTEGER,
  error_message TEXT,
  sample_failures JSONB,
  anomaly_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT now()
);

-- Quality issues (violations with context)
CREATE TABLE quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID REFERENCES quality_results(id),
  rule_id UUID REFERENCES quality_rules(id),
  asset_id UUID REFERENCES catalog_assets(id),
  severity VARCHAR(20),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'false_positive')),
  title VARCHAR(500),
  description TEXT,
  impact_score INT,
  affected_rows BIGINT,
  sample_data JSONB,
  root_cause TEXT,
  remediation_plan TEXT,
  assigned_to VARCHAR(255),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Scan schedules
CREATE TABLE quality_scan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  data_source_id UUID REFERENCES data_sources(id),
  rule_ids UUID[],
  cron_expression VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

## Frontend Architecture

### Page Structure
```
DataQuality/
├── Overview (Quality Score + Dimension Breakdown)
├── Assets (Profiled assets with quality scores)
├── Rules (Create/manage rules with AI assist)
├── Violations (Drill-through issues with remediation)
├── Trends (Historical quality metrics)
└── Settings (Scan schedules, thresholds)
```

### Key Features

#### 1. Auto-Profiling Dashboard
- One-click scan of data sources
- Visual data profiling results
- Auto-generated rule suggestions
- Quality score per asset

#### 2. Smart Rule Builder
- Template library by dimension
- AI-powered rule generation from text
- Visual rule builder
- Test before save

#### 3. Violation Management
- Drill-through to affected rows
- AI-powered root cause analysis
- Remediation suggestions
- Issue tracking workflow

#### 4. Trends & Analytics
- Quality score over time
- Dimension breakdown
- Data source comparison
- Anomaly timeline

## Implementation Plan

### Phase 1: Core Infrastructure
1. Database migrations for new tables
2. ProfilingService implementation
3. Enhanced QualityService with 6 dimensions
4. Basic rule execution engine

### Phase 2: AI Integration
1. AI-powered profiling
2. Anomaly detection models
3. Natural language rule creation
4. Root cause analysis

### Phase 3: Frontend Rebuild
1. Remove duplicate cards
2. Asset profiling UI
3. Smart rule builder
4. Violation drill-through
5. Trends visualization

### Phase 4: Automation
1. Scheduled scans
2. Auto-remediation (optional)
3. Alert system
4. Quality gates for pipelines

## Success Metrics
- Quality rules coverage: Target 80% of critical assets
- Auto-detection rate: >90% of anomalies caught
- False positive rate: <5%
- Mean time to resolution: <24 hours
- Quality score improvement: Track trend over time
