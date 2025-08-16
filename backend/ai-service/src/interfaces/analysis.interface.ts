export interface AnalysisRequest {
  dataSourceId: string;
  analysisType: 'schema' | 'data_quality' | 'compliance' | 'performance';
  options?: AnalysisOptions;
  userId: string;
}

export interface AnalysisOptions {
  includeMetadata?: boolean;
  includeSampleData?: boolean;
  sampleSize?: number;
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  targetTables?: string[];
  targetSchemas?: string[];
  complianceFrameworks?: ComplianceFramework[];
}

export interface AnalysisResult {
  analysisId: string;
  dataSourceId: string;
  analysisType: string;
  status: AnalysisStatus;
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  results?: AnalysisData;
  error?: string;
  userId: string;
}

export interface AnalysisData {
  schemaAnalysis?: SchemaAnalysisResult;
  qualityAnalysis?: QualityAnalysisResult;
  complianceAnalysis?: ComplianceAnalysisResult;
  performanceAnalysis?: PerformanceAnalysisResult;
  summary: AnalysisSummary;
}

export interface SchemaAnalysisResult {
  totalTables: number;
  totalColumns: number;
  tableAnalysis: TableAnalysis[];
  relationshipMap: RelationshipAnalysis[];
  dataClassification: DataClassificationSummary;
  recommendations: string[];
}

export interface TableAnalysis {
  schemaName: string;
  tableName: string;
  columnCount: number;
  estimatedRowCount?: number;
  columns: ColumnAnalysis[];
  governance: TableGovernance;
  dataQuality: TableQualityMetrics;
  relationships: TableRelationship[];
}

export interface ColumnAnalysis {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  classification: DataClassification;
  sensitivity: SensitivityLevel;
  qualityScore: number;
  patterns: DataPattern[];
  statistics?: ColumnStatistics;
  recommendations: string[];
}

export interface TableGovernance {
  classification: DataClassification;
  sensitivity: SensitivityLevel;
  complianceRequirements: ComplianceFramework[];
  accessLevel: AccessLevel;
  retentionPolicy?: RetentionPolicy;
  encryptionRequired: boolean;
  auditRequired: boolean;
}

export interface TableQualityMetrics {
  completeness: number;
  validity: number;
  consistency: number;
  accuracy: number;
  uniqueness: number;
  overallScore: number;
  issues: QualityIssue[];
}

export interface QualityAnalysisResult {
  overallScore: number;
  dimensionScores: QualityDimensionScores;
  issues: QualityIssue[];
  trends: QualityTrend[];
  recommendations: QualityRecommendation[];
}

export interface QualityDimensionScores {
  completeness: number;
  validity: number;
  consistency: number;
  accuracy: number;
  uniqueness: number;
  timeliness: number;
}

export interface QualityIssue {
  id: string;
  type: QualityIssueType;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  table: string;
  column?: string;
  description: string;
  affectedRows: number;
  suggestion: string;
  detectedAt: Date;
  status: 'Open' | 'Acknowledged' | 'Resolved' | 'Ignored';
}

export interface ComplianceAnalysisResult {
  overallScore: number;
  frameworkResults: FrameworkComplianceResult[];
  violations: ComplianceViolation[];
  recommendations: ComplianceRecommendation[];
  riskAssessment: RiskAssessment;
}

export interface FrameworkComplianceResult {
  framework: ComplianceFramework;
  score: number;
  status: 'Compliant' | 'Partially Compliant' | 'Non-Compliant';
  requirements: RequirementResult[];
  lastAssessed: Date;
}

export interface PerformanceAnalysisResult {
  queryPerformance: QueryPerformanceMetrics;
  indexAnalysis: IndexAnalysis[];
  storageAnalysis: StorageMetrics;
  recommendations: PerformanceRecommendation[];
}

export interface AnalysisSummary {
  totalTables: number;
  totalColumns: number;
  sensitiveDataTables: number;
  qualityScore: number;
  complianceScore: number;
  criticalIssues: number;
  highPriorityRecommendations: string[];
  estimatedImprovementEffort: 'Low' | 'Medium' | 'High';
}

// Supporting Enums and Types
export enum AnalysisStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum DataClassification {
  PUBLIC = 'Public',
  INTERNAL = 'Internal',
  CONFIDENTIAL = 'Confidential',
  RESTRICTED = 'Restricted',
  PII = 'PII',
  PHI = 'PHI',
  FINANCIAL = 'Financial'
}

export enum SensitivityLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum ComplianceFramework {
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  CCPA = 'CCPA',
  SOX = 'SOX',
  PCI_DSS = 'PCI-DSS',
  ISO_27001 = 'ISO-27001',
  NIST = 'NIST'
}

