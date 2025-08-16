/* eslint-disable @typescript-eslint/consistent-type-definitions */

/**
 * ───────────────────────────────
 * Utility & Brand Types
 * ───────────────────────────────
 */
export type Brand<K, T extends string> = K & { readonly __brand: T };

export type UUID = Brand<string, 'uuid'>;               // e.g., '2f1a2c1e-...'
export type ISODateTime = Brand<string, 'iso-datetime'>; // e.g., new Date().toISOString()
export type ByteSize = Brand<number, 'bytes'>;
export type Percentage = Brand<number, '0..100'>;

export type NonEmptyArray<T> = readonly [T, ...T[]];
export type PositiveInt = Brand<number, 'positive-int'>;

/**
 * ───────────────────────────────
 * Shared Enums / Unions
 * ───────────────────────────────
 */
export type DiscoveryType = 'full' | 'incremental' | 'targeted';

export enum DiscoveryStatus {
  PENDING = 'pending',
  INITIALIZING = 'initializing',
  SCANNING_METADATA = 'scanning_metadata',
  SAMPLING_DATA = 'sampling_data',
  CLASSIFYING = 'classifying',
  AI_ANALYSIS = 'ai_analysis',
  QUALITY_ASSESSMENT = 'quality_assessment',
  GENERATING_INSIGHTS = 'generating_insights',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PatternType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  IP_ADDRESS = 'ip_address',
  UUID = 'uuid',
  DATE = 'date',
  URL = 'url',
  CUSTOM = 'custom',
}

export type ConstraintKind = 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'NOT NULL';
export type IndexMethod = 'btree' | 'hash' | 'gist' | 'gin' | 'brin' | 'spgist' | string;
export type TableLike = 'table' | 'view' | 'materialized_view';

export type DBType =
  | 'postgres'
  | 'mysql'
  | 'mariadb'
  | 'mssql'
  | 'oracle'
  | 'snowflake'
  | 'bigquery'
  | 'sqlite'
  | 'redshift'
  | string;

export type QualityDimension = 'Completeness' | 'Validity' | 'Consistency' | 'Accuracy' | 'Uniqueness';
export type DataVolume = 'Small' | 'Medium' | 'Large' | 'Very Large';
export type Criticality = 'Low' | 'Medium' | 'High' | 'Critical';
export type RiskLevel = Criticality;
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
export type Timeline = 'Immediate' | 'Short Term' | 'Long Term';

export type GovernanceCategory = 'Access Control' | 'Data Classification' | 'Retention' | 'Compliance';

export type DataClassification =
  | 'PII'
  | 'PHI'
  | 'PCI'
  | 'Confidential'
  | 'Restricted'
  | 'Internal'
  | 'Public'
  | 'Custom';

export type SensitivityLevel = 'Low' | 'Medium' | 'High' | 'Very High';

export type ComplianceFramework =
  | 'GDPR'
  | 'HIPAA'
  | 'PCI-DSS'
  | 'SOX'
  | 'CCPA'
  | 'ISO27001'
  | 'NIST'
  | 'SOC2'
  | 'Custom';

export type ClassificationScope = 'column_name' | 'data_type' | 'data_pattern';

/**
 * ───────────────────────────────
 * Request Models
 * ───────────────────────────────
 */

export interface DiscoveryOptions {
  readonly schemas?: readonly string[];
  readonly tables?: readonly string[];
  readonly includeSystemTables?: boolean;
  readonly includeSampleData?: boolean;
  readonly sampleSize?: PositiveInt; // rows per table when sampling
  readonly analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  readonly aiAnalysis?: boolean;
  readonly classificationRules?: readonly ClassificationRule[];
  readonly customPatterns?: readonly CustomPattern[];
}

/**
 * Discriminated DiscoveryRequest:
 * - full / incremental: options optional
 * - targeted: requires at least one of schemas/tables, and they cannot be empty
 */
interface BaseDiscoveryRequest {
  readonly dataSourceId: UUID | string;
  readonly userId: UUID | string;
}

