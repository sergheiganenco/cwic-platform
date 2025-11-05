// backend/quality-engine/src/types/index.ts
// Type definitions for the Quality Engine

export type QualityDimension =
  | 'completeness'
  | 'accuracy'
  | 'consistency'
  | 'validity'
  | 'freshness'
  | 'uniqueness';

export type QualityStatus = 'passed' | 'failed' | 'warning' | 'error' | 'skipped';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface QualityEvent {
  id: string;
  type: 'check' | 'profile' | 'anomaly' | 'healing' | 'alert';
  assetId: string;
  ruleId?: string;
  timestamp: Date;
  source: 'scheduled' | 'manual' | 'event' | 'api';
  priority?: Priority;
  metadata?: Record<string, any>;
}

export interface QualityResult {
  id: string;
  ruleId: string;
  assetId: string;
  dimension?: QualityDimension;
  status: QualityStatus;
  score?: number;
  executionTimeMs: number;
  rowsChecked?: number;
  rowsFailed?: number;
  timestamp: Date;
  sampleFailures?: any[];
  metadata?: Record<string, any>;
}

export interface AnomalyEvent {
  id: string;
  assetId: string;
  type: 'outlier' | 'drift' | 'pattern' | 'missing' | 'duplicate';
  severity: Severity;
  confidence: number;
  description: string;
  detectedAt: Date;
  metadata?: Record<string, any>;
}

export interface HealingEvent {
  id: string;
  issueId: string;
  assetId: string;
  action: 'impute' | 'deduplicate' | 'standardize' | 'enrich' | 'rollback';
  status: 'pending' | 'executing' | 'success' | 'failed' | 'rolled_back';
  confidence: number;
  executedAt: Date;
  result?: {
    rowsAffected?: number;
    beforeScore?: number;
    afterScore?: number;
    error?: string;
  };
  metadata?: Record<string, any>;
}

export interface QualityProfile {
  assetId: string;
  profileDate: Date;
  dimensions: {
    [K in QualityDimension]: number;
  };
  statistics: {
    rowCount: number;
    columnCount: number;
    sizeBytes?: number;
    lastUpdated?: Date;
  };
  patterns: {
    piiDetected?: string[];
    enumColumns?: string[];
    relationships?: Array<{
      sourceColumn: string;
      targetTable: string;
      targetColumn: string;
      confidence: number;
    }>;
    seasonality?: Array<{
      column: string;
      period: string;
      strength: number;
    }>;
  };
  anomalies?: AnomalyEvent[];
}

export interface QualityRule {
  id: string;
  name: string;
  description?: string;
  dimension: QualityDimension;
  assetId?: string;
  expression: string;
  dialect: 'postgres' | 'mysql' | 'sqlserver' | 'generic';
  severity: Severity;
  enabled: boolean;
  schedule?: {
    type: 'cron' | 'event' | 'continuous';
    expression?: string;
    triggers?: string[];
  };
  costEstimate?: CostEstimate;
  adaptive?: {
    enabled: boolean;
    learnThresholds: boolean;
    seasonality: boolean;
  };
  metadata?: Record<string, any>;
}

export interface CostEstimate {
  ruleId: string;
  computeUnits: number;
  storageScannedGB: number;
  monetaryCost: number;
  estimatedTimeMs: number;
  confidence: number;
}

export interface ScheduledJob {
  id: string;
  ruleId: string;
  assetId: string;
  scheduledAt: Date;
  priority: Priority;
  costEstimate?: CostEstimate;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  lastError?: string;
}

export interface MLModel {
  id: string;
  type: 'isolation_forest' | 'autoencoder' | 'lstm' | 'prophet';
  assetId: string;
  dimension?: QualityDimension;
  trainedAt: Date;
  accuracy: number;
  parameters: Record<string, any>;
  features: string[];
  windowSize: number;
}

export interface Prediction {
  assetId: string;
  dimension: QualityDimension;
  horizon: number; // days
  predictions: Array<{
    date: Date;
    score: number;
    confidence: number;
    trend: 'improving' | 'stable' | 'degrading';
  }>;
  alerts: Array<{
    date: Date;
    type: 'threshold_breach' | 'anomaly' | 'trend_change';
    severity: Severity;
    message: string;
  }>;
}

export interface QualityOwnership {
  assetId: string;
  owners: string[];
  stewards: string[];
  certifications: Array<{
    level: 'bronze' | 'silver' | 'gold' | 'platinum';
    certifiedBy: string;
    certifiedAt: Date;
    expiresAt: Date;
  }>;
  sla: {
    dimensions: Partial<Record<QualityDimension, { min: number; target: number }>>;
    breachThreshold: number;
    escalationPath: string[];
  };
}

export interface QualityCheckRequest {
  assetId: string;
  ruleId?: string;
  immediate: boolean;
  source: string;
  timestamp: Date;
}

export interface TelemetryData {
  checkId: string;
  ruleId: string;
  assetId: string;
  startTime: Date;
  endTime: Date;
  executionTimeMs: number;
  resourceUsage: {
    cpuMs: number;
    memoryMb: number;
    ioOperations: number;
  };
  result: QualityResult;
  trace?: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
}