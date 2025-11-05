import { openai } from '@config/openai';
import { logger } from '@utils/logger';
import { AIService } from './AIService';
import { DataContextProvider, DataContext } from './DataContextProvider';
import { CacheService } from './CacheService';

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ConversationContext {
  sessionId: string;
  messages: ConversationMessage[];
  dataContext?: DataContext;
  preferences?: {
    detailLevel?: 'brief' | 'detailed' | 'comprehensive';
    includeCode?: boolean;
    includeRecommendations?: boolean;
  };
}

export interface EnhancedQueryRequest {
  query: string;
  sessionId?: string;
  conversationHistory?: ConversationMessage[];
  includeContext?: boolean;
  preferences?: ConversationContext['preferences'];
}

export interface EnhancedQueryResponse {
  message: string;
  type: 'text' | 'data' | 'query' | 'analysis' | 'visualization' | 'code';
  data?: any;
  sql?: string;
  recommendations?: string[];
  relatedAssets?: string[];
  confidence: number;
  processingTime: number;
  isAiGenerated: boolean;
  sessionId: string;
}

export class EnhancedAIService extends AIService {
  private dataContextProvider: DataContextProvider;
  private cacheService: CacheService;
  private conversations: Map<string, ConversationContext> = new Map();

  constructor() {
    super();
    this.dataContextProvider = new DataContextProvider();
    this.cacheService = new CacheService();
  }

  /**
   * Process natural language query with full context awareness
   */
  public async processQuery(request: EnhancedQueryRequest): Promise<EnhancedQueryResponse> {
    const startTime = Date.now();
    const sessionId = request.sessionId || this.generateSessionId();

    try {
      logger.info('Processing enhanced query', { query: request.query, sessionId });

      // Get or create conversation context
      const context = this.getOrCreateContext(sessionId, request);

      // Fetch data context if requested
      if (request.includeContext !== false) {
        context.dataContext = await this.dataContextProvider.getDataContext();
      }

      // Detect query intent
      const intent = this.detectQueryIntent(request.query);
      logger.info('Detected query intent:', intent);

      // Route to specialized handler
      let response: EnhancedQueryResponse;

      switch (intent.type) {
        case 'search':
          response = await this.handleSearchQuery(request.query, context, intent);
          break;
        case 'quality':
          response = await this.handleQualityQuery(request.query, context, intent);
          break;
        case 'lineage':
          response = await this.handleLineageQuery(request.query, context, intent);
          break;
        case 'pipeline':
          response = await this.handlePipelineQuery(request.query, context, intent);
          break;
        case 'statistics':
          response = await this.handleStatisticsQuery(request.query, context, intent);
          break;
        case 'sensitive_data':
          response = await this.handleSensitiveDataQuery(request.query, context, intent);
          break;
        case 'sql_generation':
          response = await this.handleSQLGeneration(request.query, context, intent);
          break;
        case 'recommendation':
          response = await this.handleRecommendationQuery(request.query, context, intent);
          break;
        default:
          response = await this.handleGeneralQuery(request.query, context);
      }

      // Add processing time
      response.processingTime = Date.now() - startTime;
      response.sessionId = sessionId;

      // Update conversation history
      this.updateConversationHistory(context, request.query, response.message);

      return response;

    } catch (error) {
      logger.error('Enhanced query processing failed:', error);
      return {
        message: 'I encountered an error processing your query. Please try again.',
        type: 'text',
        confidence: 0,
        processingTime: Date.now() - startTime,
        isAiGenerated: false,
        sessionId,
      };
    }
  }

