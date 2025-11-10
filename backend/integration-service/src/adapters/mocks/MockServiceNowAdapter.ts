// Mock ServiceNow Adapter for Testing
import { ServiceNowAdapter, CreateIncidentRequest, UpdateIncidentRequest, Incident, CreateChangeRequestRequest, ChangeRequest } from '../ServiceNowAdapter';

export class MockServiceNowAdapter extends ServiceNowAdapter {
  private mockIncidents: Map<string, Incident> = new Map();
  private mockChangeRequests: Map<string, ChangeRequest> = new Map();
  private incidentCounter = 1;
  private changeCounter = 1;

  constructor() {
    // Pass dummy config to parent
    super({ instance: 'mock-instance.service-now.com', username: 'mock', password: 'mock' });
  }

  async createIncident(request: CreateIncidentRequest): Promise<Incident> {
    const sysId = `incident-${this.incidentCounter}`;
    const number = `INC${String(this.incidentCounter).padStart(7, '0')}`;
    this.incidentCounter++;

    const now = new Date().toISOString();

    const mockIncident: Incident = {
      sys_id: sysId,
      number,
      short_description: request.shortDescription,
      description: request.description,
      state: '1', // New
      impact: request.impact || '3',
      urgency: request.urgency || '3',
      priority: this.calculatePriority(request.impact || '3', request.urgency || '3'),
      opened_at: now,
      updated_at: now,
    };

    if (request.assignedTo) {
      mockIncident.assigned_to = {
        value: request.assignedTo,
        display_value: request.assignedTo,
      };
    }

    if (request.assignmentGroup) {
      mockIncident.assignment_group = {
        value: request.assignmentGroup,
        display_value: request.assignmentGroup,
      };
    }

    if (request.category) mockIncident.category = request.category;
    if (request.subcategory) mockIncident.subcategory = request.subcategory;

    this.mockIncidents.set(sysId, mockIncident);

    console.log(`[MOCK SERVICENOW] Created incident: ${number}`);
    console.log(`  Short Description: ${request.shortDescription}`);
    console.log(`  Impact: ${request.impact || '3'}, Urgency: ${request.urgency || '3'}`);
    console.log(`  Priority: ${mockIncident.priority}`);

    return mockIncident;
  }

  async getIncident(sysId: string): Promise<Incident> {
    const incident = this.mockIncidents.get(sysId);
    if (!incident) {
      throw new Error(`Incident ${sysId} not found`);
    }
    return incident;
  }

  async getIncidentByNumber(number: string): Promise<Incident | null> {
    for (const incident of this.mockIncidents.values()) {
      if (incident.number === number) {
        return incident;
      }
    }
    return null;
  }

  async updateIncident(sysId: string, update: UpdateIncidentRequest): Promise<Incident> {
    const incident = this.mockIncidents.get(sysId);
    if (!incident) {
      throw new Error(`Incident ${sysId} not found`);
    }

    if (update.shortDescription) incident.short_description = update.shortDescription;
    if (update.description) incident.description = update.description;
    if (update.state) incident.state = update.state;
    if (update.impact) incident.impact = update.impact;
    if (update.urgency) incident.urgency = update.urgency;
    if (update.workNotes) incident.work_notes = update.workNotes;
    if (update.closeNotes) incident.close_notes = update.closeNotes;

    if (update.assignedTo) {
      incident.assigned_to = {
        value: update.assignedTo,
        display_value: update.assignedTo,
      };
    }

    if (update.assignmentGroup) {
      incident.assignment_group = {
        value: update.assignmentGroup,
        display_value: update.assignmentGroup,
      };
    }

    incident.updated_at = new Date().toISOString();

    console.log(`[MOCK SERVICENOW] Updated incident: ${incident.number}`);
    return incident;
  }

  async addWorkNotes(sysId: string, notes: string): Promise<void> {
    const incident = this.mockIncidents.get(sysId);
    if (!incident) {
      throw new Error(`Incident ${sysId} not found`);
    }

    incident.work_notes = notes;
    console.log(`[MOCK SERVICENOW] Added work notes to ${incident.number}: ${notes}`);
  }

  async resolveIncident(sysId: string, resolutionNotes: string): Promise<Incident> {
    const incident = this.mockIncidents.get(sysId);
    if (!incident) {
      throw new Error(`Incident ${sysId} not found`);
    }

    incident.state = '6'; // Resolved
    incident.close_notes = resolutionNotes;
    incident.resolved_at = new Date().toISOString();

    console.log(`[MOCK SERVICENOW] Resolved incident: ${incident.number}`);
    return incident;
  }

