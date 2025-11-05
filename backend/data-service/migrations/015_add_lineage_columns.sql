-- Migration: Add column-level lineage metadata
-- This adds a JSONB column to store which columns are involved in each lineage relationship

-- Add metadata column to store column-level relationships
ALTER TABLE catalog_lineage
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for faster metadata queries
CREATE INDEX IF NOT EXISTS idx_catalog_lineage_metadata ON catalog_lineage USING gin(metadata);

-- Add comments
COMMENT ON COLUMN catalog_lineage.metadata IS 'Stores column-level relationship details: {"columns": [{"from": "customer_id", "to": "id", "matchType": "exact"}]}';
