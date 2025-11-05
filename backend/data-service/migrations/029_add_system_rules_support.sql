-- Migration: Add system rules support
-- Description: Adds is_system flag and parameters column for pre-built system rules

-- Add is_system column to quality_rules if it doesn't exist
ALTER TABLE quality_rules
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Add parameters column for rule configuration if it doesn't exist
ALTER TABLE quality_rules
ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}';

-- Create index for system rules
CREATE INDEX IF NOT EXISTS idx_quality_rules_is_system
ON quality_rules(is_system)
WHERE is_system = true;

-- Create index for active system rules
CREATE INDEX IF NOT EXISTS idx_quality_rules_system_active
ON quality_rules(is_system, is_active)
WHERE is_system = true AND is_active = true;

-- Add comment
COMMENT ON COLUMN quality_rules.is_system IS 'Indicates if this is a pre-built system rule';
COMMENT ON COLUMN quality_rules.parameters IS 'Configuration parameters for the rule (patterns, thresholds, etc.)';

-- Update existing rules to not be system rules
UPDATE quality_rules
SET is_system = FALSE
WHERE is_system IS NULL;