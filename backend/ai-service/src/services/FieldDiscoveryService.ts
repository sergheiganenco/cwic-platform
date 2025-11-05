import { openai } from '@config/openai';
import { logger } from '@utils/logger';
import axios from 'axios';
import { CacheService } from './CacheService';
import {
  buildFieldDiscoveryPrompt,
  FIELD_DISCOVERY_SYSTEM_PROMPT,
  type FieldDiscoveryRequest,
  type FieldDiscoveryResultField
} from '../prompts/fieldDiscovery';

export interface DiscoveredField {
  id: string;
  assetId: number;
  assetName: string;
  fieldName: string;
  schema: string;
  tableName: string;
  dataType: string;
  classification: 'General' | 'PII' | 'PHI' | 'Financial';
  sensitivity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  suggestedTags: string[];
  suggestedRules: string[];
  dataPatterns: string[];
  businessContext: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'needs-review' | 'rejected';
  detectedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  isAiGenerated: boolean;
}

export interface DriftAlert {
  id: string;
  assetId: number;
  assetName: string;
  fieldName: string;
  issueType: 'new_value' | 'distribution_shift' | 'type_change' | 'nullability_change';
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  firstSeen: Date;
  lastSeen: Date;
  metadata?: any;
}

export interface FieldDiscoveryStats {
  newFieldsThisWeek: number;
  documentationComplete: number;
  fieldsNeedingReview: number;
  sourcesScanned: number;
  totalFields: number;
  classifiedFields: number;
  sensitiveFields: number;
}

export class FieldDiscoveryService {
  private cacheService: CacheService;
  private dataServiceUrl: string;

  constructor() {
    this.cacheService = new CacheService();
    this.dataServiceUrl = process.env.DATA_SERVICE_URL || 'http://localhost:3002';
  }

  /**
   * Discover and classify fields from a specific data source
   */
  public async discoverFieldsFromSource(
    dataSourceId: number,
    options?: {
      schemas?: string[];
      tables?: string[];
      forceRefresh?: boolean;
    }
  ): Promise<DiscoveredField[]> {
    try {
      logger.info('Discovering fields from data source', { dataSourceId, options });

      // Fetch assets (tables and columns) from the data service
      const assets = await this.fetchAssetsFromSource(dataSourceId, options);

      if (!assets || assets.length === 0) {
        logger.warn('No assets found for data source', { dataSourceId });
        return [];
      }

      // Group columns by table
      const tableGroups = this.groupAssetsByTable(assets);

      // Process each table
      const allDiscoveredFields: DiscoveredField[] = [];

      for (const [tableName, tableData] of tableGroups.entries()) {
        const discoveredFields = await this.analyzeTable(tableData);
        allDiscoveredFields.push(...discoveredFields);
      }

      logger.info('Field discovery completed', {
        dataSourceId,
        tablesProcessed: tableGroups.size,
        fieldsDiscovered: allDiscoveredFields.length
      });

      return allDiscoveredFields;

    } catch (error) {
      logger.error('Field discovery failed', { dataSourceId, error });
      throw error;
    }
  }

  /**
   * Get all discovered fields with filtering
   */
  public async getDiscoveredFields(filter?: {
    status?: 'pending' | 'accepted' | 'needs-review' | 'rejected';
    classification?: 'General' | 'PII' | 'PHI' | 'Financial';
    sensitivity?: 'Low' | 'Medium' | 'High' | 'Critical';
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ fields: DiscoveredField[]; total: number }> {
    try {
      // In a real implementation, this would query a database
      // For now, we'll fetch from cache or generate fresh data
      const cacheKey = `discovered_fields:${JSON.stringify(filter)}`;
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch real data from data service
      const assets = await this.fetchAllAssets();
      const discoveredFields = await this.convertAssetsToDiscoveredFields(assets);

      // Apply filters
      let filtered = discoveredFields;

      if (filter?.status) {
        filtered = filtered.filter(f => f.status === filter.status);
      }

      if (filter?.classification) {
        filtered = filtered.filter(f => f.classification === filter.classification);
      }

      if (filter?.sensitivity) {
        filtered = filtered.filter(f => f.sensitivity === filter.sensitivity);
      }

      if (filter?.search) {
        const searchLower = filter.search.toLowerCase();
        filtered = filtered.filter(f =>
          f.fieldName.toLowerCase().includes(searchLower) ||
          f.assetName.toLowerCase().includes(searchLower) ||
          f.tableName.toLowerCase().includes(searchLower)
        );
      }

      const total = filtered.length;
      const offset = filter?.offset || 0;
      const limit = filter?.limit || 50;
      const paginated = filtered.slice(offset, offset + limit);

      const result = { fields: paginated, total };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(result), 300);

      return result;

    } catch (error) {
      logger.error('Failed to get discovered fields', { error });
      throw error;
    }
  }

