import { db } from '@/config/database';
import { redis } from '@/config/redis';
import { DiscoveryStatus, JobPriority, JobStatus } from '@/interfaces';
import { APIError } from '@/utils/errors';
import { logger } from '@/utils/logger';

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

type DiscoveryKind = 'full' | 'incremental' | 'targeted';

export interface DiscoveryJobData {
  sessionId: string;
  userId: string;
  dataSourceId: string;
  discoveryType: DiscoveryKind;
  options?: DiscoveryOptions;
  priority: JobPriority;
  retryCount?: number;
  maxRetries?: number;
}

export interface DiscoveryJobResult {
  sessionId: string;
  status: JobStatus;
  result?: DiscoveryResults;
  error?: string;
  duration: number;
  completedAt: Date;
}

/** Tighten options you actually use */
export interface DiscoveryOptions {
  includeSampleData?: boolean;
  sampleSize?: number;
  aiAnalysis?: boolean; // default true
  schemas?: string[];
  tables?: string[];
}

/** Minimal result shape; swap with your domain interfaces if you prefer */
export interface DiscoveryResults {
  metadata: any;         // replace with Discovery.DataSourceMetadata if wired
  classification: any;   // replace with Discovery.ClassificationResults
  aiInsights?: any;      // replace with Discovery.AIInsights
  summary: any;          // replace with Discovery.DiscoverySummary
}

/* ──────────────────────────────────────────────────────────────────────────
 * Config & Keys
 * ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60_000;
const REDIS_STATUS_TTL_SEC = 300;

const STATUS_KEY = (sessionId: string) => `discovery:status:${sessionId}`;
const CANCEL_KEY = (sessionId: string) => `discovery:cancel:${sessionId}`;

/* ──────────────────────────────────────────────────────────────────────────
 * Utils
 * ────────────────────────────────────────────────────────────────────────── */

const backoffWithJitter = (attempt: number) => {
  const exp = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
  const jitter = Math.floor(Math.random() * Math.min(1000, exp * 0.1));
  return exp + jitter;
};

const safeLogSize = (val: unknown, max = 4096) => {
  try {
    const s = JSON.stringify(val);
    return s.length <= max ? s : s.slice(0, max) + `… (truncated ${s.length - max} chars)`;
  } catch {
    return '[unserializable]';
  }
};

const isTransientError = (err: unknown): boolean => {
  const msg = (err as any)?.message?.toLowerCase?.() || '';
  const code = (err as any)?.code || '';
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    msg.includes('timeout') ||
    msg.includes('connection') ||
    msg.includes('deadlock') ||
    msg.includes('too many connections') ||
    msg.includes('rate limit') ||
    msg.includes('temporarily') ||
    msg.includes('try again')
  );
};

/** Parameterized UPDATE builder to avoid index mistakes */
const buildUpdateQuery = (table: string, whereClause: string, whereParams: unknown[], data: Record<string, unknown>) => {
  const keys = Object.keys(data);
  const setFragments = keys.map((k, i) => `${k} = $${i + whereParams.length + 1}`);
  const values = [...whereParams, ...keys.map(k => data[k])];
  const text = `UPDATE ${table} SET ${setFragments.join(', ')} ${whereClause}`;
  return { text, values };
};

/* ──────────────────────────────────────────────────────────────────────────
 * Job
 * ────────────────────────────────────────────────────────────────────────── */

export class DiscoveryJob {
  private maxRetries = DEFAULT_MAX_RETRIES;

  constructor() {}

