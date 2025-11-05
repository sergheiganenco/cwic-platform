-- ===================================================================
-- AdventureWorks Sample Data Population Script
-- Realistic data for testing lineage, quality, and catalog features
-- ===================================================================

-- 1. Countries (20 records)
INSERT INTO countries (country_code, country_name, region, currency_code) VALUES
('USA', 'United States', 'North America', 'USD'),
('CAN', 'Canada', 'North America', 'CAD'),
('MEX', 'Mexico', 'North America', 'MXN'),
('GBR', 'United Kingdom', 'Europe', 'GBP'),
('DEU', 'Germany', 'Europe', 'EUR'),
('FRA', 'France', 'Europe', 'EUR'),
('ITA', 'Italy', 'Europe', 'EUR'),
('ESP', 'Spain', 'Europe', 'EUR'),
('JPN', 'Japan', 'Asia', 'JPY'),
('CHN', 'China', 'Asia', 'CNY'),
('IND', 'India', 'Asia', 'INR'),
('AUS', 'Australia', 'Oceania', 'AUD'),
('BRA', 'Brazil', 'South America', 'BRL'),
('ARG', 'Argentina', 'South America', 'ARS'),
('ZAF', 'South Africa', 'Africa', 'ZAR'),
('NLD', 'Netherlands', 'Europe', 'EUR'),
('SWE', 'Sweden', 'Europe', 'SEK'),
('NOR', 'Norway', 'Europe', 'NOK'),
('SGP', 'Singapore', 'Asia', 'SGD'),
('KOR', 'South Korea', 'Asia', 'KRW');

-- 2. Departments (8 records)
INSERT INTO departments (department_name, description, manager_name, budget) VALUES
('Sales', 'Sales and customer acquisition', 'Sarah Johnson', 5000000.00),
('Marketing', 'Marketing and brand management', 'Michael Chen', 2500000.00),
('Engineering', 'Product development and engineering', 'David Rodriguez', 8000000.00),
('Customer Service', 'Customer support and satisfaction', 'Emily Thompson', 1500000.00),
('Finance', 'Financial planning and accounting', 'Robert Williams', 1000000.00),
('Human Resources', 'Employee management and recruiting', 'Jennifer Davis', 800000.00),
('Operations', 'Supply chain and logistics', 'James Martinez', 3000000.00),
('IT', 'Information technology and systems', 'Lisa Anderson', 4000000.00);

-- 3. Product Categories (15 records with hierarchy)
INSERT INTO product_categories (category_id, category_name, parent_category_id, description, active) VALUES
(1, 'Electronics', NULL, 'Electronic devices and accessories', true),
(2, 'Computers', 1, 'Desktop and laptop computers', true),
(3, 'Mobile Devices', 1, 'Smartphones and tablets', true),
(4, 'Home Appliances', NULL, 'Household appliances', true),
(5, 'Kitchen', 4, 'Kitchen appliances and tools', true),
(6, 'Clothing', NULL, 'Apparel and accessories', true),
(7, 'Men''s Clothing', 6, 'Clothing for men', true),
(8, 'Women''s Clothing', 6, 'Clothing for women', true),
(9, 'Sports & Outdoors', NULL, 'Sports equipment and outdoor gear', true),
(10, 'Fitness', 9, 'Fitness equipment and accessories', true),
(11, 'Books', NULL, 'Books and publications', true),
(12, 'Toys & Games', NULL, 'Toys and gaming products', true),
(13, 'Automotive', NULL, 'Automotive parts and accessories', true),
(14, 'Beauty & Personal Care', NULL, 'Beauty and personal care products', true),
(15, 'Furniture', NULL, 'Home and office furniture', true);

-- 4. Suppliers (12 records)
INSERT INTO suppliers (company_name, contact_name, email, phone, address, rating, active) VALUES
('TechSupply Inc', 'John Smith', 'john@techsupply.com', '+1-555-0101', '123 Tech St, San Francisco, CA', 4.5, true),
('Global Electronics', 'Maria Garcia', 'maria@globalelec.com', '+1-555-0102', '456 Innovation Blvd, Austin, TX', 4.8, true),
('HomeGoods Ltd', 'Peter Jones', 'peter@homegoods.com', '+1-555-0103', '789 Commerce Ave, Chicago, IL', 4.2, true),
('Fashion Wholesale', 'Anna Lee', 'anna@fashionwholesale.com', '+1-555-0104', '321 Fashion St, New York, NY', 4.6, true),
('Sports Direct', 'Tom Wilson', 'tom@sportsdirect.com', '+1-555-0105', '654 Athletic Way, Denver, CO', 4.4, true),
('Book Distributors', 'Linda Brown', 'linda@bookdist.com', '+1-555-0106', '987 Library Rd, Boston, MA', 4.7, true),
('Toy Manufacturers', 'Kevin White', 'kevin@toymfg.com', '+1-555-0107', '147 Play St, Los Angeles, CA', 4.3, true),
('Auto Parts Plus', 'Susan Clark', 'susan@autoparts.com', '+1-555-0108', '258 Motor Pkwy, Detroit, MI', 4.5, true),
('Beauty Supplies Co', 'Rachel Green', 'rachel@beautysup.com', '+1-555-0109', '369 Cosmetic Ave, Miami, FL', 4.9, true),
('Furniture World', 'Chris Taylor', 'chris@furnitureworld.com', '+1-555-0110', '741 Home Blvd, Seattle, WA', 4.1, true),
('Kitchen Essentials', 'David Miller', 'david@kitcheness.com', '+1-555-0111', '852 Cook St, Portland, OR', 4.6, true),
('Mobile Tech Supply', 'Emma Davis', 'emma@mobiletech.com', '+1-555-0112', '963 Phone Ave, San Jose, CA', 4.8, true);

-- 5. Warehouses (5 records)
INSERT INTO warehouses (warehouse_name, location, capacity, manager_name, active) VALUES
('West Coast DC', 'Los Angeles, CA', 50000, 'Mike Johnson', true),
('East Coast DC', 'New York, NY', 45000, 'Sarah Williams', true),
('Central DC', 'Chicago, IL', 60000, 'Tom Anderson', true),
('South DC', 'Atlanta, GA', 40000, 'Lisa Martinez', true),
('Northwest DC', 'Seattle, WA', 35000, 'John Davis', true);

