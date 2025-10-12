-- ============================================================================
-- CWIC Comprehensive Data Catalog - Database Schema
-- Implements: Trust Scores, Collaboration, Lineage, Quality, AI Features
-- ============================================================================

-- ============================================================================
-- PART 1: ENHANCE EXISTING CATALOG_ASSETS
-- ============================================================================

-- Add trust score and engagement metrics to existing assets table
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(3,2);
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS last_profiled_at TIMESTAMPTZ;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS documentation_completeness INTEGER DEFAULT 0;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS is_deprecated BOOLEAN DEFAULT FALSE;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS deprecation_reason TEXT;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS steward_ids UUID[];
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS domain VARCHAR(100);
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS sensitivity_level VARCHAR(50); -- public, internal, confidential, restricted

-- Enhance catalog_columns
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS is_primary_key BOOLEAN DEFAULT FALSE;
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS is_foreign_key BOOLEAN DEFAULT FALSE;
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS foreign_key_table VARCHAR(255);
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS foreign_key_column VARCHAR(255);
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS data_classification VARCHAR(50); -- PII, sensitive, public
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS sample_values JSONB;
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS value_distribution JSONB;
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS null_percentage DECIMAL(5,2);
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS unique_percentage DECIMAL(5,2);
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS min_value TEXT;
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS max_value TEXT;
ALTER TABLE catalog_columns ADD COLUMN IF NOT EXISTS avg_value DECIMAL(20,4);

-- ============================================================================
-- PART 2: DOCUMENTATION & VERSIONING
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    content TEXT,
    format VARCHAR(20) DEFAULT 'markdown', -- markdown, html, plain
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(asset_id, version)
);

CREATE INDEX idx_asset_docs_asset ON asset_documentation(asset_id);
CREATE INDEX idx_asset_docs_current ON asset_documentation(asset_id, is_current) WHERE is_current = TRUE;

-- ============================================================================
-- PART 3: BUSINESS GLOSSARY
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_glossary_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    term VARCHAR(255) NOT NULL,
    definition TEXT NOT NULL,
    acronym VARCHAR(50),
    synonyms TEXT[],
    related_terms UUID[],
    category VARCHAR(100),
    domain VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft', -- draft, approved, deprecated
    owner_id UUID,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, term)
);

CREATE INDEX idx_glossary_term ON business_glossary_terms(tenant_id, term);
CREATE INDEX idx_glossary_status ON business_glossary_terms(status);

CREATE TABLE IF NOT EXISTS glossary_term_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id UUID NOT NULL REFERENCES business_glossary_terms(id) ON DELETE CASCADE,
    asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
    column_id BIGINT REFERENCES catalog_columns(id) ON DELETE CASCADE,
    mapping_type VARCHAR(20) DEFAULT 'manual', -- manual, ai_suggested, auto_detected
    confidence_score DECIMAL(3,2),
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK (asset_id IS NOT NULL OR column_id IS NOT NULL)
);

CREATE INDEX idx_term_mappings_term ON glossary_term_mappings(term_id);
CREATE INDEX idx_term_mappings_asset ON glossary_term_mappings(asset_id);
CREATE INDEX idx_term_mappings_column ON glossary_term_mappings(column_id);

-- ============================================================================
-- PART 4: DATA LINEAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lineage_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    source_asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
    target_asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
    source_column_id BIGINT REFERENCES catalog_columns(id) ON DELETE SET NULL,
    target_column_id BIGINT REFERENCES catalog_columns(id) ON DELETE SET NULL,
    lineage_type VARCHAR(50) DEFAULT 'data_flow', -- data_flow, transformation, copy
    transformation_logic TEXT,
    transformation_type VARCHAR(50), -- sql, python, etl
    confidence_score DECIMAL(3,2),
    detection_method VARCHAR(50), -- sql_parse, manual, api
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lineage_source ON lineage_edges(source_asset_id);
CREATE INDEX idx_lineage_target ON lineage_edges(target_asset_id);
CREATE INDEX idx_lineage_columns ON lineage_edges(source_column_id, target_column_id);

CREATE TABLE IF NOT EXISTS lineage_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    snapshot_name VARCHAR(255),
    snapshot_date TIMESTAMPTZ DEFAULT now(),
    lineage_data JSONB NOT NULL, -- Full graph snapshot
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PART 5: DATA QUALITY & PROFILING
-- ============================================================================

CREATE TABLE IF NOT EXISTS quality_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50), -- completeness, uniqueness, validity, consistency, timeliness
    asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
    column_id BIGINT REFERENCES catalog_columns(id) ON DELETE CASCADE,
    rule_sql TEXT NOT NULL,
    threshold_value DECIMAL(10,2),
    threshold_operator VARCHAR(10), -- >, <, =, >=, <=
    severity VARCHAR(20) DEFAULT 'warning', -- info, warning, error, critical
    is_active BOOLEAN DEFAULT TRUE,
    schedule_cron VARCHAR(100),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quality_rules_asset ON quality_rules(asset_id);
