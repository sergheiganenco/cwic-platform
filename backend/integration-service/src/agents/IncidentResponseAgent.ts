// Incident Response Agent - Handles incident creation and routing
import { ServiceNowAdapter, CreateIncidentRequest } from '../adapters/ServiceNowAdapter';
import { JiraAdapter, CreateIssueRequest } from '../adapters/JiraAdapter';
import { MockServiceNowAdapter } from '../adapters/mocks/MockServiceNowAdapter';
import { MockJiraAdapter } from '../adapters/mocks/MockJiraAdapter';

export interface IncidentContext {
  source: 'pipeline' | 'data_quality' | 'lineage' | 'manual';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedSystems: string[];
  errorDetails?: {
    message: string;
    stackTrace?: string;
    logs?: string[];
  };
  dataImpact?: {
    recordsAffected: number;
    tablesAffected: string[];
    businessImpact: string;
  };
  complianceRisk?: {
    isGDPR: boolean;
    isCCPA: boolean;
    isPII: boolean;
    riskLevel: 'high' | 'medium' | 'low';
  };
}

export interface IncidentResponse {
  incidentId: string;
  incidentNumber: string;
  ticketUrl?: string;
  assignedTo?: string;
  estimatedResolutionTime?: string;
  remediationSteps?: string[];
  autoRemediationAttempted: boolean;
  autoRemediationSuccess?: boolean;
}

export interface RoutingDecision {
  target: 'servicenow' | 'jira' | 'both' | 'auto_remediate';
  urgency: '1' | '2' | '3';
  impact: '1' | '2' | '3';
  assignmentGroup?: string;
  autoRemediate: boolean;
  escalate: boolean;
  notifyStakeholders: string[];
}

export class IncidentResponseAgent {
  private serviceNowAdapter: ServiceNowAdapter | MockServiceNowAdapter;
  private jiraAdapter: JiraAdapter | MockJiraAdapter;
  private useMocks: boolean;

  constructor(
    serviceNowAdapter: ServiceNowAdapter | MockServiceNowAdapter,
    jiraAdapter: JiraAdapter | MockJiraAdapter,
    useMocks: boolean = true
  ) {
    this.serviceNowAdapter = serviceNowAdapter;
    this.jiraAdapter = jiraAdapter;
    this.useMocks = useMocks;
  }

  /**
   * Handle incident creation and routing
   */
  async handleIncident(context: IncidentContext): Promise<IncidentResponse> {
    console.log(`\n[Incident Agent] 🚨 New incident detected`);
    console.log(`  Source: ${context.source}`);
    console.log(`  Severity: ${context.severity}`);
    console.log(`  Title: ${context.title}`);

    // Make routing decision
    const routing = this.makeRoutingDecision(context);

    // Attempt auto-remediation if applicable
    let autoRemediationSuccess = false;
    if (routing.autoRemediate) {
      autoRemediationSuccess = await this.attemptAutoRemediation(context);
    }

    // Create incident/ticket based on routing decision
    let incidentId = '';
    let incidentNumber = '';
    let ticketUrl = '';

    if (routing.target === 'servicenow' || routing.target === 'both') {
      const incident = await this.createServiceNowIncident(context, routing);
      incidentId = incident.sys_id;
      incidentNumber = incident.number;
      ticketUrl = `https://${this.useMocks ? 'mock-instance' : process.env.SERVICENOW_INSTANCE}.service-now.com/incident.do?sys_id=${incidentId}`;
    }

    if (routing.target === 'jira' || routing.target === 'both') {
      const issue = await this.createJiraIssue(context, routing);
      if (!incidentNumber) incidentNumber = issue.key;
      ticketUrl = issue.self;
    }

    // Generate remediation steps
    const remediationSteps = this.generateRemediationSteps(context);

    // Auto-close if remediation was successful
    if (autoRemediationSuccess && incidentId) {
      await this.resolveIncident(incidentId, 'Auto-remediated successfully');
    }

    // Notify stakeholders if needed
    if (routing.notifyStakeholders.length > 0) {
      await this.notifyStakeholders(routing.notifyStakeholders, context, incidentNumber);
    }

    return {
      incidentId,
      incidentNumber,
      ticketUrl,
      assignedTo: routing.assignmentGroup,
      remediationSteps,
      autoRemediationAttempted: routing.autoRemediate,
      autoRemediationSuccess,
    };
  }

