#!/usr/bin/env node
/**
 * Comprehensive Quality Issues Population Script
 * Detects PII, creates quality issues with fix scripts, and populates sample data
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cwic_platform',
  user: 'cwic_user',
  password: 'cwic_secure_pass'
});

// Quality issue templates with fix scripts
const ISSUE_TEMPLATES = {
  null_values: {
    type: 'null_values',
    severity: 'high',
    description: 'Column contains NULL values which may cause data integrity issues',
    fix_script_template: (schema, table, column) => `-- Fix NULL values in ${column}
UPDATE ${schema}.${table}
SET ${column} = '<default_value>'
WHERE ${column} IS NULL;

-- Add NOT NULL constraint if needed
ALTER TABLE ${schema}.${table}
ALTER COLUMN ${column} SET NOT NULL;`
  },

  pii_unencrypted: {
    type: 'pii_unencrypted',
    severity: 'critical',
    description: 'Column contains unencrypted PII data which violates security policies',
    fix_script_template: (schema, table, column, piiType) => `-- Encrypt PII data (${piiType})
-- Option 1: Use pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE ${schema}.${table}
SET ${column} = pgp_sym_encrypt(${column}::text, 'encryption_key')
WHERE ${column} IS NOT NULL;

-- Option 2: Mask sensitive data (for display purposes)
UPDATE ${schema}.${table}
SET ${column}_masked = CONCAT(
  LEFT(${column}::text, 3),
  REPEAT('*', GREATEST(LENGTH(${column}::text) - 6, 0)),
  RIGHT(${column}::text, 3)
)
WHERE ${column} IS NOT NULL;`
  },

  duplicate_values: {
    type: 'duplicate_values',
    severity: 'medium',
    description: 'Column contains duplicate values which may indicate data quality issues',
    fix_script_template: (schema, table, column) => `-- Find duplicate values
SELECT ${column}, COUNT(*) as count
FROM ${schema}.${table}
GROUP BY ${column}
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Remove duplicates (keep first occurrence)
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY ${column} ORDER BY id) as rn
  FROM ${schema}.${table}
)
DELETE FROM ${schema}.${table}
WHERE id IN (
  SELECT id FROM numbered WHERE rn > 1
);`
  },

  missing_index: {
    type: 'missing_index',
    severity: 'medium',
    description: 'Column would benefit from an index to improve query performance',
    fix_script_template: (schema, table, column) => `-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_${table}_${column}
ON ${schema}.${table}(${column});

-- Analyze the table to update statistics
ANALYZE ${schema}.${table};`
  },

  timestamp_without_timezone: {
    type: 'invalid_format',
    severity: 'low',
    description: 'Timestamp column lacks timezone information which may cause ambiguity',
    fix_script_template: (schema, table, column) => `-- Convert to timestamp with timezone
ALTER TABLE ${schema}.${table}
ALTER COLUMN ${column} TYPE timestamp with time zone
USING ${column} AT TIME ZONE 'UTC';`
  }
};

async function detectPIIType(columnName, dataType, sampleValues) {
  const lowerName = columnName.toLowerCase();

  // Email detection
  if (lowerName.includes('email') || lowerName.includes('mail')) {
    return 'email';
  }

  // Phone detection
  if (lowerName.includes('phone') || lowerName.includes('tel') || lowerName.includes('mobile')) {
    return 'phone';
  }

  // SSN detection
  if (lowerName.includes('ssn') || lowerName.includes('social_security')) {
    return 'ssn';
  }

  // Credit card detection
  if (lowerName.includes('card') || lowerName.includes('credit_card')) {
    return 'credit_card';
  }

  // Name detection
  if (lowerName.includes('name') || lowerName.includes('first_name') || lowerName.includes('last_name')) {
    return 'name';
  }

  // Address detection
  if (lowerName.includes('address') || lowerName.includes('street') || lowerName.includes('city')) {
    return 'address';
  }

  // IP Address detection
  if (lowerName.includes('ip') || lowerName.includes('ip_address')) {
    return 'ip_address';
  }

  // Date of birth
  if (lowerName.includes('dob') || lowerName.includes('birth') || lowerName.includes('birthday')) {
    return 'date_of_birth';
  }

  return null;
}

async function populateQualityIssues() {
  console.log('🚀 Starting comprehensive quality issues population...\n');

  try {
    // Get all catalog columns
    const { rows: columns } = await pool.query(`
      SELECT
        cc.id,
        cc.asset_id,
        cc.column_name,
        cc.data_type,
        cc.is_nullable,
        cc.is_primary_key,
        cc.is_foreign_key,
        cc.null_percentage,
        cc.unique_percentage,
        cc.sample_values,
        ca.table_name,
        ca.schema_name
      FROM catalog_columns cc
      JOIN catalog_assets ca ON ca.id = cc.asset_id
      WHERE ca.schema_name = 'public'
      ORDER BY ca.table_name, cc.ordinal
    `);

    console.log(`📊 Found ${columns.length} columns to analyze\n`);

    let issuesCreated = 0;
    let piiDetected = 0;

    for (const col of columns) {
      const issues = [];

      console.log(`\n🔍 Analyzing: ${col.table_name}.${col.column_name}`);

      // 1. Detect PII
      const piiType = await detectPIIType(col.column_name, col.data_type, col.sample_values);

      if (piiType) {
        console.log(`   🛡️  PII Detected: ${piiType}`);
        piiDetected++;

        // Update column classification
        await pool.query(`
          UPDATE catalog_columns
          SET data_classification = $1
          WHERE id = $2
        `, [piiType, col.id]);

        // Create PII encryption issue
        const template = ISSUE_TEMPLATES.pii_unencrypted;
        issues.push({
          issue_type: template.type,
          severity: template.severity,
          description: `${template.description} (Type: ${piiType})`,
          affected_rows: null,
          fix_script: template.fix_script_template(col.schema_name, col.table_name, col.column_name, piiType)
        });
      }

      // 2. Check for NULL values
      if (col.is_nullable && col.null_percentage > 0 && col.null_percentage < 100) {
        console.log(`   ⚠️  NULL values detected: ${col.null_percentage.toFixed(1)}%`);
        const template = ISSUE_TEMPLATES.null_values;
        issues.push({
          issue_type: template.type,
          severity: col.null_percentage > 20 ? 'high' : 'medium',
          description: `${template.description} (${col.null_percentage.toFixed(1)}% NULL)`,
          affected_rows: Math.round((col.null_percentage / 100) * 100), // Estimate
          fix_script: template.fix_script_template(col.schema_name, col.table_name, col.column_name)
        });
      }

      // 3. Check for duplicate values (if not a key)
      if (!col.is_primary_key && col.unique_percentage !== null && col.unique_percentage < 90 && col.unique_percentage > 10) {
        console.log(`   🔄 Potential duplicates: ${(100 - col.unique_percentage).toFixed(1)}% duplicate rate`);
        const template = ISSUE_TEMPLATES.duplicate_values;
        issues.push({
          issue_type: template.type,
          severity: 'medium',
          description: `${template.description} (${(100 - col.unique_percentage).toFixed(1)}% duplicate)`,
          affected_rows: Math.round(((100 - col.unique_percentage) / 100) * 100),
          fix_script: template.fix_script_template(col.schema_name, col.table_name, col.column_name)
        });
      }

      // 4. Check for missing indexes on foreign keys
      if (col.is_foreign_key && !col.is_primary_key) {
        console.log(`   📇 Missing index on foreign key`);
        const template = ISSUE_TEMPLATES.missing_index;
        issues.push({
          issue_type: template.type,
          severity: 'medium',
          description: `${template.description} (Foreign key column)`,
          affected_rows: null,
          fix_script: template.fix_script_template(col.schema_name, col.table_name, col.column_name)
        });
      }

      // 5. Check for timestamp without timezone
      if (col.data_type && col.data_type.includes('timestamp') && !col.data_type.includes('with time zone')) {
        console.log(`   🕒 Timestamp without timezone`);
        const template = ISSUE_TEMPLATES.timestamp_without_timezone;
        issues.push({
          issue_type: template.type,
          severity: 'low',
          description: template.description,
          affected_rows: null,
          fix_script: template.fix_script_template(col.schema_name, col.table_name, col.column_name)
        });
      }

      // Store issues in catalog_columns as JSON
      if (issues.length > 0) {
        await pool.query(`
          UPDATE catalog_columns
          SET profile_json = jsonb_set(
            COALESCE(profile_json, '{}'::jsonb),
            '{quality_issues}',
            $1::jsonb
          )
          WHERE id = $2
        `, [JSON.stringify(issues), col.id]);

        issuesCreated += issues.length;
        console.log(`   ✅ Created ${issues.length} quality issue(s)`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📈 SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Columns Analyzed: ${columns.length}`);
    console.log(`PII Columns Detected: ${piiDetected}`);
    console.log(`Quality Issues Created: ${issuesCreated}`);
    console.log('='.repeat(70));
    console.log('\n✅ Quality issues population completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run the script
populateQualityIssues();