  /**
   * Get drift alerts for schema changes
   */
  public async getDriftAlerts(): Promise<DriftAlert[]> {
    try {
      // In a real implementation, this would track schema changes over time
      // For now, return sample data based on real assets
      const assets = await this.fetchAllAssets();

      const alerts: DriftAlert[] = [];

      // Detect potential drift by looking for recently added fields
      const recentAssets = assets.filter(a => {
        // Fields added in the last 7 days
        return a.type === 'column' && new Date().getTime() - new Date(a.createdAt || Date.now()).getTime() < 7 * 24 * 60 * 60 * 1000;
      });

      for (const asset of recentAssets.slice(0, 10)) {
        alerts.push({
          id: `drift-${asset.id}`,
          assetId: asset.id,
          assetName: `${asset.schema}.${asset.tableName}`,
          fieldName: asset.name,
          issueType: 'new_value',
          issue: `New column detected: ${asset.name} (${asset.dataType})`,
          severity: 'medium',
          firstSeen: new Date(asset.createdAt || Date.now()),
          lastSeen: new Date(),
          metadata: { dataType: asset.dataType }
        });
      }

      return alerts;

    } catch (error) {
      logger.error('Failed to get drift alerts', { error });
      return [];
    }
  }

  /**
   * Get field discovery statistics
   */
  public async getStats(): Promise<FieldDiscoveryStats> {
    try {
      const assets = await this.fetchAllAssets();
      const columns = assets.filter(a => a.type === 'column');

      // Count fields by various criteria
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const newFieldsThisWeek = columns.filter(c =>
        c.createdAt && new Date(c.createdAt) > oneWeekAgo
      ).length;

      const documentedFields = columns.filter(c => c.description && c.description.trim() !== '').length;
      const documentationComplete = columns.length > 0
        ? Math.round((documentedFields / columns.length) * 100)
        : 0;

      const classifiedFields = columns.filter(c => c.classification).length;
      const sensitiveFields = columns.filter(c =>
        c.classification && ['PII', 'PHI', 'Financial'].includes(c.classification)
      ).length;

      const fieldsNeedingReview = columns.filter(c =>
        !c.classification || !c.description || c.sensitivity === 'High' || c.sensitivity === 'Critical'
      ).length;

      // Get unique data sources
      const dataSources = await this.fetchDataSources();
      const sourcesScanned = dataSources.length;

      return {
        newFieldsThisWeek,
        documentationComplete,
        fieldsNeedingReview,
        sourcesScanned,
        totalFields: columns.length,
        classifiedFields,
        sensitiveFields
      };

    } catch (error) {
      logger.error('Failed to get field discovery stats', { error });
      return {
        newFieldsThisWeek: 0,
        documentationComplete: 0,
        fieldsNeedingReview: 0,
        sourcesScanned: 0,
        totalFields: 0,
        classifiedFields: 0,
        sensitiveFields: 0
      };
    }
  }