-- 6. Payment Methods (6 records)
INSERT INTO payment_methods (method_name, description, active, processing_fee_pct) VALUES
('Credit Card', 'Visa, Mastercard, Amex', true, 2.5),
('Debit Card', 'Bank debit cards', true, 1.5),
('PayPal', 'PayPal payment gateway', true, 2.9),
('Bank Transfer', 'Direct bank transfer', true, 0.5),
('Cash on Delivery', 'Pay when you receive', true, 0.0),
('Cryptocurrency', 'Bitcoin and Ethereum', true, 1.0);

-- 7. Sales Territories (10 records)
INSERT INTO sales_territories (territory_name, country_id, region, sales_quota) VALUES
('US West', 1, 'California, Oregon, Washington', 5000000.00),
('US East', 1, 'New York, Massachusetts, Pennsylvania', 4500000.00),
('US South', 1, 'Texas, Florida, Georgia', 4000000.00),
('US Midwest', 1, 'Illinois, Michigan, Ohio', 3500000.00),
('Canada', 2, 'All provinces', 2000000.00),
('UK & Ireland', 4, 'United Kingdom', 3000000.00),
('Western Europe', 5, 'Germany, France, Netherlands', 3500000.00),
('Asia Pacific', 9, 'Japan, Singapore, Australia', 4000000.00),
('Latin America', 13, 'Brazil, Argentina, Mexico', 2500000.00),
('Rest of World', 15, 'Other countries', 1500000.00);

-- 8. Employees (25 records)
INSERT INTO employees (first_name, last_name, email, phone, hire_date, department_id, job_title, salary, manager_id, active) VALUES
('Sarah', 'Johnson', 'sarah.johnson@adventureworks.com', '555-1001', '2018-01-15', 1, 'VP of Sales', 150000.00, NULL, true),
('Michael', 'Chen', 'michael.chen@adventureworks.com', '555-1002', '2018-03-20', 2, 'VP of Marketing', 140000.00, NULL, true),
('David', 'Rodriguez', 'david.rodriguez@adventureworks.com', '555-1003', '2017-06-10', 3, 'VP of Engineering', 180000.00, NULL, true),
('Emily', 'Thompson', 'emily.thompson@adventureworks.com', '555-1004', '2019-02-01', 4, 'Director of Customer Service', 110000.00, NULL, true),
('Robert', 'Williams', 'robert.williams@adventureworks.com', '555-1005', '2017-08-15', 5, 'CFO', 200000.00, NULL, true),
('Jennifer', 'Davis', 'jennifer.davis@adventureworks.com', '555-1006', '2018-11-01', 6, 'VP of HR', 130000.00, NULL, true),
('James', 'Martinez', 'james.martinez@adventureworks.com', '555-1007', '2019-04-12', 7, 'VP of Operations', 145000.00, NULL, true),
('Lisa', 'Anderson', 'lisa.anderson@adventureworks.com', '555-1008', '2018-07-20', 8, 'CTO', 190000.00, NULL, true),
('Tom', 'Wilson', 'tom.wilson@adventureworks.com', '555-1009', '2019-09-05', 1, 'Senior Sales Manager', 95000.00, 1, true),
('Anna', 'Lee', 'anna.lee@adventureworks.com', '555-1010', '2020-01-15', 1, 'Sales Representative', 65000.00, 9, true),
('Peter', 'Brown', 'peter.brown@adventureworks.com', '555-1011', '2020-03-20', 1, 'Sales Representative', 62000.00, 9, true),
('Linda', 'White', 'linda.white@adventureworks.com', '555-1012', '2019-11-10', 2, 'Marketing Manager', 85000.00, 2, true),
('Kevin', 'Clark', 'kevin.clark@adventureworks.com', '555-1013', '2020-05-01', 2, 'Marketing Specialist', 58000.00, 12, true),
('Susan', 'Taylor', 'susan.taylor@adventureworks.com', '555-1014', '2019-07-15', 3, 'Senior Engineer', 120000.00, 3, true),
('Rachel', 'Green', 'rachel.green@adventureworks.com', '555-1015', '2020-02-20', 3, 'Software Engineer', 95000.00, 14, true),
('Chris', 'Miller', 'chris.miller@adventureworks.com', '555-1016', '2020-06-10', 3, 'Software Engineer', 92000.00, 14, true),
('Emma', 'Garcia', 'emma.garcia@adventureworks.com', '555-1017', '2019-12-01', 4, 'Customer Service Manager', 75000.00, 4, true),
('John', 'Lopez', 'john.lopez@adventureworks.com', '555-1018', '2020-08-15', 4, 'Customer Service Rep', 45000.00, 17, true),
('Maria', 'Gonzalez', 'maria.gonzalez@adventureworks.com', '555-1019', '2020-09-20', 4, 'Customer Service Rep', 43000.00, 17, true),
('Daniel', 'Moore', 'daniel.moore@adventureworks.com', '555-1020', '2019-10-05', 5, 'Senior Accountant', 85000.00, 5, true),
('Jessica', 'Jackson', 'jessica.jackson@adventureworks.com', '555-1021', '2020-04-12', 6, 'HR Manager', 78000.00, 6, true),
('Brian', 'Martin', 'brian.martin@adventureworks.com', '555-1022', '2019-08-20', 7, 'Operations Manager', 88000.00, 7, true),
('Nicole', 'Lee', 'nicole.lee@adventureworks.com', '555-1023', '2020-07-01', 7, 'Logistics Coordinator', 55000.00, 22, true),
('Andrew', 'Walker', 'andrew.walker@adventureworks.com', '555-1024', '2019-05-15', 8, 'IT Manager', 105000.00, 8, true),
('Michelle', 'Hall', 'michelle.hall@adventureworks.com', '555-1025', '2020-10-01', 8, 'Systems Administrator', 72000.00, 24, true);