  public async execute(data: DiscoveryJobData): Promise<DiscoveryJobResult> {
    const started = Date.now();
    const { sessionId, userId, dataSourceId, discoveryType, options } = data;

    try {
      logger.info('Discovery job: start', {
        sessionId, userId, dataSourceId, discoveryType, priority: data.priority, retryCount: data.retryCount ?? 0,
      });

      await this.updateJobStatus(sessionId, DiscoveryStatus.INITIALIZING, 0);

      await this.validateJobData(data);

      // Respect cancellation early
      if (await this.isCancelled(sessionId)) {
        throw new APIError('Job cancelled', 499);
      }

      const result = await this.executeDiscoveryPhases(data);

      await this.updateJobStatus(sessionId, DiscoveryStatus.COMPLETED, 100, result);

      await this.sendCompletionNotification(userId, sessionId, discoveryType, true);

      const duration = Date.now() - started;
      logger.info('Discovery job: completed', {
        sessionId,
        durationMs: duration,
        resultPreview: safeLogSize({
          summary: result?.summary,
          metadata: { totalTables: result?.metadata?.totalTables, totalColumns: result?.metadata?.totalColumns },
        })
      });

      return {
        sessionId,
        status: JobStatus.COMPLETED,
        result,
        duration,
        completedAt: new Date(),
      };
    } catch (err: any) {
      const duration = Date.now() - started;
      logger.error('Discovery job: failed', {
        sessionId,
        durationMs: duration,
        error: err?.message,
        retryCount: data.retryCount ?? 0,
      });

      if (await this.shouldRetryJob(data, err)) {
        return this.scheduleRetry(data);
      }

      await this.updateJobStatus(sessionId, DiscoveryStatus.FAILED, 0, undefined, err?.message);
      await this.sendCompletionNotification(userId, sessionId, discoveryType, false, err?.message);

      return {
        sessionId,
        status: JobStatus.FAILED,
        error: err?.message ?? 'failed',
        duration,
        completedAt: new Date(),
      };
    }
  }

  /* ────────────────────────── Phases ────────────────────────── */

  private async executeDiscoveryPhases(data: DiscoveryJobData): Promise<DiscoveryResults> {
    const { sessionId, dataSourceId, options } = data;
    let progress = 0;

    try {
      // Phase 1: metadata
      await this.updateJobStatus(sessionId, DiscoveryStatus.SCANNING_METADATA, 10);
      const metadata = await this.scanMetadata(dataSourceId, options);
      progress = 20;
      await this.updateJobStatus(sessionId, DiscoveryStatus.SCANNING_METADATA, progress);

      // Phase 2: sampling
      if (options?.includeSampleData) {
        await this.updateJobStatus(sessionId, DiscoveryStatus.SAMPLING_DATA, progress);
        const sampleData = await this.sampleData(dataSourceId, metadata, options);
        (metadata as any).sampleData = sampleData;
        progress = 40;
        await this.updateJobStatus(sessionId, DiscoveryStatus.SAMPLING_DATA, progress);
      }

      // Phase 3: classification
      await this.updateJobStatus(sessionId, DiscoveryStatus.CLASSIFYING, progress);
      const classification = await this.classifyData(metadata, options);
      progress = 60;
      await this.updateJobStatus(sessionId, DiscoveryStatus.CLASSIFYING, progress);

      // Phase 4: AI analysis (default on)
      let aiInsights: unknown | undefined;
      if (options?.aiAnalysis !== false) {
        await this.updateJobStatus(sessionId, DiscoveryStatus.AI_ANALYSIS, progress);
        aiInsights = await this.performAIAnalysis(metadata, classification);
        progress = 80;
        await this.updateJobStatus(sessionId, DiscoveryStatus.AI_ANALYSIS, progress);
      }

      const summary = this.generateSummary(metadata, classification, aiInsights);

      return { metadata, classification, aiInsights, summary };
    } catch (err) {
      logger.error('Discovery phases: error', { sessionId, progress, error: (err as any)?.message });
      throw err;
    }
  }

  /* ────────────────────────── Implementations (mocked) ────────────────────────── */

