-- Insert bad data for quality testing
-- This script adds various quality issues to test detection

-- 1. Insert customers with NULL emails (completeness issue)
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, credit_limit)
VALUES
  ('John', 'NoEmail', NULL, '555-0001', '1990-01-01', 1000.00),
  ('Jane', 'MissingEmail', NULL, '555-0002', '1985-05-15', 2000.00),
  ('Bob', 'NoContact', NULL, NULL, '1992-08-20', 500.00);

-- 2. Insert customers with invalid emails (validity issue)
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, credit_limit)
VALUES
  ('Alice', 'BadEmail', 'notanemail', '555-0004', '1988-03-10', 1500.00),
  ('Charlie', 'InvalidEmail', '@invalid.com', '555-0005', '1995-07-25', 3000.00),
  ('Diana', 'WrongFormat', 'missing@', '555-0006', '1991-11-30', 2500.00);

-- 3. Insert customers with negative credit limits (validity issue)
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, credit_limit)
VALUES
  ('Negative', 'Credit', 'negative@test.com', '555-0007', '1990-01-01', -1000.00),
  ('Bad', 'Limit', 'badlimit@test.com', '555-0008', '1985-05-15', -500.00);

-- 4. Insert customers with future birth dates (timeliness issue)
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, credit_limit)
VALUES
  ('Future', 'Born', 'future@test.com', '555-0009', '2030-01-01', 1000.00),
  ('NotYet', 'Born', 'notyet@test.com', '555-0010', '2025-06-15', 2000.00);

-- 5. Insert orders with NULL customer_id (completeness issue)
INSERT INTO orders (customer_id, order_date, ship_date, ship_mode, customer_segment, country, city, state, postal_code, region)
VALUES
  (NULL, '2024-01-01', '2024-01-05', 'Standard', 'Consumer', 'USA', 'New York', 'NY', '10001', 'East'),
  (NULL, '2024-01-02', NULL, 'Express', 'Corporate', 'USA', 'Los Angeles', 'CA', '90001', 'West');

-- 6. Insert orders with ship dates before order dates (consistency issue)
INSERT INTO orders (customer_id, order_date, ship_date, ship_mode, customer_segment, country, city, state, postal_code, region)
VALUES
  (1, '2024-01-10', '2024-01-05', 'Standard', 'Consumer', 'USA', 'Chicago', 'IL', '60601', 'Central'),
  (2, '2024-01-15', '2024-01-01', 'Express', 'Corporate', 'USA', 'Houston', 'TX', '77001', 'South');

-- 7. Insert order_items with negative quantities and prices (validity issue)
-- First create valid orders
INSERT INTO orders (customer_id, order_date, ship_date, ship_mode, customer_segment, country, city, state, postal_code, region)
VALUES
  (1, '2024-01-20', '2024-01-25', 'Standard', 'Consumer', 'USA', 'Miami', 'FL', '33101', 'South'),
  (2, '2024-01-21', '2024-01-26', 'Express', 'Corporate', 'USA', 'Seattle', 'WA', '98101', 'West')
RETURNING order_id;

-- Get the last two order IDs (we'll use hardcoded values for simplicity)
-- Insert order items with bad data
INSERT INTO order_items (order_id, product_id, sales, quantity, discount, profit)
VALUES
  ((SELECT MAX(order_id) FROM orders), 1, -100.00, -5, 0.5, -50.00),
  ((SELECT MAX(order_id)-1 FROM orders), 2, 999999.99, 1, 2.0, 999999.00);

-- 8. Insert products with extreme outlier prices (accuracy issue)
INSERT INTO products (product_name, category, sub_category, unit_price, unit_cost)
VALUES
  ('Super Expensive Item', 'Technology', 'Gadgets', 999999.99, 999998.00),
  ('Almost Free Item', 'Office', 'Supplies', 0.01, 0.001),
  ('Negative Price Item', 'Furniture', 'Chairs', -49.99, -25.00);

-- 9. Insert duplicate products (uniqueness issue if product_name should be unique)
INSERT INTO products (product_name, category, sub_category, unit_price, unit_cost)
VALUES
  ('Duplicate Product', 'Technology', 'Computers', 999.99, 500.00),
  ('Duplicate Product', 'Technology', 'Computers', 999.99, 500.00),
  ('Duplicate Product', 'Technology', 'Computers', 999.99, 500.00);

-- 10. Insert countries with NULL and empty values (completeness issue)
INSERT INTO countries (country_name, country_code, region, population, gdp_billions)
VALUES
  (NULL, 'XX1', 'Unknown', 0, 0),
  ('', 'XX2', NULL, -1000000, -100.00),
  ('Invalid Country', '', '', NULL, NULL);

-- Summary of quality issues inserted:
-- 1. Completeness: NULL emails, NULL customer_ids in orders, NULL country names
-- 2. Validity: Invalid emails, negative quantities, negative credit limits
-- 3. Uniqueness: Duplicate product names
-- 4. Accuracy: Extreme outlier prices ($999,999.99 and $0.01)
-- 5. Consistency: Ship dates before order dates
-- 6. Timeliness: Future birth dates

SELECT 'Bad data inserted successfully!' as status;