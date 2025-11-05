const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass',
});

const adventureWorksId = 'a21c94f1-afaa-4e0f-9ca0-dec657a908ef';

// Asset IDs from catalog_assets
const assets = {
  customers: 340,
  orders: 341,
  order_items: 342,
  products: 343,
  employees: 344,
  departments: 345,
  suppliers: 346,
  product_categories: 347,
  payments: 348,
  inventory: 349,
  warehouses: 350,
  customer_addresses: 351
};

const qualityRules = [
  // Completeness rules
  {
    name: 'Customer Email Completeness',
    description: 'Check that all active customers have email addresses',
    severity: 'high',
    dimension: 'completeness',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) FROM customers WHERE active = true AND (email IS NULL OR email = \'\')',
    asset_id: assets.customers,
    column_name: 'email',
    threshold_config: { max_null_count: 0 }
  },
  {
    name: 'Product Description Completeness',
    description: 'Ensure products have descriptions',
    severity: 'medium',
    dimension: 'completeness',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) FROM products WHERE description IS NULL OR description = \'\'',
    asset_id: assets.products,
    column_name: 'description',
    threshold_config: { max_null_percentage: 10 }
  },
  // Validity rules
  {
    name: 'Customer Credit Limit Validity',
    description: 'Credit limit should be between $0 and $50,000',
    severity: 'high',
    dimension: 'validity',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) FROM customers WHERE credit_limit < 0 OR credit_limit > 50000',
    asset_id: assets.customers,
    column_name: 'credit_limit',
    threshold_config: { max_invalid_count: 0 }
  },
  {
    name: 'Order Date Validity',
    description: 'Order dates should not be in the future',
    severity: 'critical',
    dimension: 'validity',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) FROM orders WHERE order_date > NOW()',
    asset_id: assets.orders,
    column_name: 'order_date',
    threshold_config: { max_invalid_count: 0 }
  },
  {
    name: 'Product Price Validity',
    description: 'Product unit price should be positive',
    severity: 'high',
    dimension: 'validity',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) FROM products WHERE unit_price <= 0',
    asset_id: assets.products,
    column_name: 'unit_price',
    threshold_config: { max_invalid_count: 0 }
  },
  // Consistency rules
  {
    name: 'Order Total Consistency',
    description: 'Order total should match sum of line items',
    severity: 'critical',
    dimension: 'consistency',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) FROM orders o LEFT JOIN (SELECT order_id, SUM(line_total) as calc_total FROM order_items GROUP BY order_id) oi ON o.order_id = oi.order_id WHERE ABS(COALESCE(o.total_amount, 0) - COALESCE(oi.calc_total, 0)) > 0.01',
    asset_id: assets.orders,
    column_name: 'total_amount',
    threshold_config: { max_inconsistent_count: 0 }
  },
  {
    name: 'Inventory Stock Consistency',
    description: 'Inventory quantity should be non-negative',
    severity: 'high',
    dimension: 'consistency',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) FROM inventory WHERE quantity < 0',
    asset_id: assets.inventory,
    column_name: 'quantity',
    threshold_config: { max_invalid_count: 0 }
  },
  // Uniqueness rules
  {
    name: 'Customer Email Uniqueness',
    description: 'Customer email addresses should be unique',
    severity: 'high',
    dimension: 'uniqueness',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) - COUNT(DISTINCT email) FROM customers WHERE email IS NOT NULL',
    asset_id: assets.customers,
    column_name: 'email',
    threshold_config: { max_duplicate_count: 0 }
  },
  {
    name: 'Product SKU Uniqueness',
    description: 'Product SKUs must be unique',
    severity: 'critical',
    dimension: 'uniqueness',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) - COUNT(DISTINCT sku) FROM products',
    asset_id: assets.products,
    column_name: 'sku',
    threshold_config: { max_duplicate_count: 0 }
  },
  // Accuracy rules
  {
    name: 'Employee Salary Range',
    description: 'Employee salaries should be within realistic range ($20k - $200k)',
    severity: 'medium',
    dimension: 'accuracy',
    type: 'sql',
    dialect: 'postgres',
    expression: 'SELECT COUNT(*) FROM employees WHERE salary < 20000 OR salary > 200000',
    asset_id: assets.employees,
    column_name: 'salary',
    threshold_config: { max_outlier_count: 2 }
  }
];

