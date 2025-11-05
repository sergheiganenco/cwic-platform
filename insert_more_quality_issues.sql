-- Insert More Bad Quality Data into AdventureWorks for Testing
-- This script uses correct column names from the actual schema

\c adventureworks

-- ============================================================================
-- COMPLETENESS ISSUES - Additional NULL values
-- ============================================================================

-- Add more NULL values to various tables
UPDATE public.customer_addresses SET address_line1 = NULL WHERE address_id IN (30, 35, 40);
UPDATE public.customer_addresses SET address_line2 = NULL WHERE address_id BETWEEN 45 AND 60;

UPDATE public.employees SET first_name = NULL WHERE employee_id IN (2, 5, 8);
UPDATE public.employees SET last_name = NULL WHERE employee_id IN (3, 6, 9);
UPDATE public.employees SET email = NULL WHERE employee_id IN (4, 7, 10);

UPDATE public.shipments SET carrier = NULL WHERE shipment_id IN (5, 10, 15, 20);
UPDATE public.shipments SET tracking_number = NULL WHERE shipment_id IN (8, 16, 24, 32);

-- ============================================================================
-- CONSISTENCY ISSUES - Negative values and data mismatches
-- ============================================================================

-- Negative quantities in inventory
UPDATE public.inventory SET quantity = -25 WHERE inventory_id IN (10, 20, 30, 40);
UPDATE public.inventory SET quantity = -100 WHERE inventory_id IN (15, 25, 35);

-- Negative quantities in order_items
UPDATE public.order_items SET quantity = -5 WHERE order_item_id IN (20, 40, 60, 80);

-- Negative reorder points
UPDATE public.inventory SET reorder_point = -10 WHERE inventory_id IN (12, 22, 32);

-- Future dates for shipments
UPDATE public.shipments SET shipped_date = '2030-12-31' WHERE shipment_id IN (6, 12, 18);
UPDATE public.shipments SET estimated_delivery = '2040-01-15' WHERE shipment_id IN (7, 14, 21);

-- Shipped dates before order dates (data inconsistency)
UPDATE public.shipments s
SET shipped_date = '2020-01-01'
WHERE shipment_id IN (10, 20, 30)
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.order_id = s.order_id
    AND o.order_date > '2020-01-01'
  );

-- Actual delivery before shipped date (impossible scenario)
UPDATE public.shipments
SET actual_delivery = '2023-01-01',
    shipped_date = '2023-06-01'
WHERE shipment_id IN (25, 26, 27);

-- ============================================================================
-- VALIDITY ISSUES - Invalid status values
-- ============================================================================

-- Invalid shipment statuses
UPDATE public.shipments SET shipment_status = 'INVALID' WHERE shipment_id IN (8, 16, 24);
UPDATE public.shipments SET shipment_status = 'UNKNOWN_STATUS' WHERE shipment_id IN (9, 17, 25);
UPDATE public.shipments SET shipment_status = '' WHERE shipment_id IN (11, 19, 27);

-- ============================================================================
-- UNIQUENESS ISSUES - More duplicates
-- ============================================================================

-- Duplicate tracking numbers
UPDATE public.shipments SET tracking_number = 'DUP-TRACK-001' WHERE shipment_id IN (30, 31, 32, 33);
UPDATE public.shipments SET tracking_number = 'DUP-TRACK-002' WHERE shipment_id IN (35, 36, 37);

-- Duplicate employee emails
UPDATE public.employees SET email = 'duplicate.employee@company.com' WHERE employee_id IN (12, 13, 14);

-- ============================================================================
-- FRESHNESS ISSUES - Very old dates
-- ============================================================================

-- Very old last restock dates
UPDATE public.inventory SET last_restock_date = '1990-01-01' WHERE inventory_id IN (50, 51, 52, 53);
UPDATE public.inventory SET last_restock_date = '1985-06-15' WHERE inventory_id IN (55, 56, 57);

-- Ancient created_at timestamps
UPDATE public.products SET created_at = '1980-01-01' WHERE product_id IN (60, 61, 62);

-- ============================================================================
-- ACCURACY ISSUES - More invalid data
-- ============================================================================

-- More invalid emails for employees
UPDATE public.employees SET email = 'not-valid-email' WHERE employee_id = 15;
UPDATE public.employees SET email = 'missing@domain' WHERE employee_id = 16;
UPDATE public.employees SET email = '@nodomain.com' WHERE employee_id = 17;

-- Invalid/suspicious carrier names
UPDATE public.shipments SET carrier = '' WHERE shipment_id IN (40, 41);
UPDATE public.shipments SET carrier = 'X' WHERE shipment_id IN (42, 43);
UPDATE public.shipments SET carrier = '123456' WHERE shipment_id IN (44, 45);

-- ============================================================================
-- REFERENTIAL INTEGRITY ISSUES (soft violations)
-- ============================================================================

-- Orders with very high total amounts (outliers)
UPDATE public.orders SET total_amount = 9999999.99 WHERE order_id IN (100, 101, 102);

-- Zero total amounts (suspicious)
UPDATE public.orders SET total_amount = 0 WHERE order_id IN (105, 106, 107);

-- Negative total amounts (impossible)
UPDATE public.orders SET total_amount = -500.00 WHERE order_id IN (110, 111, 112);

-- ============================================================================
-- DATA QUALITY SUMMARY
-- ============================================================================

-- Summary of issues created
SELECT
  'NULL Emails (Customers)' as issue_type,
  COUNT(*) as count
FROM public.customers WHERE email IS NULL
UNION ALL
SELECT 'NULL Emails (Employees)', COUNT(*)
FROM public.employees WHERE email IS NULL
UNION ALL
SELECT 'Invalid Email Format', COUNT(*)
FROM public.customers WHERE email IS NOT NULL AND email NOT LIKE '%@%.%'
UNION ALL
SELECT 'Negative Quantities (Inventory)', COUNT(*)
FROM public.inventory WHERE quantity < 0
UNION ALL
SELECT 'Negative Quantities (Order Items)', COUNT(*)
FROM public.order_items WHERE quantity < 0
UNION ALL
SELECT 'Future Shipment Dates', COUNT(*)
FROM public.shipments WHERE shipped_date > CURRENT_DATE
UNION ALL
SELECT 'Duplicate Tracking Numbers',
  COUNT(*) - COUNT(DISTINCT tracking_number)
FROM public.shipments WHERE tracking_number IS NOT NULL
UNION ALL
SELECT 'Invalid Shipment Status', COUNT(*)
FROM public.shipments WHERE shipment_status NOT IN ('pending', 'shipped', 'delivered', 'cancelled')
UNION ALL
SELECT 'Negative Order Totals', COUNT(*)
FROM public.orders WHERE total_amount < 0
UNION ALL
SELECT 'Zero Order Totals', COUNT(*)
FROM public.orders WHERE total_amount = 0
UNION ALL
SELECT 'Old Last Restock Dates', COUNT(*)
FROM public.inventory WHERE last_restock_date < '2000-01-01'
ORDER BY issue_type;

-- Analyze tables after updates
VACUUM ANALYZE public.customers;
VACUUM ANALYZE public.customer_addresses;
VACUUM ANALYZE public.employees;
VACUUM ANALYZE public.orders;
VACUUM ANALYZE public.order_items;
VACUUM ANALYZE public.inventory;
VACUUM ANALYZE public.shipments;
VACUUM ANALYZE public.products;

\echo 'Bad quality data has been inserted successfully!'
\echo 'You can now test the quality engine with various data quality issues.'