  /**
   * Make intelligent routing decision
   */
  private makeRoutingDecision(context: IncidentContext): RoutingDecision {
    const decision: RoutingDecision = {
      target: 'jira',
      urgency: '3',
      impact: '3',
      autoRemediate: false,
      escalate: false,
      notifyStakeholders: [],
    };

    // Determine urgency based on severity
    switch (context.severity) {
      case 'critical':
        decision.urgency = '1';
        decision.impact = '1';
        decision.target = 'both'; // Create both ServiceNow incident and Jira ticket
        decision.escalate = true;
        break;
      case 'high':
        decision.urgency = '2';
        decision.impact = '2';
        decision.target = 'servicenow';
        break;
      case 'medium':
        decision.urgency = '2';
        decision.impact = '3';
        decision.target = 'jira';
        break;
      case 'low':
        decision.urgency = '3';
        decision.impact = '3';
        decision.target = 'jira';
        break;
    }

    // Check for compliance risks
    if (context.complianceRisk) {
      if (context.complianceRisk.isPII && context.complianceRisk.riskLevel === 'high') {
        decision.urgency = '1';
        decision.impact = '1';
        decision.target = 'both';
        decision.notifyStakeholders.push('security@company.com', 'legal@company.com', 'dpo@company.com');
        decision.escalate = true;
      }
    }

    // Determine assignment based on source
    switch (context.source) {
      case 'pipeline':
        decision.assignmentGroup = 'Data Engineering';
        decision.autoRemediate = true; // Pipelines often have known fixes
        break;
      case 'data_quality':
        decision.assignmentGroup = 'Data Quality Team';
        decision.notifyStakeholders.push('data-quality@company.com');
        break;
      case 'lineage':
        decision.assignmentGroup = 'Data Engineering';
        break;
      default:
        decision.assignmentGroup = 'Platform Team';
    }

    // High data impact requires escalation
    if (context.dataImpact && context.dataImpact.recordsAffected > 10000) {
      decision.impact = '1';
      decision.notifyStakeholders.push('data-governance@company.com');
    }

    return decision;
  }

  /**
   * Create ServiceNow incident
   */
  private async createServiceNowIncident(context: IncidentContext, routing: RoutingDecision) {
    const request: CreateIncidentRequest = {
      shortDescription: context.title,
      description: this.formatDescription(context),
      impact: routing.impact,
      urgency: routing.urgency,
      category: this.mapSourceToCategory(context.source),
      assignmentGroup: routing.assignmentGroup,
    };

    const incident = await this.serviceNowAdapter.createIncident(request);

    // Add work notes with detailed information
    if (context.errorDetails) {
      await this.serviceNowAdapter.addWorkNotes(
        incident.sys_id,
        `Error Details:\n${context.errorDetails.message}\n\nAffected Systems: ${context.affectedSystems.join(', ')}`
      );
    }

    return incident;
  }

  /**
   * Create Jira issue
   */
  private async createJiraIssue(context: IncidentContext, routing: RoutingDecision) {
    const request: CreateIssueRequest = {
      project: process.env.JIRA_PROJECT || 'DATA',
      issueType: context.severity === 'critical' || context.severity === 'high' ? 'Bug' : 'Task',
      summary: context.title,
      description: this.formatDescription(context),
      priority: this.mapSeverityToPriority(context.severity),
      labels: [context.source, context.severity, ...context.affectedSystems],
    };

    const issue = await this.jiraAdapter.createIssue(request);

    // Add comments with additional context
    if (context.errorDetails) {
      await this.jiraAdapter.addComment(
        issue.key,
        `Error Message: ${context.errorDetails.message}\n\nAffected Systems: ${context.affectedSystems.join(', ')}`
      );
    }

    return issue;
  }

  /**
   * Attempt automatic remediation
   */
  private async attemptAutoRemediation(context: IncidentContext): Promise<boolean> {
    console.log(`[Incident Agent] 🔧 Attempting auto-remediation...`);

    // Simulate auto-remediation logic
    // In reality, this would call specific remediation services

    if (context.source === 'pipeline') {
      // Common pipeline fixes
      if (context.errorDetails?.message.includes('timeout')) {
        console.log(`[Incident Agent] ✅ Auto-fix: Increasing pipeline timeout`);
        // Would call pipeline service API to update timeout
        return true;
      }

      if (context.errorDetails?.message.includes('connection')) {
        console.log(`[Incident Agent] 🔄 Auto-fix: Retrying connection with backoff`);
        // Would trigger pipeline retry
        return true;
      }
    }

    if (context.source === 'data_quality' && context.complianceRisk?.isPII) {
      console.log(`[Incident Agent] 🔒 Auto-fix: Quarantining table with PII exposure`);
      // Would call data service to quarantine table
      return true;
    }

    console.log(`[Incident Agent] ❌ No auto-remediation available`);
    return false;
  }

