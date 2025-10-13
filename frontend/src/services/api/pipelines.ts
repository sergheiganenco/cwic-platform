import { api as http } from './client';

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  config: {
    steps: PipelineStep[];
  };
  schedule?: string;
  enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineStep {
  id: string;
  name: string;
  type: 'extract' | 'transform' | 'load' | 'execute';
  params: {
    engine?: 'postgresql' | 'mssql';
    dataSourceId?: string;
    connection?: any;
    sql?: string;
    timeoutMs?: number;
    maxAttempts?: number;
  };
}

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  meta?: any;
  triggered_by?: string;
  canceled: boolean;
  steps?: PipelineStepExecution[];
}

export interface PipelineStepExecution {
  id: string;
  run_id: string;
  step_id: string;
  ordinal: number;
  type: string;
  status?: string;
  params: any;
  meta?: any;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  attempt: number;
  max_attempts: number;
  timeout_ms: number;
}

export interface StepLog {
  id: number;
  step_id: string;
  ts: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export const pipelinesApi = {
  // Pipelines
  list(params?: any) {
    return http.get('/pipelines', { params }).then(r => r.data);
  },
  get(id: string) {
    return http.get(`/pipelines/${id}`).then(r => r.data);
  },
  create(data: Partial<Pipeline>) {
    return http.post('/pipelines', data).then(r => r.data);
  },
  update(id: string, data: Partial<Pipeline>) {
    return http.put(`/pipelines/${id}`, data).then(r => r.data);
  },
  delete(id: string) {
    return http.delete(`/pipelines/${id}`);
  },
  trigger(id: string, data?: { triggeredBy?: string }) {
    return http.post(`/pipelines/${id}/run`, data || {}).then(r => r.data);
  },
};

export const runsApi = {
  list(params?: any) {
    return http.get('/pipeline-runs', { params }).then(r => r.data);
  },
  get(id: string, includeSteps?: boolean) {
    return http.get(`/pipeline-runs/${id}`, {
      params: { includeSteps }
    }).then(r => r.data);
  },
  cancel(id: string) {
    return http.post(`/pipeline-runs/${id}/cancel`).then(r => r.data);
  },
  retry(id: string) {
    return http.post(`/pipeline-runs/${id}/retry`).then(r => r.data);
  },
  logs(id: string, after?: number) {
    return http.get(`/pipeline-runs/${id}/logs`, {
      params: { after }
    }).then(r => r.data as { data: StepLog[]; next: number });
  },
};