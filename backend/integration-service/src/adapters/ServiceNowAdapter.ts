// ServiceNow Integration Adapter
import axios, { AxiosInstance } from 'axios';

export interface ServiceNowConfig {
  instance: string; // e.g., 'your-instance.service-now.com'
  username: string;
  password: string;
}

export interface Incident {
  sys_id: string;
  number: string;
  short_description: string;
  description?: string;
  state: string;
  impact: string;
  urgency: string;
  priority: string;
  assigned_to?: { value: string; display_value: string };
  assignment_group?: { value: string; display_value: string };
  category?: string;
  subcategory?: string;
  opened_at: string;
  updated_at: string;
  resolved_at?: string;
  close_notes?: string;
  work_notes?: string;
}

export interface CreateIncidentRequest {
  shortDescription: string;
  description?: string;
  impact?: '1' | '2' | '3'; // 1-High, 2-Medium, 3-Low
  urgency?: '1' | '2' | '3';
  category?: string;
  subcategory?: string;
  assignedTo?: string;
  assignmentGroup?: string;
  caller?: string;
  customFields?: Record<string, any>;
}

export interface UpdateIncidentRequest {
  shortDescription?: string;
  description?: string;
  state?: string;
  impact?: string;
  urgency?: string;
  assignedTo?: string;
  assignmentGroup?: string;
  workNotes?: string;
  closeNotes?: string;
}

export interface ChangeRequest {
  sys_id: string;
  number: string;
  short_description: string;
  description?: string;
  state: string;
  risk: string;
  impact: string;
  priority: string;
  type: string;
  requested_by?: { value: string; display_value: string };
  assignment_group?: { value: string; display_value: string };
  start_date?: string;
  end_date?: string;
}

export interface CreateChangeRequestRequest {
  shortDescription: string;
  description?: string;
  type?: 'standard' | 'normal' | 'emergency';
  risk?: 'high' | 'medium' | 'low';
  impact?: '1' | '2' | '3';
  requestedBy?: string;
  assignmentGroup?: string;
  startDate?: string;
  endDate?: string;
  customFields?: Record<string, any>;
}

export class ServiceNowAdapter {
  private client: AxiosInstance;
  private config: ServiceNowConfig;