  private async scanMetadata(dataSourceId: string, _options?: DiscoveryOptions): Promise<any> {
    void _options;
    const dataSource = await this.getDataSource(dataSourceId);
    if (!dataSource) throw new APIError('Data source not found', 404);

    // Replace this mock with real extractor when ready
    const metadata = {
      dataSourceId,
      connectionInfo: {
        type: (dataSource as any).type,
        host: (dataSource as any).connectionConfig?.host,
        database: (dataSource as any).connectionConfig?.database,
        version: '14.5',
      },
      schemas: [
        {
          name: 'public',
          tables: [
            {
              schema: 'public',
              name: 'users',
              type: 'table',
              columns: [
                { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
                { name: 'email', dataType: 'varchar', nullable: false },
                { name: 'first_name', dataType: 'varchar', nullable: true },
                { name: 'last_name', dataType: 'varchar', nullable: true },
                { name: 'phone', dataType: 'varchar', nullable: true },
                { name: 'date_of_birth', dataType: 'date', nullable: true },
                { name: 'created_at', dataType: 'timestamp', nullable: false },
              ],
              primaryKeys: ['id'],
              foreignKeys: [],
              indexes: [
                { name: 'users_pkey', columns: ['id'], unique: true },
                { name: 'users_email_idx', columns: ['email'], unique: true },
              ],
              rowCount: 15_000,
              sizeBytes: 2_048_000,
            },
            {
              schema: 'public',
              name: 'orders',
              type: 'table',
              columns: [
                { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
                { name: 'user_id', dataType: 'integer', nullable: false, isForeignKey: true },
                { name: 'total_amount', dataType: 'decimal', nullable: false },
                { name: 'status', dataType: 'varchar', nullable: false },
                { name: 'created_at', dataType: 'timestamp', nullable: false },
              ],
              primaryKeys: ['id'],
              foreignKeys: [
                { name: 'fk_orders_user', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
              ],
              indexes: [
                { name: 'orders_pkey', columns: ['id'], unique: true },
                { name: 'orders_user_id_idx', columns: ['user_id'], unique: false },
              ],
              rowCount: 45_000,
              sizeBytes: 3_072_000,
            },
          ],
          views: [],
          procedures: [],
        },
      ],
      totalTables: 2,
      totalColumns: 12,
      totalRows: 60_000,
      dataSize: 5_120_000,
      lastUpdated: new Date(),
    };

    return metadata;
  }

  private async sampleData(_dataSourceId: string, _metadata: any, options?: DiscoveryOptions): Promise<any> {
    void _metadata;
    const size = Math.max(1, Math.min(options?.sampleSize ?? 100, 10_000));
    void size; // for now
    return {
      'public.users': [
        { id: 1, email: 'john.doe@example.com', first_name: 'John', last_name: 'Doe', phone: '+1-555-0123', date_of_birth: '1990-05-15' },
        { id: 2, email: 'jane.smith@example.com', first_name: 'Jane', last_name: 'Smith', phone: '+1-555-0124', date_of_birth: '1985-12-08' },
        { id: 3, email: 'invalid-email', first_name: 'Bob', last_name: 'Johnson', phone: '555-0125', date_of_birth: '1992-03-22' },
      ],
      'public.orders': [
        { id: 1, user_id: 1, total_amount: 99.99, status: 'completed', created_at: '2024-01-15T10:30:00Z' },
        { id: 2, user_id: 2, total_amount: 149.50, status: 'pending', created_at: '2024-01-16T14:20:00Z' },
        { id: 3, user_id: 1, total_amount: -10.00, status: 'refunded', created_at: '2024-01-17T09:15:00Z' },
      ],
    };
  }

  private async classifyData(metadata: any, _options?: DiscoveryOptions): Promise<any> {
    void _options;
    const fieldClassifications: any[] = [];
    const tableClassifications: any[] = [];

    const piiPatterns = ['email', 'phone', 'ssn', 'social_security', 'first_name', 'last_name', 'full_name'];
    const phiPatterns = ['medical', 'health', 'diagnosis', 'patient', 'dob', 'date_of_birth'];
    const finPatterns = ['credit_card', 'bank_account', 'salary', 'income', 'total_amount', 'price'];

    for (const schema of metadata.schemas) {
      for (const table of schema.tables) {
        let hasPII = false; let hasPHI = false; let hasFIN = false;

        for (const col of table.columns) {
          const name = String(col.name).toLowerCase();
          let classification = 'General';
          let sensitivity = 'Low';
          let confidence = 0.7;
          const patterns: string[] = [];
          const tags: string[] = [];
          const complianceFlags: any[] = [];

          if (piiPatterns.some(p => name.includes(p))) {
            classification = 'PII';
            sensitivity = name.includes('ssn') ? 'High' : 'Medium';
            confidence = 0.9;
            patterns.push('PII identifier pattern');
            tags.push('personal_data');
            complianceFlags.push({ framework: 'GDPR', requirement: 'Data subject rights', severity: 'Warning' });
            hasPII = true;
          } else if (phiPatterns.some(p => name.includes(p))) {
            classification = 'PHI';
            sensitivity = 'High';
            confidence = 0.9;
            patterns.push('PHI identifier pattern');
            tags.push('health_data');
            complianceFlags.push({ framework: 'HIPAA', requirement: 'PHI protection', severity: 'Error' });
            hasPHI = true;
          } else if (finPatterns.some(p => name.includes(p))) {
            classification = 'Financial';
            sensitivity = 'Medium';
            confidence = 0.8;
            patterns.push('Financial data pattern');
            tags.push('financial_data');
            complianceFlags.push({ framework: 'PCI-DSS', requirement: 'Payment data security', severity: 'Warning' });
            hasFIN = true;
          }

          fieldClassifications.push({
            schema: schema.name,
            table: table.name,
            column: col.name,
            dataType: col.dataType,
            classification,
            sensitivity,
            confidence,
            patterns,
            tags,
            complianceFlags,
          });
        }

        let overallClassification = 'General';
        let overallSensitivity = 'Low';
        if (hasPHI) { overallClassification = 'PHI'; overallSensitivity = 'High'; }
        else if (hasPII) { overallClassification = 'PII'; overallSensitivity = 'Medium'; }
        else if (hasFIN) { overallClassification = 'Financial'; overallSensitivity = 'Medium'; }

        tableClassifications.push({
          schema: schema.name,
          table: table.name,
          overallClassification,
          overallSensitivity,
          dataVolume: table.rowCount > 100_000 ? 'Large' : table.rowCount > 10_000 ? 'Medium' : 'Small',
          businessCriticality: 'Medium',
          accessFrequency: 'Regular',
          retentionCategory: 'Standard',
          complianceScope: this.getComplianceScope(overallClassification),
        });
      }
    }

    return {
      fieldClassifications,
      tableClassifications,
      sensitivityMap: this.createSensitivityMap(fieldClassifications),
      complianceMapping: this.createComplianceMapping(fieldClassifications),
      riskAssessment: this.assessRisk(fieldClassifications, tableClassifications),
    };
  }

  private async performAIAnalysis(metadata: any, classification: any): Promise<any> {
    // Stubbed AI; integrate your AIService usage once ready
    const aiInsights = {
      fieldRecommendations: [] as any[],
      schemaInsights: [] as any[],
      qualityPredictions: [] as any[],
      governanceRecommendations: [] as any[],
      anomalies: [] as any[],
    };

    for (const f of classification.fieldClassifications) {
      if (f.sensitivity === 'High' || f.classification !== 'General') {
        aiInsights.fieldRecommendations.push({
          schema: f.schema,
          table: f.table,
          column: f.column,
          recommendation: `Encrypt and restrict access to ${f.classification} field`,
          reasoning: `Contains ${f.classification} with ${f.sensitivity} sensitivity`,
          confidence: 0.9,
          impact: f.sensitivity === 'High' ? 'High' : 'Medium',
          category: 'Security',
        });
      }
    }

    aiInsights.schemaInsights.push({
      type: 'Pattern',
      insight: 'Detected user-order relationship; consider normalization/indexing',
      confidence: 0.8,
      tables: ['users', 'orders'],
      recommendation: 'Add FKs and composite indexes for key joins',
      priority: 'Medium',
    });

    aiInsights.qualityPredictions.push({
      table: 'users',
      column: 'email',
      qualityDimension: 'Validity',
      predictedScore: 85,
      confidence: 0.9,
      factors: ['Invalid format occurrences'],
      recommendations: ['Add email validation', 'Clean existing invalids'],
    });

    aiInsights.governanceRecommendations.push({
      scope: 'Table',
      target: 'users',
      recommendation: 'Adopt data retention for PII',
      category: 'Retention',
      priority: 'High',
      effort: 'Medium',
      benefit: 'Compliance & cost control',
    });

    aiInsights.anomalies.push({
      type: 'Quality',
      table: 'orders',
      column: 'total_amount',
      description: 'Negative amounts detected',
      severity: 'Warning',
      confidence: 0.95,
      suggestion: 'Review refund logic; add validation',
    });

    return aiInsights;
  }

  private generateSummary(metadata: any, classification: any, aiInsights?: any): any {
    const summary = {
      totalTablesAnalyzed: metadata.totalTables,
      totalColumnsAnalyzed: metadata.totalColumns,
      classificationsApplied: classification.fieldClassifications.length,
      sensitiveDataFound: classification.fieldClassifications.filter((f: any) => f.sensitivity !== 'Low').length,
      complianceFlags: classification.fieldClassifications.reduce((sum: number, f: any) => sum + f.complianceFlags.length, 0),
      qualityIssues: 0,
      aiRecommendations: 0,
      executionTime: 0,
      dataVolumeProcessed: metadata.totalRows || 0,
    };

    if (aiInsights) {
      summary.qualityIssues = aiInsights.anomalies.length;
      summary.aiRecommendations = aiInsights.fieldRecommendations.length + aiInsights.governanceRecommendations.length;
    }
    return summary;
  }

  private createSensitivityMap(fieldClassifications: any[]) {
    const bySensitivity: Record<string, any[]> = {
      Low: fieldClassifications.filter(f => f.sensitivity === 'Low'),
      Medium: fieldClassifications.filter(f => f.sensitivity === 'Medium'),
      High: fieldClassifications.filter(f => f.sensitivity === 'High'),
      Critical: fieldClassifications.filter(f => f.sensitivity === 'Critical'),
    };

    const byClassification: Record<string, any[]> = {
      General: fieldClassifications.filter(f => f.classification === 'General'),
      PII: fieldClassifications.filter(f => f.classification === 'PII'),
      PHI: fieldClassifications.filter(f => f.classification === 'PHI'),
      Financial: fieldClassifications.filter(f => f.classification === 'Financial'),
    };

    return {
      bySensitivity,
      byClassification,
      sensitiveTableCount: new Set(
        fieldClassifications.filter(f => f.sensitivity !== 'Low').map(f => `${f.schema}.${f.table}`)
      ).size,
      highRiskFields: fieldClassifications.filter(f => f.sensitivity === 'High' || f.sensitivity === 'Critical'),
    };
  }

  private createComplianceMapping(fieldClassifications: any[]) {
    const frameworkMap: Record<string, { applicableTables: Set<string>; applicableFields: any[]; requirements: Set<string>; riskLevel: 'Low' | 'Medium' | 'High' }> = {};

    fieldClassifications.forEach(field => {
      field.complianceFlags.forEach((flag: any) => {
        if (!frameworkMap[flag.framework]) {
          frameworkMap[flag.framework] = {
            applicableTables: new Set<string>(),
            applicableFields: [],
            requirements: new Set<string>(),
            riskLevel: 'Low',
          };
        }
        const f = frameworkMap[flag.framework];
        f.applicableTables.add(`${field.schema}.${field.table}`);
        f.applicableFields.push(field);
        f.requirements.add(flag.requirement);
        if (flag.severity === 'Error') f.riskLevel = 'High';
        else if (flag.severity === 'Warning' && f.riskLevel === 'Low') f.riskLevel = 'Medium';
      });
    });

    // Convert Sets
    const byFramework: Record<string, any> = {};
    for (const [fw, data] of Object.entries(frameworkMap)) {
      byFramework[fw] = {
        applicableTables: Array.from(data.applicableTables),
        applicableFields: data.applicableFields,
        requirements: Array.from(data.requirements),
        riskLevel: data.riskLevel,
      };
    }

    return {
      byFramework,
      overallComplexity: Object.keys(byFramework).length > 2 ? 'High' : Object.keys(byFramework).length > 1 ? 'Medium' : 'Low',
      requiredActions: this.generateComplianceActions(byFramework),
    };
  }

  private generateComplianceActions(byFramework: Record<string, any>) {
    const actions: any[] = [];
    for (const [framework, data] of Object.entries(byFramework)) {
      if (data.riskLevel === 'High') {
        actions.push({ framework, action: `Immediate ${framework} compliance review`, priority: 'High', timeline: '30 days', effort: 'High' });
      } else if (data.riskLevel === 'Medium') {
        actions.push({ framework, action: `${framework} compliance assessment`, priority: 'Medium', timeline: '90 days', effort: 'Medium' });
      }
    }
    return actions;
  }

  private assessRisk(fieldClassifications: any[], tableClassifications: any[]) {
    const highRiskFields = fieldClassifications.filter(f => f.sensitivity === 'High' || f.sensitivity === 'Critical');
    const sensitiveTableCount = tableClassifications.filter(t => t.overallSensitivity !== 'Low').length;

    let overallRisk: 'Low' | 'Medium' | 'High' = 'Low';
    if (highRiskFields.length > 10 || sensitiveTableCount > 5) overallRisk = 'High';
    else if (highRiskFields.length > 5 || sensitiveTableCount > 2) overallRisk = 'Medium';

    return {
      overallRisk,
      riskFactors: [
        {
          factor: 'High sensitivity data fields',
          level: highRiskFields.length > 10 ? 'High' : highRiskFields.length > 5 ? 'Medium' : 'Low',
          description: `${highRiskFields.length} fields contain highly sensitive data`,
          affectedTables: [...new Set(highRiskFields.map(f => `${f.schema}.${f.table}`))],
          mitigationStrategy: 'Implement encryption and access controls',
        },
      ],
      mitigationPriorities: [
        'Implement data classification policies',
        'Set up access controls for sensitive data',
        'Regular compliance audits',
      ],
      businessImpact: {
        reputational: overallRisk === 'High' ? 'High' : 'Medium',
        financial: overallRisk === 'High' ? 'High' : 'Low',
        operational: 'Medium',
        regulatory: overallRisk === 'High' ? 'Critical' : 'Medium',
      },
    };
  }

  private getComplianceScope(classification: string): string[] {
    switch (classification) {
      case 'PII': return ['GDPR', 'CCPA'];
      case 'PHI': return ['HIPAA'];
      case 'Financial': return ['PCI-DSS', 'SOX'];
      default: return [];
    }
  }

  /* ────────────────────────── Validation ────────────────────────── */

  private async validateJobData(d: DiscoveryJobData): Promise<void> {
    if (!d.sessionId) throw new APIError('Session ID is required', 400);
    if (!d.userId) throw new APIError('User ID is required', 400);
    if (!d.dataSourceId) throw new APIError('Data source ID is required', 400);

    const valid: DiscoveryKind[] = ['full', 'incremental', 'targeted'];
    if (!valid.includes(d.discoveryType)) throw new APIError('Invalid discovery type', 400);

    // basic existence
    const ds = await this.getDataSource(d.dataSourceId);
    if (!ds) throw new APIError('Data source not found', 404);

    // Targeted must include at least one target
    if (d.discoveryType === 'targeted') {
      const hasTargets = Boolean(d.options?.schemas?.length || d.options?.tables?.length);
      if (!hasTargets) throw new APIError('Targeted discovery requires schemas or tables', 400);
    }
  }

  /* ────────────────────────── Persistence & Status ────────────────────────── */

  private async updateJobStatus(
    sessionId: string,
    status: DiscoveryStatus,
    progress?: number,
    result?: unknown,
    error?: string
  ): Promise<void> {
    try {
      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date(),
      };
      if (progress !== undefined) patch.progress = progress;
      if (result !== undefined) patch.results = JSON.stringify(result);
      if (error !== undefined) patch.error = error;
      if (status === DiscoveryStatus.COMPLETED || status === DiscoveryStatus.FAILED || status === DiscoveryStatus.CANCELLED) {
        patch.completed_at = new Date();
      }

      const { text, values } = buildUpdateQuery('discovery_sessions', 'WHERE session_id = $1', [sessionId], patch);
      await db.query(text, values);

      await (redis as any).set?.(
        STATUS_KEY(sessionId),
        JSON.stringify({ status, progress: progress ?? null, updated_at: Date.now() }),
        { EX: REDIS_STATUS_TTL_SEC }
      );
    } catch (err) {
      logger.error('Discovery status update failed', { sessionId, status, error: (err as any)?.message });
      // non-fatal
    }
  }

  private async getDataSource(dataSourceId: string): Promise<any> {
    try {
      const result = await db.query('SELECT * FROM data_sources WHERE id = $1', [dataSourceId]);
      return result.rows[0] ?? null;
    } catch (err) {
      logger.error('Discovery data source lookup failed', { dataSourceId, error: (err as any)?.message });
      throw err;
    }
  }

  /* ────────────────────────── Retry & Cancel ────────────────────────── */

  private async shouldRetryJob(d: DiscoveryJobData, err: unknown): Promise<boolean> {
    const retryCount = d.retryCount ?? 0;
    const maxRetries = d.maxRetries ?? this.maxRetries;

    if (err instanceof APIError && err.statusCode >= 400 && err.statusCode < 500) return false;
    if ((err as any)?.statusCode === 499) return false; // cancelled
    if (await this.isCancelled(d.sessionId)) return false;
    if (retryCount >= maxRetries) return false;

    return isTransientError(err);
  }

  private async scheduleRetry(d: DiscoveryJobData): Promise<DiscoveryJobResult> {
    const retryCount = (d.retryCount ?? 0) + 1;
    const delay = backoffWithJitter(retryCount);

    logger.info('Discovery job: scheduling retry', { sessionId: d.sessionId, retryCount, delayMs: delay });

    const retryData: DiscoveryJobData = { ...d, retryCount };

    setTimeout(async () => {
      try {
        if (await this.isCancelled(retryData.sessionId)) {
          await this.updateJobStatus(retryData.sessionId, DiscoveryStatus.FAILED, 0, undefined, 'Job cancelled');
          return;
        }
        await this.execute(retryData);
      } catch (err) {
        logger.error('Discovery retry execution failed', { sessionId: retryData.sessionId, error: (err as any)?.message });
      }
    }, delay);

    return {
      sessionId: d.sessionId,
      status: JobStatus.PENDING,
      duration: 0,
      completedAt: new Date(),
    };
  }

  private async isCancelled(sessionId: string): Promise<boolean> {
    try {
      const val = await (redis as any).get?.(CANCEL_KEY(sessionId));
      return val === '1' || val === 'true';
    } catch {
      return false;
    }
  }

  /* ────────────────────────── Notifications ────────────────────────── */

  private async sendCompletionNotification(
    userId: string,
    sessionId: string,
    discoveryType: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const type = success ? 'discovery_completed' : 'discovery_failed';
      const title = success ? 'Discovery Completed' : 'Discovery Failed';
      const message = success
        ? `Your ${discoveryType} discovery completed successfully.`
        : `Your ${discoveryType} discovery failed: ${error ?? 'unknown error'}`;
      const metadata = { sessionId, discoveryType, success };

      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, type, title, message, JSON.stringify(metadata)]
      );
      // push via websocket/event bus as needed
    } catch (err) {
      logger.error('Discovery notification failed', { userId, sessionId, error: (err as any)?.message });
      // swallow
    }
  }

  /* ────────────────────────── Lifecycle helpers ────────────────────────── */

  public async cleanup(sessionId: string): Promise<void> {
    try {
      await (redis as any).del?.(STATUS_KEY(sessionId));
      logger.debug('Discovery cleanup completed', { sessionId });
    } catch (err) {
      logger.error('Discovery cleanup failed', { sessionId, error: (err as any)?.message });
    }
  }

  public async cancel(sessionId: string): Promise<void> {
    try {
      // A controller can also set CANCEL_KEY(sessionId) in Redis, if you want
      await this.updateJobStatus(sessionId, DiscoveryStatus.CANCELLED, 0);
      await this.cleanup(sessionId);
      logger.info('Discovery job cancelled', { sessionId });
    } catch (err) {
      logger.error('Discovery cancel failed', { sessionId, error: (err as any)?.message });
      throw err;
    }
  }

  public async getProgress(sessionId: string): Promise<any> {
    try {
      const cached = await (redis as any).get?.(STATUS_KEY(sessionId));
      if (cached) {
        try { return JSON.parse(cached); } catch { /* fall through */ }
      }

      const result = await db.query(
        'SELECT status, progress, updated_at FROM discovery_sessions WHERE session_id = $1',
        [sessionId]
      );
      if (result.rows.length === 0) throw new APIError('Discovery session not found', 404);

      return {
        status: result.rows[0].status,
        progress: result.rows[0].progress,
        updated_at: result.rows[0].updated_at,
      };
    } catch (err) {
      logger.error('Discovery progress fetch failed', { sessionId, error: (err as any)?.message });
      throw err;
    }
  }
}

/** Singleton */
export const discoveryJob = new DiscoveryJob();
