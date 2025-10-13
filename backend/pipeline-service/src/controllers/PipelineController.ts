import { Request, Response } from 'express';
import { PipelineRepository } from '../repositories/PipelineRepository.js';
import { Queue } from 'bullmq';

const repo = new PipelineRepository();

// Initialize BullMQ queue (will be used later for job processing)
const queue = new Queue('pipeline-runs', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export class PipelineController {
  // Pipeline CRUD
  async createPipeline(req: Request, res: Response) {
    try {
      const pipeline = await repo.createPipeline(req.body);
      res.status(201).json({ data: pipeline });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getPipeline(req: Request, res: Response) {
    try {
      const pipeline = await repo.getPipeline(req.params.id);
      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }
      res.json({ data: pipeline });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async listPipelines(req: Request, res: Response) {
    try {
      const pipelines = await repo.listPipelines(req.query as any);
      res.json({ data: pipelines });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updatePipeline(req: Request, res: Response) {
    try {
      const pipeline = await repo.updatePipeline(req.params.id, req.body);
      res.json({ data: pipeline });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deletePipeline(req: Request, res: Response) {
    try {
      await repo.deletePipeline(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Pipeline Runs
  async triggerRun(req: Request, res: Response) {
    try {
      const run = await repo.createRun(
        req.params.id,
        req.body.triggeredBy || 'manual'
      );

      // Queue the run for processing
      await queue.add('execute', { runId: run.id });

      res.status(202).json({ data: run });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getRun(req: Request, res: Response) {
    try {
      const run = await repo.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      // Include steps if requested
      if (req.query.includeSteps === 'true') {
        const steps = await repo.getSteps(run.id);
        res.json({ data: { ...run, steps } });
      } else {
        res.json({ data: run });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async listRuns(req: Request, res: Response) {
    try {
      const runs = await repo.listRuns(req.query as any);
      res.json({ data: runs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async cancelRun(req: Request, res: Response) {
    try {
      await repo.cancelRun(req.params.id);
      res.status(202).json({ message: 'Run canceled' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async retryRun(req: Request, res: Response) {
    try {
      const originalRun = await repo.getRun(req.params.id);
      if (!originalRun) {
        return res.status(404).json({ error: 'Run not found' });
      }

      // Create a new run with same pipeline
      const newRun = await repo.createRun(
        originalRun.pipeline_id,
        req.body.triggeredBy || 'retry'
      );

      // Queue for processing
      await queue.add('execute', { runId: newRun.id });

      res.status(202).json({ data: newRun });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getRunLogs(req: Request, res: Response) {
    try {
      const after = req.query.after ? parseInt(req.query.after as string) : undefined;
      const logs = await repo.getLogs(req.params.id, after);
      const next = logs.length > 0 ? logs[logs.length - 1].id : after || 0;
      res.json({ data: logs, next });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}