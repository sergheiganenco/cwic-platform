-- fast pattern search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_catalog_assets_search
ON catalog_assets USING gin ((schema_name || '.' || table_name || ' ' || coalesce(description,'')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_catalog_assets_ds
  ON catalog_assets (datasource_id);

CREATE INDEX IF NOT EXISTS idx_catalog_assets_quality
  ON catalog_assets (quality);

CREATE INDEX IF NOT EXISTS idx_catalog_assets_classification
  ON catalog_assets (classification);

CREATE INDEX IF NOT EXISTS idx_catalog_assets_updated
  ON catalog_assets (updated_at DESC);

-- maintain updated_at
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_assets ON catalog_assets;
CREATE TRIGGER trg_touch_assets BEFORE UPDATE ON catalog_assets
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- metrics for top cards
CREATE MATERIALIZED VIEW IF NOT EXISTS catalog_metrics AS
SELECT
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE asset_type='table')::bigint AS tables,
  COUNT(*) FILTER (WHERE asset_type='view')::bigint AS views,
  jsonb_object_agg(quality, cnt) FILTER (WHERE quality IS NOT NULL) AS by_quality,
  jsonb_object_agg(classification, cnt) FILTER (WHERE classification IS NOT NULL) AS by_classification
FROM (
  SELECT quality, classification, asset_type, 1 AS cnt
  FROM catalog_assets
) s;

CREATE INDEX IF NOT EXISTS idx_catalog_metrics_dummy ON catalog_metrics (total);

-- refresh helper
CREATE OR REPLACE FUNCTION refresh_catalog_metrics() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_metrics;
END;
$$ LANGUAGE plpgsql;
