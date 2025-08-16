// src/services/AnalysisService.ts
import { APIError } from '@/utils/errors';
import { logger } from '@/utils/logger';

// Import concrete classes but DO NOT rely on their exported types
// (your current module doesn't export DataProcessor/DataSample types)
import * as DataProcessorMod from '@/processors/DataProcessor';
import * as SchemaProcessorMod from '@/processors/SchemaProcessor';
import { AIService } from './AIService';

/* ──────────────────────────────────────────────────────────────────────────
 * Minimal contracts (kept small to avoid coupling & missing exports)
 * ────────────────────────────────────────────────────────────────────────── */

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type RuleStatus = 'passed' | 'warning' | 'failed';

export interface DataSample {
  columnName: string;
  values: unknown[];
}

export interface QualityIssue {
  column: string;
  type:
    | 'null_values'
    | 'format_inconsistency'
    | 'out_of_range'
    | 'uniqueness'
    | 'referential'
    | 'custom';
  severity: Severity;
  count: number;
  sample?: unknown[];
  message?: string;
}

export interface IDataProcessor {
  analyzeSampleData(
    samples: DataSample[],
  ): Promise<{ analysis: Record<string, unknown>[]; qualityIssues: QualityIssue[] }>;
}

export interface SchemaInfo {
  name: string;
  // optional extra fields your processor might use
  [k: string]: unknown;
}