  /**
   * Detect the intent of the user query
   */
  private detectQueryIntent(query: string): { type: string; entities: string[] } {
    const lowerQuery = query.toLowerCase();
    const entities: string[] = [];

    // Search/Discovery intent
    if (lowerQuery.match(/\b(find|search|show me|list|what|where is)\b.*\b(table|column|field|data|dataset|source)\b/)) {
      return { type: 'search', entities };
    }

    // Quality intent
    if (lowerQuery.match(/\b(quality|issue|problem|error|validation|completeness|accuracy)\b/)) {
      return { type: 'quality', entities };
    }

    // Lineage intent
    if (lowerQuery.match(/\b(lineage|upstream|downstream|dependency|source|impact|flow|comes from|used by)\b/)) {
      return { type: 'lineage', entities };
    }

    // Pipeline intent
    if (lowerQuery.match(/\b(pipeline|workflow|job|run|execution|etl|schedule)\b/)) {
      return { type: 'pipeline', entities };
    }

    // Statistics intent
    if (lowerQuery.match(/\b(how many|count|total|statistics|metrics|summary|overview)\b/)) {
      return { type: 'statistics', entities };
    }

    // Sensitive data intent
    if (lowerQuery.match(/\b(sensitive|pii|phi|personal|private|confidential|security|compliance|gdpr|hipaa)\b/)) {
      return { type: 'sensitive_data', entities };
    }

    // SQL generation intent
    if (lowerQuery.match(/\b(generate sql|write query|create query|sql for|query to)\b/)) {
      return { type: 'sql_generation', entities };
    }

    // Recommendation intent
    if (lowerQuery.match(/\b(recommend|suggest|improve|optimize|best practice|should i)\b/)) {
      return { type: 'recommendation', entities };
    }

    return { type: 'general', entities };
  }

  /**
   * Handle search/discovery queries
   */
  private async handleSearchQuery(query: string, context: ConversationContext, intent: any): Promise<EnhancedQueryResponse> {
    const dataContext = context.dataContext!;

    // Extract search terms
    const searchTerms = this.extractSearchTerms(query);
    logger.info('Search terms:', searchTerms);

    // Search in assets
    const results = await Promise.all(
      searchTerms.map(term => this.dataContextProvider.searchAssets(term, dataContext))
    );

    const allAssets = [...new Set(results.flat())];

    if (allAssets.length === 0) {
      return {
        message: `I couldn't find any assets matching "${searchTerms.join('", "')}". Try different keywords or check if the data has been cataloged.`,
        type: 'text',
        confidence: 0.8,
        processingTime: 0,
        isAiGenerated: false,
        sessionId: context.sessionId,
      };
    }

    // Format response
    const message = this.formatSearchResults(allAssets, searchTerms);

    return {
      message,
      type: 'data',
      data: { assets: allAssets, count: allAssets.length },
      recommendations: [
        'Click on an asset to view details',
        'Use filters to narrow down results',
        'Check lineage to understand data flow',
      ],
      relatedAssets: allAssets.slice(0, 5).map(a => a.name),
      confidence: 0.9,
      processingTime: 0,
      isAiGenerated: false,
      sessionId: context.sessionId,
    };
  }

  /**
   * Handle quality-related queries
   */
  private async handleQualityQuery(query: string, context: ConversationContext, intent: any): Promise<EnhancedQueryResponse> {
    const dataContext = context.dataContext!;

    // Check if asking about specific asset
    const assetName = this.extractAssetName(query);

    if (assetName) {
      const qualityInfo = await this.dataContextProvider.getQualityInfo(assetName, dataContext);

      if (qualityInfo) {
        const message = this.formatQualityInfo(qualityInfo);
        return {
          message,
          type: 'analysis',
          data: qualityInfo,
          confidence: 0.95,
          processingTime: 0,
          isAiGenerated: false,
          sessionId: context.sessionId,
        };
      }
    }

    // General quality overview
    const assetsWithIssues = await this.dataContextProvider.getAssetsWithIssues(dataContext);

    const message = this.formatQualityOverview(dataContext, assetsWithIssues);

    return {
      message,
      type: 'analysis',
      data: {
        overview: dataContext.statistics,
        assetsWithIssues: assetsWithIssues.slice(0, 10),
      },
      recommendations: [
        'Focus on assets with low quality scores',
        'Review and fix validation errors',
        'Set up automated quality monitoring',
      ],
      confidence: 0.9,
      processingTime: 0,
      isAiGenerated: false,
      sessionId: context.sessionId,
    };
  }

