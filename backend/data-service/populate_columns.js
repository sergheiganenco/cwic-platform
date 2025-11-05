const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass',
});

const columnsData = [
  // customers (340)
  { asset_id: 340, column_name: 'customer_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 340, column_name: 'first_name', data_type: 'character varying', is_nullable: false, ordinal: 2 },
  { asset_id: 340, column_name: 'last_name', data_type: 'character varying', is_nullable: false, ordinal: 3 },
  { asset_id: 340, column_name: 'email', data_type: 'character varying', is_nullable: false, ordinal: 4 },
  { asset_id: 340, column_name: 'phone', data_type: 'character varying', is_nullable: true, ordinal: 5 },
  { asset_id: 340, column_name: 'date_of_birth', data_type: 'date', is_nullable: true, ordinal: 6 },
  { asset_id: 340, column_name: 'customer_since', data_type: 'date', is_nullable: true, ordinal: 7 },
  { asset_id: 340, column_name: 'loyalty_points', data_type: 'integer', is_nullable: true, ordinal: 8 },
  { asset_id: 340, column_name: 'credit_limit', data_type: 'numeric', is_nullable: true, ordinal: 9 },
  { asset_id: 340, column_name: 'active', data_type: 'boolean', is_nullable: true, ordinal: 10 },
  { asset_id: 340, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 11 },

  // orders (341)
  { asset_id: 341, column_name: 'order_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 341, column_name: 'customer_id', data_type: 'integer', is_nullable: false, ordinal: 2, is_foreign_key: true, foreign_key_table: 'customers', foreign_key_column: 'customer_id' },
  { asset_id: 341, column_name: 'employee_id', data_type: 'integer', is_nullable: true, ordinal: 3, is_foreign_key: true, foreign_key_table: 'employees', foreign_key_column: 'employee_id' },
  { asset_id: 341, column_name: 'order_date', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 4 },
  { asset_id: 341, column_name: 'required_date', data_type: 'date', is_nullable: true, ordinal: 5 },
  { asset_id: 341, column_name: 'shipped_date', data_type: 'date', is_nullable: true, ordinal: 6 },
  { asset_id: 341, column_name: 'territory_id', data_type: 'integer', is_nullable: true, ordinal: 7 },
  { asset_id: 341, column_name: 'shipping_address_id', data_type: 'integer', is_nullable: true, ordinal: 8, is_foreign_key: true, foreign_key_table: 'customer_addresses', foreign_key_column: 'address_id' },
  { asset_id: 341, column_name: 'order_status', data_type: 'character varying', is_nullable: true, ordinal: 9 },
  { asset_id: 341, column_name: 'subtotal', data_type: 'numeric', is_nullable: true, ordinal: 10 },
  { asset_id: 341, column_name: 'tax_amount', data_type: 'numeric', is_nullable: true, ordinal: 11 },
  { asset_id: 341, column_name: 'shipping_cost', data_type: 'numeric', is_nullable: true, ordinal: 12 },
  { asset_id: 341, column_name: 'total_amount', data_type: 'numeric', is_nullable: true, ordinal: 13 },
  { asset_id: 341, column_name: 'notes', data_type: 'text', is_nullable: true, ordinal: 14 },
  { asset_id: 341, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 15 },

  // order_items (342)
  { asset_id: 342, column_name: 'order_item_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 342, column_name: 'order_id', data_type: 'integer', is_nullable: false, ordinal: 2, is_foreign_key: true, foreign_key_table: 'orders', foreign_key_column: 'order_id' },
  { asset_id: 342, column_name: 'product_id', data_type: 'integer', is_nullable: false, ordinal: 3, is_foreign_key: true, foreign_key_table: 'products', foreign_key_column: 'product_id' },
  { asset_id: 342, column_name: 'quantity', data_type: 'integer', is_nullable: false, ordinal: 4 },
  { asset_id: 342, column_name: 'unit_price', data_type: 'numeric', is_nullable: false, ordinal: 5 },
  { asset_id: 342, column_name: 'discount', data_type: 'numeric', is_nullable: true, ordinal: 6 },
  { asset_id: 342, column_name: 'line_total', data_type: 'numeric', is_nullable: true, ordinal: 7 },
  { asset_id: 342, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 8 },

  // products (343)
  { asset_id: 343, column_name: 'product_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 343, column_name: 'product_name', data_type: 'character varying', is_nullable: false, ordinal: 2 },
  { asset_id: 343, column_name: 'sku', data_type: 'character varying', is_nullable: false, ordinal: 3 },
  { asset_id: 343, column_name: 'category_id', data_type: 'integer', is_nullable: true, ordinal: 4, is_foreign_key: true, foreign_key_table: 'product_categories', foreign_key_column: 'category_id' },
  { asset_id: 343, column_name: 'supplier_id', data_type: 'integer', is_nullable: true, ordinal: 5, is_foreign_key: true, foreign_key_table: 'suppliers', foreign_key_column: 'supplier_id' },
  { asset_id: 343, column_name: 'unit_price', data_type: 'numeric', is_nullable: false, ordinal: 6 },
  { asset_id: 343, column_name: 'cost_price', data_type: 'numeric', is_nullable: true, ordinal: 7 },
  { asset_id: 343, column_name: 'units_in_stock', data_type: 'integer', is_nullable: true, ordinal: 8 },
  { asset_id: 343, column_name: 'reorder_level', data_type: 'integer', is_nullable: true, ordinal: 9 },
  { asset_id: 343, column_name: 'discontinued', data_type: 'boolean', is_nullable: true, ordinal: 10 },
  { asset_id: 343, column_name: 'description', data_type: 'text', is_nullable: true, ordinal: 11 },
  { asset_id: 343, column_name: 'weight_kg', data_type: 'numeric', is_nullable: true, ordinal: 12 },
  { asset_id: 343, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 13 },

  // employees (344)
  { asset_id: 344, column_name: 'employee_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 344, column_name: 'first_name', data_type: 'character varying', is_nullable: false, ordinal: 2 },
  { asset_id: 344, column_name: 'last_name', data_type: 'character varying', is_nullable: false, ordinal: 3 },
  { asset_id: 344, column_name: 'email', data_type: 'character varying', is_nullable: true, ordinal: 4 },
  { asset_id: 344, column_name: 'phone', data_type: 'character varying', is_nullable: true, ordinal: 5 },
  { asset_id: 344, column_name: 'hire_date', data_type: 'date', is_nullable: false, ordinal: 6 },
  { asset_id: 344, column_name: 'department_id', data_type: 'integer', is_nullable: true, ordinal: 7, is_foreign_key: true, foreign_key_table: 'departments', foreign_key_column: 'department_id' },
  { asset_id: 344, column_name: 'job_title', data_type: 'character varying', is_nullable: true, ordinal: 8 },
  { asset_id: 344, column_name: 'salary', data_type: 'numeric', is_nullable: true, ordinal: 9 },
  { asset_id: 344, column_name: 'manager_id', data_type: 'integer', is_nullable: true, ordinal: 10, is_foreign_key: true, foreign_key_table: 'employees', foreign_key_column: 'employee_id' },
  { asset_id: 344, column_name: 'active', data_type: 'boolean', is_nullable: true, ordinal: 11 },
  { asset_id: 344, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 12 },

  // departments (345)
  { asset_id: 345, column_name: 'department_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 345, column_name: 'department_name', data_type: 'character varying', is_nullable: false, ordinal: 2 },
  { asset_id: 345, column_name: 'description', data_type: 'text', is_nullable: true, ordinal: 3 },
  { asset_id: 345, column_name: 'manager_name', data_type: 'character varying', is_nullable: true, ordinal: 4 },
  { asset_id: 345, column_name: 'budget', data_type: 'numeric', is_nullable: true, ordinal: 5 },
  { asset_id: 345, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 6 },

  // suppliers (346)
  { asset_id: 346, column_name: 'supplier_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 346, column_name: 'company_name', data_type: 'character varying', is_nullable: false, ordinal: 2 },
  { asset_id: 346, column_name: 'contact_name', data_type: 'character varying', is_nullable: true, ordinal: 3 },
  { asset_id: 346, column_name: 'email', data_type: 'character varying', is_nullable: true, ordinal: 4 },
  { asset_id: 346, column_name: 'phone', data_type: 'character varying', is_nullable: true, ordinal: 5 },
  { asset_id: 346, column_name: 'address', data_type: 'text', is_nullable: true, ordinal: 6 },
  { asset_id: 346, column_name: 'rating', data_type: 'numeric', is_nullable: true, ordinal: 7 },
  { asset_id: 346, column_name: 'active', data_type: 'boolean', is_nullable: true, ordinal: 8 },
  { asset_id: 346, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 9 },

  // product_categories (347)
  { asset_id: 347, column_name: 'category_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 347, column_name: 'category_name', data_type: 'character varying', is_nullable: false, ordinal: 2 },
  { asset_id: 347, column_name: 'parent_category_id', data_type: 'integer', is_nullable: true, ordinal: 3, is_foreign_key: true, foreign_key_table: 'product_categories', foreign_key_column: 'category_id' },
  { asset_id: 347, column_name: 'description', data_type: 'text', is_nullable: true, ordinal: 4 },
  { asset_id: 347, column_name: 'active', data_type: 'boolean', is_nullable: true, ordinal: 5 },
  { asset_id: 347, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 6 },

  // payments (348)
  { asset_id: 348, column_name: 'payment_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 348, column_name: 'order_id', data_type: 'integer', is_nullable: false, ordinal: 2, is_foreign_key: true, foreign_key_table: 'orders', foreign_key_column: 'order_id' },
  { asset_id: 348, column_name: 'payment_method_id', data_type: 'integer', is_nullable: true, ordinal: 3 },
  { asset_id: 348, column_name: 'payment_date', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 4 },
  { asset_id: 348, column_name: 'amount', data_type: 'numeric', is_nullable: false, ordinal: 5 },
  { asset_id: 348, column_name: 'payment_status', data_type: 'character varying', is_nullable: true, ordinal: 6 },
  { asset_id: 348, column_name: 'transaction_id', data_type: 'character varying', is_nullable: true, ordinal: 7 },
  { asset_id: 348, column_name: 'notes', data_type: 'text', is_nullable: true, ordinal: 8 },
  { asset_id: 348, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 9 },

  // inventory (349)
  { asset_id: 349, column_name: 'inventory_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 349, column_name: 'product_id', data_type: 'integer', is_nullable: false, ordinal: 2, is_foreign_key: true, foreign_key_table: 'products', foreign_key_column: 'product_id' },
  { asset_id: 349, column_name: 'warehouse_id', data_type: 'integer', is_nullable: false, ordinal: 3, is_foreign_key: true, foreign_key_table: 'warehouses', foreign_key_column: 'warehouse_id' },
  { asset_id: 349, column_name: 'quantity', data_type: 'integer', is_nullable: false, ordinal: 4 },
  { asset_id: 349, column_name: 'reorder_point', data_type: 'integer', is_nullable: true, ordinal: 5 },
  { asset_id: 349, column_name: 'last_restock_date', data_type: 'date', is_nullable: true, ordinal: 6 },
  { asset_id: 349, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 7 },

  // warehouses (350)
  { asset_id: 350, column_name: 'warehouse_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 350, column_name: 'warehouse_name', data_type: 'character varying', is_nullable: false, ordinal: 2 },
  { asset_id: 350, column_name: 'location', data_type: 'character varying', is_nullable: true, ordinal: 3 },
  { asset_id: 350, column_name: 'capacity', data_type: 'integer', is_nullable: true, ordinal: 4 },
  { asset_id: 350, column_name: 'manager_name', data_type: 'character varying', is_nullable: true, ordinal: 5 },
  { asset_id: 350, column_name: 'active', data_type: 'boolean', is_nullable: true, ordinal: 6 },
  { asset_id: 350, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 7 },

  // customer_addresses (351)
  { asset_id: 351, column_name: 'address_id', data_type: 'integer', is_nullable: false, ordinal: 1, is_primary_key: true, is_foreign_key: false },
  { asset_id: 351, column_name: 'customer_id', data_type: 'integer', is_nullable: false, ordinal: 2, is_foreign_key: true, foreign_key_table: 'customers', foreign_key_column: 'customer_id' },
  { asset_id: 351, column_name: 'address_type', data_type: 'character varying', is_nullable: true, ordinal: 3 },
  { asset_id: 351, column_name: 'street_address', data_type: 'character varying', is_nullable: true, ordinal: 4 },
  { asset_id: 351, column_name: 'city', data_type: 'character varying', is_nullable: true, ordinal: 5 },
  { asset_id: 351, column_name: 'state_province', data_type: 'character varying', is_nullable: true, ordinal: 6 },
  { asset_id: 351, column_name: 'postal_code', data_type: 'character varying', is_nullable: true, ordinal: 7 },
  { asset_id: 351, column_name: 'country_id', data_type: 'integer', is_nullable: true, ordinal: 8 },
  { asset_id: 351, column_name: 'is_default', data_type: 'boolean', is_nullable: true, ordinal: 9 },
  { asset_id: 351, column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: true, ordinal: 10 },
];

async function populateColumns() {
  try {
    for (const col of columnsData) {
      const query = `
        INSERT INTO catalog_columns (
          asset_id, column_name, data_type, is_nullable, ordinal,
          is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (asset_id, column_name) DO NOTHING
      `;

      await pool.query(query, [
        col.asset_id,
        col.column_name,
        col.data_type,
        col.is_nullable,
        col.ordinal,
        col.is_primary_key || false,
        col.is_foreign_key || false,
        col.foreign_key_table || null,
        col.foreign_key_column || null,
      ]);

      console.log(`Inserted: ${col.column_name} for asset ${col.asset_id}`);
    }

    console.log('All columns inserted successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error inserting columns:', error);
    process.exit(1);
  }
}

populateColumns();