-- 9. Customers (50 records)
INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active) VALUES
('Alice', 'Anderson', 'alice.anderson@email.com', '555-2001', '1985-03-15', '2020-01-10', 2500, 5000.00, true),
('Bob', 'Baker', 'bob.baker@email.com', '555-2002', '1990-07-22', '2020-02-15', 1800, 3000.00, true),
('Carol', 'Carter', 'carol.carter@email.com', '555-2003', '1988-11-30', '2020-03-20', 3200, 7000.00, true),
('David', 'Davis', 'david.davis@email.com', '555-2004', '1992-05-18', '2020-04-05', 1500, 4000.00, true),
('Eva', 'Evans', 'eva.evans@email.com', '555-2005', '1987-09-12', '2020-05-12', 2900, 6000.00, true),
('Frank', 'Fisher', 'frank.fisher@email.com', '555-2006', '1991-02-28', '2020-06-18', 2100, 5500.00, true),
('Grace', 'Garcia', 'grace.garcia@email.com', '555-2007', '1989-08-07', '2020-07-22', 3500, 8000.00, true),
('Henry', 'Harris', 'henry.harris@email.com', '555-2008', '1993-12-14', '2020-08-30', 1200, 3500.00, true),
('Ivy', 'Jackson', 'ivy.jackson@email.com', '555-2009', '1986-04-25', '2020-09-10', 2700, 6500.00, true),
('Jack', 'Johnson', 'jack.johnson@email.com', '555-2010', '1994-10-03', '2020-10-15', 1900, 4500.00, true),
('Kate', 'King', 'kate.king@email.com', '555-2011', '1990-06-19', '2020-11-20', 2300, 5000.00, true),
('Leo', 'Lopez', 'leo.lopez@email.com', '555-2012', '1988-01-08', '2020-12-05', 3100, 7500.00, true),
('Mary', 'Martin', 'mary.martin@email.com', '555-2013', '1992-09-21', '2021-01-12', 2600, 6000.00, true),
('Nick', 'Nelson', 'nick.nelson@email.com', '555-2014', '1987-03-30', '2021-02-18', 1700, 4000.00, true),
('Olivia', 'Owen', 'olivia.owen@email.com', '555-2015', '1991-11-16', '2021-03-25', 2800, 6500.00, true),
('Paul', 'Parker', 'paul.parker@email.com', '555-2016', '1989-07-04', '2021-04-08', 2000, 5000.00, true),
('Quinn', 'Quinn', 'quinn.quinn@email.com', '555-2017', '1993-02-14', '2021-05-14', 1600, 3500.00, true),
('Rose', 'Roberts', 'rose.roberts@email.com', '555-2018', '1986-08-22', '2021-06-20', 3300, 7000.00, true),
('Sam', 'Smith', 'sam.smith@email.com', '555-2019', '1994-12-09', '2021-07-05', 1400, 4000.00, true),
('Tina', 'Taylor', 'tina.taylor@email.com', '555-2020', '1990-04-17', '2021-08-11', 2500, 5500.00, true),
('Uma', 'Turner', 'uma.turner@email.com', '555-2021', '1988-10-26', '2021-09-17', 2900, 6000.00, true),
('Victor', 'Walker', 'victor.walker@email.com', '555-2022', '1992-06-05', '2021-10-22', 2200, 5000.00, true),
('Wendy', 'White', 'wendy.white@email.com', '555-2023', '1987-01-13', '2021-11-28', 3000, 7500.00, true),
('Xavier', 'Young', 'xavier.young@email.com', '555-2024', '1991-09-01', '2021-12-10', 1800, 4500.00, true),
('Yara', 'Adams', 'yara.adams@email.com', '555-2025', '1989-05-20', '2022-01-15', 2400, 5500.00, true),
('Zack', 'Allen', 'zack.allen@email.com', '555-2026', '1993-11-08', '2022-02-20', 1500, 3000.00, true),
('Amy', 'Bell', 'amy.bell@email.com', '555-2027', '1986-03-27', '2022-03-25', 3400, 8000.00, true),
('Ben', 'Brooks', 'ben.brooks@email.com', '555-2028', '1994-07-15', '2022-04-30', 1300, 3500.00, true),
('Cara', 'Campbell', 'cara.campbell@email.com', '555-2029', '1990-12-03', '2022-05-05', 2700, 6000.00, true),
('Dan', 'Cooper', 'dan.cooper@email.com', '555-2030', '1988-08-11', '2022-06-10', 2100, 5000.00, true),
('Elle', 'Cox', 'elle.cox@email.com', '555-2031', '1992-04-19', '2022-07-15', 2800, 6500.00, true),
('Fred', 'Foster', 'fred.foster@email.com', '555-2032', '1987-10-28', '2022-08-20', 1900, 4500.00, true),
('Gina', 'Gray', 'gina.gray@email.com', '555-2033', '1991-06-06', '2022-09-25', 2300, 5500.00, true),
('Hugo', 'Hayes', 'hugo.hayes@email.com', '555-2034', '1989-02-14', '2022-10-30', 3100, 7000.00, true),
('Iris', 'Hill', 'iris.hill@email.com', '555-2035', '1993-08-22', '2022-11-05', 1600, 4000.00, true),
('Joel', 'Howard', 'joel.howard@email.com', '555-2036', '1986-12-10', '2022-12-10', 2600, 6000.00, true),
('Kim', 'James', 'kim.james@email.com', '555-2037', '1994-05-28', '2023-01-15', 1400, 3500.00, true),
('Luke', 'Kelly', 'luke.kelly@email.com', '555-2038', '1990-11-16', '2023-02-20', 2500, 5500.00, true),
('Mia', 'Long', 'mia.long@email.com', '555-2039', '1988-07-04', '2023-03-25', 2900, 6500.00, true),
('Noah', 'Moore', 'noah.moore@email.com', '555-2040', '1992-03-12', '2023-04-30', 2000, 5000.00, true),
('Opal', 'Morris', 'opal.morris@email.com', '555-2041', '1987-09-20', '2023-05-05', 3200, 7500.00, true),
('Pete', 'Murphy', 'pete.murphy@email.com', '555-2042', '1991-05-08', '2023-06-10', 1700, 4000.00, true),
('Rita', 'Perry', 'rita.perry@email.com', '555-2043', '1989-01-16', '2023-07-15', 2800, 6000.00, true),
('Stan', 'Powell', 'stan.powell@email.com', '555-2044', '1993-07-24', '2023-08-20', 1500, 3500.00, true),
('Tara', 'Reed', 'tara.reed@email.com', '555-2045', '1986-11-02', '2023-09-25', 3300, 7000.00, true),
('Uri', 'Ross', 'uri.ross@email.com', '555-2046', '1994-04-10', '2023-10-30', 1200, 3000.00, true),
('Vera', 'Russell', 'vera.russell@email.com', '555-2047', '1990-08-18', '2023-11-05', 2400, 5500.00, true),
('Will', 'Scott', 'will.scott@email.com', '555-2048', '1988-02-26', '2023-12-10', 2700, 6000.00, true),
('Xena', 'Stewart', 'xena.stewart@email.com', '555-2049', '1992-10-14', '2024-01-15', 1900, 4500.00, true),
('York', 'Torres', 'york.torres@email.com', '555-2050', '1987-06-22', '2024-02-20', 2200, 5000.00, true);

