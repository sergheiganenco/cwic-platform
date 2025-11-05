// Mock Data Generators for Testing Different Database Scenarios
import { DataSourceType } from '@/types/dataSources';

// Generate mock rule execution results based on database type
export const generateMockRuleResult = (
  databaseType: DataSourceType,
  ruleType: string,
  scenario: 'success' | 'partial_fail' | 'complete_fail' | 'error' = 'success'
) => {
  const baseResult = {
    ruleId: `rule_${Math.random().toString(36).substr(2, 9)}`,
    executedAt: new Date().toISOString(),
    databaseType,
    ruleType
  };

  switch (scenario) {
    case 'success':
      return {
        ...baseResult,
        status: 'passed',
        rowsChecked: 10000,
        rowsFailed: 0,
        passRate: 100,
        executionTimeMs: Math.floor(Math.random() * 500) + 100,
        message: `All rows passed validation on ${databaseType}`
      };

    case 'partial_fail':
      const failedRows = Math.floor(Math.random() * 500) + 50;
      const totalRows = 10000;
      return {
        ...baseResult,
        status: 'failed',
        rowsChecked: totalRows,
        rowsFailed: failedRows,
        passRate: ((totalRows - failedRows) / totalRows) * 100,
        executionTimeMs: Math.floor(Math.random() * 1000) + 200,
        message: `Found ${failedRows} issues in ${databaseType} data`,
        issues: generateMockIssues(databaseType, ruleType, failedRows)
      };

    case 'complete_fail':
      return {
        ...baseResult,
        status: 'failed',
        rowsChecked: 10000,
        rowsFailed: 10000,
        passRate: 0,
        executionTimeMs: Math.floor(Math.random() * 2000) + 500,
        message: `All rows failed validation in ${databaseType}`,
        issues: generateMockIssues(databaseType, ruleType, 10000)
      };

    case 'error':
      return {
        ...baseResult,
        status: 'error',
        rowsChecked: 0,
        rowsFailed: 0,
        passRate: 0,
        executionTimeMs: Math.floor(Math.random() * 100) + 10,
        errorMessage: generateDatabaseError(databaseType),
        executionError: true
      };
  }
};

// Generate database-specific error messages
export const generateDatabaseError = (databaseType: DataSourceType): string => {
  const errors: Record<string, string[]> = {
    postgresql: [
      'ERROR: column "unknown_column" does not exist',
      'ERROR: permission denied for schema public',
      'ERROR: relation "non_existent_table" does not exist',
      'ERROR: syntax error at or near "LIMIT"',
      'ERROR: could not connect to server: Connection refused'
    ],
    mysql: [
      "Unknown column 'unknown_column' in 'field list'",
      "Table 'database.table' doesn't exist",
      "Access denied for user 'user'@'localhost'",
      "You have an error in your SQL syntax",
      "Can't connect to MySQL server on 'localhost'"
    ],
    mssql: [
      "Invalid column name 'unknown_column'",
      "Invalid object name 'dbo.non_existent_table'",
      "The SELECT permission was denied on the object",
      "Incorrect syntax near 'LIMIT'",
      "Cannot open database requested by the login"
    ],
    oracle: [
      "ORA-00942: table or view does not exist",
      "ORA-00904: invalid identifier",
      "ORA-01031: insufficient privileges",
      "ORA-00933: SQL command not properly ended",
      "ORA-12154: TNS:could not resolve the connect identifier"
    ],
    mongodb: [
      "MongoError: Collection not found",
      "MongoError: Field 'unknown_field' not found",
      "MongoError: not authorized on database",
      "MongoError: Invalid aggregation pipeline",
      "MongoServerError: connection refused"
    ],
    snowflake: [
      "SQL compilation error: Object 'TABLE_NAME' does not exist",
      "SQL compilation error: Column 'UNKNOWN_COLUMN' not found",
      "Insufficient privileges to operate on database",
      "SQL compilation error: syntax error",
      "Network error: Could not reach Snowflake"
    ],
    bigquery: [
      "Table not found: dataset.table",
      "Unrecognized name: unknown_column",
      "Access Denied: BigQuery requires permission",
      "Syntax error: Unexpected keyword LIMIT",
      "Could not connect to BigQuery API"
    ],
    redshift: [
      "ERROR: relation \"table\" does not exist",
      "ERROR: column \"unknown\" does not exist",
      "ERROR: permission denied for relation table",
      "ERROR: syntax error at or near \"LIMIT\"",
      "ERROR: could not connect to server"
    ]
  };

  const dbErrors = errors[databaseType] || errors.postgresql;
  return dbErrors[Math.floor(Math.random() * dbErrors.length)];
};

