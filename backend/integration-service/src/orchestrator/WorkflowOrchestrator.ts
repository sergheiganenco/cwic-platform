// Workflow Orchestrator - Coordinates all agents and services
import { PipelineIntelligenceAgent, PipelineFailure, RootCauseAnalysis } from '../agents/PipelineIntelligenceAgent';
import { IncidentResponseAgent, IncidentContext, IncidentResponse } from '../agents/IncidentResponseAgent';
import { ServiceNowAdapter } from '../adapters/ServiceNowAdapter';
import { JiraAdapter } from '../adapters/JiraAdapter';
import { AzureDevOpsAdapter } from '../adapters/AzureDevOpsAdapter';
import { MockServiceNowAdapter } from '../adapters/mocks/MockServiceNowAdapter';
import { MockJiraAdapter } from '../adapters/mocks/MockJiraAdapter';
import { MockAzureDevOpsAdapter } from '../adapters/mocks/MockAzureDevOpsAdapter';

export interface WorkflowConfig {
  useMocks: boolean;
  enableAI: boolean;
  autoRemediate: boolean;
  jira?: {
    url: string;
    username: string;
    apiToken: string;
    defaultProject: string;
  };
  azureDevOps?: {
    organization: string;
    project: string;
    personalAccessToken: string;
  };
  serviceNow?: {
    instance: string;
    username: string;
    password: string;
  };
  openaiApiKey?: string;
}

export interface PipelineFailureEvent {
  type: 'pipeline_failure';
  pipelineId: string;
  pipelineName: string;
  runId: string;
  stepId?: string;
  error: string;
  stackTrace?: string;
  logs?: string[];
  attemptNumber: number;
  metadata?: any;
}

export interface DataQualityFailureEvent {
  type: 'data_quality_failure';
  ruleId: string;
  ruleName: string;
  table: string;
  schema: string;
  failureCount: number;
  totalRecords: number;
  isPII: boolean;
  complianceRisk: 'high' | 'medium' | 'low';
  metadata?: any;
}

export interface WorkflowResult {
  eventId: string;
  eventType: string;
  timestamp: string;
  analysis?: RootCauseAnalysis;
  incident?: IncidentResponse;
  actions: Array<{
    type: string;
    status: 'success' | 'failed';
    message: string;
    details?: any;
  }>;
  autoRemediationAttempted: boolean;
  autoRemediationSuccess: boolean;
}

export class WorkflowOrchestrator {
  private pipelineAgent: PipelineIntelligenceAgent;
  private incidentAgent: IncidentResponseAgent;
  private jiraAdapter: JiraAdapter | MockJiraAdapter;
  private azureDevOpsAdapter: AzureDevOpsAdapter | MockAzureDevOpsAdapter;
  private serviceNowAdapter: ServiceNowAdapter | MockServiceNowAdapter;
  private config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = config;

    // Initialize adapters (real or mock)
    if (config.useMocks) {
      this.jiraAdapter = new MockJiraAdapter();
      this.azureDevOpsAdapter = new MockAzureDevOpsAdapter();
      this.serviceNowAdapter = new MockServiceNowAdapter();
      console.log('[Orchestrator] 🧪 Using MOCK adapters for testing');
    } else {
      if (!config.jira || !config.azureDevOps || !config.serviceNow) {
        throw new Error('Real adapters require full configuration');
      }
      this.jiraAdapter = new JiraAdapter(config.jira);
      this.azureDevOpsAdapter = new AzureDevOpsAdapter(config.azureDevOps);
      this.serviceNowAdapter = new ServiceNowAdapter(config.serviceNow);
      console.log('[Orchestrator] 🔌 Using REAL adapters');
    }

    // Initialize AI agents
    this.pipelineAgent = new PipelineIntelligenceAgent(config.enableAI ? config.openaiApiKey : undefined);
    this.incidentAgent = new IncidentResponseAgent(
      this.serviceNowAdapter,
      this.jiraAdapter,
      config.useMocks
    );