-- 10. Customer Addresses (75 records - some customers have multiple addresses)
INSERT INTO customer_addresses (customer_id, address_type, street_address, city, state_province, postal_code, country_id, is_default) VALUES
(1, 'billing', '123 Main St', 'New York', 'NY', '10001', 1, true),
(1, 'shipping', '456 Oak Ave', 'Brooklyn', 'NY', '11201', 1, false),
(2, 'billing', '789 Elm St', 'Los Angeles', 'CA', '90001', 1, true),
(3, 'billing', '321 Pine Rd', 'Chicago', 'IL', '60601', 1, true),
(4, 'billing', '654 Maple Dr', 'Houston', 'TX', '77001', 1, true),
(5, 'billing', '987 Cedar Ln', 'Phoenix', 'AZ', '85001', 1, true),
(6, 'billing', '147 Birch Way', 'Philadelphia', 'PA', '19019', 1, true),
(7, 'billing', '258 Spruce St', 'San Antonio', 'TX', '78201', 1, true),
(8, 'billing', '369 Willow Ct', 'San Diego', 'CA', '92101', 1, true),
(9, 'billing', '741 Ash Blvd', 'Dallas', 'TX', '75201', 1, true),
(10, 'billing', '852 Cherry Ave', 'San Jose', 'CA', '95101', 1, true),
(11, 'billing', '963 Walnut St', 'Austin', 'TX', '78701', 1, true),
(12, 'billing', '159 Hickory Dr', 'Jacksonville', 'FL', '32099', 1, true),
(13, 'billing', '357 Poplar Ln', 'Fort Worth', 'TX', '76101', 1, true),
(14, 'billing', '486 Sycamore Rd', 'Columbus', 'OH', '43004', 1, true),
(15, 'billing', '624 Magnolia Way', 'Charlotte', 'NC', '28201', 1, true),
(16, 'billing', '792 Dogwood Ct', 'Indianapolis', 'IN', '46201', 1, true),
(17, 'billing', '813 Redwood Blvd', 'San Francisco', 'CA', '94102', 1, true),
(18, 'billing', '924 Palm Ave', 'Seattle', 'WA', '98101', 1, true),
(19, 'billing', '135 Cypress St', 'Denver', 'CO', '80201', 1, true),
(20, 'billing', '246 Fir Dr', 'Washington', 'DC', '20001', 1, true),
(21, 'billing', '357 Juniper Ln', 'Boston', 'MA', '02101', 1, true),
(22, 'billing', '468 Acacia Rd', 'Nashville', 'TN', '37201', 1, true),
(23, 'billing', '579 Cottonwood Way', 'Baltimore', 'MD', '21201', 1, true),
(24, 'billing', '680 Beech Ct', 'Detroit', 'MI', '48201', 1, true),
(25, 'billing', '791 Linden Blvd', 'Portland', 'OR', '97201', 1, true),
(26, 'billing', '802 Chestnut Ave', 'Las Vegas', 'NV', '89101', 1, true),
(27, 'billing', '913 Pecan St', 'Milwaukee', 'WI', '53201', 1, true),
(28, 'billing', '124 Walnut Dr', 'Albuquerque', 'NM', '87101', 1, true),
(29, 'billing', '235 Oak Ln', 'Tucson', 'AZ', '85701', 1, true),
(30, 'billing', '346 Pine Rd', 'Fresno', 'CA', '93650', 1, true),
(31, 'billing', '457 Maple Way', 'Sacramento', 'CA', '94203', 1, true),
(32, 'billing', '568 Cedar Ct', 'Long Beach', 'CA', '90801', 1, true),
(33, 'billing', '679 Birch Blvd', 'Kansas City', 'MO', '64101', 1, true),
(34, 'billing', '780 Spruce Ave', 'Mesa', 'AZ', '85201', 1, true),
(35, 'billing', '891 Willow St', 'Atlanta', 'GA', '30301', 1, true),
(36, 'billing', '902 Ash Dr', 'Virginia Beach', 'VA', '23450', 1, true),
(37, 'billing', '113 Cherry Ln', 'Omaha', 'NE', '68101', 1, true),
(38, 'billing', '224 Walnut Rd', 'Colorado Springs', 'CO', '80901', 1, true),
(39, 'billing', '335 Hickory Way', 'Raleigh', 'NC', '27601', 1, true),
(40, 'billing', '446 Poplar Ct', 'Miami', 'FL', '33101', 1, true),
(41, 'billing', '557 Sycamore Blvd', 'Oakland', 'CA', '94601', 1, true),
(42, 'billing', '668 Magnolia Ave', 'Minneapolis', 'MN', '55401', 1, true),
(43, 'billing', '779 Dogwood St', 'Tulsa', 'OK', '74101', 1, true),
(44, 'billing', '880 Redwood Dr', 'Cleveland', 'OH', '44101', 1, true),
(45, 'billing', '991 Palm Ln', 'Wichita', 'KS', '67201', 1, true),
(46, 'billing', '102 Cypress Rd', 'Arlington', 'TX', '76010', 1, true),
(47, 'billing', '213 Fir Way', 'New Orleans', 'LA', '70112', 1, true),
(48, 'billing', '324 Juniper Ct', 'Bakersfield', 'CA', '93301', 1, true),
(49, 'billing', '435 Acacia Blvd', 'Tampa', 'FL', '33601', 1, true),
(50, 'billing', '546 Cottonwood Ave', 'Anaheim', 'CA', '92801', 1, true);

