// Jira Integration Adapter
import axios, { AxiosInstance } from 'axios';

export interface JiraConfig {
  url: string;
  username: string;
  apiToken: string;
  defaultProject?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
    };
    priority: {
      name: string;
    };
    created: string;
    updated: string;
  };
}

export interface CreateIssueRequest {
  project: string;
  issueType: 'Bug' | 'Task' | 'Story' | 'Epic' | 'Incident';
  summary: string;
  description: string;
  priority?: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  assignee?: string;
  labels?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateIssueRequest {
  summary?: string;
  description?: string;
  status?: string;
  assignee?: string;
  priority?: string;
  labels?: string[];
}

export class JiraAdapter {
  private client: AxiosInstance;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;

    const auth = Buffer.from(`${config.username}:${config.apiToken}`).toString('base64');

    this.client = axios.create({
      baseURL: `${config.url}/rest/api/3`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Create a new Jira issue
   */
  async createIssue(request: CreateIssueRequest): Promise<JiraIssue> {
    const payload = {
      fields: {
        project: { key: request.project },
        summary: request.summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: request.description,
                },
              ],
            },
          ],
        },
        issuetype: { name: request.issueType },
        priority: request.priority ? { name: request.priority } : undefined,
        assignee: request.assignee ? { name: request.assignee } : undefined,
        labels: request.labels || [],
        ...request.customFields,
      },
    };

    const response = await this.client.post('/issue', payload);
    return this.getIssue(response.data.key);
  }

  /**
   * Get issue by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    const response = await this.client.get(`/issue/${issueKey}`);
    return response.data;
  }

  /**
   * Update an existing issue
   */
  async updateIssue(issueKey: string, update: UpdateIssueRequest): Promise<void> {
    const fields: any = {};

    if (update.summary) fields.summary = update.summary;
    if (update.priority) fields.priority = { name: update.priority };
    if (update.assignee) fields.assignee = { name: update.assignee };
    if (update.labels) fields.labels = update.labels;

    if (update.description) {
      fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: update.description }],
          },
        ],
      };
    }

    await this.client.put(`/issue/${issueKey}`, { fields });
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueKey: string, comment: string): Promise<void> {
    await this.client.post(`/issue/${issueKey}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: comment }],
          },
        ],
      },
    });
  }

  /**
   * Transition issue to a new status
   */
  async transitionIssue(issueKey: string, transitionName: string): Promise<void> {
    // Get available transitions
    const transitionsResponse = await this.client.get(`/issue/${issueKey}/transitions`);
    const transition = transitionsResponse.data.transitions.find(
      (t: any) => t.name.toLowerCase() === transitionName.toLowerCase()
    );

    if (!transition) {
      throw new Error(`Transition '${transitionName}' not found for issue ${issueKey}`);
    }

    await this.client.post(`/issue/${issueKey}/transitions`, {
      transition: { id: transition.id },
    });
  }

  /**
   * Link two issues
   */
  async linkIssues(inwardIssue: string, outwardIssue: string, linkType: string = 'Relates'): Promise<void> {
    await this.client.post('/issueLink', {
      type: { name: linkType },
      inwardIssue: { key: inwardIssue },
      outwardIssue: { key: outwardIssue },
    });
  }

  /**
   * Search issues using JQL
   */
  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraIssue[]> {
    const response = await this.client.post('/search', {
      jql,
      maxResults,
      fields: ['summary', 'status', 'assignee', 'priority', 'created', 'updated'],
    });

    return response.data.issues;
  }

  /**
   * Get issue transitions
   */
  async getTransitions(issueKey: string): Promise<Array<{ id: string; name: string }>> {
    const response = await this.client.get(`/issue/${issueKey}/transitions`);
    return response.data.transitions.map((t: any) => ({ id: t.id, name: t.name }));
  }
}
