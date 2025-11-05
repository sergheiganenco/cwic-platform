-- Comprehensive Quality Test Data for AdventureWorks
-- This script adds various data quality issues to test all quality dimensions

\c adventureworks;

-- ============================================================================
-- COMPLETENESS ISSUES (NULL values, missing data)
-- ============================================================================

-- Add persons with missing first/last names
INSERT INTO person.person (businessentityid, persontype, namestyle, title, firstname, middlename, lastname, suffix, emailpromotion, rowguid, modifieddate)
VALUES
  (nextval('person.person_businessentityid_seq'::regclass), 'IN', false, NULL, NULL, 'M', 'Smith', NULL, 0, gen_random_uuid(), NOW()),
  (nextval('person.person_businessentityid_seq'::regclass), 'IN', false, NULL, 'John', NULL, NULL, NULL, 0, gen_random_uuid(), NOW()),
  (nextval('person.person_businessentityid_seq'::regclass), 'EM', false, NULL, NULL, NULL, 'Doe', NULL, 0, gen_random_uuid(), NOW());

-- Add email addresses with NULL values
INSERT INTO person.emailaddress (businessentityid, emailaddressid, emailaddress, rowguid, modifieddate)
SELECT businessentityid, 1, NULL, gen_random_uuid(), NOW()
FROM person.person
WHERE businessentityid IN (SELECT businessentityid FROM person.person ORDER BY businessentityid DESC LIMIT 5);

-- Add phone numbers with NULL area code or phone number
INSERT INTO person.personphone (businessentityid, phonenumber, phonenumbertypeid, modifieddate)
SELECT businessentityid, NULL, 1, NOW()
FROM person.person
WHERE businessentityid IN (SELECT businessentityid FROM person.person ORDER BY businessentityid DESC LIMIT 3);

-- ============================================================================
-- ACCURACY ISSUES (Incorrect data, out of range values)
-- ============================================================================

-- Add products with negative prices
UPDATE production.product
SET listprice = -99.99
WHERE productid IN (SELECT productid FROM production.product WHERE listprice > 0 ORDER BY productid LIMIT 5);

-- Add products with zero or negative weight
UPDATE production.product
SET weight = -10.5
WHERE productid IN (SELECT productid FROM production.product WHERE weight IS NOT NULL ORDER BY productid LIMIT 3);

-- Add sales orders with future order dates
UPDATE sales.salesorderheader
SET orderdate = NOW() + INTERVAL '30 days',
    duedate = NOW() + INTERVAL '60 days'
WHERE salesorderid IN (SELECT salesorderid FROM sales.salesorderheader ORDER BY salesorderid DESC LIMIT 5);

-- Add employees with birth dates in the future or too recent
UPDATE humanresources.employee
SET birthdate = '2020-01-01'
WHERE businessentityid IN (SELECT businessentityid FROM humanresources.employee ORDER BY businessentityid LIMIT 2);

-- Add employees with hire date before birth date
UPDATE humanresources.employee
SET hiredate = birthdate - INTERVAL '5 years'
WHERE businessentityid IN (SELECT businessentityid FROM humanresources.employee ORDER BY businessentityid DESC LIMIT 3);

-- ============================================================================
-- CONSISTENCY ISSUES (Data conflicts, mismatched references)
-- ============================================================================