-- 11. Products (80 records)
INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, description, weight_kg) VALUES
-- Electronics - Computers
('UltraBook Pro 15"', 'COMP-001', 2, 1, 1299.99, 850.00, 45, 10, false, 'High-performance laptop with 16GB RAM', 1.8),
('Gaming Desktop X5000', 'COMP-002', 2, 1, 1899.99, 1300.00, 23, 5, false, 'Gaming PC with RTX 4080', 8.5),
('Wireless Keyboard', 'COMP-003', 2, 1, 79.99, 35.00, 120, 20, false, 'Mechanical wireless keyboard', 0.8),
('Laser Mouse Pro', 'COMP-004', 2, 1, 49.99, 20.00, 200, 30, false, 'Ergonomic gaming mouse', 0.15),
-- Electronics - Mobile
('Smartphone Elite', 'MOB-001', 3, 2, 899.99, 550.00, 80, 15, false, 'Latest flagship smartphone 256GB', 0.2),
('Tablet Pro 12"', 'MOB-002', 3, 12, 649.99, 400.00, 50, 10, false, '12-inch tablet with pen support', 0.5),
('Wireless Earbuds', 'MOB-003', 3, 2, 149.99, 75.00, 150, 25, false, 'Noise-canceling wireless earbuds', 0.05),
('Phone Case Premium', 'MOB-004', 3, 12, 29.99, 8.00, 300, 50, false, 'Protective phone case', 0.1),
-- Home Appliances - Kitchen
('Coffee Maker Deluxe', 'KIT-001', 5, 3, 129.99, 65.00, 40, 10, false, 'Programmable coffee maker', 2.5),
('Blender Pro 2000', 'KIT-002', 5, 11, 89.99, 45.00, 60, 12, false, 'High-speed blender', 3.2),
('Air Fryer XL', 'KIT-003', 5, 3, 149.99, 80.00, 35, 8, false, '8-quart air fryer', 5.5),
('Stand Mixer', 'KIT-004', 5, 11, 279.99, 150.00, 25, 5, false, 'Professional stand mixer', 8.0),
-- Clothing - Men
('Men Cotton Shirt', 'CLO-M-001', 7, 4, 49.99, 20.00, 100, 20, false, 'Classic cotton shirt', 0.3),
('Men Jeans Blue', 'CLO-M-002', 7, 4, 79.99, 35.00, 80, 15, false, 'Slim fit jeans', 0.6),
('Men Leather Jacket', 'CLO-M-003', 7, 4, 249.99, 120.00, 30, 8, false, 'Genuine leather jacket', 1.5),
('Men Running Shoes', 'CLO-M-004', 7, 5, 119.99, 60.00, 65, 12, false, 'Athletic running shoes', 0.9),
-- Clothing - Women
('Women Summer Dress', 'CLO-W-001', 8, 4, 69.99, 30.00, 75, 15, false, 'Floral summer dress', 0.4),
('Women Yoga Pants', 'CLO-W-002', 8, 5, 59.99, 25.00, 90, 18, false, 'High-waist yoga pants', 0.3),
('Women Leather Boots', 'CLO-W-003', 8, 4, 189.99, 95.00, 40, 10, false, 'Ankle leather boots', 1.2),
('Women Handbag', 'CLO-W-004', 8, 4, 129.99, 60.00, 55, 12, false, 'Designer handbag', 0.8),
-- Sports & Fitness
('Yoga Mat Premium', 'SPT-001', 10, 5, 39.99, 15.00, 120, 20, false, 'Non-slip yoga mat', 1.5),
('Dumbbell Set 20kg', 'SPT-002', 10, 5, 89.99, 45.00, 45, 10, false, 'Adjustable dumbbell set', 20.0),
('Treadmill Pro', 'SPT-003', 10, 5, 899.99, 500.00, 15, 3, false, 'Electric treadmill', 75.0),
('Resistance Bands Set', 'SPT-004', 10, 5, 24.99, 10.00, 200, 30, false, 'Exercise resistance bands', 0.5),
-- Books
('Business Strategy 101', 'BOK-001', 11, 6, 24.99, 10.00, 150, 25, false, 'Business management book', 0.5),
('Cooking Mastery', 'BOK-002', 11, 6, 34.99, 15.00, 100, 20, false, 'Professional cooking guide', 0.8),
('Fitness Journey', 'BOK-003', 11, 6, 19.99, 8.00, 120, 20, false, 'Health and fitness guide', 0.4),
('Programming Python', 'BOK-004', 11, 6, 49.99, 22.00, 80, 15, false, 'Python programming textbook', 1.2),
-- Toys & Games
('Building Blocks Set', 'TOY-001', 12, 7, 39.99, 18.00, 100, 20, false, 'Educational building blocks', 2.0),
('Board Game Classic', 'TOY-002', 12, 7, 29.99, 12.00, 80, 15, false, 'Family board game', 1.5),
('Remote Control Car', 'TOY-003', 12, 7, 79.99, 40.00, 50, 10, false, 'RC racing car', 1.2),
('Puzzle 1000 Pieces', 'TOY-004', 12, 7, 24.99, 10.00, 70, 15, false, 'Jigsaw puzzle', 0.8),
-- Automotive
('Car Phone Mount', 'AUTO-001', 13, 8, 19.99, 8.00, 150, 25, false, 'Universal phone mount', 0.2),
('LED Headlight Kit', 'AUTO-002', 13, 8, 129.99, 65.00, 40, 8, false, 'LED headlight upgrade', 1.5),
('Floor Mats Set', 'AUTO-003', 13, 8, 49.99, 22.00, 60, 12, false, 'All-weather floor mats', 3.0),
('Dash Camera', 'AUTO-004', 13, 8, 89.99, 45.00, 35, 8, false, 'HD dash camera', 0.3),
-- Beauty & Personal Care
('Facial Cleanser', 'BEAUTY-001', 14, 9, 19.99, 8.00, 200, 30, false, 'Gentle facial cleanser', 0.15),
('Hair Dryer Pro', 'BEAUTY-002', 14, 9, 69.99, 35.00, 50, 10, false, 'Professional hair dryer', 0.8),
('Makeup Palette', 'BEAUTY-003', 14, 9, 44.99, 20.00, 75, 15, false, 'Eyeshadow palette', 0.2),
('Perfume Signature', 'BEAUTY-004', 14, 9, 89.99, 40.00, 60, 12, false, 'Designer perfume 100ml', 0.4),
-- Furniture
('Office Chair Ergonomic', 'FURN-001', 15, 10, 299.99, 150.00, 30, 8, false, 'Ergonomic office chair', 18.0),
('Standing Desk', 'FURN-002', 15, 10, 449.99, 250.00, 20, 5, false, 'Adjustable standing desk', 35.0),
('Bookshelf Modern', 'FURN-003', 15, 10, 189.99, 95.00, 25, 6, false, '5-tier bookshelf', 22.0),
('Coffee Table', 'FURN-004', 15, 10, 149.99, 75.00, 30, 7, false, 'Modern coffee table', 15.0);