  /**
   * Handle lineage queries
   */
  private async handleLineageQuery(query: string, context: ConversationContext, intent: any): Promise<EnhancedQueryResponse> {
    const dataContext = context.dataContext!;
    const assetName = this.extractAssetName(query);

    if (!assetName) {
      return {
        message: 'Please specify which table or asset you want to see lineage for. For example: "Show me lineage for customers table"',
        type: 'text',
        confidence: 0.7,
        processingTime: 0,
        isAiGenerated: false,
        sessionId: context.sessionId,
      };
    }

    const lineageInfo = await this.dataContextProvider.getLineageForAsset(assetName, dataContext);

    if (!lineageInfo) {
      return {
        message: `I couldn't find lineage information for "${assetName}". Make sure the asset exists and has been scanned for lineage.`,
        type: 'text',
        confidence: 0.8,
        processingTime: 0,
        isAiGenerated: false,
        sessionId: context.sessionId,
      };
    }

    const message = this.formatLineageInfo(lineageInfo);

    return {
      message,
      type: 'visualization',
      data: lineageInfo,
      confidence: 0.95,
      processingTime: 0,
      isAiGenerated: false,
      sessionId: context.sessionId,
    };
  }

  /**
   * Handle pipeline status queries
   */
  private async handlePipelineQuery(query: string, context: ConversationContext, intent: any): Promise<EnhancedQueryResponse> {
    const dataContext = context.dataContext!;
    const pipelineName = this.extractPipelineName(query);

    const pipelines = await this.dataContextProvider.getPipelineStatus(pipelineName, dataContext);

    const message = this.formatPipelineStatus(pipelines, dataContext.statistics);

    return {
      message,
      type: 'analysis',
      data: { pipelines },
      recommendations: pipelines.filter(p => p.status === 'failed').length > 0
        ? ['Check logs for failed pipelines', 'Review error messages', 'Restart failed jobs']
        : ['All pipelines running smoothly', 'Monitor execution times', 'Review schedule if needed'],
      confidence: 0.95,
      processingTime: 0,
      isAiGenerated: false,
      sessionId: context.sessionId,
    };
  }

  /**
   * Handle statistics/overview queries
   */
  private async handleStatisticsQuery(query: string, context: ConversationContext, intent: any): Promise<EnhancedQueryResponse> {
    const dataContext = context.dataContext!;
    const stats = dataContext.statistics;

    const message = `📊 **Data Platform Overview**

**Overall Statistics:**
- **Total Assets**: ${stats.totalAssets} tables, views, and columns cataloged
- **Data Sources**: ${stats.totalDataSources} connected databases
- **Average Quality Score**: ${stats.averageQualityScore}% across all assets
- **Active Pipelines**: ${stats.activePipelines} currently running
- **Quality Issues**: ${stats.totalIssues} issues requiring attention

**Data Sources Breakdown:**
${dataContext.dataSources.map(ds => `- **${ds.name}** (${ds.type}): ${ds.status}`).join('\n')}

**Quality Summary:**
${dataContext.qualityMetrics.length > 0
  ? `- Monitored Assets: ${dataContext.qualityMetrics.length}
- Best Performing: ${dataContext.qualityMetrics.sort((a, b) => b.score - a.score)[0]?.assetName} (${dataContext.qualityMetrics[0]?.score}%)
- Needs Attention: ${dataContext.qualityMetrics.sort((a, b) => a.score - b.score)[0]?.assetName} (${dataContext.qualityMetrics.sort((a, b) => a.score - b.score)[0]?.score}%)`
  : '- No quality metrics available yet'}`;

    return {
      message,
      type: 'analysis',
      data: { statistics: stats, details: dataContext },
      confidence: 1.0,
      processingTime: 0,
      isAiGenerated: false,
      sessionId: context.sessionId,
    };
  }

  /**
   * Handle sensitive data queries
   */
  private async handleSensitiveDataQuery(query: string, context: ConversationContext, intent: any): Promise<EnhancedQueryResponse> {
    const dataContext = context.dataContext!;
    const sensitiveAssets = await this.dataContextProvider.getSensitiveAssets(dataContext);

    const message = this.formatSensitiveDataReport(sensitiveAssets);

    return {
      message,
      type: 'analysis',
      data: { sensitiveAssets },
      recommendations: [
        'Ensure encryption at rest for PII/PHI data',
        'Review access controls for sensitive assets',
        'Implement data masking for non-production environments',
        'Regularly audit sensitive data access',
      ],
      confidence: 0.95,
      processingTime: 0,
      isAiGenerated: false,
      sessionId: context.sessionId,
    };
  }

