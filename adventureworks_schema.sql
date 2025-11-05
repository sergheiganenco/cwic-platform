-- ===================================================================
-- AdventureWorks Test Database Schema for Data Lineage & Quality Testing
-- 20 Interconnected Tables with Foreign Keys
-- ===================================================================

-- Clean up existing tables if they exist
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS countries CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS sales_territories CASCADE;
DROP TABLE IF EXISTS employee_territories CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;

-- ===================================================================
-- DIMENSION TABLES (No Dependencies)
-- ===================================================================

-- 1. Countries (Reference data)
CREATE TABLE countries (
    country_id SERIAL PRIMARY KEY,
    country_code VARCHAR(3) NOT NULL UNIQUE,
    country_name VARCHAR(100) NOT NULL,
    region VARCHAR(50),
    currency_code VARCHAR(3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Departments
CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_name VARCHAR(100),
    budget DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Product Categories
CREATE TABLE product_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    parent_category_id INTEGER REFERENCES product_categories(category_id),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Suppliers
CREATE TABLE suppliers (
    supplier_id SERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    rating DECIMAL(3, 2),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Warehouses
CREATE TABLE warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    capacity INTEGER,
    manager_name VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Payment Methods
CREATE TABLE payment_methods (
    payment_method_id SERIAL PRIMARY KEY,
    method_name VARCHAR(50) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    processing_fee_pct DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Sales Territories
CREATE TABLE sales_territories (
    territory_id SERIAL PRIMARY KEY,
    territory_name VARCHAR(100) NOT NULL,
    country_id INTEGER REFERENCES countries(country_id),
    region VARCHAR(50),
    sales_quota DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================================================================
-- ENTITY TABLES (First Level Dependencies)
-- ===================================================================

-- 8. Employees
CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    hire_date DATE NOT NULL,
    department_id INTEGER REFERENCES departments(department_id),
    job_title VARCHAR(100),
    salary DECIMAL(12, 2),
    manager_id INTEGER REFERENCES employees(employee_id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Customers
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    customer_since DATE DEFAULT CURRENT_DATE,
    loyalty_points INTEGER DEFAULT 0,
    credit_limit DECIMAL(10, 2),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Customer Addresses
CREATE TABLE customer_addresses (
    address_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    address_type VARCHAR(20), -- 'billing', 'shipping'
    street_address VARCHAR(200),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country_id INTEGER REFERENCES countries(country_id),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Products
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    category_id INTEGER REFERENCES product_categories(category_id),
    supplier_id INTEGER REFERENCES suppliers(supplier_id),
    unit_price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2),
    units_in_stock INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    discontinued BOOLEAN DEFAULT false,
    description TEXT,
    weight_kg DECIMAL(8, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Promotions
CREATE TABLE promotions (
    promotion_id SERIAL PRIMARY KEY,
    promotion_name VARCHAR(100) NOT NULL,
    discount_percentage DECIMAL(5, 2),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================================================================
-- TRANSACTION TABLES (Second Level Dependencies)
-- ===================================================================

-- 13. Orders
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    employee_id INTEGER REFERENCES employees(employee_id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    required_date DATE,
    shipped_date DATE,
    territory_id INTEGER REFERENCES sales_territories(territory_id),
    shipping_address_id INTEGER REFERENCES customer_addresses(address_id),
    order_status VARCHAR(20), -- 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
    subtotal DECIMAL(12, 2),
    tax_amount DECIMAL(10, 2),
    shipping_cost DECIMAL(8, 2),
    total_amount DECIMAL(12, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Order Items
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(5, 2) DEFAULT 0,
    line_total DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Payments
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    payment_method_id INTEGER REFERENCES payment_methods(payment_method_id),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(20), -- 'pending', 'completed', 'failed', 'refunded'
    transaction_id VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Inventory
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(warehouse_id),
    quantity INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER DEFAULT 10,
    last_restock_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, warehouse_id)
);

-- 17. Shipments
CREATE TABLE shipments (
    shipment_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    shipped_date TIMESTAMP,
    estimated_delivery DATE,
    actual_delivery DATE,
    shipment_status VARCHAR(20), -- 'preparing', 'shipped', 'in_transit', 'delivered'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. Product Reviews
CREATE TABLE product_reviews (
    review_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_title VARCHAR(200),
    review_text TEXT,
    helpful_count INTEGER DEFAULT 0,
    verified_purchase BOOLEAN DEFAULT false,
    review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. Employee Territories
CREATE TABLE employee_territories (
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    territory_id INTEGER NOT NULL REFERENCES sales_territories(territory_id) ON DELETE CASCADE,
    assigned_date DATE DEFAULT CURRENT_DATE,
    active BOOLEAN DEFAULT true,
    PRIMARY KEY (employee_id, territory_id)
);

-- 20. Audit Log
CREATE TABLE audit_log (
    audit_id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20), -- 'INSERT', 'UPDATE', 'DELETE'
    employee_id INTEGER REFERENCES employees(employee_id),
    changed_data JSONB,
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================================================================
-- Create Indexes for Performance
-- ===================================================================

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);

COMMENT ON TABLE countries IS 'Reference data for countries and regions';
COMMENT ON TABLE customers IS 'Customer master data with contact information';
COMMENT ON TABLE orders IS 'Sales orders placed by customers';
COMMENT ON TABLE order_items IS 'Line items for each order with product details';
COMMENT ON TABLE products IS 'Product catalog with pricing and inventory info';
COMMENT ON TABLE employees IS 'Employee records with department and salary information';