-- Add 40 more products (keeping it shorter for brevity)
INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, weight_kg) VALUES
('Monitor 27" 4K', 'COMP-005', 2, 1, 399.99, 250.00, 35, 8, false, 6.5),
('USB-C Hub', 'COMP-006', 2, 1, 49.99, 22.00, 100, 20, false, 0.15),
('Webcam HD Pro', 'COMP-007', 2, 1, 79.99, 40.00, 60, 12, false, 0.3),
('Power Bank 20000mAh', 'MOB-005', 3, 12, 39.99, 18.00, 120, 20, false, 0.4),
('Screen Protector', 'MOB-006', 3, 12, 14.99, 5.00, 250, 40, false, 0.02),
('Microwave Oven', 'KIT-005', 5, 3, 199.99, 110.00, 28, 6, false, 18.0),
('Toaster 4-Slice', 'KIT-006', 5, 11, 49.99, 25.00, 45, 10, false, 2.5),
('Electric Kettle', 'KIT-007', 5, 11, 39.99, 18.00, 70, 15, false, 1.2),
('Men Polo Shirt', 'CLO-M-005', 7, 4, 39.99, 18.00, 90, 18, false, 0.25),
('Men Sneakers', 'CLO-M-006', 7, 5, 89.99, 45.00, 70, 14, false, 0.85),
('Women Blouse', 'CLO-W-005', 8, 4, 54.99, 25.00, 80, 16, false, 0.2),
('Women Sandals', 'CLO-W-006', 8, 4, 69.99, 32.00, 55, 11, false, 0.6),
('Exercise Bike', 'SPT-005', 10, 5, 399.99, 220.00, 12, 3, false, 45.0),
('Swimming Goggles', 'SPT-006', 10, 5, 24.99, 10.00, 100, 20, false, 0.1),
('Tennis Racket', 'SPT-007', 10, 5, 89.99, 45.00, 35, 8, false, 0.35),
('Photography Guide', 'BOK-005', 11, 6, 39.99, 18.00, 60, 12, false, 0.9),
('Mystery Novel', 'BOK-006', 11, 6, 16.99, 7.00, 150, 25, false, 0.3),
('Science Encyclopedia', 'BOK-007', 11, 6, 59.99, 28.00, 40, 8, false, 2.5),
('Action Figure Set', 'TOY-005', 12, 7, 34.99, 16.00, 70, 14, false, 0.5),
('Stuffed Animal', 'TOY-006', 12, 7, 19.99, 8.00, 100, 20, false, 0.3),
('Video Game Console', 'TOY-007', 12, 7, 499.99, 350.00, 20, 4, false, 4.5),
('Car Vacuum Cleaner', 'AUTO-005', 13, 8, 59.99, 30.00, 45, 10, false, 1.5),
('Tire Pressure Gauge', 'AUTO-006', 13, 8, 14.99, 6.00, 80, 15, false, 0.1),
('Jumper Cables', 'AUTO-007', 13, 8, 29.99, 14.00, 50, 10, false, 2.0),
('Moisturizer Cream', 'BEAUTY-005', 14, 9, 29.99, 12.00, 100, 20, false, 0.2),
('Lipstick Set', 'BEAUTY-006', 14, 9, 34.99, 15.00, 85, 17, false, 0.1),
('Nail Polish Kit', 'BEAUTY-007', 14, 9, 24.99, 10.00, 120, 24, false, 0.3),
('Dining Table', 'FURN-005', 15, 10, 599.99, 350.00, 10, 2, false, 55.0),
('Armchair Comfort', 'FURN-006', 15, 10, 349.99, 180.00, 18, 4, false, 25.0),
('Bed Frame Queen', 'FURN-007', 15, 10, 499.99, 280.00, 12, 3, false, 45.0),
('Laptop Backpack', 'COMP-008', 2, 1, 59.99, 28.00, 80, 16, false, 0.8),
('Smartwatch Fitness', 'MOB-007', 3, 2, 249.99, 140.00, 40, 8, false, 0.05),
('Portable Speaker', 'MOB-008', 3, 2, 69.99, 35.00, 60, 12, false, 0.5),
('Rice Cooker', 'KIT-008', 5, 11, 79.99, 40.00, 35, 7, false, 4.0),
('Food Processor', 'KIT-009', 5, 11, 129.99, 68.00, 25, 5, false, 5.5),
('Men Belt Leather', 'CLO-M-007', 7, 4, 39.99, 18.00, 75, 15, false, 0.3),
('Women Scarf', 'CLO-W-007', 8, 4, 29.99, 12.00, 90, 18, false, 0.15),
('Basketball Official', 'SPT-008', 10, 5, 29.99, 14.00, 50, 10, false, 0.6),
('Children Book Set', 'BOK-008', 11, 6, 44.99, 20.00, 55, 11, false, 1.5),
('Car Air Freshener', 'AUTO-008', 13, 8, 9.99, 3.50, 200, 40, false, 0.05);

