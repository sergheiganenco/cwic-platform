import { q, qOne } from '../db.js';
import { v4 as uuid } from 'uuid';

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  config: any;
  schedule?: string;
  enabled: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  started_at?: Date;
  finished_at?: Date;
  error_message?: string;
  meta?: any;
  triggered_by?: string;
  canceled: boolean;
}

export interface PipelineStep {
  id: string;
  run_id: string;
  step_id: string;
  ordinal: number;
  type: string;
  status?: string;
  params: any;
  meta?: any;
  started_at?: Date;
  finished_at?: Date;
  error_message?: string;
  heartbeat_at?: Date;
  attempt: number;
  max_attempts: number;
  timeout_ms: number;
}

export class PipelineRepository {
  // Pipeline CRUD
  async createPipeline(data: Partial<Pipeline>): Promise<Pipeline> {
    const id = data.id || uuid();
    const result = await qOne(
      `INSERT INTO pipelines (id, name, description, config, schedule, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, data.name, data.description, data.config || {}, data.schedule, data.enabled ?? true, data.created_by]
    );
    return result;
  }

  async getPipeline(id: string): Promise<Pipeline | null> {
    return qOne('SELECT * FROM pipelines WHERE id = $1', [id]);
  }

  async listPipelines(filters?: { enabled?: boolean }): Promise<Pipeline[]> {
    let query = 'SELECT * FROM pipelines WHERE 1=1';
    const params: any[] = [];
    if (filters?.enabled !== undefined) {
      params.push(filters.enabled);
      query += ` AND enabled = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    return q(query, params);
  }

  async updatePipeline(id: string, data: Partial<Pipeline>): Promise<Pipeline> {
    const fields = [];
    const params = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      params.push(data.description);
    }
    if (data.config !== undefined) {
      fields.push(`config = $${idx++}`);
      params.push(data.config);
    }
    if (data.schedule !== undefined) {
      fields.push(`schedule = $${idx++}`);
      params.push(data.schedule);
    }
    if (data.enabled !== undefined) {
      fields.push(`enabled = $${idx++}`);
      params.push(data.enabled);
    }

    fields.push(`updated_at = now()`);
    params.push(id);

    const result = await qOne(
      `UPDATE pipelines SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result;
  }

  async deletePipeline(id: string): Promise<boolean> {
    const result = await q('DELETE FROM pipelines WHERE id = $1', [id]);
    return result.length > 0;
  }

  // Pipeline Runs
  async createRun(pipelineId: string, triggeredBy?: string): Promise<PipelineRun> {
    const id = uuid();
    const result = await qOne(
      `INSERT INTO pipeline_runs (id, pipeline_id, status, triggered_by)
       VALUES ($1, $2, 'queued', $3)
       RETURNING *`,
      [id, pipelineId, triggeredBy]
    );

    // Create steps based on pipeline config
    const pipeline = await this.getPipeline(pipelineId);
    if (pipeline?.config?.steps) {
      for (let i = 0; i < pipeline.config.steps.length; i++) {
        const step = pipeline.config.steps[i];
        await this.createStep(id, {
          step_id: step.id || `step_${i}`,
          ordinal: i,
          type: step.type || 'execute',
          params: step.params || {},
          max_attempts: step.maxAttempts || 3,
          timeout_ms: step.timeoutMs || 60000,
        });
      }
    }

    return result;
  }

  async getRun(id: string): Promise<PipelineRun | null> {
    return qOne('SELECT * FROM pipeline_runs WHERE id = $1', [id]);
  }

  async listRuns(filters?: { pipeline_id?: string; status?: string }): Promise<PipelineRun[]> {
    let query = 'SELECT * FROM pipeline_runs WHERE 1=1';
    const params: any[] = [];

    if (filters?.pipeline_id) {
      params.push(filters.pipeline_id);
      query += ` AND pipeline_id = $${params.length}`;
    }
    if (filters?.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    return q(query, params);
  }

  async updateRun(id: string, data: Partial<PipelineRun>): Promise<PipelineRun> {
    const fields = [];
    const params = [];
    let idx = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      params.push(data.status);
    }
    if (data.started_at !== undefined) {
      fields.push(`started_at = $${idx++}`);
      params.push(data.started_at);
    }
    if (data.finished_at !== undefined) {
      fields.push(`finished_at = $${idx++}`);
      params.push(data.finished_at);
    }
    if (data.error_message !== undefined) {
      fields.push(`error_message = $${idx++}`);
      params.push(data.error_message);
    }
    if (data.canceled !== undefined) {
      fields.push(`canceled = $${idx++}`);
      params.push(data.canceled);
    }

    params.push(id);
    const result = await qOne(
      `UPDATE pipeline_runs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result;
  }

  async cancelRun(id: string): Promise<void> {
    await q(`UPDATE pipeline_runs SET canceled = true WHERE id = $1`, [id]);
    await q(`UPDATE pipeline_steps SET status = CASE
      WHEN status IN ('queued','running') THEN 'canceled'
      ELSE status END
      WHERE run_id = $1`, [id]);
  }

  // Pipeline Steps
  async createStep(runId: string, data: any): Promise<PipelineStep> {
    const id = uuid();
    const result = await qOne(
      `INSERT INTO pipeline_steps (id, run_id, step_id, ordinal, type, params, max_attempts, timeout_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, runId, data.step_id, data.ordinal, data.type, data.params, data.max_attempts, data.timeout_ms]
    );
    return result;
  }

  async getSteps(runId: string): Promise<PipelineStep[]> {
    return q('SELECT * FROM pipeline_steps WHERE run_id = $1 ORDER BY ordinal', [runId]);
  }

  async updateStep(runId: string, stepId: string, data: Partial<PipelineStep>): Promise<void> {
    const fields = [];
    const params = [];
    let idx = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      params.push(data.status);
    }
    if (data.started_at !== undefined) {
      fields.push(`started_at = $${idx++}`);
      params.push(data.started_at);
    }
    if (data.finished_at !== undefined) {
      fields.push(`finished_at = $${idx++}`);
      params.push(data.finished_at);
    }
    if (data.error_message !== undefined) {
      fields.push(`error_message = $${idx++}`);
      params.push(data.error_message);
    }
    if (data.heartbeat_at !== undefined) {
      fields.push(`heartbeat_at = $${idx++}`);
      params.push(data.heartbeat_at);
    }
    if (data.attempt !== undefined) {
      fields.push(`attempt = $${idx++}`);
      params.push(data.attempt);
    }

    params.push(runId, stepId);
    await q(
      `UPDATE pipeline_steps SET ${fields.join(', ')} WHERE run_id = $${idx} AND step_id = $${idx + 1}`,
      params
    );
  }

  async stepHeartbeat(runId: string, stepId: string): Promise<void> {
    await q(`UPDATE pipeline_steps SET heartbeat_at = now() WHERE run_id = $1 AND step_id = $2`, [runId, stepId]);
  }

  // Logs
  async addLog(runId: string, stepId: string, level: string, message: string, data?: any): Promise<void> {
    await q(
      `INSERT INTO pipeline_step_logs (run_id, step_id, level, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [runId, stepId, level, message, data || {}]
    );
  }

  async getLogs(runId: string, after?: number): Promise<any[]> {
    return q(
      `SELECT id, step_id, ts, level, message, data
       FROM pipeline_step_logs
       WHERE run_id = $1 AND id > $2
       ORDER BY id ASC LIMIT 500`,
      [runId, after || 0]
    );
  }
}