export type DiscoveryRequest =
  | (BaseDiscoveryRequest & {
      readonly discoveryType: 'full';
      readonly options?: DiscoveryOptions;
    })
  | (BaseDiscoveryRequest & {
      readonly discoveryType: 'incremental';
      readonly options?: DiscoveryOptions & { readonly since?: ISODateTime };
    })
  | (BaseDiscoveryRequest & {
      readonly discoveryType: 'targeted';
      readonly options: DiscoveryOptions & {
        readonly schemas?: NonEmptyArray<string>;
        readonly tables?: NonEmptyArray<string>;
      };
    });

/**
 * ───────────────────────────────
 * Session / Results
 * ───────────────────────────────
 */

export interface DiscoverySession {
  readonly sessionId: UUID | string;
  readonly userId: UUID | string;
  readonly dataSourceId: UUID | string;
  readonly discoveryType: DiscoveryType;
  readonly status: DiscoveryStatus;
  readonly progress: Percentage; // 0..100
  readonly currentStep?: string;
  readonly results?: DiscoveryResults;
  readonly error?: string;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly estimatedCompletion?: Date;
  readonly options: DiscoveryOptions;
}

export interface DiscoveryResults {
  readonly metadata: DataSourceMetadata;
  readonly classification: ClassificationResults;
  readonly aiInsights: AIInsights;
  readonly qualityAssessment: QualityAssessment;
  readonly summary: DiscoverySummary;
  readonly recommendations: readonly DiscoveryRecommendation[];
}

/**
 * ───────────────────────────────
 * Metadata Shapes
 * ───────────────────────────────
 */

export interface DataSourceMetadata {
  readonly dataSourceId: UUID | string;
  readonly connectionInfo: ConnectionInfo;
  readonly schemas: readonly SchemaMetadata[];
  readonly totalTables: number;
  readonly totalColumns: number;
  readonly totalRows?: number;
  readonly dataSize?: ByteSize;
  readonly lastUpdated: Date;
}

export interface ConnectionInfo {
  readonly type: DBType;
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly version?: string;
  readonly charset?: string;
  readonly collation?: string;
}

export interface SchemaMetadata {
  readonly name: string;
  readonly tables: readonly TableMetadata[];
  readonly views: readonly ViewMetadata[];
  readonly procedures?: readonly ProcedureMetadata[];
  readonly functions?: readonly FunctionMetadata[];
}

export interface TableMetadata {
  readonly schema: string;
  readonly name: string;
  readonly type: TableLike;
  readonly columns: readonly ColumnMetadata[];
  readonly primaryKeys: readonly string[];
  readonly foreignKeys: readonly ForeignKeyMetadata[];
  readonly indexes: readonly IndexMetadata[];
  readonly constraints: readonly ConstraintMetadata[];
  readonly rowCount?: number;
  readonly sizeBytes?: ByteSize;
  readonly lastModified?: Date;
  readonly sampleData?: readonly unknown[];
}

export interface ColumnMetadata {
  readonly name: string;
  readonly dataType: string;
  readonly length?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly nullable: boolean;
  readonly defaultValue?: unknown;
  readonly autoIncrement?: boolean;
  readonly description?: string;
  readonly position: number;
}

export interface ViewMetadata {
  readonly schema: string;
  readonly name: string;
  readonly definition: string;
  readonly columns: readonly ColumnMetadata[];
  readonly dependencies: readonly string[];
}

export interface ProcedureMetadata {
  readonly schema: string;
  readonly name: string;
  readonly parameters: readonly ParameterMetadata[];
  readonly returnType?: string;
  readonly language?: string;
}

export interface FunctionMetadata {
  readonly schema: string;
  readonly name: string;
  readonly parameters: readonly ParameterMetadata[];
  readonly returnType: string;
  readonly language?: string;
}

export interface ParameterMetadata {
  readonly name: string;
  readonly dataType: string;
  readonly direction: 'IN' | 'OUT' | 'INOUT';
  readonly defaultValue?: unknown;
}

export interface ForeignKeyMetadata {
  readonly name: string;
  readonly columns: readonly string[];
  readonly referencedTable: string; // consider "schema.table"
  readonly referencedColumns: readonly string[];
  readonly onDelete?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | string;
  readonly onUpdate?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | string;
}

export interface IndexMetadata {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
  readonly type?: string;   // btree, hash... (engine-specific)
  readonly method?: IndexMethod;
}

