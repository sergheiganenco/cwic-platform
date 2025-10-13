-- Pipeline Service Database Schema
-- Initial setup for pipeline management

-- Pipeline definitions
CREATE TABLE IF NOT EXISTS pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  schedule        TEXT, -- cron expression if scheduled
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_name ON pipelines(name);
CREATE INDEX IF NOT EXISTS idx_pipelines_enabled ON pipelines(enabled);

-- Pipeline runs (executions)
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','canceled')),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  error_message   TEXT,
  meta            JSONB NOT NULL DEFAULT '{}',
  triggered_by    TEXT,
  canceled        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created ON pipeline_runs(created_at DESC);

-- Pipeline steps (individual operations within a run)
CREATE TABLE IF NOT EXISTS pipeline_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step_id         TEXT NOT NULL, -- unique within the run
  ordinal         INT NOT NULL,
  type            TEXT NOT NULL, -- extract, transform, load, etc.
  status          TEXT CHECK (status IN ('queued','running','succeeded','failed','canceled','skipped')),
  params          JSONB NOT NULL DEFAULT '{}',
  meta            JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  error_message   TEXT,
  heartbeat_at    TIMESTAMPTZ,
  attempt         INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 1,
  timeout_ms      INT NOT NULL DEFAULT 60000,
  UNIQUE(run_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_steps_run ON pipeline_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON pipeline_steps(status);
CREATE INDEX IF NOT EXISTS idx_steps_run_ordinal ON pipeline_steps(run_id, ordinal);