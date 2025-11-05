// Database Error Display Component - Shows database-specific errors with helpful context
import React from 'react';
import { AlertTriangle, Database, Info, XCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/Alert';
import { Button } from '@components/ui/Button';

interface DatabaseError {
  code?: string;
  message: string;
  databaseType: string;
  query?: string;
  hint?: string;
  documentation?: string;
}

interface DatabaseErrorDisplayProps {
  error: DatabaseError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const DatabaseErrorDisplay: React.FC<DatabaseErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss
}) => {
  // Get database-specific error explanations and solutions
  const getErrorContext = (dbType: string, errorCode?: string, message?: string): {
    title: string;
    description: string;
    solutions: string[];
    severity: 'error' | 'warning' | 'info';
  } => {
    const lowerMessage = message?.toLowerCase() || '';
    const lowerDbType = dbType.toLowerCase();

    // Database connection errors
    if (lowerMessage.includes('connection') || lowerMessage.includes('connect')) {
      return {
        title: `${getFriendlyDBName(dbType)} Connection Error`,
        description: 'Unable to connect to the database server',
        solutions: [
          'Check if the database server is running',
          'Verify network connectivity',
          'Confirm connection credentials are correct',
          'Check firewall settings'
        ],
        severity: 'error'
      };
    }

    // Permission errors
    if (lowerMessage.includes('permission') || lowerMessage.includes('denied') || lowerMessage.includes('privilege')) {
      return {
        title: 'Insufficient Permissions',
        description: `The database user lacks required permissions for this operation`,
        solutions: [
          `Grant SELECT permission on the target table`,
          `Ensure user has access to the schema/database`,
          `Contact your database administrator`,
          `Try using a different database user with appropriate permissions`
        ],
        severity: 'error'
      };
    }

    // Table/Column not found errors
    if (lowerMessage.includes('does not exist') || lowerMessage.includes('not found') || lowerMessage.includes('unknown')) {
      return {
        title: 'Object Not Found',
        description: 'The specified table or column does not exist',
        solutions: [
          'Verify the table/column name is correct',
          'Check for typos or case sensitivity issues',
          `${lowerDbType === 'postgresql' ? 'PostgreSQL is case-sensitive for quoted identifiers' : ''}`,
          `${lowerDbType === 'mysql' ? 'Check if using the correct database' : ''}`,
          'Ensure the object has been created and synced'
        ].filter(Boolean),
        severity: 'error'
      };
    }

    // Syntax errors (database-specific)
    if (lowerMessage.includes('syntax') || lowerMessage.includes('parse')) {
      const syntaxHints = {
        'mongodb': [
          'MongoDB uses document-based queries, not SQL',
          'Check if using proper MongoDB query syntax',
          'Example: { field: { $exists: true } } instead of SQL'
        ],
        'oracle': [
          'Oracle requires FROM DUAL for simple selects',
          'Use || for string concatenation instead of +',
          'Date literals need TO_DATE function'
        ],
        'mssql': [
          'Use square brackets for reserved words',
          'Use TOP instead of LIMIT',
          'String concatenation uses + operator'
        ],
        'mysql': [
          'Use backticks for identifiers with special characters',
          'LIMIT syntax is different from SQL Server',
          'Use CONCAT for string concatenation'
        ],
        'postgresql': [
          'Use double quotes for case-sensitive identifiers',
          'Use :: for type casting',
          'Array and JSON operators are PostgreSQL-specific'
        ]
      };

      return {
        title: `${getFriendlyDBName(dbType)} Syntax Error`,
        description: 'The query syntax is incompatible with this database type',
        solutions: syntaxHints[lowerDbType] || [
          'Review the query syntax for this database type',
          'Check the database documentation',
          'Ensure using correct SQL dialect'
        ],
        severity: 'error'
      };
    }

    // Timeout errors
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return {
        title: 'Query Timeout',
        description: 'The query took too long to execute',
        solutions: [
          'Optimize the query for better performance',
          'Add appropriate indexes to the table',
          'Reduce the data volume being scanned',
          'Increase the timeout threshold if necessary'
        ],
        severity: 'warning'
      };
    }

    // Data type errors
    if (lowerMessage.includes('type') || lowerMessage.includes('cast') || lowerMessage.includes('convert')) {
      return {
        title: 'Data Type Mismatch',
        description: 'The data types in the query are incompatible',
        solutions: [
          'Check column data types match the query parameters',
          `${lowerDbType === 'postgresql' ? 'Use explicit type casting with ::type' : ''}`,
          `${lowerDbType === 'mssql' ? 'Use CAST or CONVERT functions' : ''}`,
          'Ensure date/time formats are correct for this database'
        ].filter(Boolean),
        severity: 'error'
      };
    }

    // NoSQL specific errors
    if (lowerDbType === 'mongodb') {
      if (lowerMessage.includes('aggregate') || lowerMessage.includes('pipeline')) {
        return {
          title: 'MongoDB Aggregation Error',
          description: 'Invalid aggregation pipeline configuration',
          solutions: [
            'Check aggregation pipeline stages are in correct order',
            'Verify field names match document structure',
            'Ensure using $ prefix for field references',
            'Review MongoDB aggregation documentation'
          ],
          severity: 'error'
        };
      }
    }

    // Default error
    return {
      title: `Database Error`,
      description: error.message || 'An unexpected database error occurred',
      solutions: [
        'Check the error details below',
        'Verify your database configuration',
        'Contact support if the issue persists'
      ],
      severity: 'error'
    };
  };

  const getFriendlyDBName = (type: string): string => {
    const names: Record<string, string> = {
      'postgresql': 'PostgreSQL',
      'mysql': 'MySQL',
      'mssql': 'SQL Server',
      'oracle': 'Oracle',
      'mongodb': 'MongoDB',
      'snowflake': 'Snowflake',
      'bigquery': 'BigQuery',
      'redshift': 'Redshift',
      'databricks': 'Databricks',
      'cassandra': 'Cassandra',
      'elasticsearch': 'Elasticsearch'
    };
    return names[type.toLowerCase()] || type.toUpperCase();
  };

  const errorContext = getErrorContext(error.databaseType, error.code, error.message);

  const getIcon = () => {
    switch (errorContext.severity) {
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Database className="h-5 w-5 text-gray-600" />;
    }
  };

  const getAlertVariant = (): 'default' | 'destructive' => {
    return errorContext.severity === 'error' ? 'destructive' : 'default';
  };

  return (
    <Alert variant={getAlertVariant()} className="mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1">
          <AlertTitle className="flex items-center gap-2">
            {errorContext.title}
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
              {getFriendlyDBName(error.databaseType)}
            </span>
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm">{errorContext.description}</p>

            {/* Error details */}
            {error.message && error.message !== errorContext.description && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs font-mono">
                {error.message}
              </div>
            )}

            {/* Error code if available */}
            {error.code && (
              <div className="text-xs text-gray-600">
                Error Code: <code className="bg-gray-100 px-1 py-0.5 rounded">{error.code}</code>
              </div>
            )}

            {/* Query if available */}
            {error.query && (
              <details className="cursor-pointer">
                <summary className="text-sm font-medium text-gray-700 hover:text-gray-900">
                  View Query
                </summary>
                <pre className="mt-2 bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                  {error.query}
                </pre>
              </details>
            )}

            {/* Solutions */}
            {errorContext.solutions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <HelpCircle className="h-4 w-4" />
                  Possible Solutions:
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {errorContext.solutions.map((solution, index) => (
                    <li key={index} className="text-sm text-gray-700">
                      {solution}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hint from backend */}
            {error.hint && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Hint:</strong> {error.hint}
                  </p>
                </div>
              </div>
            )}

            {/* Documentation link */}
            {error.documentation && (
              <a
                href={error.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <BookOpen className="h-4 w-4" />
                View Documentation
              </a>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4">
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                >
                  Try Again
                </Button>
              )}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
};

// Export helper function to format database errors
export const formatDatabaseError = (
  error: any,
  databaseType: string
): DatabaseError => {
  // Try to extract meaningful information from various error formats
  let errorMessage = error.message || error.errorMessage || 'Unknown error';
  let errorCode = error.code || error.sqlState || error.errorCode;
  let hint = error.hint || error.detail;
  let query = error.query || error.sql;

  // Database-specific error extraction
  if (databaseType === 'postgresql') {
    // PostgreSQL errors often have detailed structure
    if (error.detail) hint = error.detail;
    if (error.hint) hint = error.hint;
    if (error.position) {
      hint = `${hint ? hint + '. ' : ''}Error at position ${error.position}`;
    }
  } else if (databaseType === 'mysql') {
    // MySQL error format
    if (error.sqlMessage) errorMessage = error.sqlMessage;
    if (error.sqlState) errorCode = error.sqlState;
  } else if (databaseType === 'mssql') {
    // SQL Server error format
    if (error.originalError) {
      errorMessage = error.originalError.message || errorMessage;
      errorCode = error.originalError.code || errorCode;
    }
  } else if (databaseType === 'mongodb') {
    // MongoDB error format
    if (error.errmsg) errorMessage = error.errmsg;
    if (error.code) errorCode = error.code;
    if (error.codeName) hint = `Error type: ${error.codeName}`;
  }

  return {
    code: errorCode,
    message: errorMessage,
    databaseType,
    query,
    hint
  };
};