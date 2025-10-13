// Rule Templates - Industry Best Practices for Data Quality

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  dimension: 'completeness' | 'accuracy' | 'consistency' | 'validity' | 'freshness' | 'uniqueness';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  sqlTemplate: string;
  parameters: {
    name: string;
    description: string;
    type: 'table' | 'column' | 'threshold' | 'pattern' | 'number';
    required: boolean;
    defaultValue?: any;
  }[];
  examples: string[];
  bestPractices: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  // ============================================================================
  // COMPLETENESS RULES
  // ============================================================================
  {
    id: 'null-rate-check',
    name: 'Null Rate Below Threshold',
    description: 'Ensures that the percentage of null values in a column stays below an acceptable threshold',
    dimension: 'completeness',
    severity: 'high',
    category: 'Missing Data',
    sqlTemplate: `SELECT
  (COUNT(*) FILTER (WHERE {{columnName}} IS NULL))::float / NULLIF(COUNT(*), 0) * 100 < {{threshold}} as passed,
  COUNT(*) FILTER (WHERE {{columnName}} IS NULL) as null_count,
  COUNT(*) as total_rows,
  ROUND((COUNT(*) FILTER (WHERE {{columnName}} IS NULL))::float / NULLIF(COUNT(*), 0) * 100, 2) as null_percentage
FROM {{tableName}}`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Column to check for nulls', type: 'column', required: true },
      { name: 'threshold', description: 'Maximum acceptable null percentage', type: 'threshold', required: true, defaultValue: 5 }
    ],
    examples: [
      'Check that email column has less than 5% nulls',
      'Ensure phone_number is populated in at least 95% of records'
    ],
    bestPractices: 'Critical business fields should have null rates below 1-5%. Optional fields can tolerate higher thresholds.'
  },
  {
    id: 'required-field-check',
    name: 'Required Field Not Null',
    description: 'Ensures that a required field has no null values',
    dimension: 'completeness',
    severity: 'critical',
    category: 'Missing Data',
    sqlTemplate: `SELECT
  COUNT(*) FILTER (WHERE {{columnName}} IS NULL) = 0 as passed,
  COUNT(*) FILTER (WHERE {{columnName}} IS NULL) as null_count,
  COUNT(*) as total_rows
FROM {{tableName}}`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Required column', type: 'column', required: true }
    ],
    examples: [
      'Verify customer_id is never null',
      'Ensure order_date is always populated'
    ],
    bestPractices: 'Use this for primary keys, foreign keys, and essential business fields that must always have values.'
  },

  // ============================================================================
  // UNIQUENESS RULES
  // ============================================================================
  {
    id: 'uniqueness-check',
    name: 'Column Uniqueness',
    description: 'Verifies that a column contains unique values (no duplicates)',
    dimension: 'uniqueness',
    severity: 'critical',
    category: 'Duplicates',
    sqlTemplate: `SELECT
  COUNT(DISTINCT {{columnName}})::float / NULLIF(COUNT(*), 0) >= {{threshold}} as passed,
  COUNT(DISTINCT {{columnName}}) as distinct_count,
  COUNT(*) as total_rows,
  COUNT(*) - COUNT(DISTINCT {{columnName}}) as duplicate_count,
  ROUND((COUNT(DISTINCT {{columnName}})::float / NULLIF(COUNT(*), 0) * 100), 2) as uniqueness_percentage
FROM {{tableName}}
WHERE {{columnName}} IS NOT NULL`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Column that should be unique', type: 'column', required: true },
      { name: 'threshold', description: 'Minimum uniqueness ratio (0-1)', type: 'threshold', required: true, defaultValue: 0.99 }
    ],
    examples: [
      'Verify user_id is unique across all records',
      'Check that email addresses are not duplicated'
    ],
    bestPractices: 'Primary keys and unique identifiers should have 100% uniqueness. Business keys should have > 99% uniqueness.'
  },
  {
    id: 'composite-uniqueness',
    name: 'Composite Key Uniqueness',
    description: 'Checks uniqueness of a combination of columns',
    dimension: 'uniqueness',
    severity: 'high',
    category: 'Duplicates',
    sqlTemplate: `SELECT
  COUNT(*) = COUNT(DISTINCT({{column1}}, {{column2}})) as passed,
  COUNT(*) as total_rows,
  COUNT(DISTINCT({{column1}}, {{column2}})) as unique_combinations,
  COUNT(*) - COUNT(DISTINCT({{column1}}, {{column2}})) as duplicate_combinations
FROM {{tableName}}
WHERE {{column1}} IS NOT NULL AND {{column2}} IS NOT NULL`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'column1', description: 'First column in composite key', type: 'column', required: true },
      { name: 'column2', description: 'Second column in composite key', type: 'column', required: true }
    ],
    examples: [
      'Verify (user_id, product_id) is unique in orders',
      'Check (date, store_id) uniqueness in sales records'
    ],
    bestPractices: 'Use for compound business keys where the combination must be unique even if individual columns can repeat.'
  },

  // ============================================================================
  // VALIDITY RULES
  // ============================================================================
  {
    id: 'email-format',
    name: 'Email Format Validation',
    description: 'Validates that email addresses follow proper format',
    dimension: 'validity',
    severity: 'high',
    category: 'Format Validation',
    sqlTemplate: `SELECT
  (COUNT(*) FILTER (WHERE {{columnName}} !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'))::float / NULLIF(COUNT(*), 0) * 100 < {{threshold}} as passed,
  COUNT(*) FILTER (WHERE {{columnName}} !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$') as invalid_count,
  COUNT(*) as total_rows,
  ROUND((COUNT(*) FILTER (WHERE {{columnName}} !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'))::float / NULLIF(COUNT(*), 0) * 100, 2) as invalid_percentage
FROM {{tableName}}
WHERE {{columnName}} IS NOT NULL`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Email column', type: 'column', required: true },
      { name: 'threshold', description: 'Maximum acceptable invalid percentage', type: 'threshold', required: true, defaultValue: 1 }
    ],
    examples: [
      'Verify customer emails are properly formatted',
      'Check that contact_email matches email pattern'
    ],
    bestPractices: 'Email validation should catch obvious format errors. Consider using more strict validation for critical applications.'
  },
  {
    id: 'phone-format',
    name: 'Phone Number Format',
    description: 'Validates phone number format (US format)',
    dimension: 'validity',
    severity: 'medium',
    category: 'Format Validation',
    sqlTemplate: `SELECT
  (COUNT(*) FILTER (WHERE {{columnName}} !~ '^\\+?1?[2-9]\\d{2}[2-9]\\d{6}$'))::float / NULLIF(COUNT(*), 0) * 100 < {{threshold}} as passed,
  COUNT(*) FILTER (WHERE {{columnName}} !~ '^\\+?1?[2-9]\\d{2}[2-9]\\d{6}$') as invalid_count,
  COUNT(*) as total_rows
FROM {{tableName}}
WHERE {{columnName}} IS NOT NULL`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Phone number column', type: 'column', required: true },
      { name: 'threshold', description: 'Maximum acceptable invalid percentage', type: 'threshold', required: true, defaultValue: 5 }
    ],
    examples: [
      'Validate phone numbers are in correct format',
      'Check mobile_number follows standard pattern'
    ],
    bestPractices: 'Adjust regex pattern based on your country/region. Consider storing phone numbers in E.164 format.'
  },
  {
    id: 'date-range',
    name: 'Date Within Valid Range',
    description: 'Ensures dates fall within an expected range',
    dimension: 'validity',
    severity: 'high',
    category: 'Range Validation',
    sqlTemplate: `SELECT
  COUNT(*) FILTER (WHERE {{columnName}} < '{{minDate}}'::date OR {{columnName}} > '{{maxDate}}'::date) = 0 as passed,
  COUNT(*) FILTER (WHERE {{columnName}} < '{{minDate}}'::date OR {{columnName}} > '{{maxDate}}'::date) as out_of_range_count,
  COUNT(*) as total_rows,
  MIN({{columnName}}) as earliest_date,
  MAX({{columnName}}) as latest_date
FROM {{tableName}}
WHERE {{columnName}} IS NOT NULL`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Date column', type: 'column', required: true },
      { name: 'minDate', description: 'Earliest acceptable date', type: 'string', required: true, defaultValue: '2020-01-01' },
      { name: 'maxDate', description: 'Latest acceptable date', type: 'string', required: true, defaultValue: '2030-12-31' }
    ],
    examples: [
      'Verify birth_date is between 1900 and current year',
      'Check order_date is not in the future'
    ],
    bestPractices: 'Set realistic bounds for dates. Birth dates should be in the past, future dates should be within reasonable planning horizons.'
  },
  {
    id: 'numeric-range',
    name: 'Numeric Value Range',
    description: 'Validates that numbers fall within an acceptable range',
    dimension: 'validity',
    severity: 'medium',
    category: 'Range Validation',
    sqlTemplate: `SELECT
  COUNT(*) FILTER (WHERE {{columnName}} < {{minValue}} OR {{columnName}} > {{maxValue}}) = 0 as passed,
  COUNT(*) FILTER (WHERE {{columnName}} < {{minValue}} OR {{columnName}} > {{maxValue}}) as out_of_range_count,
  COUNT(*) as total_rows,
  MIN({{columnName}}) as min_value,
  MAX({{columnName}}) as max_value,
  AVG({{columnName}}) as avg_value
FROM {{tableName}}
WHERE {{columnName}} IS NOT NULL`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Numeric column', type: 'column', required: true },
      { name: 'minValue', description: 'Minimum acceptable value', type: 'number', required: true, defaultValue: 0 },
      { name: 'maxValue', description: 'Maximum acceptable value', type: 'number', required: true, defaultValue: 1000000 }
    ],
    examples: [
      'Verify age is between 0 and 120',
      'Check price is positive and under $1M'
    ],
    bestPractices: 'Set bounds based on business logic. Prices should be positive, percentages 0-100, ages reasonable.'
  },

  // ============================================================================
  // FRESHNESS RULES
  // ============================================================================
  {
    id: 'data-freshness',
    name: 'Data Freshness Check',
    description: 'Ensures data has been updated recently',
    dimension: 'freshness',
    severity: 'high',
    category: 'Timeliness',
    sqlTemplate: `SELECT
  MAX({{columnName}}) >= NOW() - INTERVAL '{{maxAge}} hours' as passed,
  MAX({{columnName}}) as latest_update,
  NOW() - MAX({{columnName}}) as data_age,
  COUNT(*) as total_rows
FROM {{tableName}}`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Timestamp column', type: 'column', required: true },
      { name: 'maxAge', description: 'Maximum acceptable age in hours', type: 'number', required: true, defaultValue: 24 }
    ],
    examples: [
      'Verify data was updated in last 24 hours',
      'Check updated_at is within last hour'
    ],
    bestPractices: 'Real-time systems should be fresh within minutes. Batch processes can tolerate 24-48 hours.'
  },

  // ============================================================================
  // CONSISTENCY RULES
  // ============================================================================
  {
    id: 'referential-integrity',
    name: 'Referential Integrity Check',
    description: 'Validates foreign key relationships',
    dimension: 'consistency',
    severity: 'critical',
    category: 'Relationships',
    sqlTemplate: `SELECT
  NOT EXISTS (
    SELECT 1 FROM {{childTable}}
    WHERE {{foreignKey}} IS NOT NULL
    AND {{foreignKey}} NOT IN (SELECT {{primaryKey}} FROM {{parentTable}})
  ) as passed,
  (SELECT COUNT(*) FROM {{childTable}} WHERE {{foreignKey}} IS NOT NULL AND {{foreignKey}} NOT IN (SELECT {{primaryKey}} FROM {{parentTable}})) as orphaned_records,
  (SELECT COUNT(*) FROM {{childTable}}) as total_child_records
FROM {{childTable}}
LIMIT 1`,
    parameters: [
      { name: 'childTable', description: 'Table with foreign key', type: 'table', required: true },
      { name: 'foreignKey', description: 'Foreign key column', type: 'column', required: true },
      { name: 'parentTable', description: 'Referenced table', type: 'table', required: true },
      { name: 'primaryKey', description: 'Referenced primary key', type: 'column', required: true }
    ],
    examples: [
      'Verify all order.customer_id values exist in customers.id',
      'Check that product_id references are valid'
    ],
    bestPractices: 'All foreign keys should be valid. Orphaned records indicate data integrity issues or missing cascading deletes.'
  },
  {
    id: 'cross-field-consistency',
    name: 'Cross-Field Logical Consistency',
    description: 'Validates that related fields have consistent values',
    dimension: 'consistency',
    severity: 'high',
    category: 'Business Logic',
    sqlTemplate: `SELECT
  COUNT(*) FILTER (WHERE {{condition}}) = 0 as passed,
  COUNT(*) FILTER (WHERE {{condition}}) as inconsistent_count,
  COUNT(*) as total_rows
FROM {{tableName}}`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'condition', description: 'Logical condition that should NOT be true', type: 'string', required: true }
    ],
    examples: [
      'Verify end_date > start_date',
      'Check that discount_price < regular_price',
      'Ensure shipped_date >= order_date'
    ],
    bestPractices: 'Capture business rules like start/end date ordering, price relationships, status transitions.'
  },

  // ============================================================================
  // ACCURACY RULES
  // ============================================================================
  {
    id: 'statistical-outlier',
    name: 'Statistical Outlier Detection',
    description: 'Identifies values that are statistical outliers',
    dimension: 'accuracy',
    severity: 'medium',
    category: 'Anomaly Detection',
    sqlTemplate: `WITH stats AS (
  SELECT
    AVG({{columnName}}) as mean,
    STDDEV({{columnName}}) as stddev
  FROM {{tableName}}
  WHERE {{columnName}} IS NOT NULL
)
SELECT
  COUNT(*) FILTER (WHERE ABS({{columnName}} - stats.mean) > {{threshold}} * stats.stddev) < COUNT(*) * 0.01 as passed,
  COUNT(*) FILTER (WHERE ABS({{columnName}} - stats.mean) > {{threshold}} * stats.stddev) as outlier_count,
  COUNT(*) as total_rows,
  stats.mean,
  stats.stddev
FROM {{tableName}}, stats
WHERE {{columnName}} IS NOT NULL`,
    parameters: [
      { name: 'tableName', description: 'Table to check', type: 'table', required: true },
      { name: 'columnName', description: 'Numeric column', type: 'column', required: true },
      { name: 'threshold', description: 'Standard deviations from mean', type: 'number', required: true, defaultValue: 3 }
    ],
    examples: [
      'Detect unusually high/low prices',
      'Find anomalous transaction amounts'
    ],
    bestPractices: '3 standard deviations captures 99.7% of normal values. Adjust threshold based on data distribution.'
  }
];

// Helper function to find templates by dimension
export function getTemplatesByDimension(dimension: string): RuleTemplate[] {
  return RULE_TEMPLATES.filter(t => t.dimension === dimension);
}

// Helper function to search templates
export function searchTemplates(query: string): RuleTemplate[] {
  const lowerQuery = query.toLowerCase();
  return RULE_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.category.toLowerCase().includes(lowerQuery)
  );
}

// Helper function to get template by ID
export function getTemplateById(id: string): RuleTemplate | undefined {
  return RULE_TEMPLATES.find(t => t.id === id);
}

// Helper function to get templates by category
export function getTemplatesByCategory(category: string): RuleTemplate[] {
  return RULE_TEMPLATES.filter(t => t.category === category);
}

// Helper function to apply template parameters and generate SQL
export function applyTemplate(templateId: string, parameters: Record<string, any>): string {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  let sql = template.sqlTemplate;

  // Replace all placeholders with actual values
  for (const [key, value] of Object.entries(parameters)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    sql = sql.replace(placeholder, String(value));
  }

  return sql;
}
