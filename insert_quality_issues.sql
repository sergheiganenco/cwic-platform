-- Insert Bad Quality Data into AdventureWorks for Testing
-- This script adds various data quality issues to test the quality engine

\c adventureworks

-- ============================================================================
-- COMPLETENESS ISSUES (NULL/Missing Values)
-- ============================================================================

-- Add NULL emails to customers
UPDATE public.customers SET email = NULL WHERE customer_id IN (1, 5, 10, 15, 20, 25);

-- Add NULL phone numbers
UPDATE public.customers SET phone = NULL WHERE customer_id IN (3, 8, 13, 18, 23);

-- Add incomplete addresses (missing city or state)
UPDATE public.customer_addresses SET city = NULL WHERE address_id IN (2, 7, 12, 17);
UPDATE public.customer_addresses SET state_province = NULL WHERE address_id IN (4, 9, 14, 19);
UPDATE public.customer_addresses SET postal_code = NULL WHERE address_id IN (6, 11, 16, 21);

-- ============================================================================
-- ACCURACY ISSUES (Invalid/Incorrect Data)
-- ============================================================================

-- Invalid email formats
UPDATE public.customers SET email = 'notanemail' WHERE customer_id = 30;
UPDATE public.customers SET email = 'invalid@' WHERE customer_id = 31;
UPDATE public.customers SET email = '@nodomain.com' WHERE customer_id = 32;
UPDATE public.customers SET email = 'spaces in email@test.com' WHERE customer_id = 33;

-- Invalid phone numbers
UPDATE public.customers SET phone = '123' WHERE customer_id = 35;
UPDATE public.customers SET phone = 'abc-def-ghij' WHERE customer_id = 36;
UPDATE public.customers SET phone = '000-000-0000' WHERE customer_id = 37;

-- Invalid postal codes
UPDATE public.customer_addresses SET postal_code = '00000' WHERE address_id = 25;
UPDATE public.customer_addresses SET postal_code = 'INVALID' WHERE address_id = 26;
UPDATE public.customer_addresses SET postal_code = '123' WHERE address_id = 27;

-- ============================================================================
-- CONSISTENCY ISSUES (Data Mismatches)
-- ============================================================================

-- Negative prices
UPDATE public.inventory SET unit_price = -10.50 WHERE product_id IN (5, 15, 25);
UPDATE public.order_items SET unit_price = -5.00 WHERE order_item_id IN (10, 20, 30);

-- Negative quantities
UPDATE public.inventory SET quantity_on_hand = -50 WHERE product_id IN (8, 18, 28);
UPDATE public.order_items SET quantity = -2 WHERE order_item_id IN (15, 25, 35);

-- Future dates for historical data
UPDATE public.orders SET order_date = '2030-01-01' WHERE order_id IN (5, 10, 15);
UPDATE public.shipments SET ship_date = '2035-06-15' WHERE shipment_id IN (3, 8, 13);

-- Ship dates before order dates
UPDATE public.shipments
SET ship_date = '2020-01-01'
WHERE shipment_id IN (5, 10, 15)
  AND EXISTS (SELECT 1 FROM public.orders WHERE orders.order_id = shipments.order_id AND orders.order_date > '2020-01-01');

-- ============================================================================
-- VALIDITY ISSUES (Out of Range/Invalid Values)
-- ============================================================================

-- Invalid status values
UPDATE public.orders SET status = 'INVALID_STATUS' WHERE order_id IN (7, 17, 27);
UPDATE public.shipments SET status = 'UNKNOWN' WHERE shipment_id IN (4, 9, 14);

-- Extremely high prices (outliers)
UPDATE public.inventory SET unit_price = 999999.99 WHERE product_id IN (12, 22, 32);

-- Zero or negative employee IDs (referential integrity issues)
UPDATE public.orders SET employee_id = 0 WHERE order_id IN (12, 22, 32);
UPDATE public.orders SET employee_id = -1 WHERE order_id IN (13, 23, 33);

-- ============================================================================
-- UNIQUENESS ISSUES (Duplicates)
-- ============================================================================

-- Duplicate customer emails
UPDATE public.customers SET email = 'duplicate@test.com' WHERE customer_id IN (40, 41, 42, 43);

-- Duplicate phone numbers
UPDATE public.customers SET phone = '555-1234' WHERE customer_id IN (45, 46, 47);

-- Duplicate order tracking numbers (if column exists)
-- UPDATE public.shipments SET tracking_number = 'TRACK12345' WHERE shipment_id IN (20, 21, 22);

-- ============================================================================
-- FRESHNESS ISSUES (Stale/Outdated Data)
-- ============================================================================

-- Very old last updated timestamps
UPDATE public.customers SET updated_at = '2000-01-01' WHERE customer_id IN (50, 51, 52);
UPDATE public.inventory SET updated_at = '1999-12-31' WHERE product_id IN (40, 41, 42);

-- ============================================================================
-- CROSS-TABLE CONSISTENCY ISSUES
-- ============================================================================

-- Order totals that don't match sum of order items
-- This requires calculating the actual total and making it wrong
UPDATE public.orders
SET total_amount = 999.99
WHERE order_id IN (25, 30, 35);

-- Inventory count mismatches
UPDATE public.inventory
SET quantity_on_hand = 0
WHERE product_id IN (50, 51, 52);

-- ============================================================================
-- DATA TYPE ISSUES (Stored as text but should be numbers)
-- ============================================================================

-- These would need to be inserted as new records if columns allow text
-- Skipping for now as schema enforces types

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Count issues by type
SELECT 'Completeness Issues' as issue_type, COUNT(*) as count
FROM public.customers WHERE email IS NULL OR phone IS NULL
UNION ALL
SELECT 'Invalid Emails', COUNT(*)
FROM public.customers WHERE email NOT LIKE '%_@_%.__%'
UNION ALL
SELECT 'Negative Prices', COUNT(*)
FROM public.inventory WHERE unit_price < 0
UNION ALL
SELECT 'Negative Quantities', COUNT(*)
FROM public.inventory WHERE quantity_on_hand < 0
UNION ALL
SELECT 'Future Dates', COUNT(*)
FROM public.orders WHERE order_date > CURRENT_DATE
UNION ALL
SELECT 'Duplicate Emails', COUNT(*) - COUNT(DISTINCT email)
FROM public.customers WHERE email IS NOT NULL
UNION ALL
SELECT 'Stale Data', COUNT(*)
FROM public.customers WHERE updated_at < '2010-01-01';

VACUUM ANALYZE public.customers;
VACUUM ANALYZE public.customer_addresses;
VACUUM ANALYZE public.orders;
VACUUM ANALYZE public.order_items;
VACUUM ANALYZE public.inventory;
VACUUM ANALYZE public.shipments;