  /**
   * Resolve incident
   */
  private async resolveIncident(incidentId: string, resolutionNotes: string): Promise<void> {
    await this.serviceNowAdapter.resolveIncident(incidentId, resolutionNotes);
    console.log(`[Incident Agent] ✅ Incident ${incidentId} auto-resolved`);
  }

  /**
   * Notify stakeholders
   */
  private async notifyStakeholders(stakeholders: string[], context: IncidentContext, incidentNumber: string): Promise<void> {
    console.log(`[Incident Agent] 📧 Notifying stakeholders: ${stakeholders.join(', ')}`);
    console.log(`  Incident: ${incidentNumber}`);
    console.log(`  Severity: ${context.severity}`);

    // In production, this would integrate with notification-service
    // For now, just log
  }

  /**
   * Generate remediation steps
   */
  private generateRemediationSteps(context: IncidentContext): string[] {
    const steps: string[] = [];

    switch (context.source) {
      case 'pipeline':
        steps.push('1. Check pipeline logs for detailed error information');
        steps.push('2. Verify data source connectivity and credentials');
        steps.push('3. Review recent schema changes via Lineage service');
        steps.push('4. Test SQL queries manually against data source');
        steps.push('5. Update pipeline configuration if needed');
        steps.push('6. Retry pipeline execution');
        break;

      case 'data_quality':
        steps.push('1. Review quality rule that failed');
        steps.push('2. Analyze sample of failed records');
        steps.push('3. Determine if issue is with data or rule');
        steps.push('4. Apply data fixes or update rule threshold');
        steps.push('5. Re-run quality checks');
        break;

      case 'lineage':
        steps.push('1. Review lineage discovery logs');
        steps.push('2. Verify source system connectivity');
        steps.push('3. Check for schema changes');
        steps.push('4. Re-run lineage discovery');
        break;
    }

    if (context.complianceRisk?.isPII) {
      steps.unshift('0. URGENT: Quarantine affected tables immediately');
      steps.push('7. Notify Data Protection Officer');
      steps.push('8. Document incident for compliance audit trail');
    }

    return steps;
  }

  /**
   * Format description with all context
   */
  private formatDescription(context: IncidentContext): string {
    let desc = `${context.description}\n\n`;

    desc += `**Source:** ${context.source}\n`;
    desc += `**Severity:** ${context.severity}\n`;
    desc += `**Affected Systems:** ${context.affectedSystems.join(', ')}\n\n`;

    if (context.errorDetails) {
      desc += `**Error Message:**\n${context.errorDetails.message}\n\n`;
    }

    if (context.dataImpact) {
      desc += `**Data Impact:**\n`;
      desc += `- Records Affected: ${context.dataImpact.recordsAffected.toLocaleString()}\n`;
      desc += `- Tables Affected: ${context.dataImpact.tablesAffected.join(', ')}\n`;
      desc += `- Business Impact: ${context.dataImpact.businessImpact}\n\n`;
    }

    if (context.complianceRisk) {
      desc += `**Compliance Risk:**\n`;
      desc += `- PII Involved: ${context.complianceRisk.isPII ? 'YES' : 'NO'}\n`;
      desc += `- GDPR: ${context.complianceRisk.isGDPR ? 'YES' : 'NO'}\n`;
      desc += `- CCPA: ${context.complianceRisk.isCCPA ? 'YES' : 'NO'}\n`;
      desc += `- Risk Level: ${context.complianceRisk.riskLevel}\n`;
    }

    return desc;
  }

  /**
   * Map source to ServiceNow category
   */
  private mapSourceToCategory(source: string): string {
    const mapping: Record<string, string> = {
      pipeline: 'Data Pipeline',
      data_quality: 'Data Quality',
      lineage: 'Data Discovery',
      manual: 'General',
    };

    return mapping[source] || 'General';
  }

  /**
   * Map severity to Jira priority
   */
  private mapSeverityToPriority(severity: string): 'Highest' | 'High' | 'Medium' | 'Low' {
    const mapping: Record<string, 'Highest' | 'High' | 'Medium' | 'Low'> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    return mapping[severity] || 'Medium';
  }
}
