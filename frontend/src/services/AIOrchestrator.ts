/**
 * AI Orchestrator - Coordinates intelligence across all module AIs
 *
 * This service acts as a central hub that:
 * 1. Aggregates insights from module-specific AIs
 * 2. Provides unified context to the main AI Assistant
 * 3. Routes queries to the most appropriate AI specialist
 * 4. Synthesizes responses from multiple AI sources
 */

import axios from 'axios';

export interface ModuleAI {
  module: 'catalog' | 'quality' | 'lineage' | 'pipelines' | 'governance';
  capabilities: string[];
  endpoint: string;
  priority: number;
}

export interface AIInsight {
  id: string;
  source: string; // Which AI generated this
  type: 'suggestion' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  confidence: number;
  timestamp: Date;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

export interface UnifiedAIContext {
  // Aggregated from all modules
  catalogInsights: AIInsight[];
  qualityInsights: AIInsight[];
  lineageInsights: AIInsight[];
  pipelineInsights: AIInsight[];

  // Synthesized knowledge
  overallRecommendations: string[];
  riskAreas: Array<{
    module: string;
    risk: string;
    severity: 'high' | 'medium' | 'low';
  }>;

  // Cross-module insights
  correlations: Array<{
    modules: string[];
    finding: string;
    impact: string;
  }>;
}

class AIOrchestrator {
  private static instance: AIOrchestrator;
  private moduleAIs: Map<string, ModuleAI>;
  private insightCache: Map<string, AIInsight[]>;

  private constructor() {
    this.moduleAIs = new Map();
    this.insightCache = new Map();
    this.registerModuleAIs();
  }

  public static getInstance(): AIOrchestrator {
    if (!AIOrchestrator.instance) {
      AIOrchestrator.instance = new AIOrchestrator();
    }
    return AIOrchestrator.instance;
  }

  /**
   * Register all module-specific AIs
   */
  private registerModuleAIs() {
    // Data Catalog AI
    this.moduleAIs.set('catalog', {
      module: 'catalog',
      capabilities: [
        'field_classification',
        'pii_detection',
        'schema_analysis',
        'metadata_enrichment'
      ],
      endpoint: '/api/ai/catalog',
      priority: 1
    });

    // Data Quality AI
    this.moduleAIs.set('quality', {
      module: 'quality',
      capabilities: [
        'rule_generation',
        'quality_prediction',
        'anomaly_detection',
        'rule_optimization'
      ],
      endpoint: '/api/ai/quality',
      priority: 1
    });

    // Lineage AI
    this.moduleAIs.set('lineage', {
      module: 'lineage',
      capabilities: [
        'impact_analysis',
        'dependency_mapping',
        'data_flow_optimization'
      ],
      endpoint: '/api/ai/lineage',
      priority: 2
    });

    // Pipeline AI
    this.moduleAIs.set('pipelines', {
      module: 'pipelines',
      capabilities: [
        'failure_prediction',
        'performance_optimization',
        'schedule_optimization'
      ],
      endpoint: '/api/ai/pipelines',
      priority: 2
    });
  }

  /**
   * Gather insights from all module AIs
   */
  public async gatherAllInsights(): Promise<UnifiedAIContext> {
    const insightPromises = Array.from(this.moduleAIs.values()).map(async (moduleAI) => {
      try {
        const response = await axios.get(`${moduleAI.endpoint}/insights`);
        const insights: AIInsight[] = response.data.insights || [];

        // Cache insights
        this.insightCache.set(moduleAI.module, insights);

        return {
          module: moduleAI.module,
          insights
        };
      } catch (error) {
        console.error(`Failed to fetch insights from ${moduleAI.module} AI:`, error);
        return {
          module: moduleAI.module,
          insights: []
        };
      }
    });

    const results = await Promise.all(insightPromises);

    // Synthesize unified context
    return this.synthesizeContext(results);
  }