export interface ISchemaProcessor {
  processSchema(schema: SchemaInfo): Promise<unknown>;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Result types
 * ────────────────────────────────────────────────────────────────────────── */

export interface QualityRuleResult {
  ruleId: string;
  ruleName: string;
  status: RuleStatus;
  testedRecords: number;
  passedRecords: number;
  failedRecords: number;
  successRate: number; // 0..100
  aiExplanation?: string;
  recommendations?: string[];
}

export interface AnalysisSummary {
  totalColumns: number;
  qualityIssues: number;
  highSeverityIssues: number;
}

export interface DataSampleAnalysisResult {
  analysis: ReadonlyArray<Record<string, unknown>>;
  qualityIssues: ReadonlyArray<QualityIssue>;
  recommendations: ReadonlyArray<string>;
  summary: AnalysisSummary;
  analysisMetadata: {
    analyzedAt: string;
    analyzedBy: string;
    version: string;
  };
}

export interface SchemaAIInsights {
  overallAssessment: string;
  riskAreas: string[];
  complianceGaps: string[];
  optimizationOpportunities: string[];
}

export interface SchemaAnalysisResult {
  processed: unknown;
  aiInsights: SchemaAIInsights;
  analysisMetadata: {
    analyzedAt: string;
    analyzedBy: string;
    version: string;
  };
}

export interface QualityCheckResult {
  dataSourceId: string;
  results: ReadonlyArray<QualityRuleResult>;
  summary: {
    totalRules: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  analysisMetadata: {
    analyzedAt: string;
    analyzedBy: string;
    version: string;
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Utils
 * ────────────────────────────────────────────────────────────────────────── */

const SERVICE_VERSION = '1.0';

function asApiError(err: unknown, fallback: string, status = 500): APIError {
  if (err instanceof APIError) return err;
  const msg = err instanceof Error ? err.message : fallback;
  return new APIError(msg, status, err);
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, rej) =>
      (t = setTimeout(() => rej(new APIError(`${label} timed out after ${ms}ms`, 504)), ms)),
    );
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

function isHigh(sev: Severity): boolean {
  return sev === 'High' || sev === 'Critical';
}

/* ──────────────────────────────────────────────────────────────────────────
 * Service
 * ────────────────────────────────────────────────────────────────────────── */

export class AnalysisService {
  private readonly schemaProcessor: ISchemaProcessor;
  private readonly dataProcessor: IDataProcessor;
  private readonly ai: AIService;
  private readonly aiTimeoutMs: number;

  constructor(deps?: {
    schemaProcessor?: ISchemaProcessor;
    dataProcessor?: IDataProcessor;
    aiService?: AIService;
    aiTimeoutMs?: number;
  }) {
    // Instantiate from modules if not injected
    const DefaultSchemaProcessor =
    ( SchemaProcessorMod as any).SchemaProcessor ?? (SchemaProcessorMod as any).default;
    const DefaultDataProcessor =
    (DataProcessorMod as any).DataProcessor ?? (DataProcessorMod as any).default;


    this.schemaProcessor = deps?.schemaProcessor ?? new DefaultSchemaProcessor();
    this.dataProcessor = deps?.dataProcessor ?? new DefaultDataProcessor();
    this.ai = deps?.aiService ?? new AIService();
    this.aiTimeoutMs = deps?.aiTimeoutMs ?? Number(process.env.AI_TIMEOUT_MS ?? 8000);
  }

  /* ───────── Schema Analysis ───────── */

  public async analyzeSchema(schema: SchemaInfo, userId: string): Promise<SchemaAnalysisResult> {
    try {
      this.assertUser(userId);
      this.assertSchema(schema);

      logger.info('AnalysisService: schema analysis start', { userId, schema: schema.name });
      const processed = await this.schemaProcessor.processSchema(schema);

      const aiInsights = await this.safeSchemaInsights(processed);

      const res: SchemaAnalysisResult = {
        processed,
        aiInsights,
        analysisMetadata: {
          analyzedAt: new Date().toISOString(),
          analyzedBy: userId,
          version: SERVICE_VERSION,
        },
      };

      logger.info('AnalysisService: schema analysis complete', { userId, schema: schema.name });
      return res;
    } catch (err) {
      logger.error('AnalysisService: schema analysis error', { error: err });
      throw asApiError(err, 'Schema analysis failed', 500);
    }
  }

  /* ───────── Data Sample Analysis ───────── */

  public async analyzeDataSample(samples: DataSample[], userId: string): Promise<DataSampleAnalysisResult> {
    try {
      this.assertUser(userId);
      this.assertSamples(samples);

      logger.info('AnalysisService: data sample analysis start', { userId, samples: samples.length });

      const { analysis, qualityIssues } = await this.dataProcessor.analyzeSampleData(samples);

      const recommendations = await this.buildDataRecommendations(analysis, qualityIssues);

      const res: DataSampleAnalysisResult = {
        analysis,
        qualityIssues,
        recommendations,
        summary: {
          totalColumns: samples.length,
          qualityIssues: qualityIssues.length,
          highSeverityIssues: qualityIssues.filter((q) => isHigh(q.severity)).length,
        },
        analysisMetadata: {
          analyzedAt: new Date().toISOString(),
          analyzedBy: userId,
          version: SERVICE_VERSION,
        },
      };

      logger.info('AnalysisService: data sample analysis complete', {
        userId,
        samplesAnalyzed: samples.length,
        issuesFound: qualityIssues.length,
      });
      return res;
    } catch (err) {
      logger.error('AnalysisService: data sample analysis error', { error: err });
      throw asApiError(err, 'Data sample analysis failed', 500);
    }
  }

  /* ───────── Quality Check (mocked engine) ───────── */

  public async performQualityCheck(
    dataSourceId: string,
    rules: ReadonlyArray<Record<string, unknown>> | undefined,
    userId: string,
  ): Promise<QualityCheckResult> {
    try {
      this.assertUser(userId);
      if (!dataSourceId) throw new APIError('dataSourceId is required', 400);

      logger.info('AnalysisService: quality check start', {
        userId,
        dataSourceId,
        rules: rules?.length ?? 0,
      });

      const base = this.mockQualityResults(rules ?? []);
      const enhanced = await this.enhanceRuleResults(base);

      const summary = {
        totalRules: rules?.length ?? 0,
        passed: enhanced.filter((r) => r.status === 'passed').length,
        failed: enhanced.filter((r) => r.status === 'failed').length,
        warnings: enhanced.filter((r) => r.status === 'warning').length,
      };

      const res: QualityCheckResult = {
        dataSourceId,
        results: enhanced,
        summary,
        analysisMetadata: {
          analyzedAt: new Date().toISOString(),
          analyzedBy: userId,
          version: SERVICE_VERSION,
        },
      };

      logger.info('AnalysisService: quality check complete', {
        userId,
        dataSourceId,
        rulesChecked: rules?.length ?? 0,
      });
      return res;
    } catch (err) {
      logger.error('AnalysisService: quality check error', { error: err });
      throw asApiError(err, 'Quality check failed', 500);
    }
  }

  /* ─────────────────────────────
   * Private: AI insights for schema
   * ───────────────────────────── */

  private async safeSchemaInsights(processed: unknown): Promise<SchemaAIInsights> {
    type TableGov = {
      sensitivity?: Severity | string;
      classification?: 'General' | 'PII' | 'PHI' | 'Financial' | string;
      complianceFrameworks?: string[];
      suggestedPolicies?: string[];
    };
    type MinimalProcessed = { name?: string; tables?: { governance?: TableGov }[] };

    const schema = (processed as MinimalProcessed) ?? {};
    const tables: { governance?: TableGov }[] = Array.isArray(schema.tables) ? [...schema.tables] : [];

    // Safety: ensure mutable arrays (avoid readonly assignment issues)
    const snapshot = tables.slice(0, 100).map((t) => ({
      sensitivity: (t.governance?.sensitivity ?? 'Low').toString(),
      classification: (t.governance?.classification ?? 'General').toString(),
      frameworks: Array.isArray(t.governance?.complianceFrameworks)
        ? [...t.governance!.complianceFrameworks!]
        : ([] as string[]),
      policyCount: Array.isArray(t.governance?.suggestedPolicies) ? t.governance!.suggestedPolicies!.length : 0,
    }));

    // If AI service exposes a summarization helper, call it. Otherwise, fall back.
    const hasSummarize =
      this.ai && (typeof (this.ai as any).safeSummarize === 'function' || typeof (this.ai as any).summarize === 'function');

    let overallAssessment = this.fallbackOverallAssessment(tables);
    if (hasSummarize) {
      try {
        const fn = (this.ai as any).safeSummarize ?? (this.ai as any).summarize;
        const out = await withTimeout(
          Promise.resolve(fn.call(this.ai, { topic: 'schema-assessment', payload: { tableCount: tables.length, snapshot } })),
          this.aiTimeoutMs,
          'AI schema assessment',
        );
        if (typeof out === 'string' && out.trim()) overallAssessment = out.trim();
      } catch {
        // keep fallback
      }
    }

    return {
      overallAssessment,
      riskAreas: this.deriveRiskAreas(tables),
      complianceGaps: this.deriveComplianceGaps(tables),
      optimizationOpportunities: this.deriveOptimizations(tables),
    };
  }

  private fallbackOverallAssessment(
    tables: ReadonlyArray<{ governance?: { sensitivity?: string; classification?: string; complianceFrameworks?: string[] } }>,
  ): string {
    const total = tables.length || 1;
    const sensitive = tables.filter((t) => (t.governance?.sensitivity ?? 'Low') !== 'Low').length;
    const frameworks = new Set<string>();
    for (const t of tables) {
      const list = t.governance?.complianceFrameworks ?? [];
      for (let i = 0; i < list.length; i++) frameworks.add(list[i] as string);
    }
    if (sensitive / total > 0.5) {
      return `High-risk schema: ${sensitive}/${total} tables contain non-low sensitivity data. ${frameworks.size} compliance frameworks detected. Prioritize governance.`;
    }
    if (sensitive > 0) {
      return `Moderate-risk schema: ${sensitive} sensitive tables. Frameworks: ${[...frameworks].join(', ') || 'None'}. Maintain standard governance.`;
    }
    return 'Low-risk schema: mostly general data. Basic governance practices are sufficient.';
  }

  private deriveRiskAreas(tables: ReadonlyArray<{ governance?: { sensitivity?: string; classification?: string } }>): string[] {
    const risks: string[] = [];
    const hi = tables.filter(
      (t) => (t.governance?.sensitivity ?? 'Low') === 'High' || (t.governance?.sensitivity ?? 'Low') === 'Critical',
    ).length;
    if (hi) risks.push(`${hi} table(s) contain highly sensitive data (strict access & encryption).`);

    const pii = tables.filter((t) => t.governance?.classification === 'PII').length;
    if (pii) risks.push(`${pii} table(s) contain PII; ensure privacy controls & minimization.`);

    const phi = tables.filter((t) => t.governance?.classification === 'PHI').length;
    if (phi) risks.push(`${phi} table(s) contain PHI; HIPAA safeguards required.`);

    return risks;
  }

  private deriveComplianceGaps(tables: ReadonlyArray<{ governance?: { complianceFrameworks?: string[] } }>): string[] {
    const frameworks = new Set<string>();
    for (const t of tables) {
      const list = t.governance?.complianceFrameworks ?? [];
      for (let i = 0; i < list.length; i++) frameworks.add(list[i] as string);
    }
    const gaps: string[] = [];
    if (frameworks.has('GDPR')) gaps.push('Validate GDPR data subject rights, retention, and DPIA for high-risk processing.');
    if (frameworks.has('HIPAA')) gaps.push('Perform HIPAA security risk analysis and enforce PHI audit controls.');
    if (frameworks.has('PCI-DSS')) gaps.push('Confirm segmentation & encryption for cardholder data.');
    return gaps;
  }

  private deriveOptimizations(
    tables: ReadonlyArray<{ governance?: { suggestedPolicies?: string[]; classification?: string } }>,
  ): string[] {
    const out: string[] = [];
    let noPolicy = 0;
    let general = 0;
    for (let i = 0; i < tables.length; i++) {
      const g = tables[i]?.governance;
      if (!g) continue;
      if (!Array.isArray(g.suggestedPolicies) || g.suggestedPolicies.length === 0) noPolicy++;
      if (g.classification === 'General') general++;
    }
    if (noPolicy) out.push(`${noPolicy} table(s) lack governance policies; define baseline classification and retention.`);
    if (tables.length && general / tables.length > 0.8) {
      out.push('Large share of tables classified as General; consider targeted reclassification review.');
    }
    out.push('Automate periodic discovery and policy drift detection.');
    out.push('Schedule quarterly compliance checks for sensitive domains.');
    return out;
  }

  /* ─────────────────────────────
   * Private: Data recommendations
   * ───────────────────────────── */

  private async buildDataRecommendations(
    analysis: ReadonlyArray<Record<string, unknown>>,
    issues: ReadonlyArray<QualityIssue>,
  ): Promise<string[]> {
    const recs = new Set<string>();
    const hi = issues.filter((q) => isHigh(q.severity)).length;
    if (hi) recs.add(`Address ${hi} high/critical quality issues immediately.`);

    if (issues.some((q) => q.type === 'null_values')) recs.add('Add NOT NULL/CHECK constraints or upstream validation.');
    if (issues.some((q) => q.type === 'format_inconsistency')) recs.add('Standardize formats with validation/canonicalization.');

    // Optional AI tip if method exists
    const hasSummarize =
      this.ai && (typeof (this.ai as any).safeSummarize === 'function' || typeof (this.ai as any).summarize === 'function');
    if (hasSummarize) {
      try {
        const fn = (this.ai as any).safeSummarize ?? (this.ai as any).summarize;
        const maybe = await withTimeout(
          Promise.resolve(fn.call(this.ai, { topic: 'data-quality-highlights', payload: { issues: issues.slice(0, 50) } })),
          Math.min(this.aiTimeoutMs, 3000),
          'AI data tip',
        );
        if (typeof maybe === 'string' && maybe.trim()) recs.add(maybe.trim());
      } catch {
        // ignore AI failure
      }
    }

    recs.add('Enable continuous monitoring & alerting for key quality dimensions.');
    recs.add('Publish a data quality dashboard with issue backlog & owners.');

    return Array.from(recs);
  }

  private mockQualityResults(_rules: ReadonlyArray<Record<string, unknown>>): QualityRuleResult[] {
    return [
      {
        ruleId: 'email_format',
        ruleName: 'Email Format Validation',
        status: 'passed',
        testedRecords: 1000,
        passedRecords: 998,
        failedRecords: 2,
        successRate: 99.8,
      },
      {
        ruleId: 'phone_format',
        ruleName: 'Phone Number Format',
        status: 'warning',
        testedRecords: 1000,
        passedRecords: 950,
        failedRecords: 50,
        successRate: 95.0,
      },
      {
        ruleId: 'null_check',
        ruleName: 'Required Field Validation',
        status: 'failed',
        testedRecords: 1000,
        passedRecords: 800,
        failedRecords: 200,
        successRate: 80.0,
      },
    ];
  }

  private async enhanceRuleResults(results: ReadonlyArray<QualityRuleResult>): Promise<QualityRuleResult[]> {
    const out: QualityRuleResult[] = [];
    const hasSummarize =
      this.ai && (typeof (this.ai as any).safeSummarize === 'function' || typeof (this.ai as any).summarize === 'function');
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const baseExp = this.baseRuleExplanation(r);
      const baseRecs = this.baseRuleRecommendations(r);

      let aiNote: string | undefined;
      if (hasSummarize) {
        try {
          const fn = (this.ai as any).safeSummarize ?? (this.ai as any).summarize;
          const maybe = await withTimeout(
            Promise.resolve(fn.call(this.ai, { topic: 'quality-rule-explanation', payload: { id: r.ruleId, status: r.status, rate: r.successRate } })),
            Math.min(this.aiTimeoutMs, 3000),
            `AI note for ${r.ruleId}`,
          );
          if (typeof maybe === 'string' && maybe.trim()) aiNote = maybe.trim();
        } catch {
          // ignore
        }
      }

      out.push({
        ...r,
        aiExplanation: aiNote ?? baseExp,
        recommendations: Array.from(new Set([...(r.recommendations ?? []), ...baseRecs])),
      });
    }
    return out;
  }

  private baseRuleExplanation(r: QualityRuleResult): string {
    if (r.status === 'passed') return `Rule "${r.ruleName}" performing well (${r.successRate}% success).`;
    if (r.status === 'warning')
      return `Rule "${r.ruleName}" shows moderate issues (${r.failedRecords} failures). Investigate upstream validation.`;
    return `Rule "${r.ruleName}" failing (${r.failedRecords} failures). Immediate remediation required.`;
  }

  private baseRuleRecommendations(r: QualityRuleResult): string[] {
    const recs: string[] = [];
    if (r.status === 'failed') {
      recs.push('Identify root cause and add upstream validation.');
      recs.push('Cleanse/backfill existing bad records.');
      recs.push('Add tests & monitoring to prevent regressions.');
    } else if (r.status === 'warning') {
      recs.push('Track trend; tighten validation where safe.');
      recs.push('Add sampling-based alerts.');
    }
    return recs;
  }

  /* ───────── Guards ───────── */

  private assertUser(userId: string): void {
    if (!userId || typeof userId !== 'string') throw new APIError('Invalid userId', 400);
  }

  private assertSchema(schema: unknown): asserts schema is SchemaInfo {
    if (!schema || typeof (schema as SchemaInfo).name !== 'string') {
      throw new APIError('Invalid schema payload', 400);
    }
  }

  private assertSamples(samples: unknown): asserts samples is DataSample[] {
    if (!Array.isArray(samples)) throw new APIError('samples must be an array', 400);
    if (samples.length === 0) throw new APIError('At least one sample is required', 400);
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i] as Partial<DataSample>;
      if (!s || typeof s.columnName !== 'string' || !Array.isArray(s.values)) {
        throw new APIError(`Invalid sample at index ${i}`, 400);
      }
    }
  }
}
