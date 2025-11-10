// Pipeline Intelligence Agent - Monitors and analyzes pipeline health
import { OpenAI } from 'openai';

export interface PipelineFailure {
  pipelineId: string;
  pipelineName: string;
  runId: string;
  stepId?: string;
  errorMessage: string;
  stackTrace?: string;
  timestamp: string;
  attemptNumber: number;
  logs?: string[];
}

export interface RootCauseAnalysis {
  category: 'schema_change' | 'connection_error' | 'timeout' | 'data_quality' | 'permission' | 'unknown';
  confidence: number; // 0-1
  rootCause: string;
  suggestedFix: string;
  autoFixable: boolean;
  relatedIssues?: string[];
  knowledgeBaseArticles?: string[];
}

export interface PipelineRecommendation {
  type: 'reschedule' | 'increase_timeout' | 'add_retry' | 'change_query' | 'upgrade_resource';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  expectedImpact: string;
  implementationSteps: string[];
}

export class PipelineIntelligenceAgent {
  private openai: OpenAI | null = null;
  private knowledgeBase: Map<string, RootCauseAnalysis> = new Map();

  constructor(openaiApiKey?: string) {
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  /**
   * Analyze pipeline failure and determine root cause
   */
  async analyzeFailure(failure: PipelineFailure): Promise<RootCauseAnalysis> {
    // Check knowledge base first for known patterns
    const knownPattern = this.findKnownPattern(failure.errorMessage);
    if (knownPattern) {
      console.log(`[Pipeline Agent] Found known pattern for error`);
      return knownPattern;
    }

    // Use AI for unknown failures
    if (this.openai) {
      return this.aiAnalyzeFailure(failure);
    }

    // Fallback to rule-based analysis
    return this.ruleBasedAnalysis(failure);
  }

  /**
   * AI-powered failure analysis using OpenAI
   */
  private async aiAnalyzeFailure(failure: PipelineFailure): Promise<RootCauseAnalysis> {
    const prompt = `Analyze this pipeline failure and provide root cause analysis:

Pipeline: ${failure.pipelineName}
Step: ${failure.stepId || 'N/A'}
Error: ${failure.errorMessage}
Attempt: ${failure.attemptNumber}
Logs: ${failure.logs?.slice(-10).join('\n') || 'No logs'}

Provide analysis in JSON format:
{
  "category": "schema_change|connection_error|timeout|data_quality|permission|unknown",
  "confidence": 0.0-1.0,
  "rootCause": "brief explanation",
  "suggestedFix": "specific fix recommendation",
  "autoFixable": true|false
}`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert data engineer analyzing pipeline failures. Provide concise, actionable analysis.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      const result: RootCauseAnalysis = {
        category: analysis.category || 'unknown',
        confidence: analysis.confidence || 0.5,
        rootCause: analysis.rootCause || 'Unable to determine',
        suggestedFix: analysis.suggestedFix || 'Manual investigation required',
        autoFixable: analysis.autoFixable || false,
      };

      // Store in knowledge base for future reference
      this.storeInKnowledgeBase(failure.errorMessage, result);

      return result;
    } catch (error) {
      console.error('[Pipeline Agent] AI analysis failed:', error);
      return this.ruleBasedAnalysis(failure);
    }
  }

  /**
   * Rule-based failure analysis (fallback)
   */
  private ruleBasedAnalysis(failure: PipelineFailure): RootCauseAnalysis {
    const error = failure.errorMessage.toLowerCase();

    // Schema/Column errors
    if (error.includes('column') && (error.includes('does not exist') || error.includes('invalid'))) {
      return {
        category: 'schema_change',
        confidence: 0.9,
        rootCause: 'Database schema has changed - column missing or renamed',
        suggestedFix: 'Check recent schema migrations and update SQL queries',
        autoFixable: false,
        relatedIssues: ['Check lineage service for recent schema changes'],
      };
    }

    // Connection errors
    if (error.includes('connection') || error.includes('timeout') || error.includes('econnrefused')) {
      return {
        category: 'connection_error',
        confidence: 0.85,
        rootCause: 'Unable to connect to data source',
        suggestedFix: 'Verify data source credentials and network connectivity',
        autoFixable: true,
        relatedIssues: ['Run connection test', 'Check firewall rules'],
      };
    }

    // Timeout errors
    if (error.includes('timeout') || error.includes('timed out')) {
      return {
        category: 'timeout',
        confidence: 0.8,
        rootCause: 'Query execution exceeded timeout limit',
        suggestedFix: 'Increase timeout_ms parameter or optimize query',
        autoFixable: true,
        relatedIssues: ['Check query execution plan', 'Add indexes if needed'],
      };
    }

    // Permission errors
    if (error.includes('permission') || error.includes('denied') || error.includes('unauthorized')) {
      return {
        category: 'permission',
        confidence: 0.9,
        rootCause: 'Insufficient permissions to access resource',
        suggestedFix: 'Grant required permissions to service account',
        autoFixable: false,
      };
    }

    // Data quality errors
    if (error.includes('constraint') || error.includes('duplicate') || error.includes('null')) {
      return {
        category: 'data_quality',
        confidence: 0.75,
        rootCause: 'Data quality issue - constraint violation',
        suggestedFix: 'Add data validation step before load',
        autoFixable: false,
      };
    }

    return {
      category: 'unknown',
      confidence: 0.3,
      rootCause: 'Unable to determine root cause automatically',
      suggestedFix: 'Manual investigation required',
      autoFixable: false,
    };
  }

