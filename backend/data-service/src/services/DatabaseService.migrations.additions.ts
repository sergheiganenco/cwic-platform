// backend/data-service/src/services/DatabaseService.migrations.additions.ts

export const extraMigrations = [
  {
    id: 100,
    name: '100_quality_rules_enhanced',
    sql: `
      BEGIN;

      -- Ensure UUID/crypto helpers exist (idempotent, safe to re-run)
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- 1) Create tables if missing (modern schema)
      CREATE TABLE IF NOT EXISTS quality_rules (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name                varchar(255) NOT NULL,
        description         text,
        severity            varchar(20) NOT NULL DEFAULT 'medium',
        type                varchar(30) NOT NULL DEFAULT 'sql',
        dialect             varchar(30) NOT NULL DEFAULT 'postgres',
        expression          text NOT NULL,
        expression_hash     varchar(64),
        tags                text[] NOT NULL DEFAULT '{}'::text[],
        enabled             boolean NOT NULL DEFAULT true,
        max_execution_time_ms integer NOT NULL DEFAULT 30000,
        created_by          varchar(100),
        updated_by          varchar(100),
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        last_executed_at    timestamptz,
        execution_count     integer NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS quality_results (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id           uuid NOT NULL REFERENCES quality_rules(id) ON DELETE CASCADE,
        data_source_id    uuid REFERENCES data_sources(id) ON DELETE SET NULL,
        asset_id          uuid,
        status            varchar(15) NOT NULL,
        run_at            timestamptz NOT NULL DEFAULT now(),
        execution_time_ms integer NOT NULL DEFAULT 0,
        metrics           jsonb NOT NULL DEFAULT '{}'::jsonb,
        error             text,
        query_hash        varchar(64),
        executed_by       varchar(100)
      );

      -- 2) Backfill columns if table existed from older schema (fixes "enabled does not exist")
      ALTER TABLE quality_rules
        ADD COLUMN IF NOT EXISTS expression_hash      varchar(64),
        ADD COLUMN IF NOT EXISTS tags                 text[] NOT NULL DEFAULT '{}'::text[],
        ADD COLUMN IF NOT EXISTS enabled              boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS max_execution_time_ms integer NOT NULL DEFAULT 30000,
        ADD COLUMN IF NOT EXISTS last_executed_at     timestamptz,
        ADD COLUMN IF NOT EXISTS execution_count      integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS severity             varchar(20) NOT NULL DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS type                 varchar(30) NOT NULL DEFAULT 'sql',
        ADD COLUMN IF NOT EXISTS dialect              varchar(30) NOT NULL DEFAULT 'postgres';

      ALTER TABLE quality_rules
        ALTER COLUMN tags SET DEFAULT '{}'::text[],
        ALTER COLUMN enabled SET DEFAULT true;

      ALTER TABLE quality_results
        ADD COLUMN IF NOT EXISTS execution_time_ms integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS metrics           jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS query_hash        varchar(64),
        ADD COLUMN IF NOT EXISTS executed_by       varchar(100);

      -- 3) Constraints (use catalog guards so they’re re-runnable)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_quality_rules_severity') THEN
          ALTER TABLE quality_rules
            ADD CONSTRAINT chk_quality_rules_severity
            CHECK (severity IN ('low','medium','high','critical'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_quality_rules_type') THEN
          ALTER TABLE quality_rules
            ADD CONSTRAINT chk_quality_rules_type
            CHECK (type IN ('sql','metric'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_quality_rules_dialect') THEN
          ALTER TABLE quality_rules
            ADD CONSTRAINT chk_quality_rules_dialect
            CHECK (dialect IN ('postgres','generic'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_quality_rules_name_length') THEN
          ALTER TABLE quality_rules
            ADD CONSTRAINT chk_quality_rules_name_length
            CHECK (char_length(name) >= 2);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_quality_rules_expression_length') THEN
          ALTER TABLE quality_rules
            ADD CONSTRAINT chk_quality_rules_expression_length
            CHECK (char_length(expression) BETWEEN 3 AND 10000);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_quality_rules_max_exec_time') THEN
          ALTER TABLE quality_rules
            ADD CONSTRAINT chk_quality_rules_max_exec_time
            CHECK (max_execution_time_ms BETWEEN 1000 AND 300000);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_quality_results_status') THEN
          ALTER TABLE quality_results
            ADD CONSTRAINT chk_quality_results_status
            CHECK (status IN ('passed','failed','error','skipped','timeout'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_quality_results_exec_time') THEN
          ALTER TABLE quality_results
            ADD CONSTRAINT chk_quality_results_exec_time
            CHECK (execution_time_ms >= 0);
        END IF;
      END $$;

      -- 4) Indexes (safe to re-run)
      CREATE INDEX IF NOT EXISTS idx_quality_rules_name            ON quality_rules(name);
      CREATE INDEX IF NOT EXISTS idx_quality_rules_type_enabled    ON quality_rules(type, enabled);
      CREATE INDEX IF NOT EXISTS idx_quality_rules_updated_at      ON quality_rules(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_quality_rules_expression_hash ON quality_rules(expression_hash);

      CREATE INDEX IF NOT EXISTS idx_quality_results_rule_id       ON quality_results(rule_id);
      CREATE INDEX IF NOT EXISTS idx_quality_results_data_source   ON quality_results(data_source_id);
      CREATE INDEX IF NOT EXISTS idx_quality_results_status        ON quality_results(status);
      CREATE INDEX IF NOT EXISTS idx_quality_results_run_at        ON quality_results(run_at DESC);
      CREATE INDEX IF NOT EXISTS idx_quality_results_rule_run_at   ON quality_results(rule_id, run_at DESC);

      -- 5) Hash trigger (correct digest usage)
      CREATE OR REPLACE FUNCTION update_quality_rule_hash()
      RETURNS TRIGGER AS $$
      BEGIN
        -- pgcrypto: encode(digest(bytea,'sha256'),'hex')
        NEW.expression_hash := encode(digest(NEW.expression::bytea, 'sha256'), 'hex');
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_quality_rule_hash ON quality_rules;
      CREATE TRIGGER trigger_quality_rule_hash
        BEFORE INSERT OR UPDATE ON quality_rules
        FOR EACH ROW
        EXECUTE FUNCTION update_quality_rule_hash();

      -- 6) Updated-at trigger (generic)
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_quality_rules_updated_at ON quality_rules;
      CREATE TRIGGER trg_quality_rules_updated_at
        BEFORE UPDATE ON quality_rules
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();

      -- 7) Execution stats trigger
      CREATE OR REPLACE FUNCTION update_quality_rule_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE quality_rules
           SET last_executed_at = NEW.run_at,
               execution_count  = COALESCE(execution_count,0) + 1,
               updated_at       = now()
         WHERE id = NEW.rule_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_quality_rule_stats ON quality_results;
      CREATE TRIGGER trigger_quality_rule_stats
        AFTER INSERT ON quality_results
        FOR EACH ROW
        EXECUTE FUNCTION update_quality_rule_stats();

      COMMIT;
    `,
  },
  {
  id: 101,
  name: '101_governance_policies_enhanced',
  sql: `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    BEGIN;

    /* 1) Create table if missing (modern shape) */
    CREATE TABLE IF NOT EXISTS governance_policies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL,
      description text,
      category varchar(50) NOT NULL DEFAULT 'access',
      status varchar(20) NOT NULL DEFAULT 'active',
      priority integer NOT NULL DEFAULT 100,
      rules jsonb NOT NULL DEFAULT '[]'::jsonb,
      conditions jsonb DEFAULT '{}'::jsonb,
      actions jsonb DEFAULT '{}'::jsonb,
      effective_from timestamptz DEFAULT now(),
      effective_until timestamptz,
      created_by varchar(100),
      updated_by varchar(100),
      approved_by varchar(100),
      approved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      version integer NOT NULL DEFAULT 1
    );

    /* 2) Backfill columns for legacy tables */
    ALTER TABLE governance_policies
      ADD COLUMN IF NOT EXISTS description      text,
      ADD COLUMN IF NOT EXISTS category         varchar(50) NOT NULL DEFAULT 'access',
      ADD COLUMN IF NOT EXISTS status           varchar(20) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS priority         integer NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS rules            jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS conditions       jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS actions          jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS effective_from   timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS effective_until  timestamptz,
      ADD COLUMN IF NOT EXISTS created_by       varchar(100),
      ADD COLUMN IF NOT EXISTS updated_by       varchar(100),
      ADD COLUMN IF NOT EXISTS approved_by      varchar(100),
      ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
      ADD COLUMN IF NOT EXISTS created_at       timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS version          integer NOT NULL DEFAULT 1;

    /* 3) Constraints (guarded so this block is re-runnable) */
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_governance_policies_category') THEN
        ALTER TABLE governance_policies
          ADD CONSTRAINT chk_governance_policies_category
          CHECK (category IN ('access','privacy','retention','classification','compliance'));
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_governance_policies_status') THEN
        ALTER TABLE governance_policies
          ADD CONSTRAINT chk_governance_policies_status
          CHECK (status IN ('draft','active','inactive','archived'));
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_governance_policies_priority') THEN
        ALTER TABLE governance_policies
          ADD CONSTRAINT chk_governance_policies_priority
          CHECK (priority BETWEEN 1 AND 1000);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_governance_policies_name_length') THEN
        ALTER TABLE governance_policies
          ADD CONSTRAINT chk_governance_policies_name_length
          CHECK (char_length(name) >= 2);
      END IF;
    END $$;

    /* 4) Applications table */
    CREATE TABLE IF NOT EXISTS governance_policy_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id uuid NOT NULL REFERENCES governance_policies(id) ON DELETE CASCADE,
      resource_type varchar(50) NOT NULL,
      resource_id varchar(255) NOT NULL,
      action varchar(100) NOT NULL,
      result varchar(20) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      applied_by varchar(100),
      context jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_governance_applications_result') THEN
        ALTER TABLE governance_policy_applications
          ADD CONSTRAINT chk_governance_applications_result
          CHECK (result IN ('allowed','denied','audited','warning'));
      END IF;
    END $$;

    /* 5) Indexes (after columns exist) */
    CREATE INDEX IF NOT EXISTS idx_governance_policies_status     ON governance_policies(status);
    CREATE INDEX IF NOT EXISTS idx_governance_policies_category   ON governance_policies(category);
    CREATE INDEX IF NOT EXISTS idx_governance_policies_effective  ON governance_policies(effective_from, effective_until);
    CREATE INDEX IF NOT EXISTS idx_governance_policies_priority   ON governance_policies(priority DESC);

    CREATE INDEX IF NOT EXISTS idx_governance_applications_policy   ON governance_policy_applications(policy_id);
    CREATE INDEX IF NOT EXISTS idx_governance_applications_resource ON governance_policy_applications(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_governance_applications_applied  ON governance_policy_applications(applied_at DESC);

    /* 6) Version/updated_at trigger */
    CREATE OR REPLACE FUNCTION update_governance_policy_version()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'UPDATE' AND OLD.rules::text IS DISTINCT FROM NEW.rules::text THEN
        NEW.version := COALESCE(OLD.version, 0) + 1;
      END IF;
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_governance_policy_version ON governance_policies;
    CREATE TRIGGER trigger_governance_policy_version
      BEFORE UPDATE ON governance_policies
      FOR EACH ROW
      EXECUTE FUNCTION update_governance_policy_version();

    COMMIT;
  `,
}
,
  {
  id: 102,
  name: '102_workflow_requests_enhanced',
  sql: `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    BEGIN;

    /* 1) Create table if missing (modern shape) */
    CREATE TABLE IF NOT EXISTS workflow_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title varchar(255) NOT NULL,
      description text,
      type varchar(40) NOT NULL DEFAULT 'access',
      priority varchar(20) NOT NULL DEFAULT 'medium',
      status varchar(20) NOT NULL DEFAULT 'open',
      requester varchar(120),
      assignee varchar(120),
      approver varchar(120),
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      attachments text[] NOT NULL DEFAULT '{}'::text[],
      due_date timestamptz,
      resolved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by varchar(100)
    );

    /* 2) Backfill columns for legacy installs */
    ALTER TABLE workflow_requests
      ADD COLUMN IF NOT EXISTS description   text,
      ADD COLUMN IF NOT EXISTS type          varchar(40)  NOT NULL DEFAULT 'access',
      ADD COLUMN IF NOT EXISTS priority      varchar(20)  NOT NULL DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS status        varchar(20)  NOT NULL DEFAULT 'open',
      ADD COLUMN IF NOT EXISTS requester     varchar(120),
      ADD COLUMN IF NOT EXISTS assignee      varchar(120),
      ADD COLUMN IF NOT EXISTS approver      varchar(120),
      ADD COLUMN IF NOT EXISTS payload       jsonb        NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS attachments   text[]       NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS due_date      timestamptz,
      ADD COLUMN IF NOT EXISTS resolved_at   timestamptz,
      ADD COLUMN IF NOT EXISTS created_at    timestamptz  NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at    timestamptz  NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_by    varchar(100);

    /* 3) Ensure minimal defaults on existing rows */
    UPDATE workflow_requests
      SET type = COALESCE(type, 'access'),
          priority = COALESCE(priority, 'medium'),
          status = COALESCE(status, 'open'),
          payload = COALESCE(payload, '{}'::jsonb),
          attachments = COALESCE(attachments, '{}'::text[]),
          created_at = COALESCE(created_at, now()),
          updated_at = COALESCE(updated_at, now());

    /* 4) Constraints (guarded so re-runs are safe) */
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_workflow_requests_type') THEN
        ALTER TABLE workflow_requests
          ADD CONSTRAINT chk_workflow_requests_type
          CHECK (type IN ('access','change','incident','data_request','policy_exception'));
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_workflow_requests_priority') THEN
        ALTER TABLE workflow_requests
          ADD CONSTRAINT chk_workflow_requests_priority
          CHECK (priority IN ('low','medium','high','urgent'));
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_workflow_requests_status') THEN
        ALTER TABLE workflow_requests
          ADD CONSTRAINT chk_workflow_requests_status
          CHECK (status IN ('open','in_progress','pending_approval','approved','rejected','closed','cancelled'));
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_workflow_requests_title_length') THEN
        ALTER TABLE workflow_requests
          ADD CONSTRAINT chk_workflow_requests_title_length
          CHECK (char_length(title) >= 3);
      END IF;
    END $$;

    /* 5) Comments/history table */
    CREATE TABLE IF NOT EXISTS workflow_request_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES workflow_requests(id) ON DELETE CASCADE,
      comment_type varchar(20) NOT NULL DEFAULT 'comment',
      content text NOT NULL,
      author varchar(120) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      is_internal boolean NOT NULL DEFAULT false
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_workflow_comments_type') THEN
        ALTER TABLE workflow_request_comments
          ADD CONSTRAINT chk_workflow_comments_type
          CHECK (comment_type IN ('comment','status_change','assignment','approval','rejection'));
      END IF;
    END $$;

    /* 6) Approvals table */
    CREATE TABLE IF NOT EXISTS workflow_request_approvals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES workflow_requests(id) ON DELETE CASCADE,
      approver varchar(120) NOT NULL,
      decision varchar(20) NOT NULL,
      comments text,
      decided_at timestamptz NOT NULL DEFAULT now()
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_workflow_approvals_decision') THEN
        ALTER TABLE workflow_request_approvals
          ADD CONSTRAINT chk_workflow_approvals_decision
          CHECK (decision IN ('approved','rejected','needs_info'));
      END IF;
    END $$;

    /* 7) Indexes */
    CREATE INDEX IF NOT EXISTS idx_workflow_requests_status     ON workflow_requests(status);
    CREATE INDEX IF NOT EXISTS idx_workflow_requests_type       ON workflow_requests(type);
    CREATE INDEX IF NOT EXISTS idx_workflow_requests_assignee   ON workflow_requests(assignee);
    CREATE INDEX IF NOT EXISTS idx_workflow_requests_requester  ON workflow_requests(requester);
    CREATE INDEX IF NOT EXISTS idx_workflow_requests_updated_at ON workflow_requests(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workflow_requests_due_date   ON workflow_requests(due_date) WHERE due_date IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_workflow_comments_request    ON workflow_request_comments(request_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workflow_approvals_request   ON workflow_request_approvals(request_id);

    /* 8) Auto-resolve trigger (maintains resolved_at and updated_at) */
    CREATE OR REPLACE FUNCTION auto_resolve_workflow_request()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF NEW.status IN ('approved','rejected','closed','cancelled') AND OLD.resolved_at IS NULL THEN
          NEW.resolved_at := now();
        END IF;
        NEW.updated_at := now();
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_auto_resolve_workflow ON workflow_requests;
    CREATE TRIGGER trigger_auto_resolve_workflow
      BEFORE UPDATE ON workflow_requests
      FOR EACH ROW
      EXECUTE FUNCTION auto_resolve_workflow_request();

    COMMIT;
  `,
}
,
  {
    id: 103,
    name: '103_security_and_audit_tables',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      BEGIN;

      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type varchar(50) NOT NULL,
        entity_id varchar(255) NOT NULL,
        action varchar(50) NOT NULL,
        actor varchar(120),
        actor_ip inet,
        user_agent text,
        changes jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_audit_logs_action') THEN
          ALTER TABLE audit_logs
            ADD CONSTRAINT chk_audit_logs_action
            CHECK (action IN ('CREATE','UPDATE','DELETE','EXECUTE','ACCESS','LOGIN','LOGOUT'));
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        key varchar(255) PRIMARY KEY,
        tokens integer NOT NULL DEFAULT 0,
        last_refill timestamptz NOT NULL DEFAULT now()
      );
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_rate_limit_tokens') THEN
          ALTER TABLE rate_limit_buckets
            ADD CONSTRAINT chk_rate_limit_tokens CHECK (tokens >= 0);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS system_config (
        key varchar(100) PRIMARY KEY,
        value jsonb NOT NULL,
        description text,
        is_sensitive boolean NOT NULL DEFAULT false,
        updated_by varchar(100),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor       ON audit_logs(actor);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_last_refill ON rate_limit_buckets(last_refill);

      -- Seed default config (won't overwrite)
      INSERT INTO system_config (key, value, description)
      VALUES
        ('max_query_execution_time', '300000', 'Maximum query execution time in milliseconds'),
        ('enable_audit_logging', 'true', 'Whether to enable comprehensive audit logging'),
        ('data_retention_days', '365', 'Default data retention period in days'),
        ('max_file_upload_size', '10485760', 'Maximum file upload size in bytes (10MB)')
      ON CONFLICT (key) DO NOTHING;

      -- Maintenance function
      CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
      RETURNS integer AS $$
      DECLARE
        deleted_count integer;
      BEGIN
        DELETE FROM audit_logs
         WHERE created_at < now() - interval '1 year'
           AND action NOT IN ('DELETE','LOGIN');
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $$ LANGUAGE plpgsql;

      COMMIT;
    `,
  },
  {
    id: 104,
    name: '104_data_lineage_and_relationships',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      BEGIN;

      CREATE TABLE IF NOT EXISTS assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        type varchar(50) NOT NULL,
        data_source_id uuid REFERENCES data_sources(id) ON DELETE CASCADE,
        schema_name varchar(100),
        table_name varchar(100),
        column_name varchar(100),
        description text,
        data_type varchar(100),
        is_nullable boolean,
        is_primary_key boolean NOT NULL DEFAULT false,
        classification varchar(50) NOT NULL DEFAULT 'public',
        tags text[] NOT NULL DEFAULT '{}'::text[],
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_scanned_at timestamptz
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_assets_type') THEN
          ALTER TABLE assets
            ADD CONSTRAINT chk_assets_type
            CHECK (type IN ('database','schema','table','column','view','procedure','function'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_assets_classification') THEN
          ALTER TABLE assets
            ADD CONSTRAINT chk_assets_classification
            CHECK (classification IN ('public','internal','confidential','restricted'));
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS data_lineage (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source_asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        target_asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        relationship_type varchar(50) NOT NULL,
        transformation_logic text,
        confidence_score numeric(3,2) DEFAULT 1.0,
        discovered_by varchar(50) DEFAULT 'manual',
        discovered_at timestamptz DEFAULT now(),
        validated_by varchar(100),
        validated_at timestamptz
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_lineage_relationship_type') THEN
          ALTER TABLE data_lineage
            ADD CONSTRAINT chk_lineage_relationship_type
            CHECK (relationship_type IN ('derives_from','feeds_into','depends_on','similar_to'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_lineage_confidence') THEN
          ALTER TABLE data_lineage
            ADD CONSTRAINT chk_lineage_confidence
            CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_lineage_no_self_reference') THEN
          ALTER TABLE data_lineage
            ADD CONSTRAINT chk_lineage_no_self_reference
            CHECK (source_asset_id <> target_asset_id);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS asset_usage_stats (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        date date NOT NULL,
        query_count integer NOT NULL DEFAULT 0,
        user_count integer NOT NULL DEFAULT 0,
        bytes_read bigint NOT NULL DEFAULT 0,
        bytes_written bigint NOT NULL DEFAULT 0,
        UNIQUE(asset_id, date)
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_usage_stats_non_negative') THEN
          ALTER TABLE asset_usage_stats
            ADD CONSTRAINT chk_usage_stats_non_negative
            CHECK (query_count >= 0 AND user_count >= 0 AND bytes_read >= 0 AND bytes_written >= 0);
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_assets_data_source_id    ON assets(data_source_id);
      CREATE INDEX IF NOT EXISTS idx_assets_type              ON assets(type);
      CREATE INDEX IF NOT EXISTS idx_assets_classification    ON assets(classification);
      CREATE INDEX IF NOT EXISTS idx_assets_updated_at        ON assets(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_assets_name_search       ON assets USING gin(to_tsvector('english', name || ' ' || COALESCE(description,'')));
      CREATE INDEX IF NOT EXISTS idx_lineage_source           ON data_lineage(source_asset_id);
      CREATE INDEX IF NOT EXISTS idx_lineage_target           ON data_lineage(target_asset_id);
      CREATE INDEX IF NOT EXISTS idx_lineage_type             ON data_lineage(relationship_type);
      CREATE INDEX IF NOT EXISTS idx_usage_stats_asset_date   ON asset_usage_stats(asset_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_usage_stats_date         ON asset_usage_stats(date DESC);

      -- Helper to traverse lineage around an asset
      CREATE OR REPLACE FUNCTION get_asset_lineage(
        asset_uuid uuid,
        max_depth integer DEFAULT 3,
        direction  varchar(10) DEFAULT 'both'
      )
      RETURNS TABLE(
        source_id uuid,
        target_id uuid,
        relationship_type varchar,
        depth integer
      ) AS $$
      WITH RECURSIVE lineage_tree AS (
        SELECT 
          dl.source_asset_id AS source_id,
          dl.target_asset_id AS target_id,
          dl.relationship_type,
          1 AS depth
        FROM data_lineage dl
        WHERE (direction IN ('upstream','both') AND dl.target_asset_id = asset_uuid)
           OR (direction IN ('downstream','both') AND dl.source_asset_id = asset_uuid)

        UNION ALL

        SELECT
          dl.source_asset_id,
          dl.target_asset_id,
          dl.relationship_type,
          lt.depth + 1
        FROM data_lineage dl
        JOIN lineage_tree lt ON (
          (direction IN ('upstream','both')   AND dl.target_asset_id = lt.source_id) OR
          (direction IN ('downstream','both') AND dl.source_asset_id = lt.target_id)
        )
        WHERE lt.depth < max_depth
      )
      SELECT DISTINCT * FROM lineage_tree;
      $$ LANGUAGE sql STABLE;

      COMMIT;
    `,
  },
];