  /**
   * Synthesize insights from multiple AIs into unified context
   */
  private synthesizeContext(results: Array<{ module: string; insights: AIInsight[] }>): UnifiedAIContext {
    const context: UnifiedAIContext = {
      catalogInsights: [],
      qualityInsights: [],
      lineageInsights: [],
      pipelineInsights: [],
      overallRecommendations: [],
      riskAreas: [],
      correlations: []
    };

    // Categorize insights by module
    results.forEach(({ module, insights }) => {
      switch (module) {
        case 'catalog':
          context.catalogInsights = insights;
          break;
        case 'quality':
          context.qualityInsights = insights;
          break;
        case 'lineage':
          context.lineageInsights = insights;
          break;
        case 'pipelines':
          context.pipelineInsights = insights;
          break;
      }
    });

    // Generate cross-module correlations
    context.correlations = this.findCorrelations(context);

    // Identify risk areas
    context.riskAreas = this.identifyRisks(context);

    // Generate overall recommendations
    context.overallRecommendations = this.generateRecommendations(context);

    return context;
  }

  /**
   * Find correlations between insights from different modules
   */
  private findCorrelations(context: UnifiedAIContext): Array<{
    modules: string[];
    finding: string;
    impact: string;
  }> {
    const correlations: Array<{ modules: string[]; finding: string; impact: string }> = [];

    // Example: Quality issues + Lineage = Impact analysis
    const qualityWarnings = context.qualityInsights.filter(i => i.type === 'warning');
    const lineageImpacts = context.lineageInsights;

    if (qualityWarnings.length > 0 && lineageImpacts.length > 0) {
      correlations.push({
        modules: ['quality', 'lineage'],
        finding: `${qualityWarnings.length} quality issues detected in tables with downstream dependencies`,
        impact: 'Data quality problems may propagate to downstream systems and reports'
      });
    }

    // Example: Catalog PII + Quality rules
    const piiDetections = context.catalogInsights.filter(i =>
      i.message.toLowerCase().includes('pii') || i.message.toLowerCase().includes('sensitive')
    );
    const qualityRules = context.qualityInsights;

    if (piiDetections.length > 0 && qualityRules.length > 0) {
      correlations.push({
        modules: ['catalog', 'quality'],
        finding: `${piiDetections.length} PII fields detected, ${qualityRules.length} quality rules active`,
        impact: 'Ensure PII fields have appropriate validation and masking rules'
      });
    }

    // Example: Pipeline failures + Quality degradation
    const pipelineFailures = context.pipelineInsights.filter(i => i.type === 'warning');
    const qualityDegradation = context.qualityInsights.filter(i =>
      i.message.toLowerCase().includes('degradation') || i.message.toLowerCase().includes('decline')
    );

    if (pipelineFailures.length > 0 && qualityDegradation.length > 0) {
      correlations.push({
        modules: ['pipelines', 'quality'],
        finding: 'Pipeline failures coinciding with quality score decline',
        impact: 'Recent pipeline issues may be causing data quality problems'
      });
    }

    return correlations;
  }

