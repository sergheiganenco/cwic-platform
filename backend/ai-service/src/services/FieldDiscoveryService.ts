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
  totalFields: number;
  byStatus: Record<string, number>;
  byClassification: Record<string, number>;
  bySensitivity: Record<string, number>;
  averageConfidence: number;
  recentDiscoveries: number;
}

export class FieldDiscoveryService {
  private cacheService: CacheService;
  private dataServiceUrl: string;

  constructor() {
    this.cacheService = new CacheService();
    // Use API gateway - in Docker use container name, outside use localhost
    const isDocker = process.env.IS_DOCKER === 'true' || process.env.NODE_ENV === 'production';
    this.dataServiceUrl = process.env.API_GATEWAY_URL ||
      (isDocker ? 'http://api-gateway:8000' : 'http://localhost:8000');
    logger.info('FieldDiscoveryService initialized', { dataServiceUrl: this.dataServiceUrl, isDocker });
  }

  /**
   * Discover and classify fields from a specific data source
   */
  public async discoverFieldsFromSource(
    dataSourceId: number | string,
    options?: {
      schemas?: string[];
      tables?: string[];
      forceRefresh?: boolean;
      triggeredBy?: string;
    }
  ): Promise<DiscoveredField[]> {
    let sessionId: string | undefined;

    try {
      logger.info('Discovering fields from data source', { dataSourceId, options });

      // Create a discovery session in the database
      try {
        const { fieldDiscoveryDB } = await import('./FieldDiscoveryDBService');
        sessionId = await fieldDiscoveryDB.createSession(String(dataSourceId), {
          schemas: options?.schemas,
          tables: options?.tables,
          triggeredBy: options?.triggeredBy
        });
        logger.info('Created discovery session', { sessionId });
      } catch (dbError) {
        logger.warn('Failed to create discovery session', { dbError });
        // Continue without session tracking
      }

      // Fetch assets (tables and columns) from the data service
      const assets = await this.fetchAssetsFromSource(dataSourceId, options);

      if (!assets || assets.length === 0) {
        logger.warn('No assets found for data source', { dataSourceId });

        // Update session as completed with 0 fields
        if (sessionId) {
          try {
            const { fieldDiscoveryDB } = await import('./FieldDiscoveryDBService');
            await fieldDiscoveryDB.updateSession(sessionId, {
              fieldsDiscovered: 0,
              fieldsClassified: 0,
              piiFieldsFound: 0,
              status: 'completed'
            });
          } catch (dbError) {
            logger.warn('Failed to update session', { dbError });
          }
        }

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

      // Save discovered fields to database
      if (allDiscoveredFields.length > 0) {
        try {
          const { fieldDiscoveryDB } = await import('./FieldDiscoveryDBService');
          await fieldDiscoveryDB.saveDiscoveredFields(
            allDiscoveredFields,
            String(dataSourceId),
            sessionId
          );
          logger.info('Saved discovered fields to database', {
            count: allDiscoveredFields.length
          });
        } catch (dbError) {
          logger.error('Failed to save discovered fields to database', { dbError });
        }
      }

      // Update session with results
      if (sessionId) {
        try {
          const { fieldDiscoveryDB } = await import('./FieldDiscoveryDBService');
          const piiCount = allDiscoveredFields.filter(f => f.classification === 'PII').length;

          await fieldDiscoveryDB.updateSession(sessionId, {
            fieldsDiscovered: allDiscoveredFields.length,
            fieldsClassified: allDiscoveredFields.length,
            piiFieldsFound: piiCount,
            status: 'completed'
          });
        } catch (dbError) {
          logger.warn('Failed to update session results', { dbError });
        }
      }

      logger.info('Field discovery completed', {
        dataSourceId,
        tablesProcessed: tableGroups.size,
        fieldsDiscovered: allDiscoveredFields.length
      });

      return allDiscoveredFields;

    } catch (error) {
      logger.error('Field discovery failed', { dataSourceId, error });

      // Update session as failed
      if (sessionId) {
        try {
          const { fieldDiscoveryDB } = await import('./FieldDiscoveryDBService');
          await fieldDiscoveryDB.updateSession(sessionId, {
            fieldsDiscovered: 0,
            fieldsClassified: 0,
            piiFieldsFound: 0,
            status: 'failed',
            errorMessage: (error as any).message
          });
        } catch (dbError) {
          logger.warn('Failed to update session error', { dbError });
        }
      }

      throw error;
    }
  }

  /**
   * Get all discovered fields with filtering
   */
  public async getDiscoveredFields(filter?: {
    datasourceId?: string;
    status?: 'pending' | 'accepted' | 'needs-review' | 'rejected';
    classification?: 'General' | 'PII' | 'PHI' | 'Financial';
    sensitivity?: 'Low' | 'Medium' | 'High' | 'Critical';
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ fields: DiscoveredField[]; total: number }> {
    try {
      // First try to get from database
      try {
        const { fieldDiscoveryDB } = await import('./FieldDiscoveryDBService');
        const result = await fieldDiscoveryDB.getDiscoveredFields(filter);

        // Return database results even if empty (when filters are applied)
        // Only fallback if there are NO fields in database at all
        if (result.total > 0 || filter?.classification || filter?.status || filter?.search) {
          logger.info('Retrieved discovered fields from database', {
            count: result.fields.length,
            total: result.total,
            filter
          });
          return result;
        }

        logger.info('No fields in database, falling back to dynamic discovery');
      } catch (dbError) {
        logger.warn('Failed to get fields from database, falling back to dynamic discovery', { dbError });
      }

      // Fallback: Fetch real data from data service and analyze
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
      // Use discovered fields view to keep stats aligned with UI expectations
      const { fields } = await this.getDiscoveredFields({ limit: 5000, offset: 0 });

      const totalFields = fields.length;
      const byStatus: Record<string, number> = {};
      const byClassification: Record<string, number> = {};
      const bySensitivity: Record<string, number> = {};

      let confidenceSum = 0;
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      let recentDiscoveries = 0;

      for (const f of fields) {
        const s = (f.status || 'pending').toString();
        byStatus[s] = (byStatus[s] ?? 0) + 1;

        const c = (f.classification || 'General').toString();
        byClassification[c] = (byClassification[c] ?? 0) + 1;

        const sens = (f.sensitivity || 'Low').toString();
        bySensitivity[sens] = (bySensitivity[sens] ?? 0) + 1;

        confidenceSum += Number.isFinite(f.confidence) ? Number(f.confidence) : 0;

        const detectedTs = new Date((f as any).detectedAt ?? Date.now()).getTime();
        if (now - detectedTs <= sevenDaysMs) {
          recentDiscoveries += 1;
        }
      }

      const averageConfidence = totalFields > 0 ? confidenceSum / totalFields : 0;

      return {
        totalFields,
        byStatus,
        byClassification,
        bySensitivity,
        averageConfidence,
        recentDiscoveries,
      };

    } catch (error) {
      logger.error('Failed to get field discovery stats', { error });
      return {
        totalFields: 0,
        byStatus: {},
        byClassification: {},
        bySensitivity: {},
        averageConfidence: 0,
        recentDiscoveries: 0,
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
  private async fetchAssetsFromSource(dataSourceId: number | string, options?: any): Promise<any[]> {
    try {
      const params: any = {
        dataSourceId,
        type: 'table',  // Fetch table assets which include columns
        limit: 1000
      };

      // Add database filter if schemas provided
      if (options?.schemas && options.schemas.length > 0) {
        params.database = options.schemas[0]; // Use first schema as database filter
      }

      // Add table filter if tables provided
      if (options?.tables && options.tables.length > 0) {
        params.table = options.tables[0]; // Use first table as filter
      }

      logger.info('Fetching table assets from catalog', { params });

      const response = await axios.get(`${this.dataServiceUrl}/api/catalog/assets`, {
        params,
        timeout: 10000,
        headers: this.buildDsHeaders(),
      });

      const tableAssets = response.data?.data?.assets || response.data?.assets || [];
      logger.info('Fetched table assets from catalog', { count: tableAssets.length });

      // Now fetch columns for each table asset
      const columnAssets: any[] = [];

      for (const table of tableAssets) {
        try {
          // Fetch detailed asset with columns
          const assetResponse = await axios.get(`${this.dataServiceUrl}/api/catalog/assets/${table.id}`, {
            timeout: 5000,
            headers: this.buildDsHeaders(),
          });

          const asset = assetResponse.data?.data || assetResponse.data;
          if (asset?.columns && Array.isArray(asset.columns)) {
            // Transform columns to the expected format
            for (const col of asset.columns) {
              columnAssets.push({
                id: col.id,
                type: 'column',
                name: col.column_name || col.name,
                columnName: col.column_name || col.name,
                tableName: table.table || table.name || table.table_name,
                schema: table.schema || table.schema_name || 'public',
                dataType: col.data_type || col.dataType || 'unknown',
                isNullable: col.is_nullable !== false,
                description: col.description,
                tableId: table.id,
                metadata: {
                  data_type: col.data_type || col.dataType,
                  fully_qualified_name: `${table.schema || 'public'}.${table.table || table.name}.${col.column_name || col.name}`
                }
              });
            }
          }
        } catch (err) {
          logger.warn('Failed to fetch columns for table', { tableId: table.id, error: err });
        }
      }

      logger.info('Transformed to column assets', { count: columnAssets.length });
      return columnAssets;
    } catch (error) {
      logger.error('Failed to fetch assets from source', { dataSourceId, error });
      return [];
    }
  }

  private async fetchAllAssets(): Promise<any[]> {
    try {
      // Fetch all table assets first
      const response = await axios.get(`${this.dataServiceUrl}/api/catalog/assets`, {
        params: { type: 'table', limit: 100 },
        timeout: 10000,
        headers: this.buildDsHeaders(),
      });

      const tableAssets = response.data?.data?.assets || response.data?.assets || [];
      const columnAssets: any[] = [];

      // Fetch columns for each table
      for (const table of tableAssets.slice(0, 20)) { // Limit to first 20 tables for performance
        try {
          const assetResponse = await axios.get(`${this.dataServiceUrl}/api/catalog/assets/${table.id}`, {
            timeout: 5000,
            headers: this.buildDsHeaders(),
          });

          const asset = assetResponse.data?.data || assetResponse.data;
          if (asset?.columns && Array.isArray(asset.columns)) {
            for (const col of asset.columns) {
              columnAssets.push({
                id: col.id,
                type: 'column',
                name: col.column_name || col.name,
                columnName: col.column_name || col.name,
                tableName: table.table || table.name || table.table_name,
                schema: table.schema || table.schema_name || 'public',
                dataType: col.data_type || col.dataType || 'unknown',
                isNullable: col.is_nullable !== false,
                description: col.description,
                tableId: table.id,
                metadata: {
                  data_type: col.data_type || col.dataType,
                  fully_qualified_name: `${table.schema || 'public'}.${table.table || table.name}.${col.column_name || col.name}`
                }
              });
            }
          }
        } catch (err) {
          logger.warn('Failed to fetch columns for table', { tableId: table.id, error: err });
        }
      }

      return columnAssets;
    } catch (error) {
      logger.error('Failed to fetch all assets', { error });
      return [];
    }
  }

  private async fetchDataSources(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/data-sources`, {
        timeout: 5000,
        headers: this.buildDsHeaders(),
      });

      return response.data?.data || response.data || [];
    } catch (error) {
      logger.error('Failed to fetch data sources', { error });
      return [];
    }
  }

  private buildDsHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const bearer =
      process.env.DATA_SERVICE_TOKEN?.trim() ||
      process.env.SERVICE_BEARER?.trim() ||
      process.env.DEV_BEARER?.trim() ||
      '';
    if (bearer) headers['authorization'] = bearer.startsWith('Bearer ')
      ? bearer
      : `Bearer ${bearer}`;
    // Helpful in dev — some stacks use this flag
    if (process.env.NODE_ENV !== 'production') headers['x-dev-auth'] = 'ai-service';
    return headers;
  }

  private groupAssetsByTable(assets: any[]): Map<string, any> {
    const groups = new Map<string, any>();

    for (const a of assets) {
      const type = (a.type || '').toLowerCase();
      const schema = a.schema || a.schemaName || a.schema_name || 'public';
      const table = a.tableName || a.table_name || a.name || 'unknown';

      if (type === 'column') {
        if (!a.tableName && a.metadata?.fully_qualified_name) {
          // try to parse table from FQN like schema.table.column
          const fqn: string = a.metadata.fully_qualified_name;
          const parts = fqn.split('.');
          if (parts.length >= 2) {
            a.tableName = parts[parts.length - 2];
          }
        }
        const key = `${schema}.${a.tableName || table}`;
        if (!groups.has(key)) {
          groups.set(key, { schema, tableName: a.tableName || table, assetId: a.tableId || a.id, columns: [] });
        }
        groups.get(key)!.columns.push({
          name: a.columnName || a.name,
          type: a.dataType || a.data_type || a.metadata?.data_type || 'unknown',
          nullable: a.isNullable ?? a.is_nullable ?? true,
          description: a.description,
        });
        continue;
      }

      if ((type === 'table' || type === 'view') && Array.isArray(a.columns) && a.columns.length > 0) {
        const key = `${schema}.${table}`;
        if (!groups.has(key)) {
          groups.set(key, { schema, tableName: table, assetId: a.id, columns: [] });
        }
        for (const col of a.columns) {
          groups.get(key)!.columns.push({
            name: col.name,
            type: col.data_type || col.type || 'unknown',
            nullable: col.is_nullable ?? col.nullable ?? true,
            description: col.description,
          });
        }
      }
    }

    return groups;
  }

  private async convertAssetsToDiscoveredFields(assets: any[]): Promise<DiscoveredField[]> {
    const fields: DiscoveredField[] = [];

    for (const a of assets) {
      const type = (a.type || '').toLowerCase();
      const schema = a.schema || a.schemaName || a.schema_name || 'public';
      const table = a.tableName || a.table_name || a.name || 'unknown';

      if (type === 'column') {
        const fname = a.columnName || a.name;
        const dt = a.dataType || a.data_type || a.metadata?.data_type || 'unknown';
        fields.push({
          id: String(a.id || `${table}-${fname}`),
          assetId: a.id,
          assetName: `${schema}.${table}`,
          fieldName: fname,
          schema,
          tableName: table,
          dataType: dt,
          classification: a.classification || 'General',
          sensitivity: a.sensitivity || 'Low',
          description: a.description || `${dt} field`,
          suggestedTags: a.tags || [],
          suggestedRules: [],
          dataPatterns: [],
          businessContext: a.businessContext || '',
          confidence: a.confidence || 0.8,
          status: a.reviewStatus || 'pending',
          detectedAt: new Date(a.createdAt || Date.now()),
          isAiGenerated: false,
        });
        continue;
      }

      // Table/view with embedded columns array
      if ((type === 'table' || type === 'view') && Array.isArray(a.columns)) {
        for (const col of a.columns) {
          const fname = col.name || col.column_name;
          const dt = col.data_type || col.type || 'unknown';
          fields.push({
            id: `${a.id}-${fname}`,
            assetId: a.id,
            assetName: `${schema}.${table}`,
            fieldName: fname,
            schema,
            tableName: table,
            dataType: dt,
            classification: (col.classification as any) || 'General',
            sensitivity: (col.sensitivity as any) || 'Low',
            description: col.description || `${dt} field`,
            suggestedTags: Array.isArray(col.tags) ? col.tags : [],
            suggestedRules: [],
            dataPatterns: [],
            businessContext: '',
            confidence: 0.75,
            status: 'pending',
            detectedAt: new Date(a.updatedAt || a.createdAt || Date.now()),
            isAiGenerated: false,
          });
        }
      }
    }

    return fields;
  }

  /**
   * Persist classification and related metadata to Data Service
   */
  public async applyClassification(
    assetId: string | number,
    input: { classification: string; sensitivity?: string; tags?: string[]; description?: string }
  ): Promise<{ classification?: string; sensitivity?: string; tags?: string[]; description?: string }> {
    const id = String(assetId);

    // Map AI classes to DS sensitivity (public/internal/confidential/restricted)
    const cls = (input.classification || '').toLowerCase();
    let dsSensitivity: 'public' | 'internal' | 'confidential' | 'restricted' | undefined = undefined;
    if (['phi'].includes(cls)) dsSensitivity = 'restricted';
    else if (['pii', 'financial'].includes(cls)) dsSensitivity = 'confidential';
    else if (['general'].includes(cls)) dsSensitivity = 'internal';

    const headers = this.buildDsHeaders();

    try {
      if (dsSensitivity) {
        await axios.put(
          `${this.dataServiceUrl}/api/assets/${encodeURIComponent(id)}/classification`,
          { classification: dsSensitivity },
          { headers, timeout: 10000 }
        );
      }

      const tags: string[] = Array.isArray(input.tags) ? input.tags : [];
      // add a normalized tag for classification for discoverability
      if (cls) {
        const tag = cls.toLowerCase();
        if (!tags.includes(tag)) tags.push(tag);
      }
      if (tags.length > 0) {
        await axios.post(
          `${this.dataServiceUrl}/api/assets/${encodeURIComponent(id)}/tags`,
          { tags },
          { headers, timeout: 10000 }
        );
      }

      if (input.description && input.description.trim()) {
        await axios.put(
          `${this.dataServiceUrl}/api/assets/${encodeURIComponent(id)}`,
          { description: input.description.trim() },
          { headers, timeout: 10000 }
        );
      }

      return {
        classification: input.classification,
        sensitivity: dsSensitivity,
        tags,
        description: input.description,
      };
    } catch (error) {
      logger.error('Failed to apply classification to Data Service', { assetId: id, error });
      throw error;
    }
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
