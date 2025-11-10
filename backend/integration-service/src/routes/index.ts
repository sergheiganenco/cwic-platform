// Integration Service Routes
import express, { Request, Response } from 'express';
import { WorkflowOrchestrator, PipelineFailureEvent, DataQualityFailureEvent } from '../orchestrator/WorkflowOrchestrator';
import { GitHubWebhookHandler } from '../webhooks/GitHubWebhookHandler';
import { PipelineScheduler } from '../scheduler/PipelineScheduler';

export function setupRoutes(app: express.Application): void {
  const router = express.Router();

  // Initialize orchestrator (using mocks for testing)
  const orchestrator = new WorkflowOrchestrator({
    useMocks: process.env.USE_MOCKS === 'true' || true,
    enableAI: process.env.ENABLE_AI === 'true' || false,
    autoRemediate: process.env.AUTO_REMEDIATE === 'true' || true,
    openaiApiKey: process.env.OPENAI_API_KEY,
  });

  // Initialize GitHub webhook handler
  const githubWebhook = new GitHubWebhookHandler(
    process.env.GITHUB_WEBHOOK_SECRET || 'test-secret'
  );

  // Initialize pipeline scheduler
  const scheduler = new PipelineScheduler(
    process.env.PIPELINE_SERVICE_URL || 'http://pipeline-service:3004'
  );

  // ========== WORKFLOW ORCHESTRATION ENDPOINTS ==========

  /**
   * Handle pipeline failure event
   */
  router.post('/workflows/pipeline-failure', async (req: Request, res: Response) => {
    try {
      const event: PipelineFailureEvent = req.body;

      console.log(`[API] Received pipeline failure event: ${event.pipelineName}`);

      const result = await orchestrator.handlePipelineFailure(event);

      res.json({
        success: true,
        result,
      });
    } catch (error: any) {
      console.error('[API] Error handling pipeline failure:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * Handle data quality failure event
   */
  router.post('/workflows/data-quality-failure', async (req: Request, res: Response) => {
    try {
      const event: DataQualityFailureEvent = req.body;

      console.log(`[API] Received data quality failure event: ${event.ruleName}`);

      const result = await orchestrator.handleDataQualityFailure(event);

      res.json({
        success: true,
        result,
      });
    } catch (error: any) {
      console.error('[API] Error handling data quality failure:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * Get orchestrator statistics
   */
  router.get('/workflows/stats', (req: Request, res: Response) => {
    res.json(orchestrator.getStats());
  });

  // ========== GITHUB WEBHOOK ENDPOINTS ==========

  /**
   * GitHub webhook receiver
   */
  router.post('/webhooks/github', async (req: Request, res: Response) => {
    try {
      // Verify signature (skip in test mode)
      if (process.env.VERIFY_WEBHOOKS === 'true') {
        if (!githubWebhook.verifySignature(req)) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const eventType = req.headers['x-github-event'] as string;

      console.log(`[API] GitHub webhook received: ${eventType}`);

      let trigger = null;

      switch (eventType) {
        case 'push':
          trigger = githubWebhook.handlePush(req.body);
          break;

        case 'pull_request':
          trigger = githubWebhook.handlePullRequest(req.body);
          break;

        default:
          console.log(`[API] Unhandled GitHub event: ${eventType}`);
          return res.json({ message: 'Event received but not processed' });
      }

      if (trigger) {
        // Determine pipelines to trigger
        const pipelines = githubWebhook.determinePipelinesToTrigger(trigger);

        // TODO: Actually trigger these pipelines via pipeline service
        console.log(`[API] Would trigger pipelines: ${pipelines.join(', ')}`);

        res.json({
          success: true,
          trigger,
          pipelinesTriggered: pipelines,
        });
      } else {
        res.json({ message: 'Event received but no trigger generated' });
      }
    } catch (error: any) {
      console.error('[API] Error handling GitHub webhook:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== SCHEDULER ENDPOINTS ==========

  /**
   * Schedule a pipeline
   */
  router.post('/scheduler/pipelines', (req: Request, res: Response) => {
    try {
      const { id, pipelineId, name, schedule, enabled, timezone } = req.body;

      const success = scheduler.schedulePipeline({
        id: id || pipelineId,
        pipelineId,
        name,
        schedule,
        enabled: enabled !== false,
        timezone,
      });

      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Unschedule a pipeline
   */
  router.delete('/scheduler/pipelines/:id', (req: Request, res: Response) => {
    try {
      scheduler.unschedulePipeline(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get scheduler statistics
   */
  router.get('/scheduler/stats', (req: Request, res: Response) => {
    res.json(scheduler.getStats());
  });

  /**
   * Get all scheduled pipelines
   */
  router.get('/scheduler/pipelines', (req: Request, res: Response) => {
    res.json(scheduler.getScheduledPipelines());
  });

  // ========== TESTING ENDPOINTS ==========

  /**
   * Test pipeline failure workflow (for development)
   */
  router.post('/test/pipeline-failure', async (req: Request, res: Response) => {
    const testEvent: PipelineFailureEvent = {
      type: 'pipeline_failure',
      pipelineId: 'test-pipeline-123',
      pipelineName: 'Daily Customer Analytics',
      runId: `run-${Date.now()}`,
      stepId: 'transform-step',
      error: 'Column "loyalty_tier" does not exist',
      attemptNumber: 3,
      logs: [
        'Starting pipeline execution...',
        'Connected to database successfully',
        'Running SQL query...',
        'ERROR: column "loyalty_tier" does not exist',
      ],
    };

    const result = await orchestrator.handlePipelineFailure(testEvent);
    res.json({ success: true, result });
  });

  /**
   * Test data quality failure workflow (for development)
   */
  router.post('/test/data-quality-failure', async (req: Request, res: Response) => {
    const testEvent: DataQualityFailureEvent = {
      type: 'data_quality_failure',
      ruleId: 'pii-check-001',
      ruleName: 'Check PII in Public Tables',
      table: 'analytics_summary',
      schema: 'public',
      failureCount: 15000,
      totalRecords: 15000,
      isPII: true,
      complianceRisk: 'high',
    };

    const result = await orchestrator.handleDataQualityFailure(testEvent);
    res.json({ success: true, result });
  });

  // Mount router
  app.use('/api', router);

  console.log('[Routes] ✅ API routes configured');
}
