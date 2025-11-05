-- Insert bad data for quality testing
-- This script adds various quality issues to test detection

-- 1. Insert customers with NULL emails (completeness issue)
INSERT INTO customers (customer_id, first_name, last_name, email, phone, address, city, state, zip_code, country, created_date)
VALUES
  ('BADCUST001', 'John', 'Doe', NULL, '555-0001', '123 Main St', 'Anytown', 'CA', '90210', 'USA', NOW()),
  ('BADCUST002', 'Jane', 'Smith', NULL, '555-0002', '456 Oak Ave', 'Somewhere', 'NY', '10001', 'USA', NOW()),
  ('BADCUST003', 'Bob', 'Johnson', NULL, NULL, '789 Pine Rd', 'Nowhere', 'TX', '75001', 'USA', NOW());

-- 2. Insert customers with invalid emails (validity issue)
INSERT INTO customers (customer_id, first_name, last_name, email, phone, address, city, state, zip_code, country, created_date)
VALUES
  ('BADCUST004', 'Alice', 'Williams', 'notanemail', '555-0004', '321 Elm St', 'Elsewhere', 'FL', '33101', 'USA', NOW()),
  ('BADCUST005', 'Charlie', 'Brown', '@invalid.com', '555-0005', '654 Maple Dr', 'Anywhere', 'WA', '98101', 'USA', NOW()),
  ('BADCUST006', 'Diana', 'Davis', 'missing@', '555-0006', '987 Birch Ln', 'Somewhere', 'OR', '97201', 'USA', NOW());

-- 3. Insert duplicate customer IDs (uniqueness issue)
INSERT INTO customers (customer_id, first_name, last_name, email, phone, address, city, state, zip_code, country, created_date)
VALUES
  ('DUPCUST001', 'Michael', 'Miller', 'michael1@email.com', '555-0007', '111 First St', 'City1', 'CA', '90001', 'USA', NOW()),
  ('DUPCUST001', 'Mike', 'Miller', 'michael2@email.com', '555-0008', '222 Second St', 'City2', 'CA', '90002', 'USA', NOW())
ON CONFLICT (customer_id) DO NOTHING;

-- 4. Insert orders with negative quantities (validity issue)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount)
VALUES
  (1001, 101, -5, 29.99, 0),
  (1002, 102, -10, 49.99, 0.1),
  (1003, 103, 0, 19.99, 0);

-- 5. Insert orders with extreme/outlier prices (accuracy issue)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount)
VALUES
  (1004, 104, 1, 999999.99, 0),
  (1005, 105, 2, 0.001, 0),
  (1006, 106, 3, -49.99, 0);

-- 6. Insert employees with future birth dates (timeliness issue)
INSERT INTO employees (employee_id, first_name, last_name, title, birth_date, hire_date, address, city, region, postal_code, country, home_phone, extension, notes, reports_to)
VALUES
  (9901, 'Future', 'Person', 'Time Traveler', '2030-01-01', '2024-01-01', '999 Future Blvd', 'Tomorrow City', 'CA', '99999', 'USA', '555-9999', '9999', 'From the future', NULL),
  (9902, 'Baby', 'Genius', 'Prodigy', '2025-06-15', '2024-01-01', '888 Smart St', 'Genius Town', 'NY', '88888', 'USA', '555-8888', '8888', 'Not born yet', NULL);

-- 7. Insert inventory with negative stock (consistency issue)
INSERT INTO inventory (product_id, warehouse_id, quantity, last_updated)
VALUES
  (201, 1, -100, NOW()),
  (202, 1, -50, NOW()),
  (203, 2, -25, NOW());

-- 8. Insert orders with NULL required fields (completeness issue)
INSERT INTO orders (order_id, customer_id, employee_id, order_date, required_date, shipped_date, ship_via, freight, ship_name, ship_address, ship_city, ship_region, ship_postal_code, ship_country)
VALUES
  (9001, NULL, 1, NOW(), NOW() + INTERVAL '7 days', NULL, 1, 10.00, 'Test Order 1', NULL, NULL, NULL, NULL, NULL),
  (9002, 'CUST001', NULL, NOW(), NOW() + INTERVAL '7 days', NULL, 1, 20.00, NULL, '123 Test St', 'Test City', 'CA', '12345', 'USA'),
  (9003, 'CUST002', 1, NULL, NULL, NULL, NULL, NULL, 'Test Order 3', '456 Test Ave', 'Test Town', 'NY', '67890', 'USA');

-- 9. Insert countries with invalid ISO codes (format issue)
INSERT INTO countries (country_id, country_name, iso_code_2, iso_code_3, population, capital)
VALUES
  ('999', 'Fake Country', 'ZZZ', 'ZZZZ', -1000000, 'Nowhere City'),
  ('998', 'Test Land', '12', '123', 0, ''),
  ('997', 'Invalid Nation', '', '', NULL, NULL);

-- 10. Add some outlier data to audit_log
INSERT INTO audit_log (user_id, action, entity_type, entity_id, timestamp, details, ip_address)
VALUES
  ('', 'INVALID_ACTION', '', '', NOW(), '{}', '999.999.999.999'),
  (NULL, NULL, NULL, NULL, '1970-01-01', NULL, 'not.an.ip.address'),
  ('user123', 'DELETE', 'customer', 'ALL_CUSTOMERS', NOW() - INTERVAL '10 years', '{"dangerous": true}', '0.0.0.0');

-- Summary of quality issues inserted:
-- 1. Completeness: NULL values in required fields (emails, customer_ids, order dates)
-- 2. Validity: Invalid emails, negative quantities, invalid IP addresses
-- 3. Uniqueness: Duplicate customer IDs
-- 4. Accuracy: Extreme outlier prices ($999,999.99 and $0.001)
-- 5. Consistency: Negative inventory quantities
-- 6. Timeliness: Future birth dates, very old audit logs