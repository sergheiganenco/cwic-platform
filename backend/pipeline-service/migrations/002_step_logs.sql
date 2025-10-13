-- Step logs: append-only, monotonic seq per run
CREATE TABLE IF NOT EXISTS pipeline_step_logs (
  id            BIGSERIAL PRIMARY KEY,
  run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step_id       TEXT NOT NULL,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  level         TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
  message       TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS psl_run_step_idx ON pipeline_step_logs(run_id, step_id, id);

-- Small metadata additions (if not already added)
ALTER TABLE pipeline_steps
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS timeout_ms INT NOT NULL DEFAULT 60000;

ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS canceled BOOLEAN NOT NULL DEFAULT FALSE;