  /**
   * Generate recommendations for pipeline optimization
   */
  async generateRecommendations(pipelineId: string, historicalData: any[]): Promise<PipelineRecommendation[]> {
    const recommendations: PipelineRecommendation[] = [];

    // Analyze failure patterns
    const failures = historicalData.filter(h => h.status === 'failed');
    const successRate = (historicalData.length - failures.length) / historicalData.length;

    if (successRate < 0.8) {
      recommendations.push({
        type: 'add_retry',
        priority: 'high',
        description: 'Pipeline has low success rate (< 80%)',
        expectedImpact: 'Increase success rate by 15-20%',
        implementationSteps: [
          'Add retry logic with exponential backoff',
          'Set max_attempts to 3 for critical steps',
          'Add error handling and logging',
        ],
      });
    }

    // Check for timeout issues
    const timeouts = failures.filter(f => f.error?.includes('timeout'));
    if (timeouts.length > failures.length * 0.5) {
      recommendations.push({
        type: 'increase_timeout',
        priority: 'high',
        description: '50%+ failures are due to timeouts',
        expectedImpact: 'Reduce timeout failures',
        implementationSteps: [
          'Increase timeout_ms from current value',
          'Analyze query performance',
          'Consider adding indexes',
        ],
      });
    }

    // Check for time-based patterns
    const failuresByHour = this.analyzeTimePatterns(failures);
    const peakFailureHour = Object.entries(failuresByHour).sort((a, b) => b[1] - a[1])[0];

    if (peakFailureHour && peakFailureHour[1] > failures.length * 0.3) {
      recommendations.push({
        type: 'reschedule',
        priority: 'medium',
        description: `${Math.round((peakFailureHour[1] / failures.length) * 100)}% of failures occur around ${peakFailureHour[0]}:00`,
        expectedImpact: 'Avoid peak load times',
        implementationSteps: [
          `Reschedule pipeline to run outside of ${peakFailureHour[0]}:00`,
          'Consider running during off-peak hours (2-4 AM)',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Predict likelihood of pipeline failure
   */
  predictFailureProbability(pipeline: any, currentConditions: any): number {
    let probability = 0.1; // Base 10% failure rate

    // Check historical success rate
    if (pipeline.historicalSuccessRate) {
      probability = 1 - pipeline.historicalSuccessRate;
    }

    // Adjust based on conditions
    if (currentConditions.isWeekend) probability *= 0.7; // Less traffic on weekends
    if (currentConditions.isPeakHours) probability *= 1.5; // More failures during peak
    if (currentConditions.recentSchemaChanges) probability *= 2.0; // Higher risk after schema changes

    return Math.min(probability, 0.95); // Cap at 95%
  }

  /**
   * Find known error patterns in knowledge base
   */
  private findKnownPattern(error: string): RootCauseAnalysis | null {
    for (const [pattern, analysis] of this.knowledgeBase.entries()) {
      if (error.includes(pattern)) {
        return { ...analysis, confidence: Math.min(analysis.confidence + 0.1, 1.0) };
      }
    }
    return null;
  }

  /**
   * Store analysis in knowledge base
   */
  private storeInKnowledgeBase(errorPattern: string, analysis: RootCauseAnalysis): void {
    // Extract key error message (first 100 chars)
    const key = errorPattern.substring(0, 100);
    this.knowledgeBase.set(key, analysis);

    console.log(`[Pipeline Agent] Stored new pattern in knowledge base`);
  }

  /**
   * Analyze time-based failure patterns
   */
  private analyzeTimePatterns(failures: any[]): Record<string, number> {
    const hourCounts: Record<string, number> = {};

    failures.forEach(f => {
      if (f.timestamp) {
        const hour = new Date(f.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    return hourCounts;
  }

  /**
   * Get knowledge base size
   */
  getKnowledgeBaseSize(): number {
    return this.knowledgeBase.size;
  }

  /**
   * Export knowledge base
   */
  exportKnowledgeBase(): Array<{ pattern: string; analysis: RootCauseAnalysis }> {
    return Array.from(this.knowledgeBase.entries()).map(([pattern, analysis]) => ({
      pattern,
      analysis,
    }));
  }
}