-- 12. Promotions (5 records)
INSERT INTO promotions (promotion_name, discount_percentage, start_date, end_date, active) VALUES
('Summer Sale', 20.00, '2024-06-01', '2024-08-31', true),
('Black Friday', 30.00, '2024-11-24', '2024-11-29', true),
('New Year Special', 25.00, '2025-01-01', '2025-01-15', true),
('Spring Clearance', 15.00, '2024-03-15', '2024-04-30', true),
('Cyber Monday', 35.00, '2024-11-30', '2024-12-02', true);

-- 13. Orders (100 records - sample of recent orders)
INSERT INTO orders (customer_id, employee_id, order_date, required_date, shipped_date, territory_id, shipping_address_id, order_status, subtotal, tax_amount, shipping_cost, total_amount) VALUES
(1, 10, '2024-01-05 10:30:00', '2024-01-12', '2024-01-07', 2, 1, 'delivered', 450.00, 36.00, 15.00, 501.00),
(2, 10, '2024-01-06 14:15:00', '2024-01-13', '2024-01-08', 1, 3, 'delivered', 890.00, 71.20, 20.00, 981.20),
(3, 11, '2024-01-07 09:45:00', '2024-01-14', '2024-01-09', 3, 4, 'delivered', 1250.00, 100.00, 25.00, 1375.00),
(4, 10, '2024-01-08 11:20:00', '2024-01-15', '2024-01-10', 4, 5, 'delivered', 320.00, 25.60, 12.00, 357.60),
(5, 11, '2024-01-09 16:30:00', '2024-01-16', '2024-01-11', 1, 6, 'delivered', 675.00, 54.00, 18.00, 747.00),
(6, 10, '2024-01-10 10:00:00', '2024-01-17', '2024-01-12', 2, 7, 'delivered', 2100.00, 168.00, 30.00, 2298.00),
(7, 11, '2024-01-11 13:45:00', '2024-01-18', '2024-01-13', 3, 8, 'delivered', 540.00, 43.20, 15.00, 598.20),
(8, 10, '2024-01-12 15:20:00', '2024-01-19', '2024-01-14', 1, 9, 'delivered', 780.00, 62.40, 20.00, 862.40),
(9, 11, '2024-01-13 09:30:00', '2024-01-20', '2024-01-15', 2, 10, 'delivered', 1450.00, 116.00, 28.00, 1594.00),
(10, 10, '2024-01-14 11:45:00', '2024-01-21', NULL, 4, 11, 'shipped', 390.00, 31.20, 14.00, 435.20);

-- Add 90 more orders (abbreviated for space)
DO $$
DECLARE
    i INTEGER;
    cust_id INTEGER;
    emp_id INTEGER;
    terr_id INTEGER;
    order_total DECIMAL(12,2);
    order_stat VARCHAR(20);
BEGIN
    FOR i IN 11..100 LOOP
        cust_id := (i % 50) + 1;
        emp_id := ((i % 3) = 0)::int * 10 + 10;
        terr_id := (i % 10) + 1;
        order_total := 100.00 + (RANDOM() * 2000)::DECIMAL(12,2);

        IF i < 85 THEN
            order_stat := 'delivered';
        ELSIF i < 95 THEN
            order_stat := 'shipped';
        ELSE
            order_stat := 'processing';
        END IF;

        INSERT INTO orders (customer_id, employee_id, order_date, territory_id, order_status, subtotal, tax_amount, shipping_cost, total_amount)
        VALUES (
            cust_id,
            emp_id,
            CURRENT_DATE - (100 - i),
            terr_id,
            order_stat,
            order_total,
            order_total * 0.08,
            CASE WHEN order_total < 500 THEN 15.00 ELSE 25.00 END,
            order_total * 1.08 + CASE WHEN order_total < 500 THEN 15.00 ELSE 25.00 END
        );
    END LOOP;
END $$;

-- 14. Order Items (250+ records - multiple items per order)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, line_total) VALUES
(1, 1, 1, 1299.99, 0, 1299.99),
(1, 4, 2, 49.99, 5.00, 94.98),
(2, 5, 1, 899.99, 0, 899.99),
(2, 7, 1, 149.99, 0, 149.99),
(3, 23, 1, 899.99, 10.00, 809.99),
(3, 24, 2, 24.99, 0, 49.98),
(4, 9, 1, 129.99, 0, 129.99),
(4, 10, 1, 89.99, 0, 89.99),
(5, 13, 3, 49.99, 5.00, 142.47),
(5, 14, 2, 79.99, 5.00, 151.98);

-- Generate more order items
DO $$
DECLARE
    order_rec RECORD;
    num_items INTEGER;
    prod_id INTEGER;
    qty INTEGER;
    price DECIMAL(10,2);
BEGIN
    FOR order_rec IN SELECT order_id FROM orders WHERE order_id > 10 LOOP
        num_items := 1 + (RANDOM() * 4)::INTEGER;
        FOR i IN 1..num_items LOOP
            prod_id := 1 + (RANDOM() * 80)::INTEGER;
            qty := 1 + (RANDOM() * 3)::INTEGER;
            SELECT unit_price INTO price FROM products WHERE product_id = prod_id;

            INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, line_total)
            VALUES (order_rec.order_id, prod_id, qty, price, 0, price * qty);
        END LOOP;
    END LOOP;
END $$;

-- 15. Payments (100 records - one per order)
INSERT INTO payments (order_id, payment_method_id, amount, payment_status, transaction_id)
SELECT
    order_id,
    ((order_id % 6) + 1),
    total_amount,
    CASE
        WHEN order_status IN ('delivered', 'shipped') THEN 'completed'
        WHEN order_status = 'processing' THEN 'pending'
        ELSE 'failed'
    END,
    'TXN-' || LPAD(order_id::TEXT, 10, '0')
FROM orders;

-- 16. Inventory (400 records - products distributed across warehouses)
INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_point)
SELECT
    p.product_id,
    w.warehouse_id,
    (p.units_in_stock / 5) + (RANDOM() * 50)::INTEGER,
    p.reorder_level
