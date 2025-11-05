-- Insert Bad Data into AdventureWorks for Quality Testing
-- This script inserts rows with various data quality issues

-- 1. COMPLETENESS ISSUES: Insert customers with missing emails (nulls in important fields)
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active, created_at)
VALUES
('John', 'Doe', NULL, '555-0101', '1980-05-15', '2023-01-01', 100, 5000, true, NOW()),
('Jane', 'Smith', '', '555-0102', '1985-08-22', '2023-02-01', 50, 3000, true, NOW()),
('Bob', 'NoEmail', NULL, NULL, '1990-03-10', '2023-03-01', 0, 2000, true, NOW());

-- 2. VALIDITY ISSUES: Insert customers with invalid credit limits (exceeding max threshold)
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active, created_at)
VALUES
('Enterprise', 'ClientA', 'enterprise.a@example.com', '555-9001', '1975-01-01', '2020-01-01', 5000, 75000.00, true, NOW()),
('Corporate', 'AccountB', 'corporate.b@example.com', '555-9002', '1978-06-15', '2020-06-01', 8000, 125000.00, true, NOW());

-- 3. UNIQUENESS ISSUES: Insert customers with duplicate emails
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active, created_at)
VALUES
('Duplicate', 'User1', 'john.duplicate@example.com', '555-8001', '1982-04-20', '2023-04-01', 200, 4000, true, NOW()),
('Duplicate', 'User2', 'john.duplicate@example.com', '555-8002', '1983-07-11', '2023-04-02', 150, 3500, true, NOW()),
('Another', 'Dup1', 'jane.duplicate@example.com', '555-8003', '1984-09-05', '2023-04-03', 300, 5000, true, NOW()),
('Another', 'Dup2', 'jane.duplicate@example.com', '555-8004', '1985-11-30', '2023-04-04', 250, 4500, true, NOW());

-- 4. VALIDITY ISSUES: Insert products with invalid prices (zero or negative)
INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, description, weight_kg, created_at)
VALUES
('Test Product Zero Price', 'TEST-ZERO-001', 1, 1, 0.00, 10.00, 50, 10, false, 'Product with zero price for testing', 1.5, NOW()),
('Bad Product Negative', 'BAD-NEG-002', 2, 2, -15.99, 10.00, 30, 5, false, 'Product with negative price', 2.0, NOW());

-- 5. COMPLETENESS ISSUES: Insert products without descriptions
INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, description, weight_kg, created_at)
VALUES
('Widget Pro 2000', 'WDG-2000', 3, 3, 199.99, 120.00, 100, 20, false, NULL, 3.2, NOW()),
('Gadget Ultra', 'GDG-ULTRA', 4, 4, 299.99, 180.00, 75, 15, false, '', 2.8, NOW()),
('SuperTool Deluxe', 'ST-DLX-500', 5, 5, 449.99, 270.00, 50, 10, false, NULL, 4.5, NOW());

-- 6. CONSISTENCY ISSUES: Insert orders with totals that don't match line items
-- First, insert a valid order
INSERT INTO orders (customer_id, employee_id, order_date, required_date, shipped_date, order_status, subtotal, tax_amount, shipping_cost, total_amount, notes, created_at)
VALUES
(1, 1, '2024-01-15 10:30:00', '2024-01-20', '2024-01-18', 'shipped', 500.00, 50.00, 10.00, 650.00, 'Order total intentionally wrong', NOW()),
(2, 2, '2024-01-16 14:20:00', '2024-01-21', NULL, 'processing', 1000.00, 100.00, 15.00, 1200.00, 'Another inconsistent total', NOW()),
(3, 3, '2024-01-17 09:15:00', '2024-01-22', NULL, 'pending', 750.00, 75.00, 12.00, 850.00, 'Mismatch between total and items', NOW());

-- Get the IDs of the orders we just inserted
DO $$
DECLARE
    order_id_1 INT;
    order_id_2 INT;
    order_id_3 INT;
    product_id_1 INT;
    product_id_2 INT;
BEGIN
    -- Get order IDs (assuming they are the last 3 inserted)
    SELECT order_id INTO order_id_1 FROM orders ORDER BY created_at DESC OFFSET 2 LIMIT 1;
    SELECT order_id INTO order_id_2 FROM orders ORDER BY created_at DESC OFFSET 1 LIMIT 1;
    SELECT order_id INTO order_id_3 FROM orders ORDER BY created_at DESC LIMIT 1;

    -- Get some product IDs
    SELECT product_id INTO product_id_1 FROM products LIMIT 1;
    SELECT product_id INTO product_id_2 FROM products LIMIT 1 OFFSET 1;

    -- Insert order items that don't match the order totals
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, line_total, created_at)
    VALUES
    (order_id_1, product_id_1, 2, 100.00, 0, 200.00, NOW()),
    (order_id_1, product_id_2, 3, 150.00, 0, 450.00, NOW()),
    -- Total should be 650.00 but items sum to 650.00 - but order has 650.00, let's make it wrong
    (order_id_2, product_id_1, 5, 200.00, 0, 1000.00, NOW()),
    (order_id_2, product_id_2, 2, 125.00, 0, 250.00, NOW()),
    -- Total should be 1250 but order says 1200
    (order_id_3, product_id_1, 3, 250.00, 50.00, 700.00, NOW()),
    (order_id_3, product_id_2, 1, 125.00, 0, 125.00, NOW());
    -- Total should be 825 but order says 850