-- Create inconsistent address data (city doesn't match state/province)
UPDATE person.address
SET city = 'New York'
WHERE stateprovinceid = (SELECT stateprovinceid FROM person.stateprovince WHERE stateprovincecode = 'CA' LIMIT 1)
  AND addressid IN (SELECT addressid FROM person.address ORDER BY addressid LIMIT 5);

-- Create inconsistent product subcategories
UPDATE production.product
SET productsubcategoryid = (SELECT productsubcategoryid FROM production.productsubcategory WHERE name = 'Road Bikes' LIMIT 1)
WHERE name LIKE '%Gloves%' AND productsubcategoryid IS NOT NULL
LIMIT 3;

-- ============================================================================
-- VALIDITY ISSUES (Invalid formats, constraint violations)
-- ============================================================================

-- Add invalid email addresses (if constraints allow)
UPDATE person.emailaddress
SET emailaddress = 'invalid-email-format'
WHERE emailaddressid IN (SELECT emailaddressid FROM person.emailaddress ORDER BY emailaddressid DESC LIMIT 5);

UPDATE person.emailaddress
SET emailaddress = 'no-at-sign.com'
WHERE emailaddressid IN (SELECT emailaddressid FROM person.emailaddress ORDER BY emailaddressid DESC LIMIT 5 OFFSET 5);

UPDATE person.emailaddress
SET emailaddress = '@nodomain.com'
WHERE emailaddressid IN (SELECT emailaddressid FROM person.emailaddress ORDER BY emailaddressid DESC LIMIT 5 OFFSET 10);

-- Add invalid phone numbers
UPDATE person.personphone
SET phonenumber = '123' -- Too short
WHERE businessentityid IN (SELECT businessentityid FROM person.personphone ORDER BY businessentityid LIMIT 5);

UPDATE person.personphone
SET phonenumber = 'ABC-DEFG-HIJK' -- Invalid format
WHERE businessentityid IN (SELECT businessentityid FROM person.personphone ORDER BY businessentityid LIMIT 5 OFFSET 5);

-- Add invalid postal codes
UPDATE person.address
SET postalcode = '1234' -- Too short for US zip
WHERE addressid IN (SELECT addressid FROM person.address ORDER BY addressid LIMIT 5);

UPDATE person.address
SET postalcode = 'ABCDEFGHIJ' -- Invalid format
WHERE addressid IN (SELECT addressid FROM person.address ORDER BY addressid LIMIT 5 OFFSET 5);

-- ============================================================================
-- UNIQUENESS ISSUES (Duplicates, non-unique values)
-- ============================================================================

-- Create duplicate email addresses
DO $$
DECLARE
  target_email TEXT;
  target_businessentityid INT;
BEGIN
  -- Get an existing email
  SELECT emailaddress, businessentityid INTO target_email, target_businessentityid
  FROM person.emailaddress
  WHERE emailaddress IS NOT NULL
  LIMIT 1;

  -- Create duplicates
  INSERT INTO person.emailaddress (businessentityid, emailaddressid, emailaddress, rowguid, modifieddate)
  SELECT
    businessentityid,
    COALESCE(MAX(emailaddressid), 0) + 1,
    target_email,
    gen_random_uuid(),
    NOW()
  FROM person.person
  WHERE businessentityid != target_businessentityid
    AND businessentityid IN (SELECT businessentityid FROM person.person ORDER BY businessentityid DESC LIMIT 5)
  GROUP BY businessentityid;
END $$;

-- Create duplicate product names
UPDATE production.product
SET name = (SELECT name FROM production.product WHERE name IS NOT NULL ORDER BY productid LIMIT 1)
WHERE productid IN (SELECT productid FROM production.product ORDER BY productid DESC LIMIT 3);

-- ============================================================================
-- FRESHNESS ISSUES (Stale data, old modification dates)
-- ============================================================================

-- Add products with very old modification dates
UPDATE production.product
SET modifieddate = '2000-01-01'
WHERE productid IN (SELECT productid FROM production.product ORDER BY productid LIMIT 10);

-- Add sales orders with old modification dates
UPDATE sales.salesorderheader
SET modifieddate = '2005-01-01'
WHERE salesorderid IN (SELECT salesorderid FROM sales.salesorderheader ORDER BY salesorderid DESC LIMIT 10);

-- Add employees with very old hire dates and no updates
UPDATE humanresources.employee
SET hiredate = '1990-01-01',
    modifieddate = '1990-01-02'
WHERE businessentityid IN (SELECT businessentityid FROM humanresources.employee ORDER BY businessentityid LIMIT 5);

-- ============================================================================
-- REFERENTIAL INTEGRITY ISSUES (Orphaned records)
-- ============================================================================

-- Note: We can't easily create orphaned records due to foreign key constraints
-- But we can create records that reference deleted or inactive entities

-- Add sales orders for discontinued products
INSERT INTO sales.salesorderdetail (salesorderid, salesorderdetailid, carriertrackingnumber, orderqty, productid, specialofferid, unitprice, unitpricediscount, rowguid, modifieddate)
SELECT
  soh.salesorderid,
  COALESCE(MAX(sod.salesorderdetailid), 0) + 1,
  NULL,
  1,
  (SELECT productid FROM production.product WHERE discontinueddate IS NOT NULL ORDER BY productid LIMIT 1),
  1,
  0.00,
  0.00,
  gen_random_uuid(),
  NOW()
FROM sales.salesorderheader soh
LEFT JOIN sales.salesorderdetail sod ON soh.salesorderid = sod.salesorderid
WHERE soh.salesorderid IN (SELECT salesorderid FROM sales.salesorderheader ORDER BY salesorderid DESC LIMIT 5)
GROUP BY soh.salesorderid;

-- ============================================================================
-- BUSINESS RULE VIOLATIONS
-- ============================================================================

-- Add sales with subtotal not matching line items
UPDATE sales.salesorderheader
SET subtotal = subtotal * 1.5 -- Incorrect subtotal
WHERE salesorderid IN (SELECT salesorderid FROM sales.salesorderheader ORDER BY salesorderid DESC LIMIT 5);

-- Add products with list price less than standard cost
UPDATE production.product
SET listprice = standardcost * 0.5 -- Selling below cost
WHERE standardcost > 0
  AND productid IN (SELECT productid FROM production.product WHERE standardcost > 0 ORDER BY productid LIMIT 5);

-- Add purchase orders with order qty less than min order qty
UPDATE purchasing.purchaseorderdetail
SET orderqty = 1
WHERE productid IN (
  SELECT productid
  FROM production.product
  WHERE reorderlevel > 1
)
LIMIT 10;

-- ============================================================================
-- DATA TYPE / RANGE ISSUES
-- ============================================================================

-- Add products with extreme values
UPDATE production.product
SET reorderpoint = 999999,
    safetystocklevel = 999999
WHERE productid IN (SELECT productid FROM production.product ORDER BY productid LIMIT 5);

-- Add sales orders with extreme quantities
UPDATE sales.salesorderdetail
SET orderqty = 999999
WHERE salesorderid IN (SELECT salesorderid FROM sales.salesorderdetail ORDER BY salesorderid DESC LIMIT 5);

-- ============================================================================
-- CROSS-TABLE CONSISTENCY ISSUES
-- ============================================================================

-- Create person-employee mismatches (person type doesn't match employee status)
UPDATE person.person
SET persontype = 'SC' -- Customer, but they're an employee
WHERE businessentityid IN (SELECT businessentityid FROM humanresources.employee LIMIT 3);

-- ============================================================================
-- Summary
-- ============================================================================

-- Count quality issues added
SELECT
  'Completeness Issues' as issue_type,
  (SELECT COUNT(*) FROM person.person WHERE firstname IS NULL OR lastname IS NULL) as count
UNION ALL
SELECT
  'Accuracy Issues (Negative Prices)',
  (SELECT COUNT(*) FROM production.product WHERE listprice < 0)
UNION ALL
SELECT
  'Validity Issues (Invalid Emails)',
  (SELECT COUNT(*) FROM person.emailaddress WHERE emailaddress NOT LIKE '%@%.%' AND emailaddress IS NOT NULL)
UNION ALL
SELECT
  'Uniqueness Issues (Duplicate Emails)',
  (SELECT COUNT(*) - COUNT(DISTINCT emailaddress) FROM person.emailaddress WHERE emailaddress IS NOT NULL)
UNION ALL
SELECT
  'Freshness Issues (Old Data)',
  (SELECT COUNT(*) FROM production.product WHERE modifieddate < '2010-01-01')
ORDER BY issue_type;

PRINT 'Quality test data has been added to AdventureWorks database!';
