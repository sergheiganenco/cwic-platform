const { Pool } = require('pg');

// This script creates mock Azure SQL catalog data so the UI works even without real Azure connection

async function setupAzureMockData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://cwic_user:cwic_secure_pass@localhost:5432/cwic_platform'
  });

  try {
    console.log('📊 Setting up mock Azure SQL catalog data...');
    console.log('This allows the UI to work without real Azure credentials');
    console.log('');

    // Get the Azure Feya data source ID
    const dsResult = await pool.query(
      `SELECT id, name FROM data_sources
       WHERE type = 'mssql' AND name LIKE '%Azure%Feya%'
       LIMIT 1`
    );

    if (dsResult.rows.length === 0) {
      console.log('❌ No Azure Feya data source found');
      return;
    }

    const azureDs = dsResult.rows[0];
    console.log(`Found data source: ${azureDs.name} (${azureDs.id})`);

    // Check if catalog data already exists
    const existingCount = await pool.query(
      `SELECT COUNT(*) FROM catalog_assets WHERE datasource_id = $1`,
      [azureDs.id]
    );

    if (existingCount.rows[0].count > 0) {
      console.log(`ℹ️  Catalog already has ${existingCount.rows[0].count} assets`);
      console.log('   Clearing existing data...');

      // Clear existing data
      await pool.query(`DELETE FROM catalog_columns WHERE asset_id IN (
        SELECT id FROM catalog_assets WHERE datasource_id = $1
      )`, [azureDs.id]);

      await pool.query(`DELETE FROM catalog_assets WHERE datasource_id = $1`, [azureDs.id]);
    }

    // Create mock Azure SQL tables
    const mockTables = [
      { schema: 'dbo', table: 'Customers', database: 'CWIC_Demo' },
      { schema: 'dbo', table: 'Orders', database: 'CWIC_Demo' },
      { schema: 'dbo', table: 'Products', database: 'CWIC_Demo' },
      { schema: 'dbo', table: 'OrderDetails', database: 'CWIC_Demo' },
      { schema: 'dbo', table: 'Categories', database: 'CWIC_Demo' },
      { schema: 'Sales', table: 'Transactions', database: 'CWIC_Demo' },
      { schema: 'Sales', table: 'Revenue', database: 'CWIC_Demo' },
      { schema: 'HR', table: 'Employees', database: 'CWIC_Demo' },
      { schema: 'HR', table: 'Departments', database: 'CWIC_Demo' },
      { schema: 'Finance', table: 'Invoices', database: 'CWIC_Demo' }
    ];

    console.log('\n📝 Creating mock catalog assets...');

    for (const mockTable of mockTables) {
      // Insert catalog asset
      const assetResult = await pool.query(
        `INSERT INTO catalog_assets
         (tenant_id, datasource_id, asset_type, schema_name, table_name, database_name,
          row_count, column_count, description, created_at, updated_at)
         VALUES (1, $1, 'table', $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [
          azureDs.id,
          mockTable.schema,
          mockTable.table,
          mockTable.database,
          Math.floor(Math.random() * 10000) + 100, // Random row count
          Math.floor(Math.random() * 20) + 5,      // Random column count
          `Mock Azure SQL table: ${mockTable.schema}.${mockTable.table}`
        ]
      );

      const assetId = assetResult.rows[0].id;
      console.log(`   ✅ Created ${mockTable.schema}.${mockTable.table} (ID: ${assetId})`);

      // Create mock columns for each table
      const mockColumns = generateMockColumns(mockTable.table);

      for (let i = 0; i < mockColumns.length; i++) {
        const col = mockColumns[i];
        await pool.query(
          `INSERT INTO catalog_columns
           (asset_id, column_name, data_type, ordinal, is_nullable, is_primary_key,
            description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            assetId,
            col.name,
            col.type,
            i + 1,
            col.nullable,
            col.isPrimary || false,
            col.description || `Column ${col.name} of type ${col.type}`
          ]
        );
      }
      console.log(`      Added ${mockColumns.length} columns`);
    }

    // Update data source to mark it as "scanned"
    await pool.query(
      `UPDATE data_sources
       SET updated_at = NOW()
       WHERE id = $1`,
      [azureDs.id]
    );

    console.log('\n✅ Mock Azure catalog data created successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Created ${mockTables.length} tables`);
    console.log(`   - Multiple schemas: dbo, Sales, HR, Finance`);
    console.log(`   - Each table has realistic columns`);

    console.log('\n🎯 How to test:');
    console.log('1. Go to Data Quality page');
    console.log('2. Select "Azure Feya" in filters');
    console.log('3. Click "Rules" → "Create Rule"');
    console.log('4. Open Visual Rule Builder');
    console.log('5. Tables will show in dropdown');
    console.log('6. Select a table - columns will populate');

    console.log('\n⚠️  Note: This is mock data for UI testing.');
    console.log('   Actual column queries will still fail without real Azure credentials.');
    console.log('   But the dropdowns will populate with realistic data!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

function generateMockColumns(tableName) {
  // Generate realistic columns based on table name
  const commonColumns = [
    { name: 'Id', type: 'int', nullable: false, isPrimary: true },
    { name: 'CreatedDate', type: 'datetime2', nullable: false },
    { name: 'ModifiedDate', type: 'datetime2', nullable: true },
    { name: 'CreatedBy', type: 'nvarchar', nullable: false },
    { name: 'ModifiedBy', type: 'nvarchar', nullable: true }
  ];

  const tableSpecificColumns = {
    'Customers': [
      { name: 'FirstName', type: 'nvarchar', nullable: false },
      { name: 'LastName', type: 'nvarchar', nullable: false },
      { name: 'Email', type: 'nvarchar', nullable: false, isUnique: true },
      { name: 'Phone', type: 'nvarchar', nullable: true },
      { name: 'Address', type: 'nvarchar', nullable: true },
      { name: 'City', type: 'nvarchar', nullable: true },
      { name: 'Country', type: 'nvarchar', nullable: true },
      { name: 'PostalCode', type: 'nvarchar', nullable: true }
    ],
    'Orders': [
      { name: 'CustomerId', type: 'int', nullable: false },
      { name: 'OrderDate', type: 'datetime2', nullable: false },
      { name: 'ShipDate', type: 'datetime2', nullable: true },
      { name: 'TotalAmount', type: 'decimal', nullable: false },
      { name: 'Status', type: 'nvarchar', nullable: false },
      { name: 'PaymentMethod', type: 'nvarchar', nullable: true }
    ],
    'Products': [
      { name: 'ProductName', type: 'nvarchar', nullable: false },
      { name: 'CategoryId', type: 'int', nullable: false },
      { name: 'UnitPrice', type: 'decimal', nullable: false },
      { name: 'UnitsInStock', type: 'int', nullable: false },
      { name: 'ReorderLevel', type: 'int', nullable: true },
      { name: 'Discontinued', type: 'bit', nullable: false }
    ],
    'Employees': [
      { name: 'EmployeeNumber', type: 'nvarchar', nullable: false, isUnique: true },
      { name: 'FirstName', type: 'nvarchar', nullable: false },
      { name: 'LastName', type: 'nvarchar', nullable: false },
      { name: 'Email', type: 'nvarchar', nullable: false },
      { name: 'DepartmentId', type: 'int', nullable: false },
      { name: 'HireDate', type: 'date', nullable: false },
      { name: 'Salary', type: 'decimal', nullable: true }
    ],
    'Invoices': [
      { name: 'InvoiceNumber', type: 'nvarchar', nullable: false, isUnique: true },
      { name: 'CustomerId', type: 'int', nullable: false },
      { name: 'InvoiceDate', type: 'date', nullable: false },
      { name: 'DueDate', type: 'date', nullable: false },
      { name: 'TotalAmount', type: 'decimal', nullable: false },
      { name: 'PaidAmount', type: 'decimal', nullable: true },
      { name: 'Status', type: 'nvarchar', nullable: false }
    ]
  };

  // Get specific columns for this table, or use generic ones
  const specificColumns = tableSpecificColumns[tableName] || [
    { name: 'Name', type: 'nvarchar', nullable: false },
    { name: 'Description', type: 'nvarchar', nullable: true },
    { name: 'IsActive', type: 'bit', nullable: false },
    { name: 'Value', type: 'decimal', nullable: true }
  ];

  return [...commonColumns.slice(0, 1), ...specificColumns, ...commonColumns.slice(1)];
}

// Run the setup
setupAzureMockData();