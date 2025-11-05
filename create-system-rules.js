const { Pool } = require('pg');

async function createSystemRules() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://cwic_user:cwic_secure_pass@localhost:5432/cwic_platform'
  });

  console.log('='.repeat(80));
  console.log('CREATING SYSTEM QUALITY RULES');
  console.log('='.repeat(80));

  // System rules that apply to common data quality scenarios
  const systemRules = [
    // Completeness Rules
    {
      name: 'Required Field Check',
      description: 'Ensures critical fields are not null',
      dimension: 'completeness',
      rule_type: 'null_check',
      severity: 'critical',
      expression: '${column} IS NOT NULL',
      is_system: true,
      is_active: true,
      tags: ['system', 'completeness', 'critical'],
      parameters: {
        pattern: 'null_check',
        configurable: true,
        auto_apply_to: ['id', 'email', 'name', 'created_at', 'customer_id', 'order_id']
      }
    },
    {
      name: 'Email Completeness',
      description: 'Checks that email fields are populated',
      dimension: 'completeness',
      rule_type: 'null_check',
      severity: 'high',
      expression: 'email IS NOT NULL AND email != \'\'',
      is_system: true,
      is_active: true,
      tags: ['system', 'email', 'completeness'],
      parameters: {
        pattern: 'null_check',
        column_pattern: '.*email.*',
        configurable: true
      }
    },

    // Validity Rules
    {
      name: 'Email Format Validation',
      description: 'Validates email addresses match standard format',
      dimension: 'validity',
      rule_type: 'pattern_check',
      severity: 'high',
      expression: "${column} SIMILAR TO '%@%.%'",
      is_system: true,
      is_active: true,
      tags: ['system', 'email', 'validity', 'regex'],
      parameters: {
        pattern: 'regex_check',
        regex: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$',
        column_pattern: '.*email.*',
        configurable: true
      }
    },
    {
      name: 'Phone Number Format',
      description: 'Validates phone numbers match expected formats',
      dimension: 'validity',
      rule_type: 'pattern_check',
      severity: 'medium',
      expression: "${column} SIMILAR TO '[0-9() +-]{10,}'",
      is_system: true,
      is_active: true,
      tags: ['system', 'phone', 'validity', 'regex'],
      parameters: {
        pattern: 'regex_check',
        regex: '^\\+?[1-9]\\d{1,14}$',
        column_pattern: '.*(phone|tel|mobile).*',
        configurable: true
      }
    },
    {
      name: 'Date Range Validation',
      description: 'Ensures dates are within reasonable range',
      dimension: 'validity',
      rule_type: 'range_check',
      severity: 'medium',
      expression: '${column} BETWEEN \'1900-01-01\' AND CURRENT_DATE + INTERVAL \'1 year\'',
      is_system: true,
      is_active: true,
      tags: ['system', 'date', 'validity', 'range'],
      parameters: {
        pattern: 'range_check',
        min_value: '1900-01-01',
        max_value: 'CURRENT_DATE + 1 year',
        column_pattern: '.*(date|_at|_on).*',
        configurable: true
      }
    },
    {
      name: 'Positive Amount Check',
      description: 'Ensures amount fields contain positive values',
      dimension: 'validity',
      rule_type: 'range_check',
      severity: 'high',
      expression: '${column} >= 0',
      is_system: true,
      is_active: true,
      tags: ['system', 'amount', 'validity', 'financial'],
      parameters: {
        pattern: 'range_check',
        min_value: 0,
        column_pattern: '.*(amount|price|cost|fee|total|sum).*',
        configurable: true
      }
    },

    // Uniqueness Rules
    {
      name: 'Primary Key Uniqueness',
      description: 'Ensures primary key columns are unique',
      dimension: 'uniqueness',
      rule_type: 'duplicate_check',
      severity: 'critical',
      expression: 'COUNT(*) = COUNT(DISTINCT ${column})',
      is_system: true,
      is_active: true,
      tags: ['system', 'uniqueness', 'primary_key', 'critical'],
      parameters: {
        pattern: 'duplicate_check',
        column_pattern: '.*(^id$|_id$)',
        configurable: false
      }
    },
    {
      name: 'Email Uniqueness',
      description: 'Checks for duplicate email addresses',
      dimension: 'uniqueness',
      rule_type: 'duplicate_check',
      severity: 'high',
      expression: 'COUNT(*) = COUNT(DISTINCT LOWER(${column}))',
      is_system: true,
      is_active: true,
      tags: ['system', 'email', 'uniqueness'],
      parameters: {
        pattern: 'duplicate_check',
        column_pattern: '.*email.*',
        case_sensitive: false,
        configurable: true
      }
    },

    // Consistency Rules
    {
      name: 'Cross-Field Date Consistency',
      description: 'Ensures end dates are after start dates',
      dimension: 'consistency',
      rule_type: 'custom',
      severity: 'high',
      expression: 'CASE WHEN ${end_column} IS NOT NULL THEN ${end_column} >= ${start_column} ELSE TRUE END',
      is_system: true,
      is_active: true,
      tags: ['system', 'date', 'consistency', 'temporal'],
      parameters: {
        pattern: 'cross_field',
        requires_columns: ['start_date', 'end_date'],
        configurable: true
      }
    },
    {
      name: 'Status Transition Validity',
      description: 'Validates status field transitions are logical',
      dimension: 'consistency',
      rule_type: 'custom',
      severity: 'medium',
      expression: '${column} IN (\'pending\', \'active\', \'completed\', \'cancelled\')',
      is_system: true,
      is_active: true,
      tags: ['system', 'status', 'consistency', 'workflow'],
      parameters: {
        pattern: 'enum_check',
        valid_values: ['pending', 'active', 'completed', 'cancelled'],
        column_pattern: '.*status.*',
        configurable: true
      }
    },

    // Accuracy Rules
    {
      name: 'Percentage Range Check',
      description: 'Ensures percentage values are between 0 and 100',
      dimension: 'accuracy',
      rule_type: 'range_check',
      severity: 'high',
      expression: '${column} BETWEEN 0 AND 100',
      is_system: true,
      is_active: true,
      tags: ['system', 'percentage', 'accuracy', 'range'],
      parameters: {
        pattern: 'range_check',
        min_value: 0,
        max_value: 100,
        column_pattern: '.*(percent|pct|rate).*',
        configurable: false
      }
    },
    {
      name: 'Future Date Check',
      description: 'Prevents dates too far in the future',
      dimension: 'accuracy',
      rule_type: 'range_check',
      severity: 'medium',
      expression: '${column} <= CURRENT_DATE + INTERVAL \'10 years\'',
      is_system: true,
      is_active: true,
      tags: ['system', 'date', 'accuracy', 'temporal'],
      parameters: {
        pattern: 'range_check',
        max_value: 'CURRENT_DATE + 10 years',
        column_pattern: '.*(expiry|expire|due).*',
        configurable: true
      }
    },

    // Timeliness Rules
    {
      name: 'Data Freshness Check',
      description: 'Ensures data is not stale',
      dimension: 'timeliness',
      rule_type: 'custom',
      severity: 'medium',
      expression: '${column} >= CURRENT_DATE - INTERVAL \'90 days\'',
      is_system: true,
      is_active: true,
      tags: ['system', 'freshness', 'timeliness'],
      parameters: {
        pattern: 'freshness_check',
        max_age_days: 90,
        column_pattern: '.*(updated_at|modified_at|last_.*_at).*',
        configurable: true
      }
    },

    // Common Business Rules
    {
      name: 'SSN Format Check',
      description: 'Validates US Social Security Numbers',
      dimension: 'validity',
      rule_type: 'pattern_check',
      severity: 'critical',
      expression: "${column} SIMILAR TO '[0-9]{3}-[0-9]{2}-[0-9]{4}'",
      is_system: true,
      is_active: true,
      tags: ['system', 'ssn', 'pii', 'validity', 'compliance'],
      parameters: {
        pattern: 'regex_check',
        regex: '^\\d{3}-\\d{2}-\\d{4}$',
        column_pattern: '.*(ssn|social_security).*',
        is_pii: true,
        configurable: false
      }
    },
    {
      name: 'Credit Card Number Check',
      description: 'Validates credit card number format',
      dimension: 'validity',
      rule_type: 'pattern_check',
      severity: 'critical',
      expression: '${column} ~* \'^[0-9]{13,19}$\'',
      is_system: true,
      is_active: true,
      tags: ['system', 'credit_card', 'pii', 'validity', 'compliance'],
      parameters: {
        pattern: 'regex_check',
        regex: '^[0-9]{13,19}$',
        column_pattern: '.*(card_number|credit_card|cc_number).*',
        is_pii: true,
        configurable: false
      }
    },
    {
      name: 'ZIP Code Format',
      description: 'Validates US ZIP codes',
      dimension: 'validity',
      rule_type: 'pattern_check',
      severity: 'low',
      expression: "${column} SIMILAR TO '[0-9]{5}' OR ${column} SIMILAR TO '[0-9]{5}-[0-9]{4}'",
      is_system: true,
      is_active: true,
      tags: ['system', 'zip_code', 'address', 'validity'],
      parameters: {
        pattern: 'regex_check',
        regex: '^\\d{5}(-\\d{4})?$',
        column_pattern: '.*(zip|postal).*',
        configurable: true
      }
    }
  ];

  try {
    console.log('\n📝 Creating system rules...\n');

    // First, check if system rules already exist
    const existingCount = await pool.query(
      'SELECT COUNT(*) FROM quality_rules WHERE is_system = true'
    );

    if (existingCount.rows[0].count > 0) {
      console.log(`ℹ️  Found ${existingCount.rows[0].count} existing system rules`);
      console.log('   Clearing old system rules...');
      await pool.query('DELETE FROM quality_rules WHERE is_system = true');
    }

    // Insert system rules
    for (const rule of systemRules) {
      try {
        // Store dimension and rule_type in parameters
        const fullParameters = {
          ...rule.parameters,
          dimension: rule.dimension,
          rule_type: rule.rule_type
        };

        const result = await pool.query(
          `INSERT INTO quality_rules
           (name, description, severity, type, expression,
            enabled, is_system, tags, parameters, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::jsonb, NOW(), NOW())
           RETURNING id`,
          [
            rule.name,
            rule.description,
            rule.severity,
            'sql',  // type is always 'sql' for our rules
            rule.expression,
            rule.is_active,
            rule.is_system,
            rule.tags,
            JSON.stringify(fullParameters)
          ]
        );

        console.log(`✅ Created: ${rule.name} (${rule.dimension})`);
      } catch (ruleError) {
        console.error(`❌ Failed to create rule "${rule.name}": ${ruleError.message}`);
        console.error(`   Expression: ${rule.expression}`);
        console.error(`   Tags: ${JSON.stringify(rule.tags)}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('SYSTEM RULES CREATED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   - Created ${systemRules.length} system rules`);
    console.log(`   - Dimensions covered: completeness, validity, uniqueness, consistency, accuracy, timeliness`);
    console.log(`   - All rules are pre-configured and ready to use`);

    console.log('\n🎯 How to use system rules:');
    console.log('1. Go to Data Quality page');
    console.log('2. Look for rules marked with "System" badge');
    console.log('3. System rules can be applied to any matching columns');
    console.log('4. Users can enable/disable but not delete system rules');
    console.log('5. Rules auto-apply to columns matching their patterns');

  } catch (error) {
    console.error('❌ Error creating system rules:', error.message);
  } finally {
    await pool.end();
  }
}

createSystemRules();