// Create some anomalies in the data
const anomalyData = [
  // Completeness issues
  {
    rule_index: 0, // Customer Email Completeness
    status: 'failed',
    severity: 'high',
    dimension: 'completeness',
    title: 'Missing Email Addresses for Active Customers',
    description: '3 active customers are missing email addresses, which prevents marketing communications and order notifications',
    affected_rows: 3,
    rows_checked: 50,
    rows_failed: 3,
    metric_value: 6.0,
    impact_score: 75,
    sample_data: {
      examples: [
        { customer_id: 15, first_name: 'John', last_name: 'Smith', email: null, active: true },
        { customer_id: 28, first_name: 'Sarah', last_name: 'Johnson', email: '', active: true },
        { customer_id: 42, first_name: 'Mike', last_name: 'Brown', email: null, active: true }
      ]
    },
    root_cause: 'Legacy data migration did not require email field',
    remediation_plan: 'Contact customers via phone to collect email addresses'
  },
  {
    rule_index: 1, // Product Description Completeness
    status: 'failed',
    severity: 'medium',
    dimension: 'completeness',
    title: 'Products Missing Descriptions',
    description: '12 products (14%) lack descriptions, impacting customer purchase decisions',
    affected_rows: 12,
    rows_checked: 84,
    rows_failed: 12,
    metric_value: 14.3,
    impact_score: 55,
    sample_data: {
      examples: [
        { product_id: 23, product_name: 'Widget Pro 2000', sku: 'WDG-2000', description: null },
        { product_id: 45, product_name: 'Gadget Ultra', sku: 'GDG-ULTRA', description: '' }
      ]
    },
    root_cause: 'Bulk product imports skip description field',
    remediation_plan: 'Request product descriptions from suppliers'
  },
  // Validity issues
  {
    rule_index: 2, // Customer Credit Limit Validity
    status: 'failed',
    severity: 'high',
    dimension: 'validity',
    title: 'Invalid Customer Credit Limits',
    description: '2 customers have credit limits exceeding the maximum allowed threshold of $50,000',
    affected_rows: 2,
    rows_checked: 50,
    rows_failed: 2,
    metric_value: 4.0,
    impact_score: 80,
    sample_data: {
      examples: [
        { customer_id: 7, first_name: 'Enterprise', last_name: 'Client A', credit_limit: 75000.00 },
        { customer_id: 33, first_name: 'Corporate', last_name: 'Account B', credit_limit: 125000.00 }
      ]
    },
    root_cause: 'Manual credit limit adjustments bypass validation',
    remediation_plan: 'Review and approve high-limit accounts, update validation rules'
  },
  {
    rule_index: 4, // Product Price Validity
    status: 'failed',
    severity: 'high',
    dimension: 'validity',
    title: 'Products with Invalid Pricing',
    description: '1 product has zero or negative unit price',
    affected_rows: 1,
    rows_checked: 84,
    rows_failed: 1,
    metric_value: 1.2,
    impact_score: 85,
    sample_data: {
      examples: [
        { product_id: 67, product_name: 'Test Product', sku: 'TEST-001', unit_price: 0.00 }
      ]
    },
    root_cause: 'Test data not cleaned from production database',
    remediation_plan: 'Remove test products or set proper pricing'
  },
  // Consistency issues
  {
    rule_index: 5, // Order Total Consistency
    status: 'failed',
    severity: 'critical',
    dimension: 'consistency',
    title: 'Order Totals Mismatch with Line Items',
    description: '5 orders have totals that don\'t match the sum of their line items, potentially causing financial discrepancies',
    affected_rows: 5,
    rows_checked: 100,
    rows_failed: 5,
    metric_value: 5.0,
    impact_score: 95,
    sample_data: {
      examples: [
        { order_id: 23, total_amount: 599.99, calculated_total: 549.99, difference: 50.00 },
        { order_id: 45, total_amount: 1200.00, calculated_total: 1250.00, difference: -50.00 },
        { order_id: 78, total_amount: 850.00, calculated_total: 825.50, difference: 24.50 }
      ]
    },
    root_cause: 'Order updates don\'t recalculate totals when line items change',
    remediation_plan: 'Implement database triggers to maintain order total consistency'
  },
  {
    rule_index: 6, // Inventory Stock Consistency
    status: 'failed',
    severity: 'high',
    dimension: 'consistency',
    title: 'Negative Inventory Quantities',
    description: '4 inventory records show negative stock levels, indicating overselling or data errors',
    affected_rows: 4,
    rows_checked: 420,
    rows_failed: 4,
    metric_value: 0.95,
    impact_score: 70,
    sample_data: {
      examples: [
        { inventory_id: 125, product_id: 34, warehouse_id: 2, quantity: -5 },
        { inventory_id: 287, product_id: 56, warehouse_id: 3, quantity: -12 }
      ]
    },
    root_cause: 'Concurrent order processing without proper locking',
    remediation_plan: 'Implement optimistic locking and fix negative balances'
  },
  // Uniqueness issues
  {
    rule_index: 7, // Customer Email Uniqueness
    status: 'failed',
    severity: 'high',
    dimension: 'uniqueness',
    title: 'Duplicate Customer Email Addresses',
    description: '2 email addresses are used by multiple customer accounts',
    affected_rows: 4,
    rows_checked: 50,
    rows_failed: 4,
    metric_value: 8.0,
    impact_score: 75,
    sample_data: {
      examples: [
        { customer_id: 12, email: 'john.doe@example.com', count: 2 },
        { customer_id: 35, email: 'john.doe@example.com', count: 2 },
        { customer_id: 19, email: 'jane.smith@example.com', count: 2 },
        { customer_id: 44, email: 'jane.smith@example.com', count: 2 }
      ]
    },
    root_cause: 'No unique constraint on email field allows duplicates',
    remediation_plan: 'Merge duplicate accounts or require unique emails'
  },
  // Accuracy issues
  {
    rule_index: 9, // Employee Salary Range
    status: 'failed',
    severity: 'medium',
    dimension: 'accuracy',
    title: 'Employee Salaries Outside Normal Range',
    description: '3 employee salaries are outside the expected range ($20k-$200k)',
    affected_rows: 3,
    rows_checked: 25,
    rows_failed: 3,
    metric_value: 12.0,
    impact_score: 45,
    sample_data: {
      examples: [
        { employee_id: 3, first_name: 'CEO', last_name: 'Smith', salary: 250000.00, job_title: 'Chief Executive Officer' },
        { employee_id: 19, first_name: 'Intern', last_name: 'Jones', salary: 15000.00, job_title: 'Summer Intern' },
        { employee_id: 23, first_name: 'Senior', last_name: 'VP', salary: 225000.00, job_title: 'Senior VP Sales' }
      ]
    },
    root_cause: 'Salary range validation too restrictive for executive and intern positions',
    remediation_plan: 'Adjust salary validation rules for different job levels'
  },
  // Some passing rules
  {
    rule_index: 3, // Order Date Validity
    status: 'passed',
    severity: 'critical',
    dimension: 'validity',
    title: 'Order Date Validation Passed',
    description: 'All orders have valid dates (not in future)',
    affected_rows: 0,
    rows_checked: 100,
    rows_failed: 0,
    metric_value: 0.0,
    impact_score: 0
  },
  {
    rule_index: 8, // Product SKU Uniqueness
    status: 'passed',
    severity: 'critical',
    dimension: 'uniqueness',
    title: 'Product SKU Uniqueness Verified',
    description: 'All product SKUs are unique',
    affected_rows: 0,
    rows_checked: 84,
    rows_failed: 0,
    metric_value: 0.0,
    impact_score: 0
  }
];