export enum AccessLevel {
  PUBLIC = 'Public',
  INTERNAL = 'Internal',
  RESTRICTED = 'Restricted',
  CONFIDENTIAL = 'Confidential'
}

export enum QualityIssueType {
  NULL_VALUES = 'null_values',
  DUPLICATES = 'duplicates',
  FORMAT_INCONSISTENCY = 'format_inconsistency',
  OUTLIERS = 'outliers',
  REFERENTIAL_INTEGRITY = 'referential_integrity',
  BUSINESS_RULE_VIOLATION = 'business_rule_violation'
}

// Supporting Interfaces
export interface DataPattern {
  type: string;
  pattern: string;
  confidence: number;
  examples: string[];
}

export interface ColumnStatistics {
  nullCount: number;
  uniqueCount: number;
  minValue?: any;
  maxValue?: any;
  avgValue?: number;
  standardDeviation?: number;
  distribution?: ValueDistribution[];
}

export interface ValueDistribution {
  value: any;
  count: number;
  percentage: number;
}

export interface RelationshipAnalysis {
  sourceTable: string;
  targetTable: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many';
  foreignKeys: ForeignKeyRelation[];
  strength: number;
}

export interface ForeignKeyRelation {
  sourceColumn: string;
  targetColumn: string;
  constraintName?: string;
}

export interface TableRelationship {
  relatedTable: string;
  relationshipType: string;
  foreignKeyColumns: string[];
  isStrong: boolean;
}

export interface DataClassificationSummary {
  byClassification: Record<DataClassification, number>;
  bySensitivity: Record<SensitivityLevel, number>;
  byCompliance: Record<ComplianceFramework, number>;
  totalSensitiveFields: number;
}

export interface RetentionPolicy {
  retentionPeriod: number;
  retentionUnit: 'days' | 'months' | 'years';
  archiveAfter?: number;
  deleteAfter?: number;
  policy: string;
}

export interface QualityTrend {
  date: Date;
  dimension: string;
  score: number;
  change: number;
}

export interface QualityRecommendation {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  category: 'Data Quality' | 'Governance' | 'Compliance' | 'Performance';
  title: string;
  description: string;
  impact: string;
  effort: 'Low' | 'Medium' | 'High';
  estimatedImprovement: number;
  implementation: string[];
}

export interface ComplianceViolation {
  id: string;
  framework: ComplianceFramework;
  requirement: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  table: string;
  column?: string;
  description: string;
  remediation: string;
  dueDate?: Date;
  status: 'Open' | 'In Progress' | 'Resolved';
}

export interface ComplianceRecommendation {
  framework: ComplianceFramework;
  requirement: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  implementation: string[];
  timeline: string;
}

export interface RiskAssessment {
  overallRisk: 'Low' | 'Medium' | 'High' | 'Critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  businessImpact: string;
}

export interface RiskFactor {
  factor: string;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  likelihood: number;
  impact: number;
}

export interface RequirementResult {
  requirement: string;
  status: 'Met' | 'Partially Met' | 'Not Met';
  description: string;
  evidence?: string[];
  gaps?: string[];
}

export interface QueryPerformanceMetrics {
  avgQueryTime: number;
  slowQueries: SlowQuery[];
  queryPatterns: QueryPattern[];
  resourceUtilization: ResourceUtilization;
}

export interface SlowQuery {
  query: string;
  executionTime: number;
  frequency: number;
  table: string;
  recommendation: string;
}

export interface QueryPattern {
  pattern: string;
  frequency: number;
  avgExecutionTime: number;
  optimization: string;
}

export interface ResourceUtilization {
  cpuUsage: number;
  memoryUsage: number;
  ioWait: number;
  connectionCount: number;
}

export interface IndexAnalysis {
  table: string;
  existingIndexes: IndexInfo[];
  suggestedIndexes: SuggestedIndex[];
  unusedIndexes: string[];
}

export interface IndexInfo {
  name: string;
  columns: string[];
  type: string;
  size: number;
  usage: number;
}

export interface SuggestedIndex {
  columns: string[];
  type: string;
  rationale: string;
  estimatedImprovement: number;
}

export interface StorageMetrics {
  totalSize: number;
  tablesSizes: TableSize[];
  growthRate: number;
  projectedSize: number;
  optimization: string[];
}

export interface TableSize {
  table: string;
  size: number;
  rowCount: number;
  avgRowSize: number;
}

export interface PerformanceRecommendation {
  type: 'Index' | 'Query' | 'Schema' | 'Configuration';
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  effort: 'Low' | 'Medium' | 'High';
  implementation: string;
}