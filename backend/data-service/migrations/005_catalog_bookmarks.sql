-- Migration: Add bookmarks table for catalog assets
-- Created: 2025-01-11

CREATE TABLE IF NOT EXISTS catalog_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(asset_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_bookmarks_asset ON catalog_bookmarks(asset_id);
CREATE INDEX IF NOT EXISTS idx_catalog_bookmarks_user ON catalog_bookmarks(user_id);

-- Add bookmark_count column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'catalog_assets'
    AND column_name = 'bookmark_count'
  ) THEN
    ALTER TABLE catalog_assets ADD COLUMN bookmark_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Update existing bookmark counts
UPDATE catalog_assets
SET bookmark_count = (
  SELECT COUNT(*) FROM catalog_bookmarks WHERE asset_id = catalog_assets.id
);