  async closeIncident(sysId: string, closeNotes: string): Promise<Incident> {
    const incident = this.mockIncidents.get(sysId);
    if (!incident) {
      throw new Error(`Incident ${sysId} not found`);
    }

    incident.state = '7'; // Closed
    incident.close_notes = closeNotes;

    console.log(`[MOCK SERVICENOW] Closed incident: ${incident.number}`);
    return incident;
  }

  async queryIncidents(query: string, limit: number = 50): Promise<Incident[]> {
    console.log(`[MOCK SERVICENOW] Querying incidents: ${query}`);
    return Array.from(this.mockIncidents.values()).slice(0, limit);
  }

  async createChangeRequest(request: CreateChangeRequestRequest): Promise<ChangeRequest> {
    const sysId = `change-${this.changeCounter}`;
    const number = `CHG${String(this.changeCounter).padStart(7, '0')}`;
    this.changeCounter++;

    const now = new Date().toISOString();

    const mockChange: ChangeRequest = {
      sys_id: sysId,
      number,
      short_description: request.shortDescription,
      description: request.description,
      state: 'new',
      risk: request.risk || 'medium',
      impact: request.impact || '3',
      priority: '3',
      type: request.type || 'normal',
    };

    if (request.requestedBy) {
      mockChange.requested_by = {
        value: request.requestedBy,
        display_value: request.requestedBy,
      };
    }

    if (request.assignmentGroup) {
      mockChange.assignment_group = {
        value: request.assignmentGroup,
        display_value: request.assignmentGroup,
      };
    }

    if (request.startDate) mockChange.start_date = request.startDate;
    if (request.endDate) mockChange.end_date = request.endDate;

    this.mockChangeRequests.set(sysId, mockChange);

    console.log(`[MOCK SERVICENOW] Created change request: ${number}`);
    console.log(`  Short Description: ${request.shortDescription}`);
    console.log(`  Type: ${request.type || 'normal'}`);
    console.log(`  Risk: ${request.risk || 'medium'}`);

    return mockChange;
  }

  async getChangeRequest(sysId: string): Promise<ChangeRequest> {
    const change = this.mockChangeRequests.get(sysId);
    if (!change) {
      throw new Error(`Change request ${sysId} not found`);
    }
    return change;
  }

  async updateChangeRequest(sysId: string, update: Partial<ChangeRequest>): Promise<ChangeRequest> {
    const change = this.mockChangeRequests.get(sysId);
    if (!change) {
      throw new Error(`Change request ${sysId} not found`);
    }

    Object.assign(change, update);
    console.log(`[MOCK SERVICENOW] Updated change request: ${change.number}`);
    return change;
  }

  async approveChangeRequest(sysId: string, approvalNotes?: string): Promise<ChangeRequest> {
    const change = this.mockChangeRequests.get(sysId);
    if (!change) {
      throw new Error(`Change request ${sysId} not found`);
    }

    change.state = 'approved';
    console.log(`[MOCK SERVICENOW] Approved change request: ${change.number}`);
    if (approvalNotes) {
      console.log(`  Approval notes: ${approvalNotes}`);
    }

    return change;
  }

  async rejectChangeRequest(sysId: string, rejectionNotes: string): Promise<ChangeRequest> {
    const change = this.mockChangeRequests.get(sysId);
    if (!change) {
      throw new Error(`Change request ${sysId} not found`);
    }

    change.state = 'rejected';
    console.log(`[MOCK SERVICENOW] Rejected change request: ${change.number}`);
    console.log(`  Rejection notes: ${rejectionNotes}`);

    return change;
  }

  // Testing utilities
  private calculatePriority(impact: string, urgency: string): string {
    // ServiceNow priority matrix
    const matrix: Record<string, Record<string, string>> = {
      '1': { '1': '1', '2': '2', '3': '3' },
      '2': { '1': '2', '2': '3', '3': '4' },
      '3': { '1': '3', '2': '4', '3': '5' },
    };

    return matrix[impact]?.[urgency] || '5';
  }

  getAllIncidents(): Incident[] {
    return Array.from(this.mockIncidents.values());
  }

  getAllChangeRequests(): ChangeRequest[] {
    return Array.from(this.mockChangeRequests.values());
  }

  clearAll(): void {
    this.mockIncidents.clear();
    this.mockChangeRequests.clear();
    this.incidentCounter = 1;
    this.changeCounter = 1;
    console.log('[MOCK SERVICENOW] Cleared all data');
  }
}
