const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'adventureworks',
  user: 'cwic_user',
  password: 'cwic_secure_pass',
});

async function insertBadData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Inserting bad data into AdventureWorks...\n');

    // 1. COMPLETENESS ISSUES: Customers with missing fields (email, phone, date_of_birth)
    console.log('1. Inserting customers with missing critical fields...');
    await client.query(`
      INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active, created_at)
      VALUES
      ('John', 'Doe', NULL, NULL, NULL, '2023-01-01', 100, 5000, true, NOW()),
      ('Jane', 'Smith', '', NULL, NULL, '2023-02-01', 50, 3000, true, NOW()),
      ('Bob', 'NoContact', NULL, NULL, '1990-03-10', '2023-03-01', 0, 2000, true, NOW())
    `);
    console.log('   ✓ Inserted 3 customers with NULL/empty email and phone\n');

    // 2. VALIDITY ISSUES: Invalid credit limits
    console.log('2. Inserting customers with invalid credit limits (>$50k)...');
    await client.query(`
      INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active, created_at)
      VALUES
      ('Enterprise', 'ClientA', 'enterprise.a@example.com', '555-9001', '1975-01-01', '2020-01-01', 5000, 75000.00, true, NOW()),
      ('Corporate', 'AccountB', 'corporate.b@example.com', '555-9002', '1978-06-15', '2020-06-01', 8000, 125000.00, true, NOW())
    `);
    console.log('   ✓ Inserted 2 customers with excessive credit limits\n');

    // 3. UNIQUENESS ISSUES: Duplicate emails
    console.log('3. Inserting customers with duplicate emails...');
    await client.query(`
      INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active, created_at)
      VALUES
      ('Duplicate', 'User1', 'john.duplicate@example.com', '555-8001', '1982-04-20', '2023-04-01', 200, 4000, true, NOW()),
      ('Duplicate', 'User2', 'john.duplicate@example.com', '555-8002', '1983-07-11', '2023-04-02', 150, 3500, true, NOW()),
      ('Another', 'Dup1', 'jane.duplicate@example.com', '555-8003', '1984-09-05', '2023-04-03', 300, 5000, true, NOW()),
      ('Another', 'Dup2', 'jane.duplicate@example.com', '555-8004', '1985-11-30', '2023-04-04', 250, 4500, true, NOW())
    `);
    console.log('   ✓ Inserted 4 customers with duplicate emails\n');

    // 4. VALIDITY ISSUES: Products with invalid prices
    console.log('4. Inserting products with zero/negative prices...');
    await client.query(`
      INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, description, weight_kg, created_at)
      VALUES
      ('Test Product Zero Price', 'TEST-ZERO-001', 1, 1, 0.00, 10.00, 50, 10, false, 'Product with zero price for testing', 1.5, NOW()),
      ('Bad Product Negative', 'BAD-NEG-002', 2, 2, -15.99, 10.00, 30, 5, false, 'Product with negative price', 2.0, NOW())
    `);
    console.log('   ✓ Inserted 2 products with invalid prices\n');

    // 5. COMPLETENESS ISSUES: Products without descriptions
    console.log('5. Inserting products with NULL/empty descriptions...');
    await client.query(`
      INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, description, weight_kg, created_at)
      VALUES
      ('Widget Pro 2000', 'WDG-2000', 3, 3, 199.99, 120.00, 100, 20, false, NULL, 3.2, NOW()),
      ('Gadget Ultra', 'GDG-ULTRA', 4, 4, 299.99, 180.00, 75, 15, false, '', 2.8, NOW()),
      ('SuperTool Deluxe', 'ST-DLX-500', 5, 5, 449.99, 270.00, 50, 10, false, NULL, 4.5, NOW())
    `);
    console.log('   ✓ Inserted 3 products without descriptions\n');

    // 6. VALIDITY ISSUES: Orders with future dates
    console.log('6. Inserting order with future date...');
    await client.query(`
      INSERT INTO orders (customer_id, employee_id, order_date, required_date, shipped_date, order_status, subtotal, tax_amount, shipping_cost, total_amount, notes, created_at)
      VALUES
      (1, 1, '2026-12-31 10:00:00', '2027-01-05', NULL, 'pending', 100.00, 10.00, 5.00, 115.00, 'Order date in future', NOW())
    `);
    console.log('   ✓ Inserted 1 order with future date\n');

    // 7. CONSISTENCY ISSUES: Orders with mismatched totals
    console.log('7. Inserting orders with inconsistent totals...');
    const orderResult = await client.query(`
      INSERT INTO orders (customer_id, employee_id, order_date, required_date, shipped_date, order_status, subtotal, tax_amount, shipping_cost, total_amount, notes, created_at)
      VALUES
      (1, 1, '2024-01-15 10:30:00', '2024-01-20', '2024-01-18', 'shipped', 500.00, 50.00, 10.00, 650.00, 'Order total intentionally wrong', NOW()),
      (2, 2, '2024-01-16 14:20:00', '2024-01-21', NULL, 'processing', 1000.00, 100.00, 15.00, 1200.00, 'Another inconsistent total', NOW()),
      (3, 3, '2024-01-17 09:15:00', '2024-01-22', NULL, 'pending', 750.00, 75.00, 12.00, 850.00, 'Mismatch between total and items', NOW())
      RETURNING order_id
    `);

    const orderIds = orderResult.rows.map(r => r.order_id);

    // Insert order items with totals that don't match
    await client.query(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, line_total, created_at)
      VALUES
      ($1, 1, 2, 100.00, 0, 200.00, NOW()),
      ($1, 2, 3, 150.00, 0, 450.00, NOW()),
      ($2, 1, 5, 200.00, 0, 1000.00, NOW()),
      ($2, 2, 2, 125.00, 0, 250.00, NOW()),
      ($3, 1, 3, 250.00, 50.00, 700.00, NOW()),
      ($3, 2, 1, 125.00, 0, 125.00, NOW())
    `, [orderIds[0], orderIds[1], orderIds[2]]);
    console.log('   ✓ Inserted 3 orders with mismatched totals\n');

    // 8. CONSISTENCY ISSUES: Negative inventory
    console.log('8. Inserting inventory with negative quantities...');
    // Get some existing product-warehouse combinations that don't exist yet
    const unusedSlots = await client.query(`
      SELECT p.product_id, w.warehouse_id
      FROM products p CROSS JOIN warehouses w
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory i
        WHERE i.product_id = p.product_id AND i.warehouse_id = w.warehouse_id
      )
      LIMIT 4
    `);

    for (const slot of unusedSlots.rows) {
      await client.query(`
        INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_point, last_restock_date, created_at)
        VALUES ($1, $2, $3, 10, '2024-01-01', NOW())
      `, [slot.product_id, slot.warehouse_id, Math.floor(Math.random() * -15) - 1]);
    }
    console.log('   ✓ Inserted 4 inventory records with negative quantities\n');

    // 9. ACCURACY ISSUES: Employees with unrealistic salaries
    console.log('9. Inserting employees with outlier salaries...');
    await client.query(`
      INSERT INTO employees (first_name, last_name, email, phone, hire_date, department_id, job_title, salary, manager_id, active, created_at)
      VALUES
      ('CEO', 'Executive', 'ceo@example.com', '555-1000', '2015-01-01', 1, 'Chief Executive Officer', 250000.00, NULL, true, NOW()),
      ('Intern', 'Summer', 'intern@example.com', '555-1001', '2024-06-01', 2, 'Summer Intern', 15000.00, 1, true, NOW()),
      ('VP', 'Sales', 'vp.sales@example.com', '555-1002', '2016-03-15', 3, 'VP of Sales', 225000.00, 1, true, NOW())
    `);
    console.log('   ✓ Inserted 3 employees with outlier salaries\n');

    // 10. COMPLETENESS ISSUES: Employees with missing fields
    console.log('10. Inserting employees with NULL email/phone...');
    await client.query(`
      INSERT INTO employees (first_name, last_name, email, phone, hire_date, department_id, job_title, salary, manager_id, active, created_at)
      VALUES
      ('NoEmail', 'Person', NULL, '555-2001', '2023-01-15', 2, 'Data Analyst', 65000.00, 5, true, NOW()),
      ('NoPhone', 'Guy', 'nophone@example.com', NULL, '2023-02-20', 3, 'Sales Rep', 55000.00, 10, true, NOW())
    `);
    console.log('   ✓ Inserted 2 employees with missing contact info\n');

    // 11. VALIDITY ISSUES: Payments with negative amounts
    console.log('11. Inserting invalid payments...');
    const lastOrder = await client.query('SELECT order_id FROM orders ORDER BY created_at DESC LIMIT 1');
    await client.query(`
      INSERT INTO payments (order_id, payment_method_id, payment_date, amount, payment_status, transaction_id, notes, created_at)
      VALUES
      ($1, 1, NOW(), -50.00, 'failed', 'TXN-NEG-001', 'Negative payment amount', NOW()),
      ($1, 2, '2026-01-01 12:00:00', 100.00, 'pending', 'TXN-FUTURE-002', 'Payment date in future', NOW())
    `, [lastOrder.rows[0].order_id]);
    console.log('   ✓ Inserted 2 invalid payments\n');

    // 12. COMPLETENESS ISSUES: Customer addresses with missing fields
    console.log('12. Inserting addresses with NULL fields...');
    await client.query(`
      INSERT INTO customer_addresses (customer_id, address_type, street_address, city, state_province, postal_code, country_id, is_default, created_at)
      VALUES
      (1, 'billing', NULL, 'New York', 'NY', '10001', 1, false, NOW()),
      (2, 'shipping', '123 Main St', NULL, 'CA', '90001', 1, false, NOW()),
      (3, 'billing', '456 Oak Ave', 'Boston', NULL, NULL, 1, false, NOW())
    `);
    console.log('   ✓ Inserted 3 addresses with missing fields\n');

    // 13. OUTLIER DATA: Extreme values
    console.log('13. Inserting records with extreme values...');
    await client.query(`
      INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, customer_since, loyalty_points, credit_limit, active, created_at)
      VALUES
      ('Extreme', 'Points', 'extreme@example.com', '555-9999', '1950-01-01', '1990-01-01', 999999, 100000.00, true, NOW())
    `);

    await client.query(`
      INSERT INTO products (product_name, sku, category_id, supplier_id, unit_price, cost_price, units_in_stock, reorder_level, discontinued, description, weight_kg, created_at)
      VALUES
      ('Extremely Expensive', 'EXP-MAX-999', 1, 1, 999999.99, 500000.00, 1, 1, false, 'Outrageously priced item', 100.0, NOW())
    `);
    console.log('   ✓ Inserted extreme value records\n');

    await client.query('COMMIT');

    // Count the bad data
    console.log('\n=== BAD DATA SUMMARY ===');

    const counts = await Promise.all([
      client.query("SELECT COUNT(*) FROM customers WHERE email IS NULL OR email = ''"),
      client.query("SELECT COUNT(*) FROM customers WHERE credit_limit > 50000"),
      client.query("SELECT COUNT(*) FROM products WHERE unit_price <= 0"),
      client.query("SELECT COUNT(*) FROM products WHERE description IS NULL OR description = ''"),
      client.query("SELECT COUNT(*) FROM inventory WHERE quantity < 0"),
      client.query("SELECT COUNT(*) FROM orders WHERE order_date > NOW()"),
      client.query("SELECT COUNT(*) FROM employees WHERE salary < 20000 OR salary > 200000"),
      client.query("SELECT email, COUNT(*) as cnt FROM customers WHERE email IS NOT NULL AND email != '' GROUP BY email HAVING COUNT(*) > 1")
    ]);

    console.log(`Customers with NULL/empty emails: ${counts[0].rows[0].count}`);
    console.log(`Customers with credit limit > $50k: ${counts[1].rows[0].count}`);
    console.log(`Products with price <= 0: ${counts[2].rows[0].count}`);
    console.log(`Products without descriptions: ${counts[3].rows[0].count}`);
    console.log(`Inventory with negative quantities: ${counts[4].rows[0].count}`);
    console.log(`Orders with future dates: ${counts[5].rows[0].count}`);
    console.log(`Employees with outlier salaries: ${counts[6].rows[0].count}`);
    console.log(`Duplicate email addresses: ${counts[7].rows.length} emails duplicated`);

    console.log('\n✅ Bad data insertion complete!');
    console.log('Your application can now detect these real anomalies when scanning.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting bad data:', error);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

insertBadData();