FROM products p
CROSS JOIN warehouses w;

-- 17. Shipments (100 records)
INSERT INTO shipments (order_id, warehouse_id, carrier, tracking_number, shipped_date, estimated_delivery, actual_delivery, shipment_status)
SELECT
    o.order_id,
    ((o.order_id % 5) + 1),
    CASE (o.order_id % 4)
        WHEN 0 THEN 'FedEx'
        WHEN 1 THEN 'UPS'
        WHEN 2 THEN 'USPS'
        ELSE 'DHL'
    END,
    'TRACK-' || LPAD(o.order_id::TEXT, 12, '0'),
    o.shipped_date,
    o.required_date,
    CASE
        WHEN o.order_status = 'delivered' THEN o.shipped_date + INTERVAL '3 days'
        ELSE NULL
    END,
    CASE
        WHEN o.order_status = 'delivered' THEN 'delivered'
        WHEN o.order_status = 'shipped' THEN 'in_transit'
        WHEN o.order_status = 'processing' THEN 'preparing'
        ELSE 'pending'
    END
FROM orders o
WHERE o.shipped_date IS NOT NULL OR o.order_status IN ('processing', 'pending');

-- 18. Product Reviews (150 records)
DO $$
DECLARE
    i INTEGER;
    prod_id INTEGER;
    cust_id INTEGER;
    rating_val INTEGER;
BEGIN
    FOR i IN 1..150 LOOP
        prod_id := 1 + (RANDOM() * 80)::INTEGER;
        cust_id := 1 + (RANDOM() * 50)::INTEGER;
        rating_val := 3 + (RANDOM() * 3)::INTEGER; -- Ratings between 3-5

        INSERT INTO product_reviews (product_id, customer_id, rating, review_title, review_text, helpful_count, verified_purchase, review_date)
        VALUES (
            prod_id,
            cust_id,
            rating_val,
            'Great product!',
            'This product exceeded my expectations. Highly recommended.',
            (RANDOM() * 20)::INTEGER,
            true,
            CURRENT_DATE - (RANDOM() * 365)::INTEGER
        );
    END LOOP;
END $$;

-- 19. Employee Territories (25 records - assign sales employees to territories)
INSERT INTO employee_territories (employee_id, territory_id, assigned_date, active)
SELECT
    e.employee_id,
    ((e.employee_id % 10) + 1),
    e.hire_date,
    true
FROM employees e
WHERE e.department_id = 1; -- Sales department

-- 20. Audit Log (200 records)
DO $$
DECLARE
    i INTEGER;
    tables TEXT[] := ARRAY['orders', 'customers', 'products', 'inventory'];
    actions TEXT[] := ARRAY['INSERT', 'UPDATE', 'DELETE'];
BEGIN
    FOR i IN 1..200 LOOP
        INSERT INTO audit_log (table_name, record_id, action, employee_id, changed_data, change_date)
        VALUES (
            tables[1 + (RANDOM() * 3)::INTEGER],
            1 + (RANDOM() * 100)::INTEGER,
            actions[1 + (RANDOM() * 2)::INTEGER],
            1 + (RANDOM() * 25)::INTEGER,
            jsonb_build_object(
                'field', 'example_field',
                'old_value', 'old',
                'new_value', 'new'
            ),
            CURRENT_TIMESTAMP - (RANDOM() * INTERVAL '90 days')
        );
    END LOOP;
END $$;

-- Update sequences to max values
SELECT setval('countries_country_id_seq', (SELECT MAX(country_id) FROM countries));
SELECT setval('departments_department_id_seq', (SELECT MAX(department_id) FROM departments));
SELECT setval('product_categories_category_id_seq', (SELECT MAX(category_id) FROM product_categories));
SELECT setval('suppliers_supplier_id_seq', (SELECT MAX(supplier_id) FROM suppliers));
SELECT setval('warehouses_warehouse_id_seq', (SELECT MAX(warehouse_id) FROM warehouses));
SELECT setval('payment_methods_payment_method_id_seq', (SELECT MAX(payment_method_id) FROM payment_methods));
SELECT setval('sales_territories_territory_id_seq', (SELECT MAX(territory_id) FROM sales_territories));
SELECT setval('employees_employee_id_seq', (SELECT MAX(employee_id) FROM employees));
SELECT setval('customers_customer_id_seq', (SELECT MAX(customer_id) FROM customers));
SELECT setval('customer_addresses_address_id_seq', (SELECT MAX(address_id) FROM customer_addresses));
SELECT setval('products_product_id_seq', (SELECT MAX(product_id) FROM products));
SELECT setval('promotions_promotion_id_seq', (SELECT MAX(promotion_id) FROM promotions));
SELECT setval('orders_order_id_seq', (SELECT MAX(order_id) FROM orders));
SELECT setval('order_items_order_item_id_seq', (SELECT MAX(order_item_id) FROM order_items));
SELECT setval('payments_payment_id_seq', (SELECT MAX(payment_id) FROM payments));
SELECT setval('inventory_inventory_id_seq', (SELECT MAX(inventory_id) FROM inventory));
SELECT setval('shipments_shipment_id_seq', (SELECT MAX(shipment_id) FROM shipments));
SELECT setval('product_reviews_review_id_seq', (SELECT MAX(review_id) FROM product_reviews));
SELECT setval('audit_log_audit_id_seq', (SELECT MAX(audit_id) FROM audit_log));

-- Display summary
SELECT 'Data population completed!' as status;
SELECT
    'countries' as table_name, COUNT(*) as row_count FROM countries
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'product_categories', COUNT(*) FROM product_categories
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'warehouses', COUNT(*) FROM warehouses
UNION ALL SELECT 'payment_methods', COUNT(*) FROM payment_methods
UNION ALL SELECT 'sales_territories', COUNT(*) FROM sales_territories
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'customer_addresses', COUNT(*) FROM customer_addresses
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'promotions', COUNT(*) FROM promotions
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL SELECT 'product_reviews', COUNT(*) FROM product_reviews
UNION ALL SELECT 'employee_territories', COUNT(*) FROM employee_territories
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
ORDER BY table_name;
