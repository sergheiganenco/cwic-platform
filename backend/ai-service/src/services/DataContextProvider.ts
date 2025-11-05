import axios from 'axios';
import { logger } from '@utils/logger';

export interface DataSource {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  status: 'active' | 'inactive';
}

export interface Asset {
  id: number;
  name: string;
  type: 'table' | 'view' | 'column';
  schema: string;
  tableName?: string;
  dataType?: string;
  classification?: string;
  sensitivity?: string;
  description?: string;
}

export interface QualityMetric {
  assetId: number;
  assetName: string;
  score: number;
  issues: number;
  lastRun: string;
  rules: any[];
}

export interface LineageNode {
  id: string;
  name: string;
  type: string;
  upstream: string[];
  downstream: string[];
}

export interface PipelineStatus {
  id: number;
  name: string;
  status: 'running' | 'failed' | 'completed' | 'pending';
  lastRun?: string;
  nextRun?: string;
}

export interface DataContext {
  dataSources: DataSource[];
  assets: Asset[];
  qualityMetrics: QualityMetric[];
  lineage: LineageNode[];
  pipelines: PipelineStatus[];
  statistics: {
    totalAssets: number;
    totalDataSources: number;
    averageQualityScore: number;
    totalIssues: number;
    activePipelines: number;
  };
}

export class DataContextProvider {
  private dataServiceUrl: string;
  private cacheTimeout: number;
  private cachedContext: DataContext | null = null;
  private lastFetchTime: number = 0;

  constructor() {
    this.dataServiceUrl = process.env.DATA_SERVICE_URL || 'http://localhost:3002';
    this.cacheTimeout = 60000; // 1 minute cache
  }

  /**
   * Get comprehensive data context for AI queries
   */
  public async getDataContext(forceRefresh: boolean = false): Promise<DataContext> {
    try {
      // Return cached context if still valid
      if (!forceRefresh && this.cachedContext && Date.now() - this.lastFetchTime < this.cacheTimeout) {
        logger.info('Returning cached data context');
        return this.cachedContext;
      }

      logger.info('Fetching fresh data context');

      // Fetch all data in parallel
      const [dataSources, assets, qualityMetrics, lineage, pipelines] = await Promise.allSettled([
        this.fetchDataSources(),
        this.fetchAssets(),
        this.fetchQualityMetrics(),
        this.fetchLineage(),
        this.fetchPipelines(),
      ]);

      const context: DataContext = {
        dataSources: dataSources.status === 'fulfilled' ? dataSources.value : [],
        assets: assets.status === 'fulfilled' ? assets.value : [],
        qualityMetrics: qualityMetrics.status === 'fulfilled' ? qualityMetrics.value : [],
        lineage: lineage.status === 'fulfilled' ? lineage.value : [],
        pipelines: pipelines.status === 'fulfilled' ? pipelines.value : [],
        statistics: {
          totalAssets: 0,
          totalDataSources: 0,
          averageQualityScore: 0,
          totalIssues: 0,
          activePipelines: 0,
        },
      };

      // Calculate statistics
      context.statistics = this.calculateStatistics(context);

      this.cachedContext = context;
      this.lastFetchTime = Date.now();

      return context;
    } catch (error) {
      logger.error('Failed to fetch data context:', error);
      // Return cached context or empty context
      return this.cachedContext || this.getEmptyContext();
    }
  }