// Generate mock data quality issues
export const generateMockIssues = (
  databaseType: DataSourceType,
  ruleType: string,
  count: number
) => {
  const issues = [];
  const issueTemplates = getIssueTemplates(databaseType, ruleType);

  for (let i = 0; i < Math.min(count, 100); i++) {
    const template = issueTemplates[Math.floor(Math.random() * issueTemplates.length)];
    issues.push({
      id: `issue_${Math.random().toString(36).substr(2, 9)}`,
      row_id: Math.floor(Math.random() * 10000),
      column: template.column,
      value: template.value,
      issue_type: template.type,
      severity: template.severity,
      description: template.description
    });
  }

  return issues;
};

// Get issue templates based on database and rule type
const getIssueTemplates = (databaseType: DataSourceType, ruleType: string) => {
  const commonIssues = {
    nullCheck: [
      { column: 'email', value: null, type: 'null_value', severity: 'high', description: 'Required field is null' },
      { column: 'customer_id', value: null, type: 'null_value', severity: 'critical', description: 'Primary key cannot be null' },
      { column: 'created_date', value: null, type: 'null_value', severity: 'medium', description: 'Timestamp field is null' }
    ],
    duplicateCheck: [
      { column: 'order_id', value: 'ORD-12345', type: 'duplicate', severity: 'high', description: 'Duplicate order ID found' },
      { column: 'email', value: 'test@example.com', type: 'duplicate', severity: 'medium', description: 'Duplicate email address' },
      { column: 'sku', value: 'PROD-001', type: 'duplicate', severity: 'low', description: 'Duplicate product SKU' }
    ],
    rangeCheck: [
      { column: 'age', value: 150, type: 'out_of_range', severity: 'medium', description: 'Age value exceeds maximum (120)' },
      { column: 'price', value: -10, type: 'out_of_range', severity: 'high', description: 'Negative price not allowed' },
      { column: 'quantity', value: 999999, type: 'out_of_range', severity: 'low', description: 'Unusually high quantity' }
    ],
    patternCheck: [
      { column: 'email', value: 'invalid-email', type: 'pattern_mismatch', severity: 'high', description: 'Invalid email format' },
      { column: 'phone', value: '123', type: 'pattern_mismatch', severity: 'medium', description: 'Invalid phone number format' },
      { column: 'postal_code', value: 'ABCDE', type: 'pattern_mismatch', severity: 'low', description: 'Invalid postal code format' }
    ],
    freshnessCheck: [
      { column: 'last_updated', value: '2020-01-01', type: 'stale_data', severity: 'high', description: 'Data not updated in 3+ years' },
      { column: 'sync_date', value: '2023-01-01', type: 'stale_data', severity: 'medium', description: 'Data older than 1 year' },
      { column: 'created_at', value: '2099-01-01', type: 'future_date', severity: 'critical', description: 'Date is in the future' }
    ]
  };

  // Database-specific issues
  const dbSpecificIssues: Record<string, any> = {
    mongodb: {
      schemaCheck: [
        { column: '_id', value: 'invalid_objectid', type: 'invalid_type', severity: 'critical', description: 'Invalid ObjectId format' },
        { column: 'nested.field', value: null, type: 'missing_field', severity: 'medium', description: 'Required nested field missing' },
        { column: 'array_field', value: '[]', type: 'empty_array', severity: 'low', description: 'Array field is empty' }
      ]
    },
    postgresql: {
      constraintCheck: [
        { column: 'foreign_key', value: 999999, type: 'fk_violation', severity: 'high', description: 'Foreign key constraint violation' },
        { column: 'unique_field', value: 'duplicate', type: 'unique_violation', severity: 'high', description: 'Unique constraint violation' },
        { column: 'check_field', value: -1, type: 'check_violation', severity: 'medium', description: 'Check constraint violation' }
      ]
    },
    bigquery: {
      partitionCheck: [
        { column: '_PARTITIONDATE', value: null, type: 'missing_partition', severity: 'high', description: 'Partition date is missing' },
        { column: 'clustering_key', value: null, type: 'clustering_issue', severity: 'medium', description: 'Clustering key is null' }
      ]
    },
    snowflake: {
      variantCheck: [
        { column: 'json_data', value: 'invalid_json', type: 'invalid_variant', severity: 'high', description: 'Invalid VARIANT data type' },
        { column: 'semi_structured', value: null, type: 'null_variant', severity: 'medium', description: 'VARIANT column is null' }
      ]
    }
  };

  // Get common issues for the rule type
  const issues = commonIssues[ruleType] || commonIssues.nullCheck;

  // Add database-specific issues if available
  if (dbSpecificIssues[databaseType] && dbSpecificIssues[databaseType][ruleType]) {
    issues.push(...dbSpecificIssues[databaseType][ruleType]);
  }

  return issues;
};

