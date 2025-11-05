-- Create Quality Rules for AdventureWorks Data Source

\c cwic_platform

-- 1. Customer Email Required (Completeness)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Customer Email Required',
  'All customers must have an email address',
  'completeness',
  'not_null',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE email IS NULL',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'high',
  '{"table": "public.customers", "column": "email", "database": "adventureworks"}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 2. Valid Email Format (Accuracy)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Valid Email Format',
  'Customer emails must follow standard email format',
  'accuracy',
  'regex',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE email IS NOT NULL AND email !~ ''^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$''',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'medium',
  '{"table": "public.customers", "column": "email", "database": "adventureworks", "pattern": "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$"}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 3. Unique Customer Emails (Uniqueness)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Unique Customer Emails',
  'Customer email addresses must be unique',
  'uniqueness',
  'unique',
  'sql',
  'postgres',
  'SELECT COUNT(*) - COUNT(DISTINCT email) as failed_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE email IS NOT NULL',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'high',
  '{"table": "public.customers", "column": "email", "database": "adventureworks"}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 4. Phone Number Required (Completeness)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Phone Number Required',
  'All customers must have a phone number',
  'completeness',
  'not_null',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.customers WHERE phone IS NULL',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'medium',
  '{"table": "public.customers", "column": "phone", "database": "adventureworks"}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 5. Positive Inventory Quantity (Validity)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Positive Inventory Quantity',
  'Inventory quantities must be non-negative',
  'validity',
  'range',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.inventory WHERE quantity < 0',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'critical',
  '{"table": "public.inventory", "column": "quantity", "database": "adventureworks", "min": 0}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 6. Positive Order Item Quantity (Validity)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Positive Order Item Quantity',
  'Order item quantities must be positive',
  'validity',
  'range',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.order_items WHERE quantity <= 0',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'critical',
  '{"table": "public.order_items", "column": "quantity", "database": "adventureworks", "min": 1}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 7. Valid Shipment Status (Validity)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Valid Shipment Status',
  'Shipment status must be one of: pending, shipped, delivered, cancelled',
  'validity',
  'allowed_values',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.shipments WHERE shipment_status IS NOT NULL AND shipment_status NOT IN (''pending'', ''shipped'', ''delivered'', ''cancelled'')',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'high',
  '{"table": "public.shipments", "column": "shipment_status", "database": "adventureworks", "allowedValues": ["pending", "shipped", "delivered", "cancelled"]}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 8. Recent Last Restock Date (Freshness)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Recent Last Restock Date',
  'Last restock date should be within the last 10 years',
  'freshness',
  'sql',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.inventory WHERE last_restock_date < CURRENT_DATE - INTERVAL ''10 years''',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'low',
  '{"table": "public.inventory", "column": "last_restock_date", "database": "adventureworks", "maxAgeDays": 3650}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 9. No Future Shipment Dates (Consistency)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - No Future Shipment Dates',
  'Shipment dates cannot be in the future',
  'consistency',
  'sql',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.shipments WHERE shipped_date > CURRENT_TIMESTAMP',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'high',
  '{"table": "public.shipments", "column": "shipped_date", "database": "adventureworks"}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- 10. Positive Order Total (Validity)
INSERT INTO quality_rules (
  name, description, dimension, rule_type, type, dialect, expression,
  data_source_id, enabled, severity, rule_config, created_at
)
VALUES (
  'AW - Positive Order Total',
  'Order total amounts must be greater than zero',
  'validity',
  'range',
  'sql',
  'postgres',
  'SELECT COUNT(*) as failed_count, COUNT(*) as total_count FROM adventureworks.public.orders WHERE total_amount <= 0',
  'a21c94f1-afaa-4e0f-9ca0-dec657a908ef',
  true,
  'high',
  '{"table": "public.orders", "column": "total_amount", "database": "adventureworks", "min": 0.01}',
  NOW()
) ON CONFLICT (name) DO UPDATE SET enabled = true;

-- Show created rules
SELECT COUNT(*) as total_rules_for_adventureworks
FROM quality_rules
WHERE data_source_id = 'a21c94f1-afaa-4e0f-9ca0-dec657a908ef';

SELECT name, dimension, severity, enabled
FROM quality_rules
WHERE data_source_id = 'a21c94f1-afaa-4e0f-9ca0-dec657a908ef'
ORDER BY dimension, name;

\echo 'Quality rules for AdventureWorks created successfully!'