CREATE INDEX idx_quality_rules_active ON quality_rules(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS quality_run_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES quality_rules(id) ON DELETE CASCADE,
    run_at TIMESTAMPTZ DEFAULT now(),
    status VARCHAR(20), -- passed, failed, error
    actual_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    row_count_affected INTEGER,
    error_message TEXT,
    execution_time_ms INTEGER
);

CREATE INDEX idx_quality_runs_rule ON quality_run_history(rule_id, run_at DESC);

CREATE TABLE IF NOT EXISTS data_quality_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
    column_id BIGINT REFERENCES catalog_columns(id) ON DELETE CASCADE,
    issue_type VARCHAR(50), -- missing_values, outliers, duplicates, invalid_format
    severity VARCHAR(20),
    description TEXT,
    affected_rows INTEGER,
    sample_data JSONB,
    detected_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT
);

CREATE INDEX idx_quality_issues_asset ON data_quality_issues(asset_id, detected_at DESC);

-- ============================================================================
-- PART 6: COLLABORATION & COMMUNITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(asset_id, user_id)
);

CREATE INDEX idx_ratings_asset ON asset_ratings(asset_id);

CREATE TABLE IF NOT EXISTS asset_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES asset_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    mentions UUID[], -- User IDs mentioned
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_asset ON asset_comments(asset_id, created_at DESC);
CREATE INDEX idx_comments_parent ON asset_comments(parent_comment_id);

CREATE TABLE IF NOT EXISTS asset_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    question TEXT NOT NULL,
    tags TEXT[],
    upvotes INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    has_accepted_answer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questions_asset ON asset_questions(asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES asset_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    answer TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    is_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_answers_question ON question_answers(question_id, created_at DESC);

CREATE TABLE IF NOT EXISTS asset_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    folder VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(asset_id, user_id)
);

CREATE INDEX idx_bookmarks_user ON asset_bookmarks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS asset_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    notification_preferences JSONB, -- {changes: true, comments: true, quality_issues: true}
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(asset_id, user_id)
);

CREATE INDEX idx_followers_asset ON asset_followers(asset_id);
CREATE INDEX idx_followers_user ON asset_followers(user_id);

-- ============================================================================
-- PART 7: ACTIVITY & AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- asset_created, doc_updated, comment_added, quality_issue
    entity_type VARCHAR(50), -- asset, comment, documentation
    entity_id UUID,
    asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
    user_id UUID,
    action_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_tenant ON catalog_activity_feed(tenant_id, created_at DESC);
CREATE INDEX idx_activity_asset ON catalog_activity_feed(asset_id, created_at DESC);
CREATE INDEX idx_activity_user ON catalog_activity_feed(user_id, created_at DESC);

-- ============================================================================
-- PART 8: AI & RECOMMENDATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_generated_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
    column_id BIGINT REFERENCES catalog_columns(id) ON DELETE CASCADE,
    doc_type VARCHAR(50), -- description, summary, use_case
    generated_content TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    model_version VARCHAR(50),
    prompt_used TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_docs_asset ON ai_generated_docs(asset_id);

CREATE TABLE IF NOT EXISTS asset_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    source_asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    recommended_asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50), -- similar_schema, related_data, frequently_used_together
    relevance_score DECIMAL(3,2),
    reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recommendations_source ON asset_recommendations(source_asset_id, relevance_score DESC);

CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    user_id UUID,
    search_query TEXT NOT NULL,
    filters_applied JSONB,
    results_count INTEGER,
    clicked_asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE SET NULL,
    clicked_position INTEGER,
    search_success BOOLEAN,
    search_duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_search_analytics_query ON search_analytics(tenant_id, created_at DESC);

-- ============================================================================
-- PART 9: RELATIONSHIPS & SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    parent_asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    child_asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50), -- foreign_key, parent_child, reference
    constraint_name VARCHAR(255),
    cardinality VARCHAR(20), -- one_to_one, one_to_many, many_to_many
    is_enforced BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(parent_asset_id, child_asset_id, relationship_type)
);

CREATE INDEX idx_relationships_parent ON asset_relationships(parent_asset_id);
CREATE INDEX idx_relationships_child ON asset_relationships(child_asset_id);

-- ============================================================================
-- PART 10: NOTIFICATIONS & ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    user_id UUID NOT NULL,
    notification_type VARCHAR(50), -- comment_mention, asset_change, quality_alert
    title VARCHAR(255) NOT NULL,
    message TEXT,
    asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON user_notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================================================