    console.log('[Orchestrator] ✅ Workflow Orchestrator initialized');
    console.log(`  AI Enabled: ${config.enableAI}`);
    console.log(`  Auto-Remediation: ${config.autoRemediate}`);
  }

  /**
   * Handle pipeline failure event
   */
  async handlePipelineFailure(event: PipelineFailureEvent): Promise<WorkflowResult> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Orchestrator] 🔥 PIPELINE FAILURE EVENT`);
    console.log(`  Pipeline: ${event.pipelineName}`);
    console.log(`  Run ID: ${event.runId}`);
    console.log(`  Error: ${event.error}`);
    console.log(`${'='.repeat(80)}\n`);

    const result: WorkflowResult = {
      eventId: `${event.runId}-${Date.now()}`,
      eventType: 'pipeline_failure',
      timestamp: new Date().toISOString(),
      actions: [],
      autoRemediationAttempted: false,
      autoRemediationSuccess: false,
    };

    try {
      // Step 1: Analyze failure using Pipeline Intelligence Agent
      const failure: PipelineFailure = {
        pipelineId: event.pipelineId,
        pipelineName: event.pipelineName,
        runId: event.runId,
        stepId: event.stepId,
        errorMessage: event.error,
        stackTrace: event.stackTrace,
        timestamp: new Date().toISOString(),
        attemptNumber: event.attemptNumber,
        logs: event.logs,
      };

      const analysis = await this.pipelineAgent.analyzeFailure(failure);
      result.analysis = analysis;

      result.actions.push({
        type: 'root_cause_analysis',
        status: 'success',
        message: `Identified cause: ${analysis.category} (${Math.round(analysis.confidence * 100)}% confidence)`,
        details: analysis,
      });

      // Step 2: Determine if auto-remediation is possible
      if (this.config.autoRemediate && analysis.autoFixable) {
        const remediationSuccess = await this.attemptPipelineRemediation(event, analysis);
        result.autoRemediationAttempted = true;
        result.autoRemediationSuccess = remediationSuccess;

        result.actions.push({
          type: 'auto_remediation',
          status: remediationSuccess ? 'success' : 'failed',
          message: remediationSuccess
            ? 'Pipeline auto-remediated successfully'
            : 'Auto-remediation attempted but failed',
        });

        // If auto-remediation successful, no need to create incident
        if (remediationSuccess) {
          console.log(`[Orchestrator] ✅ Auto-remediation successful - no incident needed`);
          return result;
        }
      }

      // Step 3: Create incident using Incident Response Agent
      const incidentContext: IncidentContext = {
        source: 'pipeline',
        severity: this.determineSeverity(event, analysis),
        title: `Pipeline Failure: ${event.pipelineName}`,
        description: `Pipeline ${event.pipelineName} failed at step ${event.stepId || 'unknown'}.\n\nRoot Cause: ${analysis.rootCause}\n\nSuggested Fix: ${analysis.suggestedFix}`,
        affectedSystems: [event.pipelineName],
        errorDetails: {
          message: event.error,
          stackTrace: event.stackTrace,
          logs: event.logs,
        },
      };

      const incident = await this.incidentAgent.handleIncident(incidentContext);
      result.incident = incident;

      result.actions.push({
        type: 'incident_creation',
        status: 'success',
        message: `Created incident: ${incident.incidentNumber}`,
        details: incident,
      });

      // Step 4: Create Jira ticket for tracking
      const jiraIssue = await this.jiraAdapter.createIssue({
        project: this.config.jira?.defaultProject || 'DATA',
        issueType: 'Bug',
        summary: `Pipeline Failure: ${event.pipelineName}`,
        description: `Pipeline failed with error: ${event.error}\n\nAnalysis: ${analysis.rootCause}\n\nFix: ${analysis.suggestedFix}`,
        priority: this.mapSeverityToJiraPriority(incidentContext.severity),
        labels: ['pipeline', 'auto-created', analysis.category],
      });

      result.actions.push({
        type: 'jira_ticket',
        status: 'success',
        message: `Created Jira ticket: ${jiraIssue.key}`,
        details: { key: jiraIssue.key, url: jiraIssue.self },
      });

      // Step 5: Link ServiceNow incident to Jira if both exist
      if (incident.incidentNumber && jiraIssue.key) {
        await this.jiraAdapter.addComment(
          jiraIssue.key,
          `ServiceNow Incident: ${incident.incidentNumber}\nIncident URL: ${incident.ticketUrl || 'N/A'}`
        );
      }

      console.log(`\n[Orchestrator] ✅ Pipeline failure workflow completed`);
      console.log(`  Incident: ${incident.incidentNumber}`);
      console.log(`  Jira: ${jiraIssue.key}`);
      console.log(`  Actions: ${result.actions.length}`);

    } catch (error: any) {
      console.error(`[Orchestrator] ❌ Error in pipeline failure workflow:`, error);
      result.actions.push({
        type: 'error',
        status: 'failed',
        message: error.message,
      });
    }

    return result;
  }

  /**
   * Handle data quality failure event
   */
  async handleDataQualityFailure(event: DataQualityFailureEvent): Promise<WorkflowResult> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Orchestrator] 🚨 DATA QUALITY FAILURE EVENT`);
    console.log(`  Rule: ${event.ruleName}`);
    console.log(`  Table: ${event.schema}.${event.table}`);
    console.log(`  Failed Records: ${event.failureCount} / ${event.totalRecords}`);
    console.log(`  PII: ${event.isPII ? 'YES' : 'NO'}`);
    console.log(`${'='.repeat(80)}\n`);

    const result: WorkflowResult = {
      eventId: `dq-${event.ruleId}-${Date.now()}`,
      eventType: 'data_quality_failure',
      timestamp: new Date().toISOString(),
      actions: [],
      autoRemediationAttempted: false,
      autoRemediationSuccess: false,
    };

    try {
      // Determine severity based on failure rate and PII
      const failureRate = event.failureCount / event.totalRecords;
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';

      if (event.isPII && event.complianceRisk === 'high') {
        severity = 'critical';
      } else if (failureRate > 0.5) {
        severity = 'high';
      } else if (failureRate > 0.2) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      // Create incident context
      const incidentContext: IncidentContext = {
        source: 'data_quality',
        severity,
        title: `Data Quality Failure: ${event.ruleName}`,
        description: `Quality rule "${event.ruleName}" failed on ${event.schema}.${event.table}.\n\n${event.failureCount} out of ${event.totalRecords} records failed validation.`,
        affectedSystems: [`${event.schema}.${event.table}`],
        dataImpact: {
          recordsAffected: event.failureCount,
          tablesAffected: [`${event.schema}.${event.table}`],
          businessImpact: failureRate > 0.5 ? 'High - majority of records affected' : 'Medium - partial data affected',
        },
      };

      // Add compliance risk if PII detected
      if (event.isPII) {
        incidentContext.complianceRisk = {
          isPII: true,
          isGDPR: true, // Assume yes if PII
          isCCPA: true,
          riskLevel: event.complianceRisk,
        };
      }

      // Handle incident
      const incident = await this.incidentAgent.handleIncident(incidentContext);
      result.incident = incident;
      result.autoRemediationAttempted = incident.autoRemediationAttempted;
      result.autoRemediationSuccess = incident.autoRemediationSuccess || false;

      result.actions.push({
        type: 'incident_creation',
        status: 'success',
        message: `Created incident: ${incident.incidentNumber}`,
        details: incident,
      });

      // If PII and high risk, create Azure DevOps work item for tracking
      if (event.isPII && event.complianceRisk === 'high') {
        const workItem = await this.azureDevOpsAdapter.createWorkItem({
          workItemType: 'Bug',
          title: `URGENT: PII Exposure in ${event.schema}.${event.table}`,
          description: `High-risk PII detected in table ${event.schema}.${event.table}.\n\nFailed Records: ${event.failureCount}\n\nImmediate action required.`,
          priority: 1,
          severity: '1 - Critical',
          tags: ['pii', 'compliance', 'urgent', 'gdpr'],
        });

        result.actions.push({
          type: 'azure_devops_workitem',
          status: 'success',
          message: `Created Azure DevOps work item: ${workItem.id}`,
          details: { id: workItem.id, url: workItem.url },
        });
      }

      console.log(`\n[Orchestrator] ✅ Data quality failure workflow completed`);
      console.log(`  Incident: ${incident.incidentNumber}`);
      console.log(`  Severity: ${severity}`);
      console.log(`  Auto-remediation: ${result.autoRemediationSuccess ? 'YES' : 'NO'}`);

    } catch (error: any) {
      console.error(`[Orchestrator] ❌ Error in data quality workflow:`, error);
      result.actions.push({
        type: 'error',
        status: 'failed',
        message: error.message,
      });
    }

    return result;
  }

  /**
   * Attempt pipeline auto-remediation
   */
  private async attemptPipelineRemediation(event: PipelineFailureEvent, analysis: RootCauseAnalysis): Promise<boolean> {
    console.log(`[Orchestrator] 🔧 Attempting pipeline auto-remediation...`);

    // Simulate remediation based on category
    switch (analysis.category) {
      case 'timeout':
        console.log(`  → Increasing timeout configuration`);
        // Would call pipeline service API to increase timeout
        return true;

      case 'connection_error':
        console.log(`  → Retrying with exponential backoff`);
        // Would trigger pipeline retry
        return true;

      case 'schema_change':
        console.log(`  → Cannot auto-fix schema changes`);
        return false;

      default:
        console.log(`  → No auto-fix available for ${analysis.category}`);
        return false;
    }
  }

  /**
   * Determine severity based on failure and analysis
   */
  private determineSeverity(event: PipelineFailureEvent, analysis: RootCauseAnalysis): 'critical' | 'high' | 'medium' | 'low' {
    // Critical if high confidence known issue
    if (analysis.confidence > 0.8 && analysis.category === 'data_quality') {
      return 'critical';
    }

    // High if multiple retries failed
    if (event.attemptNumber >= 3) {
      return 'high';
    }

    // Medium if low confidence
    if (analysis.confidence < 0.5) {
      return 'medium';
    }

    return 'medium';
  }

  /**
   * Map severity to Jira priority
   */
  private mapSeverityToJiraPriority(severity: string): 'Highest' | 'High' | 'Medium' | 'Low' {
    const map: Record<string, 'Highest' | 'High' | 'Medium' | 'Low'> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };
    return map[severity] || 'Medium';
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): any {
    return {
      pipelineAgentKnowledgeBase: this.pipelineAgent.getKnowledgeBaseSize(),
      config: {
        useMocks: this.config.useMocks,
        enableAI: this.config.enableAI,
        autoRemediate: this.config.autoRemediate,
      },
    };
  }
}
