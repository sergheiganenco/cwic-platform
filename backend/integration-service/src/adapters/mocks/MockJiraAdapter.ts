// Mock Jira Adapter for Testing
import { JiraAdapter, CreateIssueRequest, UpdateIssueRequest, JiraIssue } from '../JiraAdapter';

export class MockJiraAdapter extends JiraAdapter {
  private mockIssues: Map<string, JiraIssue> = new Map();
  private issueCounter = 1;

  constructor() {
    // Pass dummy config to parent
    super({ url: 'http://mock-jira', username: 'mock', apiToken: 'mock' });
  }

  async createIssue(request: CreateIssueRequest): Promise<JiraIssue> {
    const issueKey = `${request.project}-${this.issueCounter++}`;
    const now = new Date().toISOString();

    const mockIssue: JiraIssue = {
      id: `${this.issueCounter}`,
      key: issueKey,
      self: `http://mock-jira/rest/api/3/issue/${issueKey}`,
      fields: {
        summary: request.summary,
        description: request.description,
        status: { name: 'Open' },
        priority: { name: request.priority || 'Medium' },
        created: now,
        updated: now,
      },
    };

    if (request.assignee) {
      mockIssue.fields.assignee = {
        displayName: request.assignee,
        emailAddress: `${request.assignee}@example.com`,
      };
    }

    this.mockIssues.set(issueKey, mockIssue);

    console.log(`[MOCK JIRA] Created issue: ${issueKey}`);
    console.log(`  Summary: ${request.summary}`);
    console.log(`  Type: ${request.issueType}`);
    console.log(`  Priority: ${request.priority || 'Medium'}`);

    return mockIssue;
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const issue = this.mockIssues.get(issueKey);
    if (!issue) {
      throw new Error(`Issue ${issueKey} not found`);
    }
    return issue;
  }

  async updateIssue(issueKey: string, update: UpdateIssueRequest): Promise<void> {
    const issue = this.mockIssues.get(issueKey);
    if (!issue) {
      throw new Error(`Issue ${issueKey} not found`);
    }

    if (update.summary) issue.fields.summary = update.summary;
    if (update.description) issue.fields.description = update.description;
    if (update.priority) issue.fields.priority.name = update.priority;
    if (update.status) issue.fields.status.name = update.status;
    if (update.assignee) {
      issue.fields.assignee = {
        displayName: update.assignee,
        emailAddress: `${update.assignee}@example.com`,
      };
    }

    issue.fields.updated = new Date().toISOString();

    console.log(`[MOCK JIRA] Updated issue: ${issueKey}`);
  }

  async addComment(issueKey: string, comment: string): Promise<void> {
    const issue = this.mockIssues.get(issueKey);
    if (!issue) {
      throw new Error(`Issue ${issueKey} not found`);
    }

    console.log(`[MOCK JIRA] Added comment to ${issueKey}: ${comment}`);
  }

  async transitionIssue(issueKey: string, transitionName: string): Promise<void> {
    const issue = this.mockIssues.get(issueKey);
    if (!issue) {
      throw new Error(`Issue ${issueKey} not found`);
    }

    issue.fields.status.name = transitionName;
    console.log(`[MOCK JIRA] Transitioned ${issueKey} to ${transitionName}`);
  }

  async linkIssues(inwardIssue: string, outwardIssue: string, linkType: string = 'Relates'): Promise<void> {
    console.log(`[MOCK JIRA] Linked ${inwardIssue} ${linkType} ${outwardIssue}`);
  }

  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraIssue[]> {
    console.log(`[MOCK JIRA] Searching with JQL: ${jql}`);
    return Array.from(this.mockIssues.values()).slice(0, maxResults);
  }

  async getTransitions(issueKey: string): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: '1', name: 'Open' },
      { id: '2', name: 'In Progress' },
      { id: '3', name: 'Resolved' },
      { id: '4', name: 'Closed' },
    ];
  }

  // Testing utility
  getAllIssues(): JiraIssue[] {
    return Array.from(this.mockIssues.values());
  }

  clearAll(): void {
    this.mockIssues.clear();
    this.issueCounter = 1;
    console.log('[MOCK JIRA] Cleared all issues');
  }
}