async function populateQualityData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Creating quality rules...');
    const ruleIds = [];

    for (const rule of qualityRules) {
      const result = await client.query(`
        INSERT INTO quality_rules (
          name, description, severity, dimension, type, dialect,
          expression, data_source_id, asset_id, column_name,
          threshold_config, enabled, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, 'system')
        RETURNING id
      `, [
        rule.name,
        rule.description,
        rule.severity,
        rule.dimension,
        rule.type,
        rule.dialect,
        rule.expression,
        adventureWorksId,
        rule.asset_id,
        rule.column_name,
        JSON.stringify(rule.threshold_config)
      ]);

      ruleIds.push(result.rows[0].id);
      console.log(`Created rule: ${rule.name}`);
    }

    console.log('\nCreating quality results and issues...');

    for (const anomaly of anomalyData) {
      const ruleId = ruleIds[anomaly.rule_index];
      const rule = qualityRules[anomaly.rule_index];

      // Create quality result (asset_id is not used in quality_results)
      const resultRow = await client.query(`
        INSERT INTO quality_results (
          rule_id, data_source_id, status, execution_time_ms,
          metrics, metric_value, rows_checked, rows_failed, sample_failures
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        ruleId,
        adventureWorksId,
        anomaly.status,
        Math.floor(Math.random() * 500) + 50,
        JSON.stringify({
          dimension: anomaly.dimension,
          threshold_met: anomaly.status === 'passed',
          failure_rate: anomaly.rows_checked > 0 ? (anomaly.rows_failed / anomaly.rows_checked * 100).toFixed(2) : 0
        }),
        anomaly.metric_value,
        anomaly.rows_checked,
        anomaly.rows_failed,
        JSON.stringify(anomaly.sample_data)
      ]);

      const resultId = resultRow.rows[0].id;

      // Create quality issue if failed
      if (anomaly.status === 'failed') {
        await client.query(`
          INSERT INTO quality_issues (
            result_id, rule_id, asset_id, data_source_id, severity, dimension,
            status, title, description, impact_score, affected_rows,
            sample_data, root_cause, remediation_plan
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          resultId,
          ruleId,
          rule.asset_id,
          adventureWorksId,
          anomaly.severity,
          anomaly.dimension,
          'open',
          anomaly.title,
          anomaly.description,
          anomaly.impact_score,
          anomaly.affected_rows,
          JSON.stringify(anomaly.sample_data),
          anomaly.root_cause,
          anomaly.remediation_plan
        ]);

        console.log(`Created issue: ${anomaly.title}`);
      } else {
        console.log(`Rule passed: ${anomaly.title}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Successfully created quality rules, results, and issues!');
    console.log(`\nSummary:`);
    console.log(`- Created ${qualityRules.length} quality rules`);
    console.log(`- Generated ${anomalyData.length} quality check results`);
    console.log(`- Identified ${anomalyData.filter(a => a.status === 'failed').length} quality issues`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error populating quality data:', error);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

populateQualityData();