  /**
   * Handle SQL generation requests
   */
  private async handleSQLGeneration(query: string, context: ConversationContext, intent: any): Promise<EnhancedQueryResponse> {
    // Use the parent class method
    const nlQuery = {
      query: query,
      context: {
        schemas: [...new Set(context.dataContext!.assets.map(a => a.schema))],
        tables: [...new Set(context.dataContext!.assets.filter(a => a.type === 'table').map(a => a.name))],
        fields: [...new Set(context.dataContext!.assets.filter(a => a.type === 'column').map(a => a.name))],
      },
    };

    const result = await this.processNaturalLanguageQuery(nlQuery);

    return {
      message: result.explanation,
      type: 'code',
      sql: result.sql,
      data: result,
      confidence: result.confidence,
      processingTime: 0,
      isAiGenerated: result.isAiGenerated,
      sessionId: context.sessionId,
    };
  }

  /**
   * Handle recommendation queries
   */
  private async handleRecommendationQuery(query: string, context: ConversationContext, intent: any): Promise<EnhancedQueryResponse> {
    const dataContext = context.dataContext!;

    // Use AI if available
    if (openai.isAvailable()) {
      const contextSummary = this.buildContextSummary(dataContext);

      try {
        const response = await openai.createChatCompletion({
          model: process.env.OPENAI_MODEL || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a data governance expert providing actionable recommendations for data management and quality improvement.',
            },
            {
              role: 'user',
              content: `Based on this data platform state:\n${contextSummary}\n\nUser question: ${query}\n\nProvide specific, actionable recommendations.`,
            },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        });

        const aiMessage = response.choices[0]?.message?.content || 'Unable to generate recommendations at this time.';

        return {
          message: aiMessage,
          type: 'text',
          confidence: 0.85,
          processingTime: 0,
          isAiGenerated: true,
          sessionId: context.sessionId,
        };
      } catch (error) {
        logger.error('AI recommendation failed:', error);
      }
    }

