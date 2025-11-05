-- Populate catalog_columns for AdventureWorks tables with FK relationships
-- Asset IDs mapping:
-- 351: customer_addresses, 340: customers, 345: departments, 344: employees
-- 349: inventory, 342: order_items, 341: orders, 348: payments
-- 347: product_categories, 343: products, 346: suppliers, 350: warehouses

-- customers table (asset_id: 340)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(340, 'customer_id', 'integer', false, 1, true, false, NULL, NULL),
(340, 'first_name', 'character varying', false, 2, false, false, NULL, NULL),
(340, 'last_name', 'character varying', false, 3, false, false, NULL, NULL),
(340, 'email', 'character varying', false, 4, false, false, NULL, NULL),
(340, 'phone', 'character varying', true, 5, false, false, NULL, NULL),
(340, 'date_of_birth', 'date', true, 6, false, false, NULL, NULL),
(340, 'customer_since', 'date', true, 7, false, false, NULL, NULL),
(340, 'loyalty_points', 'integer', true, 8, false, false, NULL, NULL),
(340, 'credit_limit', 'numeric', true, 9, false, false, NULL, NULL),
(340, 'active', 'boolean', true, 10, false, false, NULL, NULL),
(340, 'created_at', 'timestamp without time zone', true, 11, false, false, NULL, NULL);

-- orders table (asset_id: 341)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(341, 'order_id', 'integer', false, 1, true, false, NULL, NULL),
(341, 'customer_id', 'integer', false, 2, false, true, 'customers', 'customer_id'),
(341, 'employee_id', 'integer', true, 3, false, true, 'employees', 'employee_id'),
(341, 'order_date', 'timestamp without time zone', true, 4, false, false, NULL, NULL),
(341, 'required_date', 'date', true, 5, false, false, NULL, NULL),
(341, 'shipped_date', 'date', true, 6, false, false, NULL, NULL),
(341, 'territory_id', 'integer', true, 7, false, false, NULL, NULL),
(341, 'shipping_address_id', 'integer', true, 8, false, true, 'customer_addresses', 'address_id'),
(341, 'order_status', 'character varying', true, 9, false, false, NULL, NULL),
(341, 'subtotal', 'numeric', true, 10, false, false, NULL, NULL),
(341, 'tax_amount', 'numeric', true, 11, false, false, NULL, NULL),
(341, 'shipping_cost', 'numeric', true, 12, false, false, NULL, NULL),
(341, 'total_amount', 'numeric', true, 13, false, false, NULL, NULL),
(341, 'notes', 'text', true, 14, false, false, NULL, NULL),
(341, 'created_at', 'timestamp without time zone', true, 15, false, false, NULL, NULL);

-- order_items table (asset_id: 342)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(342, 'order_item_id', 'integer', false, 1, true, false, NULL, NULL),
(342, 'order_id', 'integer', false, 2, false, true, 'orders', 'order_id'),
(342, 'product_id', 'integer', false, 3, false, true, 'products', 'product_id'),
(342, 'quantity', 'integer', false, 4, false, false, NULL, NULL),
(342, 'unit_price', 'numeric', false, 5, false, false, NULL, NULL),
(342, 'discount', 'numeric', true, 6, false, false, NULL, NULL),
(342, 'line_total', 'numeric', true, 7, false, false, NULL, NULL),
(342, 'created_at', 'timestamp without time zone', true, 8, false, false, NULL, NULL);

-- products table (asset_id: 343)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(343, 'product_id', 'integer', false, 1, true, false, NULL, NULL),
(343, 'product_name', 'character varying', false, 2, false, false, NULL, NULL),
(343, 'sku', 'character varying', false, 3, false, false, NULL, NULL),
(343, 'category_id', 'integer', true, 4, false, true, 'product_categories', 'category_id'),
(343, 'supplier_id', 'integer', true, 5, false, true, 'suppliers', 'supplier_id'),
(343, 'unit_price', 'numeric', false, 6, false, false, NULL, NULL),
(343, 'cost_price', 'numeric', true, 7, false, false, NULL, NULL),
(343, 'units_in_stock', 'integer', true, 8, false, false, NULL, NULL),
(343, 'reorder_level', 'integer', true, 9, false, false, NULL, NULL),
(343, 'discontinued', 'boolean', true, 10, false, false, NULL, NULL),
(343, 'description', 'text', true, 11, false, false, NULL, NULL),
(343, 'weight_kg', 'numeric', true, 12, false, false, NULL, NULL),
(343, 'created_at', 'timestamp without time zone', true, 13, false, false, NULL, NULL);

-- employees table (asset_id: 344)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(344, 'employee_id', 'integer', false, 1, true, false, NULL, NULL),
(344, 'first_name', 'character varying', false, 2, false, false, NULL, NULL),
(344, 'last_name', 'character varying', false, 3, false, false, NULL, NULL),
(344, 'email', 'character varying', true, 4, false, false, NULL, NULL),
(344, 'phone', 'character varying', true, 5, false, false, NULL, NULL),
(344, 'hire_date', 'date', false, 6, false, false, NULL, NULL),
(344, 'department_id', 'integer', true, 7, false, true, 'departments', 'department_id'),
(344, 'job_title', 'character varying', true, 8, false, false, NULL, NULL),
(344, 'salary', 'numeric', true, 9, false, false, NULL, NULL),
(344, 'manager_id', 'integer', true, 10, false, true, 'employees', 'employee_id'),
(344, 'active', 'boolean', true, 11, false, false, NULL, NULL),
(344, 'created_at', 'timestamp without time zone', true, 12, false, false, NULL, NULL);

