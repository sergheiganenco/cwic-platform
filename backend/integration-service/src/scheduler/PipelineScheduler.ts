// Pipeline Scheduler using node-cron
import cron from 'node-cron';
import axios from 'axios';

export interface ScheduledPipeline {
  id: string;
  pipelineId: string;
  name: string;
  schedule: string; // cron expression
  enabled: boolean;
  timezone?: string;
}

export class PipelineScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private pipelineServiceUrl: string;

  constructor(pipelineServiceUrl: string) {
    this.pipelineServiceUrl = pipelineServiceUrl;
    console.log('[Scheduler] 📅 Pipeline Scheduler initialized');
    console.log(`  Pipeline Service: ${pipelineServiceUrl}`);
  }

  /**
   * Schedule a pipeline
   */
  schedulePipeline(pipeline: ScheduledPipeline): boolean {
    if (!cron.validate(pipeline.schedule)) {
      console.error(`[Scheduler] ❌ Invalid cron expression: ${pipeline.schedule}`);
      return false;
    }

    // Stop existing job if any
    this.unschedulePipeline(pipeline.id);

    if (!pipeline.enabled) {
      console.log(`[Scheduler] ⏸️  Pipeline ${pipeline.name} is disabled - not scheduling`);
      return true;
    }

    const task = cron.schedule(
      pipeline.schedule,
      async () => {
        await this.triggerPipeline(pipeline);
      },
      {
        timezone: pipeline.timezone || 'UTC',
      }
    );

    this.jobs.set(pipeline.id, task);

    console.log(`[Scheduler] ✅ Scheduled pipeline: ${pipeline.name}`);
    console.log(`  Schedule: ${pipeline.schedule}`);
    console.log(`  Next run: ${this.getNextRunTime(pipeline.schedule, pipeline.timezone)}`);

    return true;
  }

  /**
   * Unschedule a pipeline
   */
  unschedulePipeline(pipelineId: string): void {
    const task = this.jobs.get(pipelineId);
    if (task) {
      task.stop();
      this.jobs.delete(pipelineId);
      console.log(`[Scheduler] 🛑 Unscheduled pipeline: ${pipelineId}`);
    }
  }

  /**
   * Trigger pipeline execution
   */
  private async triggerPipeline(pipeline: ScheduledPipeline): Promise<void> {
    console.log(`\n[Scheduler] 🚀 Triggering scheduled pipeline: ${pipeline.name}`);
    console.log(`  Time: ${new Date().toISOString()}`);

    try {
      const response = await axios.post(
        `${this.pipelineServiceUrl}/api/pipelines/${pipeline.pipelineId}/run`,
        {
          triggered_by: 'scheduler',
          metadata: {
            scheduled: true,
            scheduledAt: new Date().toISOString(),
          },
        },
        {
          timeout: 10000,
        }
      );

      console.log(`[Scheduler] ✅ Pipeline triggered successfully`);
      console.log(`  Run ID: ${response.data.runId || response.data.id}`);
    } catch (error: any) {
      console.error(`[Scheduler] ❌ Failed to trigger pipeline: ${error.message}`);

      // Could integrate with incident system here
      // await this.handleSchedulerFailure(pipeline, error);
    }
  }

  /**
   * Update pipeline schedule
   */
  updateSchedule(pipelineId: string, newSchedule: string, timezone?: string): boolean {
    const task = this.jobs.get(pipelineId);
    if (!task) {
      console.error(`[Scheduler] ❌ Pipeline ${pipelineId} not found`);
      return false;
    }

    // For node-cron, we need to stop and reschedule
    this.unschedulePipeline(pipelineId);

    return this.schedulePipeline({
      id: pipelineId,
      pipelineId: pipelineId,
      name: `Pipeline ${pipelineId}`,
      schedule: newSchedule,
      enabled: true,
      timezone: timezone,
    });
  }

  /**
   * Get all scheduled pipelines
   */
  getScheduledPipelines(): Array<{ id: string; isRunning: boolean }> {
    return Array.from(this.jobs.entries()).map(([id, task]) => ({
      id,
      isRunning: task ? true : false,
    }));
  }

  /**
   * Get next run time for a cron expression
   */
  private getNextRunTime(cronExpression: string, timezone: string = 'UTC'): string {
    // This is a simplified version - in production use a proper cron parser
    return 'Next run time calculation not implemented';
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll(): void {
    console.log(`[Scheduler] 🛑 Stopping all scheduled jobs...`);
    this.jobs.forEach((task, id) => {
      task.stop();
      console.log(`  Stopped: ${id}`);
    });
    this.jobs.clear();
    console.log(`[Scheduler] ✅ All jobs stopped`);
  }

  /**
   * Get scheduler statistics
   */
  getStats(): any {
    return {
      totalJobs: this.jobs.size,
      jobs: Array.from(this.jobs.keys()),
    };
  }
}