-- PART 11: SAVED FILTERS & PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    user_id UUID NOT NULL,
    search_name VARCHAR(255) NOT NULL,
    search_query TEXT,
    filters JSONB,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with UUID[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

-- ============================================================================
-- PART 12: TRUST SCORE CALCULATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_trust_score(asset_uuid BIGINT)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    doc_score INTEGER := 0;
    quality_score INTEGER := 0;
    community_score INTEGER := 0;
    freshness_score INTEGER := 0;
    usage_score INTEGER := 0;
BEGIN
    -- Documentation completeness (0-25 points)
    SELECT
        CASE
            WHEN description IS NOT NULL AND LENGTH(description) > 50 THEN 10
            WHEN description IS NOT NULL THEN 5
            ELSE 0
        END +
        CASE
            WHEN tags IS NOT NULL AND array_length(tags, 1) > 0 THEN 5
            ELSE 0
        END +
        CASE WHEN owner_id IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN domain IS NOT NULL THEN 5 ELSE 0 END
    INTO doc_score
    FROM catalog_assets WHERE id = asset_uuid;

    -- Data quality (0-25 points)
    SELECT COALESCE(quality_score, 0) / 4 INTO quality_score
    FROM catalog_assets WHERE id = asset_uuid;

    -- Community engagement (0-25 points)
    SELECT
        LEAST(25,
            COALESCE(rating_avg, 0) * 5 +
            LEAST(10, comment_count) +
            LEAST(5, bookmark_count)
        )
    INTO community_score
    FROM catalog_assets WHERE id = asset_uuid;

    -- Data freshness (0-15 points)
    SELECT
        CASE
            WHEN updated_at > now() - INTERVAL '1 day' THEN 15
            WHEN updated_at > now() - INTERVAL '1 week' THEN 10
            WHEN updated_at > now() - INTERVAL '1 month' THEN 5
            ELSE 0
        END
    INTO freshness_score
    FROM catalog_assets WHERE id = asset_uuid;

    -- Usage (0-10 points)
    SELECT LEAST(10, view_count / 10) INTO usage_score
    FROM catalog_assets WHERE id = asset_uuid;

    score := doc_score + quality_score + community_score + freshness_score + usage_score;

    RETURN LEAST(100, score);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 13: TRIGGERS & AUTOMATIONS
-- ============================================================================

-- Auto-update trust score on changes
CREATE OR REPLACE FUNCTION update_asset_trust_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.trust_score := calculate_trust_score(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trust_score
    BEFORE UPDATE ON catalog_assets
    FOR EACH ROW
    WHEN (OLD.description IS DISTINCT FROM NEW.description OR
          OLD.tags IS DISTINCT FROM NEW.tags OR
          OLD.quality_score IS DISTINCT FROM NEW.quality_score OR
          OLD.rating_avg IS DISTINCT FROM NEW.rating_avg)
    EXECUTE FUNCTION update_asset_trust_score();

-- Auto-update rating average
CREATE OR REPLACE FUNCTION update_asset_rating_avg()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE catalog_assets
    SET
        rating_avg = (SELECT AVG(rating)::DECIMAL(3,2) FROM asset_ratings WHERE asset_id = NEW.asset_id),
        rating_count = (SELECT COUNT(*) FROM asset_ratings WHERE asset_id = NEW.asset_id)
    WHERE id = NEW.asset_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rating_avg
    AFTER INSERT OR UPDATE OR DELETE ON asset_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_asset_rating_avg();

-- Auto-update comment count
CREATE OR REPLACE FUNCTION update_asset_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE catalog_assets
    SET comment_count = (SELECT COUNT(*) FROM asset_comments WHERE asset_id = NEW.asset_id)
    WHERE id = NEW.asset_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_count
    AFTER INSERT OR DELETE ON asset_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_asset_comment_count();

-- ============================================================================
-- PART 14: VIEWS FOR COMMON QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW v_asset_overview AS
SELECT
    a.*,
    d.content as documentation,
    ARRAY_AGG(DISTINCT c.column_name) FILTER (WHERE c.column_name IS NOT NULL) as column_names,
    COUNT(DISTINCT r.id) as rating_count_direct,
    COUNT(DISTINCT cm.id) as comment_count_direct,
    COUNT(DISTINCT b.id) as bookmark_count_direct
FROM catalog_assets a
LEFT JOIN asset_documentation d ON d.asset_id = a.id AND d.is_current = TRUE
LEFT JOIN catalog_columns c ON c.asset_id = a.id
LEFT JOIN asset_ratings r ON r.asset_id = a.id
LEFT JOIN asset_comments cm ON cm.asset_id = a.id
LEFT JOIN asset_bookmarks b ON b.asset_id = a.id
GROUP BY a.id, d.content;

CREATE OR REPLACE VIEW v_trending_assets AS
SELECT
    a.*,
    a.view_count + (a.comment_count * 5) + (a.bookmark_count * 10) as trending_score
FROM catalog_assets a
WHERE a.updated_at > now() - INTERVAL '7 days'
ORDER BY trending_score DESC;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assets_trust_score ON catalog_assets(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_assets_domain ON catalog_assets(domain);
CREATE INDEX IF NOT EXISTS idx_assets_sensitivity ON catalog_assets(sensitivity_level);
CREATE INDEX IF NOT EXISTS idx_assets_owner ON catalog_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_columns_classification ON catalog_columns(data_classification);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_assets_fts ON catalog_assets USING gin(to_tsvector('english',
    COALESCE(table_name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(array_to_string(tags, ' '), '')));

CREATE INDEX IF NOT EXISTS idx_glossary_fts ON business_glossary_terms USING gin(to_tsvector('english',
    term || ' ' || definition || ' ' || COALESCE(array_to_string(synonyms, ' '), '')));

COMMIT;