-- departments table (asset_id: 345)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(345, 'department_id', 'integer', false, 1, true, false, NULL, NULL),
(345, 'department_name', 'character varying', false, 2, false, false, NULL, NULL),
(345, 'description', 'text', true, 3, false, false, NULL, NULL),
(345, 'manager_name', 'character varying', true, 4, false, false, NULL, NULL),
(345, 'budget', 'numeric', true, 5, false, false, NULL, NULL),
(345, 'created_at', 'timestamp without time zone', true, 6, false, false, NULL, NULL);

-- suppliers table (asset_id: 346)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(346, 'supplier_id', 'integer', false, 1, true, false, NULL, NULL),
(346, 'company_name', 'character varying', false, 2, false, false, NULL, NULL),
(346, 'contact_name', 'character varying', true, 3, false, false, NULL, NULL),
(346, 'email', 'character varying', true, 4, false, false, NULL, NULL),
(346, 'phone', 'character varying', true, 5, false, false, NULL, NULL),
(346, 'address', 'text', true, 6, false, false, NULL, NULL),
(346, 'rating', 'numeric', true, 7, false, false, NULL, NULL),
(346, 'active', 'boolean', true, 8, false, false, NULL, NULL),
(346, 'created_at', 'timestamp without time zone', true, 9, false, false, NULL, NULL);

-- product_categories table (asset_id: 347)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(347, 'category_id', 'integer', false, 1, true, false, NULL, NULL),
(347, 'category_name', 'character varying', false, 2, false, false, NULL, NULL),
(347, 'parent_category_id', 'integer', true, 3, false, true, 'product_categories', 'category_id'),
(347, 'description', 'text', true, 4, false, false, NULL, NULL),
(347, 'active', 'boolean', true, 5, false, false, NULL, NULL),
(347, 'created_at', 'timestamp without time zone', true, 6, false, false, NULL, NULL);

-- payments table (asset_id: 348)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(348, 'payment_id', 'integer', false, 1, true, false, NULL, NULL),
(348, 'order_id', 'integer', false, 2, false, true, 'orders', 'order_id'),
(348, 'payment_method_id', 'integer', true, 3, false, false, NULL, NULL),
(348, 'payment_date', 'timestamp without time zone', true, 4, false, false, NULL, NULL),
(348, 'amount', 'numeric', false, 5, false, false, NULL, NULL),
(348, 'payment_status', 'character varying', true, 6, false, false, NULL, NULL),
(348, 'transaction_id', 'character varying', true, 7, false, false, NULL, NULL),
(348, 'notes', 'text', true, 8, false, false, NULL, NULL),
(348, 'created_at', 'timestamp without time zone', true, 9, false, false, NULL, NULL);

-- inventory table (asset_id: 349)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(349, 'inventory_id', 'integer', false, 1, true, false, NULL, NULL),
(349, 'product_id', 'integer', false, 2, false, true, 'products', 'product_id'),
(349, 'warehouse_id', 'integer', false, 3, false, true, 'warehouses', 'warehouse_id'),
(349, 'quantity', 'integer', false, 4, false, false, NULL, NULL),
(349, 'reorder_point', 'integer', true, 5, false, false, NULL, NULL),
(349, 'last_restock_date', 'date', true, 6, false, false, NULL, NULL),
(349, 'created_at', 'timestamp without time zone', true, 7, false, false, NULL, NULL);

-- warehouses table (asset_id: 350)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(350, 'warehouse_id', 'integer', false, 1, true, false, NULL, NULL),
(350, 'warehouse_name', 'character varying', false, 2, false, false, NULL, NULL),
(350, 'location', 'character varying', true, 3, false, false, NULL, NULL),
(350, 'capacity', 'integer', true, 4, false, false, NULL, NULL),
(350, 'manager_name', 'character varying', true, 5, false, false, NULL, NULL),
(350, 'active', 'boolean', true, 6, false, false, NULL, NULL),
(350, 'created_at', 'timestamp without time zone', true, 7, false, false, NULL, NULL);

-- customer_addresses table (asset_id: 351)
INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column) VALUES
(351, 'address_id', 'integer', false, 1, true, false, NULL, NULL),
(351, 'customer_id', 'integer', false, 2, false, true, 'customers', 'customer_id'),
(351, 'address_type', 'character varying', true, 3, false, false, NULL, NULL),
(351, 'street_address', 'character varying', true, 4, false, false, NULL, NULL),
(351, 'city', 'character varying', true, 5, false, false, NULL, NULL),
(351, 'state_province', 'character varying', true, 6, false, false, NULL, NULL),
(351, 'postal_code', 'character varying', true, 7, false, false, NULL, NULL),
(351, 'country_id', 'integer', true, 8, false, false, NULL, NULL),
(351, 'is_default', 'boolean', true, 9, false, false, NULL, NULL),
(351, 'created_at', 'timestamp without time zone', true, 10, false, false, NULL, NULL);