END $$;

-- 7. VALIDITY ISSUES: Insert orders with future dates
INSERT INTO orders (customer_id, employee_id, order_date, required_date, shipped_date, order_status, subtotal, tax_amount, shipping_cost, total_amount, notes, created_at)
VALUES
(1, 1, '2026-12-31 10:00:00', '2027-01-05', NULL, 'pending', 100.00, 10.00, 5.00, 115.00, 'Order date in future', NOW());

-- 8. CONSISTENCY ISSUES: Insert negative inventory quantities
INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_point, last_restock_date, created_at)
VALUES
(1, 1, -5, 10, '2024-01-01', NOW()),
(2, 2, -12, 15, '2024-01-05', NOW()),
(3, 3, -3, 20, '2024-01-10', NOW()),
(4, 1, -8, 10, '2024-01-15', NOW());

-- 9. ACCURACY ISSUES: Insert employees with unrealistic salaries
INSERT INTO employees (first_name, last_name, email, phone, hire_date, department_id, job_title, salary, manager_id, active, created_at)
VALUES
('CEO', 'Executive', 'ceo@example.com', '555-1000', '2015-01-01', 1, 'Chief Executive Officer', 250000.00, NULL, true, NOW()),
('Intern', 'Summer', 'intern@example.com', '555-1001', '2024-06-01', 2, 'Summer Intern', 15000.00, 1, true, NOW()),
('VP', 'Sales', 'vp.sales@example.com', '555-1002', '2016-03-15', 3, 'VP of Sales', 225000.00, 1, true, NOW());

-- 10. COMPLETENESS ISSUES: Insert employees with missing required fields
INSERT INTO employees (first_name, last_name, email, phone, hire_date, department_id, job_title, salary, manager_id, active, created_at)
VALUES
('NoEmail', 'Person', NULL, '555-2001', '2023-01-15', 2, 'Data Analyst', 65000.00, 5, true, NOW()),
('NoPhone', 'Guy', 'nophone@example.com', NULL, '2023-02-20', 3, 'Sales Rep', 55000.00, 10, true, NOW());

-- 11. VALIDITY ISSUES: Insert payments with negative amounts or future dates
DO $$
DECLARE
    last_order_id INT;
BEGIN
    SELECT order_id INTO last_order_id FROM orders ORDER BY created_at DESC LIMIT 1;

    INSERT INTO payments (order_id, payment_method_id, payment_date, amount, payment_status, transaction_id, notes, created_at)
    VALUES
    (last_order_id, 1, NOW(), -50.00, 'failed', 'TXN-NEG-001', 'Negative payment amount', NOW()),
    (last_order_id, 2, '2026-01-01 12:00:00', 100.00, 'pending', 'TXN-FUTURE-002', 'Payment date in future', NOW());
END $$;

-- 12. CONSISTENCY ISSUES: Insert orphaned customer addresses (referencing non-existent customers)
-- Note: This will fail with FK constraint, so we'll insert valid addresses but with inconsistent data
INSERT INTO customer_addresses (customer_id, address_type, street_address, city, state_province, postal_code, country_id, is_default, created_at)
VALUES
(1, 'billing', NULL, 'New York', 'NY', '10001', 1, false, NOW()),
(2, 'shipping', '123 Main St', NULL, 'CA', '90001', 1, false, NOW()),
(3, 'billing', '456 Oak Ave', 'Boston', NULL, NULL, 1, false, NOW());

-- 13. UNIQUENESS ISSUES: Insert duplicate product SKUs (if constraints allow or we work around them)
-- Note: If there's a unique constraint, this will fail. Let's add products with very similar SKUs
INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, description, weight_kg, created_at)
VALUES
('Duplicate SKU Product A', 'DUP-SKU-001', 1, 1, 99.99, 60.00, 100, 20, false, 'First duplicate', 1.0, NOW()),
('Duplicate SKU Product B', 'DUP-SKU-001-COPY', 2, 2, 89.99, 55.00, 75, 15, false, 'Similar SKU', 1.2, NOW());

-- 14. DATA TYPE ISSUES: Insert text values that should be numeric (handled by constraints)
-- Insert dates that are in wrong format (will be handled by PostgreSQL type checking)
-- These need to be valid SQL but represent edge cases

-- 15. OUTLIER DATA: Insert extreme values
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active, created_at)
VALUES
('Extreme', 'Points', 'extreme@example.com', '555-9999', '1950-01-01', '1990-01-01', 999999, 100000.00, true, NOW());

INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, description, weight_kg, created_at)
VALUES
('Extremely Expensive', 'EXP-MAX-999', 1, 1, 999999.99, 500000.00, 1, 1, false, 'Outrageously priced item', 100.0, NOW());

-- Summary of bad data inserted
SELECT 'Bad data insertion complete!' as status;
SELECT 'Customers with null emails: ' || COUNT(*) FROM customers WHERE email IS NULL OR email = '' as completeness_issues;
SELECT 'Customers with invalid credit limits: ' || COUNT(*) FROM customers WHERE credit_limit > 50000 as validity_issues;
SELECT 'Products with invalid prices: ' || COUNT(*) FROM products WHERE unit_price <= 0 as price_issues;
SELECT 'Inventory with negative quantities: ' || COUNT(*) FROM inventory WHERE quantity < 0 as consistency_issues;
