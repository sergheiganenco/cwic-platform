-- Insert quality rules directly into the database for testing
-- These rules will detect the bad data we inserted

INSERT INTO quality_rules (
  id,
  name,
  description,
  data_source_id,
  dimension,
  severity,
  expression,
  threshold_config,
  enabled,
  tags,
  created_at,
  updated_at
)
VALUES
-- 1. Customer Email Completeness
(
  gen_random_uuid(),
  'Customer Email Required',
  'All customers must have an email address',
  '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid,
  'completeness',
  'high',
  'SELECT COUNT(CASE WHEN email IS NULL OR email = '''' THEN 1 END) as issue_count, COUNT(*) as total_count FROM adventureworks.public.customers',
  '{"operator": "=", "value": 0, "type": "absolute"}'::jsonb,
  true,
  ARRAY['customer', 'email', 'required'],
  NOW(),
  NOW()
),

-- 2. Valid Email Format
(
  gen_random_uuid(),
  'Valid Email Format',
  'Customer emails must be in valid format',
  '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid,
  'validity',
  'medium',
  'SELECT COUNT(CASE WHEN email IS NOT NULL AND email NOT LIKE ''%@%.%'' THEN 1 END) as issue_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE email IS NOT NULL',
  '{"operator": "=", "value": 0, "type": "absolute"}'::jsonb,
  true,
  ARRAY['customer', 'email', 'format'],
  NOW(),
  NOW()
),

-- 3. Positive Credit Limits
(
  gen_random_uuid(),
  'Positive Credit Limits',
  'Customer credit limits must be positive',
  '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid,
  'validity',
  'critical',
  'SELECT COUNT(CASE WHEN credit_limit < 0 THEN 1 END) as issue_count, COUNT(*) as total_count FROM adventureworks.public.customers',
  '{"operator": "=", "value": 0, "type": "absolute"}'::jsonb,
  true,
  ARRAY['customer', 'credit', 'validation'],
  NOW(),
  NOW()
),

-- 4. Valid Birth Dates
(
  gen_random_uuid(),
  'Valid Birth Dates',
  'Customer birth dates must be in the past',
  '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid,
  'freshness',
  'high',
  'SELECT COUNT(CASE WHEN date_of_birth > CURRENT_DATE THEN 1 END) as issue_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE date_of_birth IS NOT NULL',
  '{"operator": "=", "value": 0, "type": "absolute"}'::jsonb,
  true,
  ARRAY['customer', 'birthdate', 'temporal'],
  NOW(),
  NOW()
),

-- 5. Reasonable Credit Limits
(
  gen_random_uuid(),
  'Reasonable Credit Limits',
  'Credit limits should be within reasonable range',
  '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid,
  'accuracy',
  'medium',
  'SELECT COUNT(CASE WHEN credit_limit > 100000 OR credit_limit < 0 THEN 1 END) as issue_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE credit_limit IS NOT NULL',
  '{"operator": "=", "value": 0, "type": "absolute"}'::jsonb,
  true,
  ARRAY['customer', 'credit', 'outlier'],
  NOW(),
  NOW()
),

-- 6. Unique Customer Emails
(
  gen_random_uuid(),
  'Unique Customer Emails',
  'Customer emails should be unique',
  '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid,
  'uniqueness',
  'high',
  'SELECT COUNT(*) - COUNT(DISTINCT email) as issue_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE email IS NOT NULL',
  '{"operator": "=", "value": 0, "type": "absolute"}'::jsonb,
  true,
  ARRAY['customer', 'email', 'unique'],
  NOW(),
  NOW()
),

-- 7. Customer Age Validation
(
  gen_random_uuid(),
  'Reasonable Customer Age',
  'Customers should not be older than 120 years',
  '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid,
  'accuracy',
  'medium',
  'SELECT COUNT(CASE WHEN DATE_PART(''year'', AGE(date_of_birth)) > 120 THEN 1 END) as issue_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE date_of_birth IS NOT NULL',
  '{"operator": "=", "value": 0, "type": "absolute"}'::jsonb,
  true,
  ARRAY['customer', 'age', 'validation'],
  NOW(),
  NOW()
),

-- 8. No NULL Order Dates
(
  gen_random_uuid(),
  'Order Date Required',
  'All orders must have an order date',
  '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid,
  'completeness',
  'critical',
  'SELECT COUNT(CASE WHEN order_date IS NULL THEN 1 END) as issue_count, COUNT(*) as total_count FROM adventureworks.public.orders',
  '{"operator": "=", "value": 0, "type": "absolute"}'::jsonb,
  true,
  ARRAY['order', 'date', 'required'],
  NOW(),
  NOW()
);

-- Verify the rules were inserted
SELECT COUNT(*) as total_rules FROM quality_rules WHERE data_source_id = '793e4fe5-db62-4aa4-8b48-c220960d85ba'::uuid;