  /**
   * Fetch data sources from data service
   */
  private async fetchDataSources(): Promise<DataSource[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/data-sources`, {
        timeout: 5000,
      });
      return response.data?.data || response.data || [];
    } catch (error) {
      logger.warn('Failed to fetch data sources:', error);
      return [];
    }
  }

  /**
   * Fetch assets (tables, columns) from catalog
   */
  private async fetchAssets(): Promise<Asset[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/assets`, {
        timeout: 5000,
        params: { limit: 1000 },
      });
      return response.data?.data || response.data || [];
    } catch (error) {
      logger.warn('Failed to fetch assets:', error);
      return [];
    }
  }

  /**
   * Fetch quality metrics
   */
  private async fetchQualityMetrics(): Promise<QualityMetric[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/quality/metrics`, {
        timeout: 5000,
      });
      return response.data?.data || response.data || [];
    } catch (error) {
      logger.warn('Failed to fetch quality metrics:', error);
      return [];
    }
  }

  /**
   * Fetch lineage information
   */
  private async fetchLineage(): Promise<LineageNode[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/lineage`, {
        timeout: 5000,
      });
      return response.data?.data || response.data || [];
    } catch (error) {
      logger.warn('Failed to fetch lineage:', error);
      return [];
    }
  }

  /**
   * Fetch pipeline statuses
   */
  private async fetchPipelines(): Promise<PipelineStatus[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/pipelines`, {
        timeout: 5000,
      });
      return response.data?.data || response.data || [];
    } catch (error) {
      logger.warn('Failed to fetch pipelines:', error);
      return [];
    }
  }

  /**
   * Calculate statistics from context data
   */
  private calculateStatistics(context: DataContext): DataContext['statistics'] {
    const totalAssets = context.assets.length;
    const totalDataSources = context.dataSources.length;

    const totalQualityScore = context.qualityMetrics.reduce((sum, m) => sum + m.score, 0);
    const averageQualityScore = context.qualityMetrics.length > 0
      ? Math.round(totalQualityScore / context.qualityMetrics.length)
      : 0;

    const totalIssues = context.qualityMetrics.reduce((sum, m) => sum + m.issues, 0);

    const activePipelines = context.pipelines.filter(p => p.status === 'running').length;

    return {
      totalAssets,
      totalDataSources,
      averageQualityScore,
      totalIssues,
      activePipelines,
    };
  }

  /**
   * Search for specific assets by name or pattern
   */
  public async searchAssets(query: string, context?: DataContext): Promise<Asset[]> {
    const dataContext = context || await this.getDataContext();
    const lowerQuery = query.toLowerCase();

    return dataContext.assets.filter(asset =>
      asset.name.toLowerCase().includes(lowerQuery) ||
      asset.schema?.toLowerCase().includes(lowerQuery) ||
      asset.tableName?.toLowerCase().includes(lowerQuery) ||
      asset.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Find data sources by name or type
   */
  public async findDataSources(query: string, context?: DataContext): Promise<DataSource[]> {
    const dataContext = context || await this.getDataContext();
    const lowerQuery = query.toLowerCase();

    return dataContext.dataSources.filter(ds =>
      ds.name.toLowerCase().includes(lowerQuery) ||
      ds.type.toLowerCase().includes(lowerQuery) ||
      ds.database?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get quality information for specific assets
   */
  public async getQualityInfo(assetName: string, context?: DataContext): Promise<QualityMetric | null> {
    const dataContext = context || await this.getDataContext();
    return dataContext.qualityMetrics.find(m =>
      m.assetName.toLowerCase().includes(assetName.toLowerCase())
    ) || null;
  }

  /**
   * Get lineage for a specific asset
   */
  public async getLineageForAsset(assetName: string, context?: DataContext): Promise<LineageNode | null> {
    const dataContext = context || await this.getDataContext();
    return dataContext.lineage.find(n =>
      n.name.toLowerCase() === assetName.toLowerCase()
    ) || null;
  }

  /**
   * Get pipeline status information
   */
  public async getPipelineStatus(pipelineName?: string, context?: DataContext): Promise<PipelineStatus[]> {
    const dataContext = context || await this.getDataContext();

    if (pipelineName) {
      return dataContext.pipelines.filter(p =>
        p.name.toLowerCase().includes(pipelineName.toLowerCase())
      );
    }

    return dataContext.pipelines;
  }

  /**
   * Get assets with quality issues
   */
  public async getAssetsWithIssues(context?: DataContext): Promise<Array<{ asset: Asset; quality: QualityMetric }>> {
    const dataContext = context || await this.getDataContext();

    return dataContext.qualityMetrics
      .filter(q => q.issues > 0)
      .map(quality => {
        const asset = dataContext.assets.find(a => a.id === quality.assetId);
        return asset ? { asset, quality } : null;
      })
      .filter(Boolean) as Array<{ asset: Asset; quality: QualityMetric }>;
  }

  /**
   * Get sensitive data assets (PII, PHI)
   */
  public async getSensitiveAssets(context?: DataContext): Promise<Asset[]> {
    const dataContext = context || await this.getDataContext();

    return dataContext.assets.filter(asset =>
      asset.classification === 'PII' ||
      asset.classification === 'PHI' ||
      asset.classification === 'Financial' ||
      asset.sensitivity === 'High'
    );
  }

  /**
   * Get empty context (fallback)
   */
  private getEmptyContext(): DataContext {
    return {
      dataSources: [],
      assets: [],
      qualityMetrics: [],
      lineage: [],
      pipelines: [],
      statistics: {
        totalAssets: 0,
        totalDataSources: 0,
        averageQualityScore: 0,
        totalIssues: 0,
        activePipelines: 0,
      },
    };
  }

  /**
   * Clear cache to force fresh data fetch
   */
  public clearCache(): void {
    this.cachedContext = null;
    this.lastFetchTime = 0;
  }
}