// Generate sample queries for different databases
export const generateSampleQuery = (
  databaseType: DataSourceType,
  ruleType: string,
  tableName: string = 'sample_table',
  columnName: string = 'sample_column'
): string => {
  const queries: Record<string, Record<string, string>> = {
    postgresql: {
      nullCheck: `SELECT COUNT(*) FILTER (WHERE ${columnName} IS NULL) as null_count,
       COUNT(*) as total_count
FROM ${tableName}`,
      duplicateCheck: `SELECT ${columnName}, COUNT(*) as count
FROM ${tableName}
GROUP BY ${columnName}
HAVING COUNT(*) > 1`,
      rangeCheck: `SELECT COUNT(*) FILTER (WHERE ${columnName} < 0 OR ${columnName} > 100) as out_of_range,
       COUNT(*) as total_count
FROM ${tableName}`,
      patternCheck: `SELECT COUNT(*) FILTER (WHERE ${columnName} !~ '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$') as invalid,
       COUNT(*) as total_count
FROM ${tableName}`,
      freshnessCheck: `SELECT MAX(${columnName}) as latest_date,
       CURRENT_DATE - MAX(${columnName})::date as days_old
FROM ${tableName}`
    },
    mysql: {
      nullCheck: `SELECT SUM(CASE WHEN ${columnName} IS NULL THEN 1 ELSE 0 END) as null_count,
       COUNT(*) as total_count
FROM ${tableName}`,
      duplicateCheck: `SELECT ${columnName}, COUNT(*) as count
FROM ${tableName}
GROUP BY ${columnName}
HAVING COUNT(*) > 1`,
      rangeCheck: `SELECT SUM(CASE WHEN ${columnName} < 0 OR ${columnName} > 100 THEN 1 ELSE 0 END) as out_of_range,
       COUNT(*) as total_count
FROM ${tableName}`,
      patternCheck: `SELECT SUM(CASE WHEN ${columnName} NOT REGEXP '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$' THEN 1 ELSE 0 END) as invalid,
       COUNT(*) as total_count
FROM ${tableName}`,
      freshnessCheck: `SELECT MAX(${columnName}) as latest_date,
       DATEDIFF(CURDATE(), MAX(${columnName})) as days_old
FROM ${tableName}`
    },
    mssql: {
      nullCheck: `SELECT SUM(CASE WHEN ${columnName} IS NULL THEN 1 ELSE 0 END) as null_count,
       COUNT(*) as total_count
FROM ${tableName}`,
      duplicateCheck: `SELECT TOP 100 ${columnName}, COUNT(*) as count
FROM ${tableName}
GROUP BY ${columnName}
HAVING COUNT(*) > 1`,
      rangeCheck: `SELECT SUM(CASE WHEN ${columnName} < 0 OR ${columnName} > 100 THEN 1 ELSE 0 END) as out_of_range,
       COUNT(*) as total_count
FROM ${tableName}`,
      patternCheck: `SELECT SUM(CASE WHEN ${columnName} NOT LIKE '%@%.%' THEN 1 ELSE 0 END) as invalid,
       COUNT(*) as total_count
FROM ${tableName}`,
      freshnessCheck: `SELECT MAX(${columnName}) as latest_date,
       DATEDIFF(day, MAX(${columnName}), GETDATE()) as days_old
FROM ${tableName}`
    },
    mongodb: {
      nullCheck: `db.${tableName}.aggregate([
  { $facet: {
    nullCount: [
      { $match: { ${columnName}: null } },
      { $count: "count" }
    ],
    totalCount: [ { $count: "count" } ]
  }}
])`,
      duplicateCheck: `db.${tableName}.aggregate([
  { $group: {
    _id: "$${columnName}",
    count: { $sum: 1 }
  }},
  { $match: { count: { $gt: 1 } } }
])`,
      rangeCheck: `db.${tableName}.aggregate([
  { $facet: {
    outOfRange: [
      { $match: { $or: [
        { ${columnName}: { $lt: 0 } },
        { ${columnName}: { $gt: 100 } }
      ]}},
      { $count: "count" }
    ],
    totalCount: [ { $count: "count" } ]
  }}
])`,
      patternCheck: `db.${tableName}.find({
  ${columnName}: { $not: /^[\\w._%+-]+@[\\w.-]+\\.[A-Z]{2,}$/i }
}).count()`,
      freshnessCheck: `db.${tableName}.aggregate([
  { $group: {
    _id: null,
    latestDate: { $max: "$${columnName}" }
  }}
])`
    },
    snowflake: {
      nullCheck: `SELECT COUNT_IF(${columnName} IS NULL) as null_count,
       COUNT(*) as total_count
FROM ${tableName}`,
      duplicateCheck: `SELECT ${columnName}, COUNT(*) as count
FROM ${tableName}
GROUP BY ${columnName}
HAVING COUNT(*) > 1
LIMIT 100`,
      rangeCheck: `SELECT COUNT_IF(${columnName} < 0 OR ${columnName} > 100) as out_of_range,
       COUNT(*) as total_count
FROM ${tableName}`,
      patternCheck: `SELECT COUNT_IF(NOT RLIKE(${columnName}, '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\\\.[A-Z]{2,}$', 'i')) as invalid,
       COUNT(*) as total_count
FROM ${tableName}`,
      freshnessCheck: `SELECT MAX(${columnName}) as latest_date,
       DATEDIFF('day', MAX(${columnName}), CURRENT_DATE()) as days_old
FROM ${tableName}`
    },
    bigquery: {
      nullCheck: `SELECT COUNTIF(${columnName} IS NULL) as null_count,
       COUNT(*) as total_count
FROM \`${tableName}\``,
      duplicateCheck: `SELECT ${columnName}, COUNT(*) as count
FROM \`${tableName}\`
GROUP BY ${columnName}
HAVING COUNT(*) > 1
LIMIT 100`,
      rangeCheck: `SELECT COUNTIF(${columnName} < 0 OR ${columnName} > 100) as out_of_range,
       COUNT(*) as total_count
FROM \`${tableName}\``,
      patternCheck: `SELECT COUNTIF(NOT REGEXP_CONTAINS(${columnName}, r'^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$')) as invalid,
       COUNT(*) as total_count
FROM \`${tableName}\``,
      freshnessCheck: `SELECT MAX(${columnName}) as latest_date,
       DATE_DIFF(CURRENT_DATE(), MAX(${columnName}), DAY) as days_old
FROM \`${tableName}\``
    }
  };

  // Return the query for the specific database and rule type
  const dbQueries = queries[databaseType] || queries.postgresql;
  return dbQueries[ruleType] || dbQueries.nullCheck;
};

