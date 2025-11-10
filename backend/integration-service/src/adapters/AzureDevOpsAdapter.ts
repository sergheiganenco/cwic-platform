// Azure DevOps Integration Adapter
import axios, { AxiosInstance } from 'axios';

export interface AzureDevOpsConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
}

export interface WorkItem {
  id: number;
  rev: number;
  url: string;
  fields: {
    'System.WorkItemType': string;
    'System.Title': string;
    'System.Description'?: string;
    'System.State': string;
    'System.AssignedTo'?: { displayName: string; uniqueName: string };
    'System.CreatedDate': string;
    'System.ChangedDate': string;
    'Microsoft.VSTS.Common.Priority'?: number;
    'Microsoft.VSTS.Common.Severity'?: string;
    'System.Tags'?: string;
    [key: string]: any;
  };
}

export interface CreateWorkItemRequest {
  workItemType: 'Bug' | 'Task' | 'User Story' | 'Epic' | 'Feature' | 'Issue';
  title: string;
  description?: string;
  assignedTo?: string;
  priority?: 1 | 2 | 3 | 4;
  severity?: '1 - Critical' | '2 - High' | '3 - Medium' | '4 - Low';
  tags?: string[];
  areaPath?: string;
  iterationPath?: string;
  customFields?: Record<string, any>;
}

export interface UpdateWorkItemRequest {
  title?: string;
  description?: string;
  state?: string;
  assignedTo?: string;
  priority?: number;
  tags?: string[];
}

export class AzureDevOpsAdapter {
  private client: AxiosInstance;
  private config: AzureDevOpsConfig;
  private baseUrl: string;

  constructor(config: AzureDevOpsConfig) {
    this.config = config;
    this.baseUrl = `https://dev.azure.com/${config.organization}/${config.project}`;

    const auth = Buffer.from(`:${config.personalAccessToken}`).toString('base64');

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json-patch+json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Create a new work item
   */
  async createWorkItem(request: CreateWorkItemRequest): Promise<WorkItem> {
    const operations = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: request.title,
      },
    ];

    if (request.description) {
      operations.push({
        op: 'add',
        path: '/fields/System.Description',
        value: request.description,
      });
    }

    if (request.assignedTo) {
      operations.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: request.assignedTo,
      });
    }

    if (request.priority) {
      operations.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: request.priority,
      });
    }

    if (request.severity) {
      operations.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Severity',
        value: request.severity,
      });
    }

    if (request.tags && request.tags.length > 0) {
      operations.push({
        op: 'add',
        path: '/fields/System.Tags',
        value: request.tags.join('; '),
      });
    }

    if (request.areaPath) {
      operations.push({
        op: 'add',
        path: '/fields/System.AreaPath',
        value: request.areaPath,
      });
    }

    if (request.iterationPath) {
      operations.push({
        op: 'add',
        path: '/fields/System.IterationPath',
        value: request.iterationPath,
      });
    }

    // Add custom fields
    if (request.customFields) {
      Object.entries(request.customFields).forEach(([key, value]) => {
        operations.push({
          op: 'add',
          path: `/fields/${key}`,
          value,
        });
      });
    }

    const response = await this.client.post(
      `/_apis/wit/workitems/$${request.workItemType}?api-version=7.0`,
      operations
    );

    return response.data;
  }

  /**
   * Get work item by ID
   */
  async getWorkItem(id: number): Promise<WorkItem> {
    const response = await this.client.get(`/_apis/wit/workitems/${id}?api-version=7.0`);
    return response.data;
  }

  /**
   * Update a work item
   */
  async updateWorkItem(id: number, update: UpdateWorkItemRequest): Promise<WorkItem> {
    const operations: Array<{ op: string; path: string; value: any }> = [];

    if (update.title) {
      operations.push({ op: 'replace', path: '/fields/System.Title', value: update.title });
    }

    if (update.description) {
      operations.push({ op: 'replace', path: '/fields/System.Description', value: update.description });
    }

    if (update.state) {
      operations.push({ op: 'replace', path: '/fields/System.State', value: update.state });
    }

    if (update.assignedTo) {
      operations.push({ op: 'replace', path: '/fields/System.AssignedTo', value: update.assignedTo });
    }

    if (update.priority) {
      operations.push({ op: 'replace', path: '/fields/Microsoft.VSTS.Common.Priority', value: update.priority });
    }

    if (update.tags && update.tags.length > 0) {
      operations.push({ op: 'replace', path: '/fields/System.Tags', value: update.tags.join('; ') });
    }

    const response = await this.client.patch(`/_apis/wit/workitems/${id}?api-version=7.0`, operations);
    return response.data;
  }

  /**
   * Add a comment to a work item
   */
  async addComment(workItemId: number, comment: string): Promise<void> {
    await this.client.post(`/_apis/wit/workitems/${workItemId}/comments?api-version=7.0-preview.3`, {
      text: comment,
    });
  }

  /**
   * Query work items using WIQL
   */
  async queryWorkItems(wiql: string): Promise<WorkItem[]> {
    const queryResponse = await this.client.post('/_apis/wit/wiql?api-version=7.0', {
      query: wiql,
    });

    const ids = queryResponse.data.workItems.map((wi: any) => wi.id);

    if (ids.length === 0) return [];

    const itemsResponse = await this.client.get(
      `/_apis/wit/workitems?ids=${ids.join(',')}&api-version=7.0`
    );

    return itemsResponse.data.value;
  }

  /**
   * Link two work items
   */
  async linkWorkItems(sourceId: number, targetId: number, linkType: string = 'System.LinkTypes.Related'): Promise<void> {
    const operations = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: linkType,
          url: `${this.baseUrl}/_apis/wit/workitems/${targetId}`,
        },
      },
    ];

    await this.client.patch(`/_apis/wit/workitems/${sourceId}?api-version=7.0`, operations);
  }

  /**
   * Trigger a pipeline
   */
  async triggerPipeline(pipelineId: number, branch: string = 'main', parameters?: Record<string, any>): Promise<any> {
    const payload: any = {
      resources: {
        repositories: {
          self: {
            refName: `refs/heads/${branch}`,
          },
        },
      },
    };

    if (parameters) {
      payload.templateParameters = parameters;
    }

    const response = await this.client.post(`/_apis/pipelines/${pipelineId}/runs?api-version=7.0`, payload);
    return response.data;
  }

  /**
   * Get pipeline run status
   */
  async getPipelineRun(pipelineId: number, runId: number): Promise<any> {
    const response = await this.client.get(`/_apis/pipelines/${pipelineId}/runs/${runId}?api-version=7.0`);
    return response.data;
  }
}