export interface ConstraintMetadata {
  readonly name: string;
  readonly type: ConstraintKind;
  readonly columns: readonly string[];
  readonly definition?: string;
}

/**
 * ───────────────────────────────
 * Classification / Compliance
 * ───────────────────────────────
 */

export interface ClassificationResults {
  readonly fieldClassifications: readonly FieldClassification[];
  readonly tableClassifications: readonly TableClassification[];
  readonly sensitivityMap: SensitivityMap;
  readonly complianceMapping: ComplianceMapping;
  readonly riskAssessment: DataRiskAssessment;
}

export interface FieldClassification {
  readonly schema: string;
  readonly table: string;
  readonly column: string;
  readonly dataType: string;
  readonly classification: DataClassification;
  readonly sensitivity: SensitivityLevel;
  readonly confidence: Percentage;
  readonly patterns: readonly DetectedPattern[];
  readonly tags: readonly string[];
  readonly businessContext?: string;
  readonly complianceFlags: readonly ComplianceFlag[];
}

export interface TableClassification {
  readonly schema: string;
  readonly table: string;
  readonly overallClassification: DataClassification;
  readonly overallSensitivity: SensitivityLevel;
  readonly dataVolume: DataVolume;
  readonly businessCriticality: Criticality;
  readonly accessFrequency: 'Rare' | 'Occasional' | 'Regular' | 'High';
  readonly retentionCategory: string;
  readonly complianceScope: readonly ComplianceFramework[];
}

export interface DetectedPattern {
  readonly type: PatternType;
  readonly pattern: string; // e.g., regex or named rule
  readonly confidence: Percentage;
  readonly examples: readonly string[];
  readonly description: string;
}

export interface SensitivityMap {
  readonly bySensitivity: Record<SensitivityLevel, readonly FieldClassification[]>;
  readonly byClassification: Record<DataClassification, readonly FieldClassification[]>;
  readonly sensitiveTableCount: number;
  readonly highRiskFields: readonly FieldClassification[];
}

export interface ComplianceMapping {
  readonly byFramework: Record<ComplianceFramework, ComplianceScope>;
  readonly overallComplexity: 'Low' | 'Medium' | 'High' | 'Very High';
  readonly requiredActions: readonly ComplianceAction[];
}

export interface ComplianceScope {
  readonly applicableTables: readonly string[]; // consider using "schema.table" naming
  readonly applicableFields: readonly FieldClassification[];
  readonly requirements: readonly string[];
  readonly riskLevel: RiskLevel;
}

export interface ComplianceAction {
  readonly framework: ComplianceFramework;
  readonly action: string;
  readonly priority: 'High' | 'Medium' | 'Low';
  readonly timeline: string;
  readonly effort: 'Low' | 'Medium' | 'High';
}

export interface ComplianceFlag {
  readonly framework: ComplianceFramework;
  readonly requirement: string;
  readonly severity: 'Info' | 'Warning' | 'Error';
  readonly description: string;
}

/**
 * ───────────────────────────────
 * Risk / Quality / AI Insights
 * ───────────────────────────────
 */

export interface DataRiskAssessment {
  readonly overallRisk: RiskLevel;
  readonly riskFactors: readonly DataRiskFactor[];
  readonly mitigationPriorities: readonly string[];
  readonly businessImpact: BusinessImpact;
}

export interface DataRiskFactor {
  readonly factor: string;
  readonly level: RiskLevel;
  readonly description: string;
  readonly affectedTables: readonly string[];
  readonly mitigationStrategy: string;
}

export interface BusinessImpact {
  readonly reputational: RiskLevel;
  readonly financial: RiskLevel;
  readonly operational: RiskLevel;
  readonly regulatory: RiskLevel;
}

export interface AIInsights {
  readonly fieldRecommendations: readonly AIFieldRecommendation[];
  readonly schemaInsights: readonly SchemaInsight[];
  readonly qualityPredictions: readonly QualityPrediction[];
  readonly governanceRecommendations: readonly GovernanceRecommendation[];
  readonly anomalies: readonly DataAnomaly[];
}

export interface AIFieldRecommendation {
  readonly schema: string;
  readonly table: string;
  readonly column: string;
  readonly recommendation: string;
  readonly reasoning: string;
  readonly confidence: Percentage;
  readonly impact: 'Low' | 'Medium' | 'High';
  readonly category: 'Classification' | 'Quality' | 'Governance' | 'Security';
}