// Generate test data for different scenarios
export const generateTestScenarios = (databaseType: DataSourceType) => {
  return [
    {
      name: 'All Rules Pass',
      description: 'All quality rules pass with 100% success rate',
      rules: [
        { type: 'nullCheck', scenario: 'success' },
        { type: 'duplicateCheck', scenario: 'success' },
        { type: 'rangeCheck', scenario: 'success' },
        { type: 'patternCheck', scenario: 'success' },
        { type: 'freshnessCheck', scenario: 'success' }
      ]
    },
    {
      name: 'Mixed Results',
      description: 'Some rules pass, some fail with various severity levels',
      rules: [
        { type: 'nullCheck', scenario: 'success' },
        { type: 'duplicateCheck', scenario: 'partial_fail' },
        { type: 'rangeCheck', scenario: 'success' },
        { type: 'patternCheck', scenario: 'partial_fail' },
        { type: 'freshnessCheck', scenario: 'success' }
      ]
    },
    {
      name: 'Critical Failures',
      description: 'Multiple rules fail with critical issues',
      rules: [
        { type: 'nullCheck', scenario: 'complete_fail' },
        { type: 'duplicateCheck', scenario: 'complete_fail' },
        { type: 'rangeCheck', scenario: 'partial_fail' },
        { type: 'patternCheck', scenario: 'complete_fail' },
        { type: 'freshnessCheck', scenario: 'partial_fail' }
      ]
    },
    {
      name: 'Database Connection Error',
      description: 'Unable to connect to the database',
      rules: [
        { type: 'nullCheck', scenario: 'error' },
        { type: 'duplicateCheck', scenario: 'error' },
        { type: 'rangeCheck', scenario: 'error' },
        { type: 'patternCheck', scenario: 'error' },
        { type: 'freshnessCheck', scenario: 'error' }
      ]
    },
    {
      name: 'Permission Errors',
      description: 'Insufficient permissions to execute rules',
      rules: [
        { type: 'nullCheck', scenario: 'error' },
        { type: 'duplicateCheck', scenario: 'error' },
        { type: 'rangeCheck', scenario: 'success' },
        { type: 'patternCheck', scenario: 'success' },
        { type: 'freshnessCheck', scenario: 'error' }
      ]
    }
  ];
};

