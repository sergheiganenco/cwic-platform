import { Worker } from '../redis.js';
import { connection } from '../redis.js';
import { PipelineRepository } from '../repositories/PipelineRepository.js';
import { executeWithDataSource } from '../executors/unified.js';

const repo = new PipelineRepository();

async function executeStep(run: any, step: any) {
  const timeoutMs = step.timeout_ms ?? 60_000;

  try {
    await repo.addLog(run.id, step.step_id, 'info', `Starting step`, { attempt: step.attempt });

    // Execute the step based on params
    const params = step.params || {};
    let result: any = {};

    if (params.dataSourceId || params.engine) {
      result = await executeWithDataSource({
        dataSourceId: params.dataSourceId,
        engine: params.engine,
        connection: params.connection,
        sql: params.sql,
        timeoutMs
      });
    }

    await repo.addLog(run.id, step.step_id, 'info', 'Step succeeded', {
      metrics: {
        durationMs: result.durationMs,
        rowCount: result.rowCount
      }
    });

    return { ok: true, meta: { result } };
  } catch (e: any) {
    await repo.addLog(run.id, step.step_id, 'error', 'Step failed', {
      error: e?.message || String(e)
    });
    return { ok: false, error: e?.message || 'failed' };
  }
}

export const worker = new Worker('cwic:pipeline:runs', async job => {
  const { runId } = job.data as { runId: string };

  try {
    const run = await repo.getRun(runId);
    if (!run) {
      console.error(`Run ${runId} not found`);
      return;
    }

    await repo.updateRun(runId, {
      status: 'running',
      started_at: new Date()
    });

    const steps = await repo.getSteps(runId);

    for (const step of steps) {
      // Check if run was canceled
      const currentRun = await repo.getRun(runId);
      if (currentRun?.canceled) {
        await repo.updateStep(runId, step.step_id, {
          status: 'canceled'
        });
        continue;
      }

      // Skip completed steps
      if (step.status && ['succeeded', 'failed', 'canceled', 'skipped'].includes(step.status)) {
        continue;
      }

      // Execute step with retries
      let attempt = 0;
      let success = false;
      let lastError: string | undefined;

      while (attempt < step.max_attempts && !success) {
        attempt++;

        await repo.updateStep(runId, step.step_id, {
          status: 'running',
          started_at: new Date(),
          attempt
        });

        const result = await executeStep(run, { ...step, attempt });

        if (result.ok) {
          success = true;
          await repo.updateStep(runId, step.step_id, {
            status: 'succeeded',
            finished_at: new Date(),
            meta: result.meta
          });
        } else {
          lastError = result.error;
          if (attempt < step.max_attempts) {
            // Wait before retry (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!success) {
        await repo.updateStep(runId, step.step_id, {
          status: 'failed',
          finished_at: new Date(),
          error_message: lastError
        });
        throw new Error(`Step ${step.step_id} failed: ${lastError}`);
      }
    }

    await repo.updateRun(runId, {
      status: 'succeeded',
      finished_at: new Date()
    });

  } catch (error: any) {
    console.error(`Run ${runId} failed:`, error);
    await repo.updateRun(runId, {
      status: 'failed',
      finished_at: new Date(),
      error_message: error?.message || 'Run failed'
    });
    throw error;
  }
}, {
  connection,
  concurrency: Number(process.env.PIPELINE_WORKER_CONCURRENCY || 2),
  lockDuration: 60_000,
});

// Start the worker
worker.run().catch(console.error);

console.log('Pipeline worker started');