export interface SchemaInsight {
  readonly type: 'Pattern' | 'Relationship' | 'Optimization' | 'Risk';
  readonly insight: string;
  readonly confidence: Percentage;
  readonly tables: readonly string[];
  readonly recommendation: string;
  readonly priority: 'Low' | 'Medium' | 'High';
}

export interface QualityPrediction {
  readonly table: string;
  readonly column?: string;
  readonly qualityDimension: QualityDimension;
  readonly predictedScore: Percentage; // 0..100
  readonly confidence: Percentage;     // 0..100
  readonly factors: readonly string[];
  readonly recommendations: readonly string[];
}

export interface GovernanceRecommendation {
  readonly scope: 'Field' | 'Table' | 'Schema' | 'Database';
  readonly target: string; // e.g., "schema.table.column"
  readonly recommendation: string;
  readonly category: GovernanceCategory;
  readonly priority: 'High' | 'Medium' | 'Low';
  readonly effort: 'Low' | 'Medium' | 'High';
  readonly benefit: string;
}

export interface DataAnomaly {
  readonly type: 'Statistical' | 'Pattern' | 'Relationship' | 'Quality';
  readonly table: string;
  readonly column?: string;
  readonly description: string;
  readonly severity: 'Info' | 'Warning' | 'Error';
  readonly confidence: Percentage;
  readonly suggestion: string;
}

export interface QualityAssessment {
  readonly overallScore: Percentage;
  readonly tableScores: readonly TableQualityScore[];
  readonly dimensionScores: QualityDimensionScores;
  readonly issues: readonly QualityIssue[];
  readonly trends?: readonly QualityTrend[];
}

export interface TableQualityScore {
  readonly schema: string;
  readonly table: string;
  readonly overallScore: Percentage;
  readonly completeness: Percentage;
  readonly validity: Percentage;
  readonly consistency: Percentage;
  readonly accuracy: Percentage;
  readonly uniqueness: Percentage;
  readonly issueCount: number;
  readonly recommendation: string;
}

export interface QualityDimensionScores {
  readonly [dimension: string]: Percentage | number; // allow dynamic dimensions
}

export interface QualityIssue {
  readonly id?: UUID | string;
  readonly schema: string;
  readonly table: string;
  readonly column?: string;
  readonly dimension: QualityDimension;
  readonly severity: 'Low' | 'Medium' | 'High';
  readonly description: string;
  readonly recommendation: string;
}

export interface QualityTrend {
  readonly timestamp: ISODateTime | string;
  readonly dimension: QualityDimension;
  readonly score: Percentage;
}

export interface DiscoverySummary {
  readonly totalTablesAnalyzed: number;
  readonly totalColumnsAnalyzed: number;
  readonly classificationsApplied: number;
  readonly sensitiveDataFound: number;
  readonly complianceFlags: number;
  readonly qualityIssues: number;
  readonly aiRecommendations: number;
  readonly executionTime: number; // ms
  readonly dataVolumeProcessed: ByteSize | number;
}

export interface DiscoveryRecommendation {
  readonly id: UUID | string;
  readonly category: Timeline;
  readonly priority: Priority;
  readonly type: 'Security' | 'Compliance' | 'Quality' | 'Governance' | 'Performance';
  readonly title: string;
  readonly description: string;
  readonly affectedTables: readonly string[];
  readonly businessImpact: string;
  readonly effort: 'Low' | 'Medium' | 'High';
  readonly timeline: string;
  readonly implementation: readonly ImplementationStep[];
}

export interface ImplementationStep {
  readonly step: number;
  readonly description: string;
  readonly estimatedTime: string;
  readonly dependencies?: readonly string[];
  readonly tools?: readonly string[];
}

export interface ClassificationRule {
  readonly name: string;
  readonly pattern: string; // regex or named rule
  readonly classification: DataClassification;
  readonly sensitivity: SensitivityLevel;
  readonly scope: ClassificationScope;
  readonly priority: number;
}

export interface CustomPattern {
  readonly name: string;
  readonly regex: string; // serialized regex
  readonly classification: DataClassification;
  readonly description: string;
  readonly examples: readonly string[];
}
