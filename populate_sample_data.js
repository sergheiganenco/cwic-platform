#!/usr/bin/env node
/**
 * Populate Sample Data for Column Preview
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass'
});

async function populateSampleData() {
  console.log('🚀 Populating sample data for column preview...\n');

  try {
    // Get columns from catalog_columns with their asset information
    const { rows: columns } = await pool.query(`
      SELECT
        cc.id,
        cc.asset_id,
        cc.column_name,
        cc.data_type,
        cc.data_classification,
        ca.table_name,
        ca.schema_name,
        ca.database_name
      FROM catalog_columns cc
      JOIN catalog_assets ca ON ca.id = cc.asset_id
      WHERE ca.schema_name = 'public'
        AND ca.database_name = 'adventureworks'
      ORDER BY ca.table_name, cc.ordinal
      LIMIT 50
    `);

    console.log(`Found ${columns.length} columns to sample\n`);

    // Connect to AdventureWorks database to get actual sample data
    const awPool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'adventureworks',
      user: 'cwic_user',
      password: 'cwic_secure_pass'
    });

    let updated = 0;

    for (const col of columns) {
      try {
        // Get sample values from the actual table
        const sampleQuery = `
          SELECT DISTINCT "${col.column_name}"
          FROM "${col.schema_name}"."${col.table_name}"
          WHERE "${col.column_name}" IS NOT NULL
          LIMIT 10
        `;

        const { rows: samples } = await awPool.query(sampleQuery);

        if (samples.length > 0) {
          const sampleValues = samples.map(row => {
            const value = row[col.column_name];

            // Mask PII data
            if (col.data_classification) {
              return maskValue(value, col.data_classification);
            }

            return String(value);
          });

          // Update catalog_columns with sample values
          await pool.query(`
            UPDATE catalog_columns
            SET sample_values = $1
            WHERE id = $2
          `, [JSON.stringify(sampleValues), col.id]);

          updated++;
          console.log(`✓ ${col.table_name}.${col.column_name} - ${sampleValues.length} samples`);
        }
      } catch (err) {
        // Skip columns that can't be sampled
        console.log(`⊘ ${col.table_name}.${col.column_name} - ${err.message}`);
      }
    }

    await awPool.end();

    console.log(`\n✅ Updated ${updated} columns with sample data`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

function maskValue(value, piiType) {
  const str = String(value);

  switch (piiType) {
    case 'email':
      const [local, domain] = str.split('@');
      if (local && domain) {
        return `${local[0]}***${local[local.length - 1]}@${domain}`;
      }
      return str;

    case 'phone':
      return `***-***-${str.slice(-4)}`;

    case 'ssn':
      return `***-**-${str.slice(-4)}`;

    case 'credit_card':
      return `****-****-****-${str.slice(-4)}`;

    case 'name':
      return `${str[0]}***`;

    case 'date_of_birth':
      return '****-**-**';

    default:
      return str.slice(0, 3) + '***';
  }
}

// Run the script
populateSampleData();