// Generate performance metrics for different database types
export const generatePerformanceMetrics = (databaseType: DataSourceType) => {
  const baseMetrics = {
    postgresql: { avgResponseTime: 150, throughput: 1000, latency: 10 },
    mysql: { avgResponseTime: 120, throughput: 1200, latency: 8 },
    mssql: { avgResponseTime: 180, throughput: 900, latency: 12 },
    oracle: { avgResponseTime: 200, throughput: 800, latency: 15 },
    mongodb: { avgResponseTime: 80, throughput: 1500, latency: 5 },
    snowflake: { avgResponseTime: 300, throughput: 500, latency: 25 },
    bigquery: { avgResponseTime: 250, throughput: 600, latency: 20 },
    redshift: { avgResponseTime: 280, throughput: 550, latency: 22 }
  };

  const metrics = baseMetrics[databaseType] || baseMetrics.postgresql;

  // Add some randomness to simulate real-world variance
  return {
    avgResponseTime: metrics.avgResponseTime + Math.floor(Math.random() * 50) - 25,
    throughput: metrics.throughput + Math.floor(Math.random() * 200) - 100,
    latency: metrics.latency + Math.floor(Math.random() * 5) - 2,
    cpuUsage: Math.floor(Math.random() * 30) + 20,
    memoryUsage: Math.floor(Math.random() * 40) + 30,
    diskIO: Math.floor(Math.random() * 100) + 50,
    connectionCount: Math.floor(Math.random() * 50) + 10
  };
};