  /**
   * Identify high-priority risk areas
   */
  private identifyRisks(context: UnifiedAIContext): Array<{
    module: string;
    risk: string;
    severity: 'high' | 'medium' | 'low';
  }> {
    const risks: Array<{ module: string; risk: string; severity: 'high' | 'medium' | 'low' }> = [];

    // High severity warnings from any module
    [
      { module: 'catalog', insights: context.catalogInsights },
      { module: 'quality', insights: context.qualityInsights },
      { module: 'lineage', insights: context.lineageInsights },
      { module: 'pipelines', insights: context.pipelineInsights }
    ].forEach(({ module, insights }) => {
      const warnings = insights.filter(i => i.type === 'warning');

      warnings.forEach(warning => {
        const severity = warning.confidence > 0.8 ? 'high' : warning.confidence > 0.5 ? 'medium' : 'low';
        risks.push({
          module,
          risk: warning.message,
          severity
        });
      });
    });

    return risks.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Generate overall recommendations by synthesizing insights
   */
  private generateRecommendations(context: UnifiedAIContext): string[] {
    const recommendations: string[] = [];

    // Quality-based recommendations
    const criticalQualityIssues = context.qualityInsights.filter(i =>
      i.type === 'warning' && i.confidence > 0.7
    );
    if (criticalQualityIssues.length > 3) {
      recommendations.push(
        `Address ${criticalQualityIssues.length} critical quality issues to prevent data reliability problems`
      );
    }

    // PII recommendations
    const piiIssues = context.catalogInsights.filter(i =>
      i.message.toLowerCase().includes('pii') && i.type === 'warning'
    );
    if (piiIssues.length > 0) {
      recommendations.push(
        'Review and secure PII fields with appropriate access controls and masking rules'
      );
    }

    // Pipeline recommendations
    const pipelineIssues = context.pipelineInsights.filter(i => i.type === 'warning');
    if (pipelineIssues.length > 2) {
      recommendations.push(
        `Investigate ${pipelineIssues.length} pipeline issues that may affect data freshness and quality`
      );
    }

    // Lineage recommendations
    if (context.lineageInsights.length > 0) {
      recommendations.push(
        'Review downstream impact of recent schema changes and quality issues'
      );
    }

    return recommendations;
  }

  /**
   * Route query to appropriate module AI(s)
   */
  public async routeQuery(query: string, context?: any): Promise<{
    response: string;
    sources: string[];
    confidence: number;
  }> {
    // Analyze query to determine which AI(s) should handle it
    const relevantModules = this.analyzeQueryIntent(query);

    // Query multiple AIs in parallel
    const responses = await Promise.all(
      relevantModules.map(async (module) => {
        const moduleAI = this.moduleAIs.get(module);
        if (!moduleAI) return null;

        try {
          const response = await axios.post(`${moduleAI.endpoint}/query`, {
            query,
            context
          });

          return {
            module,
            response: response.data.response,
            confidence: response.data.confidence || 0.5
          };
        } catch (error) {
          console.error(`Failed to query ${module} AI:`, error);
          return null;
        }
      })
    );

    // Filter out failed responses
    const validResponses = responses.filter(r => r !== null);

    if (validResponses.length === 0) {
      return {
        response: 'I apologize, but I encountered an issue processing your request. Please try rephrasing or contact support.',
        sources: [],
        confidence: 0
      };
    }

    // Synthesize responses from multiple AIs
    return this.synthesizeResponses(validResponses, query);
  }

  /**
   * Analyze query to determine which module AI(s) should respond
   */
  private analyzeQueryIntent(query: string): string[] {
    const queryLower = query.toLowerCase();
    const modules: string[] = [];

    // Catalog-related keywords
    if (/(find|search|show|list).*(table|column|field|schema|database)/i.test(query) ||
        /pii|sensitive|personal|privacy/i.test(queryLower)) {
      modules.push('catalog');
    }

    // Quality-related keywords
    if (/quality|validation|rule|check|accurate|complete|valid/i.test(queryLower)) {
      modules.push('quality');
    }

    // Lineage-related keywords
    if (/lineage|dependency|impact|downstream|upstream|flow/i.test(queryLower)) {
      modules.push('lineage');
    }

    // Pipeline-related keywords
    if (/pipeline|workflow|etl|job|schedule|run|execute/i.test(queryLower)) {
      modules.push('pipelines');
    }

    // If no specific module detected, use all AIs
    if (modules.length === 0) {
      modules.push('catalog', 'quality', 'lineage', 'pipelines');
    }

    return modules;
  }

  /**
   * Synthesize multiple AI responses into a cohesive answer
   */
  private synthesizeResponses(
    responses: Array<{ module: string; response: string; confidence: number }>,
    originalQuery: string
  ): { response: string; sources: string[]; confidence: number } {
    // Sort by confidence
    responses.sort((a, b) => b.confidence - a.confidence);

    let synthesized = '';
    const sources: string[] = [];

    if (responses.length === 1) {
      // Single AI response
      synthesized = responses[0].response;
      sources.push(responses[0].module);
    } else {
      // Multiple AI responses - create structured response
      synthesized = `Based on insights from multiple AI specialists:\n\n`;

      responses.forEach((resp, index) => {
        const moduleName = resp.module.charAt(0).toUpperCase() + resp.module.slice(1);
        synthesized += `**${moduleName} AI:**\n${resp.response}\n\n`;
        sources.push(resp.module);
      });

      // Add synthesis summary
      synthesized += `\n**Summary:** These insights are interconnected and provide a comprehensive view of your data governance status.`;
    }

    // Calculate average confidence
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;

    return {
      response: synthesized,
      sources,
      confidence: avgConfidence
    };
  }

  /**
   * Get cached insights for a specific module
   */
  public getCachedInsights(module: string): AIInsight[] {
    return this.insightCache.get(module) || [];
  }

  /**
   * Clear insight cache
   */
  public clearCache() {
    this.insightCache.clear();
  }
}

export const aiOrchestrator = AIOrchestrator.getInstance();
export default aiOrchestrator;
