-- Fix autopilot NULL check rules to return actual violation rows
-- This SQL script updates existing NULL check rules to return proper results

-- Update all autopilot NULL check rules
UPDATE quality_rules
SET expression = REPLACE(
  REPLACE(
    REPLACE(expression,
      'SELECT COUNT(*) FILTER (WHERE "',
      'SELECT * FROM "'
    ),
    '" IS NULL) * 100.0 / NULLIF(COUNT(*), 0) AS null_rate FROM "',
    '." WHERE "'
  ),
  '."',
  '" WHERE "'
) || '" IS NULL LIMIT 100'
WHERE name LIKE '%[Autopilot]%NULL check%'
  AND expression LIKE 'SELECT COUNT(*) FILTER%';

-- Show updated rules
SELECT id, name, LEFT(expression, 100) as expression_preview
FROM quality_rules
WHERE name LIKE '%[Autopilot]%NULL check%';
