// Database-specific rule adapters for quality checks
import { DataSourceType } from '@/types/dataSources';

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  ruleType: 'sql' | 'nosql' | 'api';
  dimension: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  supportedDatabases: DataSourceType[];
  queryTemplate: string | ((params: any) => string);
  resultInterpreter?: (result: any) => RuleResult;
}

export interface RuleResult {
  status: 'passed' | 'failed' | 'error';
  issuesFound: number;
  passRate: number;
  message?: string;
  details?: any;
}

// Database-specific query templates
export const DATABASE_QUERY_TEMPLATES = {
  // NULL CHECK - Different syntax for different databases
  nullCheck: {
    postgresql: (table: string, column: string) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${column} IS NULL THEN 1 END) as null_count
      FROM ${table}
    `,
    mysql: (table: string, column: string) => `
      SELECT
        COUNT(*) as total_rows,
        SUM(CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END) as null_count
      FROM ${table}
    `,
    mssql: (table: string, column: string) => `
      SELECT
        COUNT(*) as total_rows,
        SUM(CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END) as null_count
      FROM ${table}
    `,
    oracle: (table: string, column: string) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${column} IS NULL THEN 1 END) as null_count
      FROM ${table}
    `,
    mongodb: (collection: string, field: string) => ({
      aggregate: [
        {
          $facet: {
            total: [{ $count: "count" }],
            nulls: [
              { $match: { [field]: null } },
              { $count: "count" }
            ]
          }
        }
      ]
    }),
    sqlite: (table: string, column: string) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${column} IS NULL THEN 1 END) as null_count
      FROM ${table}
    `
  },

  // DUPLICATE CHECK
  duplicateCheck: {
    postgresql: (table: string, columns: string[]) => `
      WITH duplicates AS (
        SELECT ${columns.join(', ')}, COUNT(*) as duplicate_count
        FROM ${table}
        GROUP BY ${columns.join(', ')}
        HAVING COUNT(*) > 1
      )
      SELECT
        (SELECT COUNT(*) FROM ${table}) as total_rows,
        COALESCE(SUM(duplicate_count - 1), 0) as duplicate_rows
      FROM duplicates
    `,
    mysql: (table: string, columns: string[]) => `
      SELECT
        (SELECT COUNT(*) FROM ${table}) as total_rows,
        (SELECT COUNT(*) FROM (
          SELECT ${columns.join(', ')}
          FROM ${table}
          GROUP BY ${columns.join(', ')}
          HAVING COUNT(*) > 1
        ) as dups) as duplicate_groups
    `,
    mongodb: (collection: string, fields: string[]) => ({
      aggregate: [
        {
          $group: {
            _id: fields.reduce((acc, field) => ({...acc, [field]: `$${field}`}), {}),
            count: { $sum: 1 }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        },
        {
          $group: {
            _id: null,
            duplicates: { $sum: { $subtract: ["$count", 1] } }
          }
        }
      ]
    })
  },

  // FRESHNESS CHECK
  freshnessCheck: {
    postgresql: (table: string, dateColumn: string, thresholdHours: number) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${dateColumn} < NOW() - INTERVAL '${thresholdHours} hours' THEN 1 END) as stale_rows
      FROM ${table}
    `,
    mysql: (table: string, dateColumn: string, thresholdHours: number) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${dateColumn} < DATE_SUB(NOW(), INTERVAL ${thresholdHours} HOUR) THEN 1 END) as stale_rows
      FROM ${table}
    `,
    mssql: (table: string, dateColumn: string, thresholdHours: number) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${dateColumn} < DATEADD(hour, -${thresholdHours}, GETDATE()) THEN 1 END) as stale_rows
      FROM ${table}
    `,
    oracle: (table: string, dateColumn: string, thresholdHours: number) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${dateColumn} < SYSDATE - ${thresholdHours}/24 THEN 1 END) as stale_rows
      FROM ${table}
    `,
    mongodb: (collection: string, field: string, thresholdHours: number) => ({
      aggregate: [
        {
          $facet: {
            total: [{ $count: "count" }],
            stale: [
              {
                $match: {
                  [field]: {
                    $lt: new Date(Date.now() - thresholdHours * 60 * 60 * 1000)
                  }
                }
              },
              { $count: "count" }
            ]
          }
        }
      ]
    })
  },

  // RANGE CHECK
  rangeCheck: {
    postgresql: (table: string, column: string, min: number, max: number) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${column} < ${min} OR ${column} > ${max} THEN 1 END) as out_of_range
      FROM ${table}
    `,
    mysql: (table: string, column: string, min: number, max: number) => `
      SELECT
        COUNT(*) as total_rows,
        SUM(CASE WHEN ${column} < ${min} OR ${column} > ${max} THEN 1 ELSE 0 END) as out_of_range
      FROM ${table}
    `,
    mongodb: (collection: string, field: string, min: number, max: number) => ({
      aggregate: [
        {
          $facet: {
            total: [{ $count: "count" }],
            outOfRange: [
              {
                $match: {
                  $or: [
                    { [field]: { $lt: min } },
                    { [field]: { $gt: max } }
                  ]
                }
              },
              { $count: "count" }
            ]
          }
        }
      ]
    })
  },

  // PATTERN CHECK (Email, Phone, etc.)
  patternCheck: {
    postgresql: (table: string, column: string, pattern: string) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${column} !~ '${pattern}' THEN 1 END) as invalid_format
      FROM ${table}
    `,
    mysql: (table: string, column: string, pattern: string) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${column} NOT REGEXP '${pattern}' THEN 1 END) as invalid_format
      FROM ${table}
    `,
    mssql: (table: string, column: string, pattern: string) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN ${column} NOT LIKE '${pattern}' THEN 1 END) as invalid_format
      FROM ${table}
    `,
    oracle: (table: string, column: string, pattern: string) => `
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN NOT REGEXP_LIKE(${column}, '${pattern}') THEN 1 END) as invalid_format
      FROM ${table}
    `,
    mongodb: (collection: string, field: string, pattern: string) => ({
      aggregate: [
        {
          $facet: {
            total: [{ $count: "count" }],
            invalid: [
              {
                $match: {
                  [field]: { $not: new RegExp(pattern) }
                }
              },
              { $count: "count" }
            ]
          }
        }
      ]
    })
  }
};

// Get appropriate query template for database type
export function getQueryTemplate(
  databaseType: DataSourceType,
  ruleType: string,
  params: any
): string | object {
  const templates = DATABASE_QUERY_TEMPLATES[ruleType];
  if (!templates) {
    throw new Error(`Unsupported rule type: ${ruleType}`);
  }

  const template = templates[databaseType];
  if (!template) {
    throw new Error(`Rule type '${ruleType}' not supported for database '${databaseType}'`);
  }

  return typeof template === 'function' ? template(...params) : template;
}

// Interpret query results based on database type
export function interpretQueryResult(
  databaseType: DataSourceType,
  ruleType: string,
  result: any
): RuleResult {
  // Handle MongoDB results
  if (databaseType === 'mongodb') {
    return interpretMongoResult(ruleType, result);
  }

  // Handle SQL results
  return interpretSQLResult(ruleType, result);
}

function interpretSQLResult(ruleType: string, result: any): RuleResult {
  const rows = result.rows || result;
  if (!rows || rows.length === 0) {
    return {
      status: 'error',
      issuesFound: 0,
      passRate: 0,
      message: 'No data returned from query'
    };
  }

  const firstRow = rows[0];
  const totalRows = parseInt(firstRow.total_rows || firstRow.total || 0);

  if (totalRows === 0) {
    return {
      status: 'passed',
      issuesFound: 0,
      passRate: 100,
      message: 'No data to check'
    };
  }

  let issuesFound = 0;
  let message = '';

  switch (ruleType) {
    case 'nullCheck':
      issuesFound = parseInt(firstRow.null_count || 0);
      message = issuesFound > 0 ? `Found ${issuesFound} NULL values` : 'No NULL values found';
      break;

    case 'duplicateCheck':
      issuesFound = parseInt(firstRow.duplicate_rows || firstRow.duplicate_groups || 0);
      message = issuesFound > 0 ? `Found ${issuesFound} duplicate records` : 'No duplicates found';
      break;

    case 'freshnessCheck':
      issuesFound = parseInt(firstRow.stale_rows || 0);
      message = issuesFound > 0 ? `Found ${issuesFound} stale records` : 'All data is fresh';
      break;

    case 'rangeCheck':
      issuesFound = parseInt(firstRow.out_of_range || 0);
      message = issuesFound > 0 ? `Found ${issuesFound} values out of range` : 'All values within range';
      break;

    case 'patternCheck':
      issuesFound = parseInt(firstRow.invalid_format || 0);
      message = issuesFound > 0 ? `Found ${issuesFound} invalid formats` : 'All formats valid';
      break;

    default:
      issuesFound = 0;
      message = 'Unknown rule type';
  }

  const passRate = Math.round(((totalRows - issuesFound) / totalRows) * 100);

  return {
    status: issuesFound > 0 ? 'failed' : 'passed',
    issuesFound,
    passRate,
    message,
    details: {
      totalRows,
      issuesFound
    }
  };
}

function interpretMongoResult(ruleType: string, result: any): RuleResult {
  if (!result || result.length === 0) {
    return {
      status: 'error',
      issuesFound: 0,
      passRate: 0,
      message: 'No data returned from MongoDB aggregation'
    };
  }

  const aggregateResult = result[0];
  const total = aggregateResult.total?.[0]?.count || 0;

  if (total === 0) {
    return {
      status: 'passed',
      issuesFound: 0,
      passRate: 100,
      message: 'No documents to check'
    };
  }

  let issuesFound = 0;
  let message = '';

  switch (ruleType) {
    case 'nullCheck':
      issuesFound = aggregateResult.nulls?.[0]?.count || 0;
      message = issuesFound > 0 ? `Found ${issuesFound} documents with NULL values` : 'No NULL values found';
      break;

    case 'duplicateCheck':
      issuesFound = aggregateResult.duplicates || 0;
      message = issuesFound > 0 ? `Found ${issuesFound} duplicate documents` : 'No duplicates found';
      break;

    case 'freshnessCheck':
      issuesFound = aggregateResult.stale?.[0]?.count || 0;
      message = issuesFound > 0 ? `Found ${issuesFound} stale documents` : 'All data is fresh';
      break;

    case 'rangeCheck':
      issuesFound = aggregateResult.outOfRange?.[0]?.count || 0;
      message = issuesFound > 0 ? `Found ${issuesFound} values out of range` : 'All values within range';
      break;

    case 'patternCheck':
      issuesFound = aggregateResult.invalid?.[0]?.count || 0;
      message = issuesFound > 0 ? `Found ${issuesFound} invalid formats` : 'All formats valid';
      break;

    default:
      issuesFound = 0;
      message = 'Unknown rule type';
  }

  const passRate = Math.round(((total - issuesFound) / total) * 100);

  return {
    status: issuesFound > 0 ? 'failed' : 'passed',
    issuesFound,
    passRate,
    message,
    details: {
      totalDocuments: total,
      issuesFound
    }
  };
}

// Get sample rules for a database type
export function getSampleRules(databaseType: DataSourceType): RuleTemplate[] {
  const commonRules: RuleTemplate[] = [
    {
      id: 'null-check',
      name: 'NULL Value Check',
      description: 'Checks for NULL values in critical columns',
      ruleType: isNoSQLDatabase(databaseType) ? 'nosql' : 'sql',
      dimension: 'completeness',
      severity: 'high',
      supportedDatabases: getAllDatabaseTypes(),
      queryTemplate: (params) => getQueryTemplate(databaseType, 'nullCheck', params)
    },
    {
      id: 'duplicate-check',
      name: 'Duplicate Record Check',
      description: 'Identifies duplicate records based on key columns',
      ruleType: isNoSQLDatabase(databaseType) ? 'nosql' : 'sql',
      dimension: 'uniqueness',
      severity: 'medium',
      supportedDatabases: getAllDatabaseTypes(),
      queryTemplate: (params) => getQueryTemplate(databaseType, 'duplicateCheck', params)
    },
    {
      id: 'freshness-check',
      name: 'Data Freshness Check',
      description: 'Ensures data is updated within acceptable timeframe',
      ruleType: isNoSQLDatabase(databaseType) ? 'nosql' : 'sql',
      dimension: 'timeliness',
      severity: 'medium',
      supportedDatabases: getAllDatabaseTypes(),
      queryTemplate: (params) => getQueryTemplate(databaseType, 'freshnessCheck', params)
    }
  ];

  // Add SQL-specific rules
  if (!isNoSQLDatabase(databaseType)) {
    commonRules.push(
      {
        id: 'range-check',
        name: 'Range Validation',
        description: 'Validates numeric values are within expected range',
        ruleType: 'sql',
        dimension: 'validity',
        severity: 'low',
        supportedDatabases: getSQLDatabases(),
        queryTemplate: (params) => getQueryTemplate(databaseType, 'rangeCheck', params)
      },
      {
        id: 'pattern-check',
        name: 'Pattern Validation',
        description: 'Validates text fields match expected patterns',
        ruleType: 'sql',
        dimension: 'validity',
        severity: 'medium',
        supportedDatabases: getSQLDatabases(),
        queryTemplate: (params) => getQueryTemplate(databaseType, 'patternCheck', params)
      }
    );
  }

  return commonRules;
}

// Helper functions
function isNoSQLDatabase(type: DataSourceType): boolean {
  const noSQLDatabases: DataSourceType[] = [
    'mongodb', 'redis', 'cassandra', 'couchdb', 'dynamodb', 'neo4j',
    'elasticsearch', 'influxdb'
  ];
  return noSQLDatabases.includes(type);
}

function getSQLDatabases(): DataSourceType[] {
  return ['postgresql', 'mysql', 'mssql', 'oracle', 'sqlite', 'mariadb',
          'snowflake', 'redshift', 'bigquery', 'databricks', 'synapse'];
}

function getAllDatabaseTypes(): DataSourceType[] {
  return [...getSQLDatabases(), 'mongodb', 'redis', 'cassandra', 'couchdb',
          'dynamodb', 'neo4j', 'elasticsearch', 'influxdb'];
}

// Format error messages based on database type
export function formatDatabaseError(databaseType: DataSourceType, error: any): string {
  const errorMessage = error.message || error.toString();

  // PostgreSQL errors
  if (databaseType === 'postgresql') {
    if (errorMessage.includes('ECONNREFUSED')) {
      return 'PostgreSQL connection refused. Check if the server is running and accessible.';
    }
    if (errorMessage.includes('password authentication failed')) {
      return 'PostgreSQL authentication failed. Check username and password.';
    }
    if (errorMessage.includes('does not exist')) {
      return `PostgreSQL error: ${errorMessage}`;
    }
  }

  // MySQL errors
  if (databaseType === 'mysql' || databaseType === 'mariadb') {
    if (errorMessage.includes('ER_ACCESS_DENIED_ERROR')) {
      return 'MySQL access denied. Check username, password, and permissions.';
    }
    if (errorMessage.includes('ER_BAD_DB_ERROR')) {
      return 'MySQL database does not exist.';
    }
    if (errorMessage.includes('ECONNREFUSED')) {
      return 'MySQL connection refused. Check if the server is running.';
    }
  }

  // MongoDB errors
  if (databaseType === 'mongodb') {
    if (errorMessage.includes('MongoNetworkError')) {
      return 'MongoDB network error. Check connection string and network access.';
    }
    if (errorMessage.includes('authentication failed')) {
      return 'MongoDB authentication failed. Check credentials.';
    }
  }

  // Oracle errors
  if (databaseType === 'oracle') {
    if (errorMessage.includes('ORA-01017')) {
      return 'Oracle invalid username/password.';
    }
    if (errorMessage.includes('ORA-12154')) {
      return 'Oracle TNS could not resolve the connect identifier.';
    }
  }

  // SQL Server errors
  if (databaseType === 'mssql') {
    if (errorMessage.includes('Login failed')) {
      return 'SQL Server login failed. Check credentials.';
    }
    if (errorMessage.includes('Cannot open database')) {
      return 'SQL Server cannot open database. Check database name and permissions.';
    }
  }

  // Generic error
  return `Database error (${databaseType}): ${errorMessage}`;
}