    // Fallback recommendations
    return {
      message: this.generateFallbackRecommendations(dataContext),
      type: 'text',
      confidence: 0.7,
      processingTime: 0,
      isAiGenerated: false,
      sessionId: context.sessionId,
    };
  }

  /**
   * Handle general conversational queries
   */
  private async handleGeneralQuery(query: string, context: ConversationContext): Promise<EnhancedQueryResponse> {
    // Use AI if available for general conversation
    if (openai.isAvailable()) {
      const contextSummary = this.buildContextSummary(context.dataContext!);

      try {
        const messages: any[] = [
          {
            role: 'system',
            content: `You are a helpful AI assistant for a data governance platform. You have access to information about data sources, assets, quality metrics, lineage, and pipelines. Be concise and helpful.

Current platform state:
${contextSummary}`,
          },
          ...context.messages.slice(-5), // Include last 5 messages for context
          {
            role: 'user',
            content: query,
          },
        ];

        const response = await openai.createChatCompletion({
          model: process.env.OPENAI_MODEL || 'gpt-4',
          messages,
          max_tokens: 800,
          temperature: 0.7,
        });

        const aiMessage = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response at this time.';

        return {
          message: aiMessage,
          type: 'text',
          confidence: 0.8,
          processingTime: 0,
          isAiGenerated: true,
          sessionId: context.sessionId,
        };
      } catch (error) {
        logger.error('AI general query failed:', error);
      }
    }

    // Fallback response
    return {
      message: `I understand you're asking about "${query}". Try asking about:
- Data quality metrics
- Finding specific tables or columns
- Pipeline status
- Sensitive data discovery
- Lineage information

Or ask me to generate SQL queries for you!`,
      type: 'text',
      confidence: 0.5,
      processingTime: 0,
      isAiGenerated: false,
      sessionId: context.sessionId,
    };
  }

  // Helper methods for formatting responses

  private formatSearchResults(assets: any[], searchTerms: string[]): string {
    const grouped = assets.reduce((acc, asset) => {
      if (!acc[asset.type]) acc[asset.type] = [];
      acc[asset.type].push(asset);
      return acc;
    }, {} as Record<string, any[]>);

    let message = `🔍 **Search Results for "${searchTerms.join('", "')}**\n\nFound ${assets.length} assets:\n\n`;

    for (const [type, items] of Object.entries(grouped)) {
      message += `**${type.toUpperCase()}S** (${items.length}):\n`;
      items.slice(0, 10).forEach(item => {
        message += `- **${item.name}**`;
        if (item.schema) message += ` (${item.schema})`;
        if (item.description) message += ` - ${item.description}`;
        message += '\n';
      });
      message += '\n';
    }

    if (assets.length > 10) {
      message += `\n_Showing first 10 results. ${assets.length - 10} more available._`;
    }

    return message;
  }

  private formatQualityInfo(quality: any): string {
    return `📊 **Quality Report for ${quality.assetName}**

**Overall Score**: ${quality.score}%
**Issues Found**: ${quality.issues}
**Last Check**: ${new Date(quality.lastRun).toLocaleString()}

**Active Rules**: ${quality.rules?.length || 0} validation rules
${quality.rules?.slice(0, 5).map((r: any) => `- ${r.name || r.rule}`).join('\n') || ''}

${quality.issues > 0 ? '⚠️ **Action Required**: Review and fix quality issues' : '✅ **All checks passed**'}`;
  }

  private formatQualityOverview(dataContext: any, assetsWithIssues: any[]): string {
    return `📊 **Data Quality Overview**

**Platform Health**:
- Average Quality Score: ${dataContext.statistics.averageQualityScore}%
- Total Issues: ${dataContext.statistics.totalIssues}
- Assets Monitored: ${dataContext.qualityMetrics.length}

**Assets Requiring Attention** (${assetsWithIssues.length}):
${assetsWithIssues.slice(0, 5).map(({ asset, quality }) =>
  `- **${asset.name}**: ${quality.score}% (${quality.issues} issues)`
).join('\n')}

${dataContext.statistics.averageQualityScore >= 90 ? '✅ Overall quality is excellent!' :
  dataContext.statistics.averageQualityScore >= 75 ? '⚠️ Quality is acceptable but can be improved' :
  '🔴 Quality needs immediate attention'}`;
  }

  private formatLineageInfo(lineage: any): string {
    return `📊 **Lineage for ${lineage.name}**

**Type**: ${lineage.type}

**Upstream Dependencies** (${lineage.upstream?.length || 0}):
${lineage.upstream?.map((u: string) => `- ${u}`).join('\n') || 'None'}

**Downstream Consumers** (${lineage.downstream?.length || 0}):
${lineage.downstream?.map((d: string) => `- ${d}`).join('\n') || 'None'}`;
  }

  private formatPipelineStatus(pipelines: any[], stats: any): string {
    if (pipelines.length === 0) {
      return '📊 **Pipeline Status**: No pipelines found.';
    }

    const byStatus = pipelines.reduce((acc, p) => {
      if (!acc[p.status]) acc[p.status] = [];
      acc[p.status].push(p);
      return acc;
    }, {} as Record<string, any[]>);

    let message = `📊 **Pipeline Status Overview**\n\n`;
    message += `**Active**: ${stats.activePipelines} pipelines running\n\n`;

    for (const [status, items] of Object.entries(byStatus)) {
      const icon = status === 'running' ? '🟢' : status === 'failed' ? '🔴' : status === 'completed' ? '✅' : '⏸️';
      message += `${icon} **${status.toUpperCase()}** (${items.length}):\n`;
      items.forEach(p => {
        message += `- **${p.name}**`;
        if (p.lastRun) message += ` - Last run: ${new Date(p.lastRun).toLocaleString()}`;
        message += '\n';
      });
      message += '\n';
    }

    return message;
  }

  private formatSensitiveDataReport(assets: any[]): string {
    if (assets.length === 0) {
      return '🛡️ **Sensitive Data Report**: No sensitive data detected.';
    }

    const byClassification = assets.reduce((acc, asset) => {
      const key = asset.classification || asset.sensitivity || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(asset);
      return acc;
    }, {} as Record<string, any[]>);

    let message = `🛡️ **Sensitive Data Report**\n\nFound ${assets.length} sensitive assets:\n\n`;

    for (const [classification, items] of Object.entries(byClassification)) {
      message += `**${classification}** (${items.length} assets):\n`;
      items.slice(0, 10).forEach(asset => {
        message += `- **${asset.name}**`;
        if (asset.schema) message += ` (${asset.schema})`;
        if (asset.sensitivity) message += ` - ${asset.sensitivity} sensitivity`;
        message += '\n';
      });
      message += '\n';
    }

    return message;
  }

  private buildContextSummary(dataContext: DataContext): string {
    return `Data Sources: ${dataContext.statistics.totalDataSources}
Assets: ${dataContext.statistics.totalAssets}
Average Quality: ${dataContext.statistics.averageQualityScore}%
Issues: ${dataContext.statistics.totalIssues}
Active Pipelines: ${dataContext.statistics.activePipelines}`;
  }

  private generateFallbackRecommendations(dataContext: DataContext): string {
    const recommendations: string[] = [];

    if (dataContext.statistics.averageQualityScore < 80) {
      recommendations.push('- Focus on improving data quality - current score is below target');
    }

    if (dataContext.statistics.totalIssues > 10) {
      recommendations.push('- Address quality issues - there are significant validation errors');
    }

    if (dataContext.pipelines.filter(p => p.status === 'failed').length > 0) {
      recommendations.push('- Review and fix failed pipelines');
    }

    if (recommendations.length === 0) {
      recommendations.push('- Continue monitoring data quality metrics');
      recommendations.push('- Regularly review pipeline performance');
      recommendations.push('- Keep data catalog up to date');
    }

    return `💡 **Recommendations**:\n\n${recommendations.join('\n')}`;
  }

  private extractSearchTerms(query: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = ['find', 'show', 'me', 'the', 'a', 'an', 'for', 'with', 'in', 'on', 'at', 'by', 'what', 'where', 'is', 'are'];
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => !stopWords.includes(word) && word.length > 2);
  }

  private extractAssetName(query: string): string | null {
    // Try to extract table/asset name from query
    const match = query.match(/\b(table|asset|dataset|column|field)\s+['""]?(\w+)['""]?/i);
    if (match) return match[2];

    // Look for quoted strings
    const quoted = query.match(/['""]([^'""]+)['""]/) ;
    if (quoted) return quoted[1];

    // Look for words after "for"
    const forMatch = query.match(/\bfor\s+(\w+)/i);
    if (forMatch) return forMatch[1];

    return null;
  }

  private extractPipelineName(query: string): string | null {
    const match = query.match(/\bpipeline\s+['""]?(\w+)['""]?/i);
    if (match) return match[1];

    const quoted = query.match(/['""]([^'""]+)['""]/ );
    if (quoted) return quoted[1];

    return null;
  }

  private getOrCreateContext(sessionId: string, request: EnhancedQueryRequest): ConversationContext {
    if (this.conversations.has(sessionId)) {
      const context = this.conversations.get(sessionId)!;
      if (request.preferences) {
        context.preferences = { ...context.preferences, ...request.preferences };
      }
      return context;
    }

    const newContext: ConversationContext = {
      sessionId,
      messages: request.conversationHistory || [],
      preferences: request.preferences,
    };

    this.conversations.set(sessionId, newContext);
    return newContext;
  }

  private updateConversationHistory(context: ConversationContext, userMessage: string, assistantResponse: string): void {
    context.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    context.messages.push({
      role: 'assistant',
      content: assistantResponse,
      timestamp: new Date(),
    });

    // Keep only last 20 messages
    if (context.messages.length > 20) {
      context.messages = context.messages.slice(-20);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Clear conversation context
   */
  public clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
  }

  /**
   * Get conversation context
   */
  public getConversation(sessionId: string): ConversationContext | null {
    return this.conversations.get(sessionId) || null;
  }
}
