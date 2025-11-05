-- Simple PII Reset Script
BEGIN;

-- Show current state
SELECT 'BEFORE RESET' as status, COUNT(*) as pii_columns FROM catalog_columns WHERE pii_type IS NOT NULL;

-- Resolve PII quality issues (simplified - just mark as resolved)
UPDATE quality_issues
SET status = 'resolved', resolved_at = NOW()
WHERE (title LIKE '%PII%' OR title LIKE '%Unencrypted%' OR description LIKE '%PII%')
  AND status IN ('open', 'acknowledged');

SELECT 'PII issues resolved' as status, COUNT(*) as count
FROM quality_issues
WHERE (title LIKE '%PII%' OR description LIKE '%PII%') AND status = 'resolved' AND resolved_at > NOW() - INTERVAL '1 minute';

-- Clear ALL PII classifications
UPDATE catalog_columns SET pii_type = NULL, is_sensitive = false, data_classification = NULL WHERE pii_type IS NOT NULL;

SELECT 'PII cleared from columns' as status;

-- Clear exclusions
DELETE FROM pii_exclusions;

SELECT 'Exclusions cleared' as status, COUNT(*) as remaining FROM pii_exclusions;

-- Verify clean slate
SELECT 'AFTER RESET' as status, COUNT(*) as remaining_pii FROM catalog_columns WHERE pii_type IS NOT NULL;

SELECT 'Ready for fresh scan!' as status;

COMMIT;