  constructor(config: ServiceNowConfig) {
    this.config = config;

    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    this.client = axios.create({
      baseURL: `https://${config.instance}/api/now`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ========== INCIDENT MANAGEMENT ==========

  /**
   * Create a new incident
   */
  async createIncident(request: CreateIncidentRequest): Promise<Incident> {
    const payload: any = {
      short_description: request.shortDescription,
      description: request.description,
      impact: request.impact || '3',
      urgency: request.urgency || '3',
      category: request.category,
      subcategory: request.subcategory,
      assigned_to: request.assignedTo,
      assignment_group: request.assignmentGroup,
      caller_id: request.caller,
      ...request.customFields,
    };

    const response = await this.client.post('/table/incident', payload);
    return response.data.result;
  }

  /**
   * Get incident by sys_id
   */
  async getIncident(sysId: string): Promise<Incident> {
    const response = await this.client.get(`/table/incident/${sysId}`);
    return response.data.result;
  }

  /**
   * Get incident by number
   */
  async getIncidentByNumber(number: string): Promise<Incident | null> {
    const response = await this.client.get('/table/incident', {
      params: { sysparm_query: `number=${number}`, sysparm_limit: 1 },
    });

    return response.data.result.length > 0 ? response.data.result[0] : null;
  }

  /**
   * Update an incident
   */
  async updateIncident(sysId: string, update: UpdateIncidentRequest): Promise<Incident> {
    const payload: any = {};

    if (update.shortDescription) payload.short_description = update.shortDescription;
    if (update.description) payload.description = update.description;
    if (update.state) payload.state = update.state;
    if (update.impact) payload.impact = update.impact;
    if (update.urgency) payload.urgency = update.urgency;
    if (update.assignedTo) payload.assigned_to = update.assignedTo;
    if (update.assignmentGroup) payload.assignment_group = update.assignmentGroup;
    if (update.workNotes) payload.work_notes = update.workNotes;
    if (update.closeNotes) payload.close_notes = update.closeNotes;

    const response = await this.client.patch(`/table/incident/${sysId}`, payload);
    return response.data.result;
  }

  /**
   * Add work notes to an incident
   */
  async addWorkNotes(sysId: string, notes: string): Promise<void> {
    await this.client.patch(`/table/incident/${sysId}`, {
      work_notes: notes,
    });
  }

  /**
   * Resolve an incident
   */
  async resolveIncident(sysId: string, resolutionNotes: string): Promise<Incident> {
    return this.updateIncident(sysId, {
      state: '6', // Resolved
      closeNotes: resolutionNotes,
    });
  }

  /**
   * Close an incident
   */
  async closeIncident(sysId: string, closeNotes: string): Promise<Incident> {
    return this.updateIncident(sysId, {
      state: '7', // Closed
      closeNotes: closeNotes,
    });
  }

  /**
   * Query incidents
   */
  async queryIncidents(query: string, limit: number = 50): Promise<Incident[]> {
    const response = await this.client.get('/table/incident', {
      params: { sysparm_query: query, sysparm_limit: limit },
    });

    return response.data.result;
  }

  // ========== CHANGE REQUEST MANAGEMENT ==========

  /**
   * Create a change request
   */
  async createChangeRequest(request: CreateChangeRequestRequest): Promise<ChangeRequest> {
    const payload: any = {
      short_description: request.shortDescription,
      description: request.description,
      type: request.type || 'normal',
      risk: request.risk || 'medium',
      impact: request.impact || '3',
      requested_by: request.requestedBy,
      assignment_group: request.assignmentGroup,
      start_date: request.startDate,
      end_date: request.endDate,
      ...request.customFields,
    };

    const response = await this.client.post('/table/change_request', payload);
    return response.data.result;
  }

  /**
   * Get change request by sys_id
   */
  async getChangeRequest(sysId: string): Promise<ChangeRequest> {
    const response = await this.client.get(`/table/change_request/${sysId}`);
    return response.data.result;
  }

  /**
   * Update a change request
   */
  async updateChangeRequest(sysId: string, update: Partial<ChangeRequest>): Promise<ChangeRequest> {
    const response = await this.client.patch(`/table/change_request/${sysId}`, update);
    return response.data.result;
  }

  /**
   * Approve a change request
   */
  async approveChangeRequest(sysId: string, approvalNotes?: string): Promise<ChangeRequest> {
    const payload: any = {
      state: 'approved',
      approval: 'approved',
    };

    if (approvalNotes) {
      payload.work_notes = approvalNotes;
    }

    const response = await this.client.patch(`/table/change_request/${sysId}`, payload);
    return response.data.result;
  }

  /**
   * Reject a change request
   */
  async rejectChangeRequest(sysId: string, rejectionNotes: string): Promise<ChangeRequest> {
    const response = await this.client.patch(`/table/change_request/${sysId}`, {
      state: 'rejected',
      approval: 'rejected',
      work_notes: rejectionNotes,
    });
    return response.data.result;
  }

  // ========== KNOWLEDGE BASE ==========

  /**
   * Create a knowledge article
   */
  async createKnowledgeArticle(title: string, content: string, category?: string): Promise<any> {
    const payload = {
      short_description: title,
      text: content,
      kb_category: category,
    };

    const response = await this.client.post('/table/kb_knowledge', payload);
    return response.data.result;
  }

  /**
   * Search knowledge base
   */
  async searchKnowledge(searchTerm: string, limit: number = 10): Promise<any[]> {
    const response = await this.client.get('/table/kb_knowledge', {
      params: {
        sysparm_query: `short_descriptionLIKE${searchTerm}^ORtextLIKE${searchTerm}`,
        sysparm_limit: limit,
      },
    });

    return response.data.result;
  }

  // ========== UTILITIES ==========

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any | null> {
    const response = await this.client.get('/table/sys_user', {
      params: { sysparm_query: `email=${email}`, sysparm_limit: 1 },
    });

    return response.data.result.length > 0 ? response.data.result[0] : null;
  }

  /**
   * Get assignment group by name
   */
  async getAssignmentGroup(name: string): Promise<any | null> {
    const response = await this.client.get('/table/sys_user_group', {
      params: { sysparm_query: `name=${name}`, sysparm_limit: 1 },
    });

    return response.data.result.length > 0 ? response.data.result[0] : null;
  }
}