  /**
   * Analyze a table and its columns using AI
   */
  private async analyzeTable(tableData: {
    schema: string;
    tableName: string;
    columns: any[];
    assetId: number;
  }): Promise<DiscoveredField[]> {
    try {
      // Check cache first
      const cacheKey = `field_analysis:${tableData.schema}:${tableData.tableName}`;
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Build request for AI analysis
      const request: FieldDiscoveryRequest = {
        schema: tableData.schema,
        tableName: tableData.tableName,
        columns: tableData.columns.map(col => ({
          name: col.name,
          type: col.dataType || col.type || 'unknown',
          nullable: col.nullable !== false,
          description: col.description
        }))
      };

      let discoveredFields: DiscoveredField[];

      if (openai.isAvailable()) {
        // Use AI for classification
        discoveredFields = await this.analyzeWithAI(request, tableData.assetId, tableData.columns);
      } else {
        // Use rule-based classification
        discoveredFields = await this.analyzeWithRules(request, tableData.assetId, tableData.columns);
      }

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, JSON.stringify(discoveredFields), 3600);

      return discoveredFields;

    } catch (error) {
      logger.error('Table analysis failed', { tableData, error });
      // Fall back to rule-based analysis
      const request: FieldDiscoveryRequest = {
        schema: tableData.schema,
        tableName: tableData.tableName,
        columns: tableData.columns.map(col => ({
          name: col.name,
          type: col.dataType || col.type || 'unknown',
          nullable: col.nullable !== false
        }))
      };
      return await this.analyzeWithRules(request, tableData.assetId, tableData.columns);
    }
  }

  /**
   * Analyze fields using AI (OpenAI)
   */
  private async analyzeWithAI(
    request: FieldDiscoveryRequest,
    assetId: number,
    originalColumns: any[]
  ): Promise<DiscoveredField[]> {
    try {
      const prompt = buildFieldDiscoveryPrompt(request);

      const response = await openai.createChatCompletion({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: FIELD_DISCOVERY_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return this.convertAIResultToDiscoveredFields(
        result,
        request,
        assetId,
        originalColumns,
        true
      );

    } catch (error) {
      logger.error('AI analysis failed, falling back to rules', { error });
      return await this.analyzeWithRules(request, assetId, originalColumns);
    }
  }

  /**
   * Analyze fields using rule-based classification
   */
  private async analyzeWithRules(
    request: FieldDiscoveryRequest,
    assetId: number,
    originalColumns: any[]
  ): Promise<DiscoveredField[]> {
    const discoveredFields: DiscoveredField[] = [];

    for (let i = 0; i < request.columns.length; i++) {
      const column = request.columns[i];
      const originalCol = originalColumns[i];

      const classification = this.classifyFieldByName(column.name);
      const sensitivity = this.determineSensitivity(classification);

      discoveredFields.push({
        id: `${assetId}-${column.name}`,
        assetId: originalCol.id || assetId,
        assetName: `${request.schema}.${request.tableName}`,
        fieldName: column.name,
        schema: request.schema,
        tableName: request.tableName,
        dataType: column.type,
        classification,
        sensitivity,
        description: column.description || `${column.type} field in ${request.tableName}`,
        suggestedTags: this.suggestTags(column.name, classification),
        suggestedRules: this.suggestRules(column.type, classification),
        dataPatterns: this.detectPatterns(column.name, column.type),
        businessContext: `Data field in ${request.tableName} table`,
        confidence: 0.7,
        status: 'pending',
        detectedAt: new Date(),
        isAiGenerated: false
      });
    }

    return discoveredFields;
  }

  // Helper methods
  private async fetchAssetsFromSource(dataSourceId: number, options?: any): Promise<any[]> {
    try {
      const params: any = { dataSourceId };
      if (options?.schemas) params.schemas = options.schemas.join(',');
      if (options?.tables) params.tables = options.tables.join(',');

      const response = await axios.get(`${this.dataServiceUrl}/api/assets`, {
        params,
        timeout: 10000
      });

      return response.data?.data || response.data || [];
    } catch (error) {
      logger.error('Failed to fetch assets from source', { dataSourceId, error });
      return [];
    }
  }

  private async fetchAllAssets(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/assets`, {
        params: { limit: 1000 },
        timeout: 10000
      });

      return response.data?.data || response.data || [];
    } catch (error) {
      logger.error('Failed to fetch all assets', { error });
      return [];
    }
  }

  private async fetchDataSources(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/data-sources`, {
        timeout: 5000
      });

      return response.data?.data || response.data || [];
    } catch (error) {
      logger.error('Failed to fetch data sources', { error });
      return [];
    }
  }

  private groupAssetsByTable(assets: any[]): Map<string, any> {
    const groups = new Map<string, any>();

    for (const asset of assets) {
      if (asset.type === 'column' && asset.tableName) {
        const key = `${asset.schema}.${asset.tableName}`;

        if (!groups.has(key)) {
          groups.set(key, {
            schema: asset.schema,
            tableName: asset.tableName,
            assetId: asset.tableId || asset.id,
            columns: []
          });
        }

        groups.get(key)!.columns.push(asset);
      }
    }

    return groups;
  }

  private async convertAssetsToDiscoveredFields(assets: any[]): Promise<DiscoveredField[]> {
    const fields: DiscoveredField[] = [];

    for (const asset of assets) {
      if (asset.type === 'column') {
        fields.push({
          id: `discovered-${asset.id}`,
          assetId: asset.id,
          assetName: `${asset.schema}.${asset.tableName}`,
          fieldName: asset.name,
          schema: asset.schema,
          tableName: asset.tableName || 'unknown',
          dataType: asset.dataType || asset.type || 'unknown',
          classification: asset.classification || 'General',
          sensitivity: asset.sensitivity || 'Low',
          description: asset.description || `${asset.dataType} field`,
          suggestedTags: asset.tags || [],
          suggestedRules: [],
          dataPatterns: [],
          businessContext: asset.businessContext || '',
          confidence: asset.confidence || 0.8,
          status: asset.reviewStatus || 'pending',
          detectedAt: new Date(asset.createdAt || Date.now()),
          isAiGenerated: false
        });
      }
    }

    return fields;
  }

  private convertAIResultToDiscoveredFields(
    aiResult: any,
    request: FieldDiscoveryRequest,
    assetId: number,
    originalColumns: any[],
    isAiGenerated: boolean
  ): DiscoveredField[] {
    const fields: DiscoveredField[] = [];

    if (!aiResult.fields || !Array.isArray(aiResult.fields)) {
      return [];
    }

    for (let i = 0; i < aiResult.fields.length; i++) {
      const aiField = aiResult.fields[i];
      const originalCol = originalColumns[i];

      fields.push({
        id: `${assetId}-${aiField.name}`,
        assetId: originalCol?.id || assetId,
        assetName: `${request.schema}.${request.tableName}`,
        fieldName: aiField.name,
        schema: request.schema,
        tableName: request.tableName,
        dataType: aiField.type,
        classification: aiField.classification,
        sensitivity: aiField.sensitivity,
        description: aiField.description,
        suggestedTags: this.suggestTags(aiField.name, aiField.classification),
        suggestedRules: aiField.suggestedRules || [],
        dataPatterns: aiField.dataPatterns || [],
        businessContext: aiField.businessContext,
        confidence: aiResult.confidence || 0.9,
        status: 'pending',
        detectedAt: new Date(),
        isAiGenerated
      });
    }

    return fields;
  }

  private classifyFieldByName(fieldName: string): 'General' | 'PII' | 'PHI' | 'Financial' {
    const lowerName = fieldName.toLowerCase();

    if (lowerName.includes('email') || lowerName.includes('phone') || lowerName.includes('name') || lowerName.includes('address')) {
      return 'PII';
    }

    if (lowerName.includes('medical') || lowerName.includes('health') || lowerName.includes('diagnosis')) {
      return 'PHI';
    }

    if (lowerName.includes('payment') || lowerName.includes('card') || lowerName.includes('amount') || lowerName.includes('price')) {
      return 'Financial';
    }

    return 'General';
  }

  private determineSensitivity(classification: string): 'Low' | 'Medium' | 'High' | 'Critical' {
    switch (classification) {
      case 'PHI':
        return 'Critical';
      case 'PII':
      case 'Financial':
        return 'High';
      default:
        return 'Low';
    }
  }

  private suggestTags(fieldName: string, classification: string): string[] {
    const tags: string[] = [];

    if (classification !== 'General') {
      tags.push(classification.toLowerCase());
    }

    if (fieldName.toLowerCase().includes('payment')) tags.push('payments');
    if (fieldName.toLowerCase().includes('customer')) tags.push('customers');
    if (fieldName.toLowerCase().includes('order')) tags.push('orders');

    return tags;
  }

  private suggestRules(dataType: string, classification: string): string[] {
    const rules: string[] = ['Not null validation'];

    if (dataType.toLowerCase().includes('varchar')) {
      rules.push('String length validation');
    }

    if (classification === 'PII' || classification === 'PHI') {
      rules.push('Data encryption required');
      rules.push('Access audit logging');
    }

    return rules;
  }

  private detectPatterns(fieldName: string, dataType: string): string[] {
    const patterns: string[] = [];

    if (fieldName.toLowerCase().includes('email')) {
      patterns.push('Email format');
    }

    if (fieldName.toLowerCase().includes('phone')) {
      patterns.push('Phone number format');
    }

    if (dataType.toLowerCase().includes('date') || dataType.toLowerCase().includes('timestamp')) {
      patterns.push('Date format');
    }

    return patterns;
  }
}
