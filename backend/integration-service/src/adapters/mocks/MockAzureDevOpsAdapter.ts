// Mock Azure DevOps Adapter for Testing
import { AzureDevOpsAdapter, CreateWorkItemRequest, UpdateWorkItemRequest, WorkItem } from '../AzureDevOpsAdapter';

export class MockAzureDevOpsAdapter extends AzureDevOpsAdapter {
  private mockWorkItems: Map<number, WorkItem> = new Map();
  private workItemCounter = 1;

  constructor() {
    // Pass dummy config to parent
    super({ organization: 'mock-org', project: 'mock-project', personalAccessToken: 'mock-token' });
  }

  async createWorkItem(request: CreateWorkItemRequest): Promise<WorkItem> {
    const id = this.workItemCounter++;
    const now = new Date().toISOString();

    const mockWorkItem: WorkItem = {
      id,
      rev: 1,
      url: `https://dev.azure.com/mock-org/mock-project/_apis/wit/workitems/${id}`,
      fields: {
        'System.WorkItemType': request.workItemType,
        'System.Title': request.title,
        'System.Description': request.description,
        'System.State': 'New',
        'System.CreatedDate': now,
        'System.ChangedDate': now,
      },
    };

    if (request.assignedTo) {
      mockWorkItem.fields['System.AssignedTo'] = {
        displayName: request.assignedTo,
        uniqueName: `${request.assignedTo}@example.com`,
      };
    }

    if (request.priority) {
      mockWorkItem.fields['Microsoft.VSTS.Common.Priority'] = request.priority;
    }

    if (request.severity) {
      mockWorkItem.fields['Microsoft.VSTS.Common.Severity'] = request.severity;
    }

    if (request.tags) {
      mockWorkItem.fields['System.Tags'] = request.tags.join('; ');
    }

    this.mockWorkItems.set(id, mockWorkItem);

    console.log(`[MOCK AZURE DEVOPS] Created work item: ${id}`);
    console.log(`  Title: ${request.title}`);
    console.log(`  Type: ${request.workItemType}`);
    console.log(`  Priority: ${request.priority || 'N/A'}`);

    return mockWorkItem;
  }

  async getWorkItem(id: number): Promise<WorkItem> {
    const workItem = this.mockWorkItems.get(id);
    if (!workItem) {
      throw new Error(`Work item ${id} not found`);
    }
    return workItem;
  }

  async updateWorkItem(id: number, update: UpdateWorkItemRequest): Promise<WorkItem> {
    const workItem = this.mockWorkItems.get(id);
    if (!workItem) {
      throw new Error(`Work item ${id} not found`);
    }

    if (update.title) workItem.fields['System.Title'] = update.title;
    if (update.description) workItem.fields['System.Description'] = update.description;
    if (update.state) workItem.fields['System.State'] = update.state;
    if (update.priority) workItem.fields['Microsoft.VSTS.Common.Priority'] = update.priority;
    if (update.tags) workItem.fields['System.Tags'] = update.tags.join('; ');

    if (update.assignedTo) {
      workItem.fields['System.AssignedTo'] = {
        displayName: update.assignedTo,
        uniqueName: `${update.assignedTo}@example.com`,
      };
    }

    workItem.fields['System.ChangedDate'] = new Date().toISOString();
    workItem.rev++;

    console.log(`[MOCK AZURE DEVOPS] Updated work item: ${id}`);
    return workItem;
  }

  async addComment(workItemId: number, comment: string): Promise<void> {
    const workItem = this.mockWorkItems.get(workItemId);
    if (!workItem) {
      throw new Error(`Work item ${workItemId} not found`);
    }

    console.log(`[MOCK AZURE DEVOPS] Added comment to work item ${workItemId}: ${comment}`);
  }

  async queryWorkItems(wiql: string): Promise<WorkItem[]> {
    console.log(`[MOCK AZURE DEVOPS] Querying with WIQL: ${wiql}`);
    return Array.from(this.mockWorkItems.values());
  }

  async linkWorkItems(sourceId: number, targetId: number, linkType: string = 'System.LinkTypes.Related'): Promise<void> {
    console.log(`[MOCK AZURE DEVOPS] Linked work items: ${sourceId} -> ${targetId} (${linkType})`);
  }

  async triggerPipeline(pipelineId: number, branch: string = 'main', parameters?: Record<string, any>): Promise<any> {
    const runId = Math.floor(Math.random() * 10000);
    console.log(`[MOCK AZURE DEVOPS] Triggered pipeline ${pipelineId} on branch ${branch}, Run ID: ${runId}`);

    return {
      id: runId,
      pipelineId,
      state: 'inProgress',
      createdDate: new Date().toISOString(),
    };
  }

  async getPipelineRun(pipelineId: number, runId: number): Promise<any> {
    console.log(`[MOCK AZURE DEVOPS] Getting pipeline run: ${pipelineId}/${runId}`);
    return {
      id: runId,
      pipelineId,
      state: 'completed',
      result: 'succeeded',
      finishedDate: new Date().toISOString(),
    };
  }

  // Testing utilities
  getAllWorkItems(): WorkItem[] {
    return Array.from(this.mockWorkItems.values());
  }

  clearAll(): void {
    this.mockWorkItems.clear();
    this.workItemCounter = 1;
    console.log('[MOCK AZURE DEVOPS] Cleared all work items');
  }
}
