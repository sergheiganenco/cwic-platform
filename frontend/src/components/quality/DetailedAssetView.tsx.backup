// Detailed Asset View with Columns, Issues, and Fix Scripts
import React, { useState, useEffect } from 'react';
import {
  Table as TableIcon,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Key,
  Link2,
  Lock,
  Eye,
  Code,
  Database,
  Info,
  Zap,
  Copy,
  Terminal,
  FileCode,
  Loader2,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';

interface Column {
  id: number;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_table?: string;
  foreign_key_column?: string;
  pii_type?: string | null;
  is_sensitive: boolean;
  encryption_status: string;
  null_percentage?: number | null;
  unique_percentage?: number | null;
  sample_values?: string[] | null;
  quality_issues: QualityIssue[];
  description?: string | null;
  data_classification?: string | null;
}

interface QualityIssue {
  id?: number;
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_rows?: number;
  fix_script?: string;
}

interface DetailedAssetViewProps {
  assetId: string;
  assetName: string;
}

interface PIIRuleOption {
  pii_type: string;
  display_name: string;
  sensitivity_level: string;
}

const DetailedAssetView: React.FC<DetailedAssetViewProps> = ({ assetId, assetName }) => {
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Column[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [showFullScript, setShowFullScript] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [realSamples, setRealSamples] = useState<Record<string, { bad_samples: any[], good_samples: any[], loading: boolean }>>({});
  const [filterPII, setFilterPII] = useState<'all' | 'yes' | 'no'>('all');
  const [filterIssues, setFilterIssues] = useState<'all' | 'yes' | 'no'>('all');
  const [assetMetadata, setAssetMetadata] = useState<{
    tableName: string;
    schemaName: string;
    databaseName: string;
    dataSourceType?: string;
  } | null>(null);
  const [enabledPIIRules, setEnabledPIIRules] = useState<PIIRuleOption[]>([]);

  useEffect(() => {
    fetchAssetDetails();
    fetchEnabledPIIRules();
  }, [assetId]);

  // Cross-tab synchronization - listen for PII config changes and refresh seamlessly
  useEffect(() => {
    let lastProcessedTimestamp = 0;

    const refreshDataSeamlessly = () => {
      console.log('[DetailedAssetView] PII config changed, refreshing columns and PII rules in background...');
      fetchAssetDetails();
      fetchEnabledPIIRules();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pii-config-update' && e.newValue) {
        const timestamp = parseInt(e.newValue, 10);

        if (timestamp > lastProcessedTimestamp) {
          lastProcessedTimestamp = timestamp;
          refreshDataSeamlessly();
        }
      }
    };

    const handleCustomUpdate = () => {
      refreshDataSeamlessly();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pii-config-update', handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pii-config-update', handleCustomUpdate);
    };
  }, [assetId]);

  // Fetch real samples for columns with quality issues (avoid calling hooks inside conditionals)
  useEffect(() => {
    columns.forEach(column => {
      column.quality_issues.forEach(issue => {
        const cacheKey = `${column.id}-${issue.issue_type}`;
        // Only fetch if not already loading or loaded
        if (!realSamples[cacheKey]) {
          fetchRealSamples(column.id, issue.issue_type);
        }
      });
    });
  }, [columns]);

  const fetchEnabledPIIRules = async () => {
    try {
      const response = await fetch('/api/pii-rules/enabled');
      const result = await response.json();

      if (result.success && result.data) {
        setEnabledPIIRules(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch enabled PII rules:', error);
      // Fallback to empty array - dropdown will just be empty if API fails
      setEnabledPIIRules([]);
    }
  };

  const fetchAssetDetails = async () => {
    setLoading(true);
    try {
      // Fetch asset metadata first
      const assetResponse = await fetch(`/api/catalog/assets/${assetId}`);
      const assetResult = await assetResponse.json();

      if (assetResult.success && assetResult.data) {
        setAssetMetadata({
          tableName: assetResult.data.table_name,
          schemaName: assetResult.data.schema_name,
          databaseName: assetResult.data.database_name,
          dataSourceType: assetResult.data.dataSourceType,
        });
      }

      // Fetch columns data
      const response = await fetch(`/api/catalog/assets/${assetId}/columns`);
      const result = await response.json();

      if (result.success && result.data) {
        // Transform the data to match our Column interface
        const columnsData = result.data.map((col: any) => {
          // Extract quality issues - they come directly from the API, not from profile_json
          const qualityIssues = col.quality_issues || [];

          return {
            id: col.id,
            column_name: col.column_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            is_primary_key: col.is_primary_key || false,
            is_foreign_key: col.is_foreign_key || false,
            foreign_key_table: col.foreign_key_table,
            foreign_key_column: col.foreign_key_column,
            pii_type: col.pii_type || col.data_classification || null,
            is_sensitive: col.is_sensitive || (col.data_classification ? true : false),
            encryption_status: col.is_encrypted ? 'encrypted' : 'unencrypted',
            null_percentage: col.null_percentage,
            unique_percentage: col.unique_percentage,
            sample_values: col.sample_values || [],
            quality_issues: qualityIssues,
            description: col.description,
            data_classification: col.data_classification,
          };
        });

        console.log(`[DetailedAssetView] Loaded ${columnsData.length} columns for asset ${assetId}`);
        console.log(`[DetailedAssetView] Total quality issues: ${columnsData.reduce((sum: number, col: any) => sum + col.quality_issues.length, 0)}`);
        console.log(`[DetailedAssetView] PII columns: ${columnsData.filter((col: any) => col.pii_type).length}`);

        setColumns(columnsData);
      } else {
        throw new Error('Failed to fetch column details');
      }
    } catch (err) {
      console.error('Error fetching asset details:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const fetchRealSamples = async (columnId: number, issueType: string) => {
    const cacheKey = `${columnId}-${issueType}`;

    // Skip if already loading or loaded
    if (realSamples[cacheKey]) {
      return;
    }

    // Mark as loading
    setRealSamples(prev => ({ ...prev, [cacheKey]: { bad_samples: [], good_samples: [], loading: true } }));

    try {
      const response = await fetch(`/api/catalog/columns/${columnId}/real-samples?issue_type=${issueType}&limit=5`);
      const result = await response.json();

      if (result.success) {
        setRealSamples(prev => ({
          ...prev,
          [cacheKey]: {
            bad_samples: result.data.bad_samples || [],
            good_samples: result.data.good_samples || [],
            loading: false
          }
        }));
      } else {
        setRealSamples(prev => ({ ...prev, [cacheKey]: { bad_samples: [], good_samples: [], loading: false } }));
      }
    } catch (error) {
      console.error('Error fetching real samples:', error);
      setRealSamples(prev => ({ ...prev, [cacheKey]: { bad_samples: [], good_samples: [], loading: false } }));
    }
  };

  const generateFullFixScript = () => {
    const allScripts: string[] = [];

    columns.forEach(column => {
      column.quality_issues.forEach(issue => {
        const script = issue.fix_script || generateFixScript(column, issue);
        allScripts.push(`-- ${column.column_name}: ${issue.issue_type}\n${script}`);
      });
    });

    return allScripts.join('\n\n-- ================================================\n\n');
  };

  const handleGenerateFullScript = () => {
    const fullScript = generateFullFixScript();
    copyToClipboard(fullScript, 'full-script');
    setShowFullScript(true);
  };

  const generateFixScript = (column: Column, issue: QualityIssue): string => {
    const tableName = assetName;
    const columnName = column.column_name;
    const schemaName = assetMetadata?.schemaName || 'public';
    const fullTableName = `${schemaName}.${tableName}`;

    // Detect database type from data source
    const dbType = assetMetadata?.dataSourceType || 'postgresql';

    // Helper function to generate PII masking scripts based on database type
    const generatePIIMaskingScript = (piiType: string): string => {
      const maskingPatterns: Record<string, any> = {
        ssn: {
          postgres: `CONCAT('***-**-', RIGHT(${columnName}::text, 4))`,
          sqlserver: `CONCAT('***-**-', RIGHT(${columnName}, 4))`,
          mysql: `CONCAT('***-**-', RIGHT(${columnName}, 4))`
        },
        credit_card: {
          postgres: `CONCAT('**** **** **** ', RIGHT(${columnName}::text, 4))`,
          sqlserver: `CONCAT('**** **** **** ', RIGHT(${columnName}, 4))`,
          mysql: `CONCAT('**** **** **** ', RIGHT(${columnName}, 4))`
        },
        email: {
          postgres: `CONCAT(LEFT(SPLIT_PART(${columnName}, '@', 1), 1), '***@', SPLIT_PART(${columnName}, '@', 2))`,
          sqlserver: `CONCAT(LEFT(SUBSTRING(${columnName}, 1, CHARINDEX('@', ${columnName}) - 1), 1), '***@', SUBSTRING(${columnName}, CHARINDEX('@', ${columnName}) + 1, LEN(${columnName})))`,
          mysql: `CONCAT(LEFT(SUBSTRING_INDEX(${columnName}, '@', 1), 1), '***@', SUBSTRING_INDEX(${columnName}, '@', -1))`
        },
        phone: {
          postgres: `CONCAT('(', LEFT(${columnName}::text, 3), ') ***-****')`,
          sqlserver: `CONCAT('(', LEFT(${columnName}, 3), ') ***-****')`,
          mysql: `CONCAT('(', LEFT(${columnName}, 3), ') ***-****')`
        },
        zip_code: {
          postgres: `'*****'`,
          sqlserver: `'*****'`,
          mysql: `'*****'`
        },
        date_of_birth: {
          postgres: `CONCAT(EXTRACT(YEAR FROM ${columnName}), '-**-**')`,
          sqlserver: `CONCAT(YEAR(${columnName}), '-**-**')`,
          mysql: `CONCAT(YEAR(${columnName}), '-**-**')`
        },
        default: {
          postgres: `CONCAT(LEFT(${columnName}::text, 2), REPEAT('*', LENGTH(${columnName}::text) - 4), RIGHT(${columnName}::text, 2))`,
          sqlserver: `CONCAT(LEFT(${columnName}, 2), REPLICATE('*', LEN(${columnName}) - 4), RIGHT(${columnName}, 2))`,
          mysql: `CONCAT(LEFT(${columnName}, 2), REPEAT('*', LENGTH(${columnName}) - 4), RIGHT(${columnName}, 2))`
        }
      };

      const dbKey = dbType.toLowerCase().includes('postgres') ? 'postgres'
        : (dbType.toLowerCase().includes('mssql') || dbType.toLowerCase().includes('sqlserver') || dbType.toLowerCase().includes('sql server')) ? 'sqlserver'
        : 'mysql';

      const pattern = maskingPatterns[piiType || 'default'] || maskingPatterns.default;
      return pattern[dbKey];
    };

    // Check if this is a PII-related issue
    const isPIIIssue = issue.title?.includes('PII Detected') ||
                       issue.description?.includes('PII data') ||
                       issue.issue_type === 'pii_unencrypted' ||
                       issue.issue_type === 'pii_detected';

    if (isPIIIssue) {
      const piiType = column.pii_type || extractPIITypeFromIssue(issue);
      const requiresEncryption = issue.description?.includes('Requires Encryption: Yes') || issue.description?.includes('ENCRYPT this column');
      const requiresMasking = issue.description?.includes('Requires Masking: Yes') || issue.description?.includes('MASK in UI');

      if (dbType.toLowerCase().includes('postgres')) {
        // PostgreSQL-specific fix
        if (requiresEncryption && requiresMasking) {
          return `-- PostgreSQL: Encrypt and Mask PII (${piiType})
-- ================================================
-- STEP 1: Enable pgcrypto extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- STEP 2: Create backup of original data
CREATE TABLE ${tableName}_backup AS
SELECT * FROM ${fullTableName};

-- STEP 3: Add new encrypted column
ALTER TABLE ${fullTableName}
ADD COLUMN ${columnName}_encrypted BYTEA;

-- STEP 4: Encrypt existing data
UPDATE ${fullTableName}
SET ${columnName}_encrypted = pgp_sym_encrypt(${columnName}::text, 'YOUR_ENCRYPTION_KEY_HERE')
WHERE ${columnName} IS NOT NULL;

-- STEP 5: Verify encryption
SELECT
  ${columnName} as original,
  pgp_sym_decrypt(${columnName}_encrypted, 'YOUR_ENCRYPTION_KEY_HERE')::text as decrypted,
  CASE WHEN ${columnName}::text = pgp_sym_decrypt(${columnName}_encrypted, 'YOUR_ENCRYPTION_KEY_HERE')::text
    THEN 'MATCH' ELSE 'MISMATCH' END as status
FROM ${fullTableName}
WHERE ${columnName} IS NOT NULL
LIMIT 10;

-- STEP 6: After verification, drop original column and rename encrypted
-- ONLY RUN AFTER VERIFYING ENCRYPTION WORKS!
-- ALTER TABLE ${fullTableName} DROP COLUMN ${columnName};
-- ALTER TABLE ${fullTableName} RENAME COLUMN ${columnName}_encrypted TO ${columnName};

-- STEP 7: Update application code to decrypt when reading:
-- SELECT pgp_sym_decrypt(${columnName}, 'YOUR_ENCRYPTION_KEY_HERE')::text as ${columnName}
-- FROM ${fullTableName};`;
        } else if (requiresMasking) {
          const maskPattern = generatePIIMaskingScript(piiType);
          return `-- PostgreSQL: Mask PII in UI (${piiType})
-- ================================================
-- NOTE: Masking is typically done in application layer, not database
-- However, here are database-level options:

-- OPTION 1: Create a masked view for UI queries
CREATE OR REPLACE VIEW ${tableName}_masked AS
SELECT
  id,
  ${maskPattern} as ${columnName},
  -- Include other columns as needed
  *
FROM ${fullTableName};

-- Grant permissions to application user
GRANT SELECT ON ${tableName}_masked TO your_app_user;

-- OPTION 2: Create masking function
CREATE OR REPLACE FUNCTION mask_${columnName}(value TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN ${maskPattern.replace(new RegExp(columnName, 'g'), 'value')};
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Use in queries:
SELECT mask_${columnName}(${columnName}) as ${columnName}_masked
FROM ${fullTableName};

-- OPTION 3: Add masked column (keeps original)
ALTER TABLE ${fullTableName}
ADD COLUMN ${columnName}_masked TEXT;

UPDATE ${fullTableName}
SET ${columnName}_masked = ${maskPattern};

-- Query masked data:
SELECT ${columnName}_masked FROM ${fullTableName};`;
        } else if (requiresEncryption) {
          return `-- PostgreSQL: Encrypt PII (${piiType})
-- ================================================
-- STEP 1: Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- STEP 2: Add encrypted column
ALTER TABLE ${fullTableName}
ADD COLUMN ${columnName}_encrypted BYTEA;

-- STEP 3: Encrypt data
UPDATE ${fullTableName}
SET ${columnName}_encrypted = pgp_sym_encrypt(${columnName}::text, 'YOUR_ENCRYPTION_KEY_HERE')
WHERE ${columnName} IS NOT NULL;

-- STEP 4: Query encrypted data (decrypt)
SELECT
  pgp_sym_decrypt(${columnName}_encrypted, 'YOUR_ENCRYPTION_KEY_HERE')::text as ${columnName}
FROM ${fullTableName};`;
        }
      } else if (dbType.toLowerCase().includes('mssql') || dbType.toLowerCase().includes('sqlserver') || dbType.toLowerCase().includes('sql server')) {
        // SQL Server-specific fix
        if (requiresEncryption && requiresMasking) {
          return `-- SQL Server: Encrypt and Mask PII (${piiType})
-- ================================================
-- STEP 1: Create Master Key and Certificate (if not exists)
IF NOT EXISTS (SELECT * FROM sys.symmetric_keys WHERE name = '##MS_DatabaseMasterKey##')
BEGIN
  CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'YourStrongPassword123!';
END

IF NOT EXISTS (SELECT * FROM sys.certificates WHERE name = 'PII_Certificate')
BEGIN
  CREATE CERTIFICATE PII_Certificate WITH SUBJECT = 'PII Data Protection';
END

-- STEP 2: Create Symmetric Key
IF NOT EXISTS (SELECT * FROM sys.symmetric_keys WHERE name = 'PII_SymmetricKey')
BEGIN
  CREATE SYMMETRIC KEY PII_SymmetricKey
  WITH ALGORITHM = AES_256
  ENCRYPTION BY CERTIFICATE PII_Certificate;
END

-- STEP 3: Add encrypted column
ALTER TABLE ${fullTableName}
ADD ${columnName}_encrypted VARBINARY(MAX);

-- STEP 4: Encrypt existing data
OPEN SYMMETRIC KEY PII_SymmetricKey
DECRYPTION BY CERTIFICATE PII_Certificate;

UPDATE ${fullTableName}
SET ${columnName}_encrypted = EncryptByKey(Key_GUID('PII_SymmetricKey'), ${columnName})
WHERE ${columnName} IS NOT NULL;

CLOSE SYMMETRIC KEY PII_SymmetricKey;

-- STEP 5: Query encrypted data (decrypt)
OPEN SYMMETRIC KEY PII_SymmetricKey
DECRYPTION BY CERTIFICATE PII_Certificate;

SELECT
  CONVERT(VARCHAR(MAX), DecryptByKey(${columnName}_encrypted)) as ${columnName}
FROM ${fullTableName};

CLOSE SYMMETRIC KEY PII_SymmetricKey;`;
        } else if (requiresMasking) {
          const maskPattern = generatePIIMaskingScript(piiType);
          return `-- SQL Server: Mask PII (${piiType})
-- ================================================
-- OPTION 1: Dynamic Data Masking (SQL Server 2016+)
ALTER TABLE ${fullTableName}
ALTER COLUMN ${columnName} ADD MASKED WITH (FUNCTION = 'partial(1,"***",2)');

-- Grant UNMASK permission to authorized users only
GRANT UNMASK TO authorized_user;

-- OPTION 2: Create masked view
CREATE VIEW ${tableName}_masked AS
SELECT
  id,
  ${maskPattern} as ${columnName},
  -- Include other columns
  *
FROM ${fullTableName};

-- OPTION 3: Add masked column
ALTER TABLE ${fullTableName}
ADD ${columnName}_masked VARCHAR(255);

UPDATE ${fullTableName}
SET ${columnName}_masked = ${maskPattern};`;
        }
      } else {
        // MySQL-specific fix
        if (requiresEncryption) {
          return `-- MySQL: Encrypt PII (${piiType})
-- ================================================
-- STEP 1: Add encrypted column
ALTER TABLE \`${fullTableName}\`
ADD COLUMN ${columnName}_encrypted VARBINARY(500);

-- STEP 2: Encrypt data using AES
UPDATE \`${fullTableName}\`
SET ${columnName}_encrypted = AES_ENCRYPT(${columnName}, 'YOUR_ENCRYPTION_KEY_HERE')
WHERE ${columnName} IS NOT NULL;

-- STEP 3: Query encrypted data (decrypt)
SELECT
  AES_DECRYPT(${columnName}_encrypted, 'YOUR_ENCRYPTION_KEY_HERE') as ${columnName}
FROM \`${fullTableName}\`;

-- STEP 4: After verification, drop original column
-- ALTER TABLE \`${fullTableName}\` DROP COLUMN ${columnName};
-- ALTER TABLE \`${fullTableName}\` CHANGE ${columnName}_encrypted ${columnName} VARBINARY(500);`;
        } else if (requiresMasking) {
          const maskPattern = generatePIIMaskingScript(piiType);
          return `-- MySQL: Mask PII (${piiType})
-- ================================================
-- OPTION 1: Create masked view
CREATE VIEW ${tableName}_masked AS
SELECT
  id,
  ${maskPattern} as ${columnName},
  -- Include other columns
  *
FROM \`${fullTableName}\`;

-- OPTION 2: Add masked column
ALTER TABLE \`${fullTableName}\`
ADD COLUMN ${columnName}_masked VARCHAR(255);

UPDATE \`${fullTableName}\`
SET ${columnName}_masked = ${maskPattern};`;
        }
      }
    }

    // Non-PII issue types (existing logic)
    switch (issue.issue_type) {
      case 'null_values':
        return `-- Fix NULL values in ${columnName}
UPDATE ${fullTableName}
SET ${columnName} = '<default_value>'
WHERE ${columnName} IS NULL;

-- Add NOT NULL constraint if needed
ALTER TABLE ${fullTableName}
ALTER COLUMN ${columnName} SET NOT NULL;`;

      case 'duplicate_values':
        if (dbType.toLowerCase().includes('postgres')) {
          return `-- PostgreSQL: Remove duplicate values
DELETE FROM ${fullTableName} a
USING ${fullTableName} b
WHERE a.ctid > b.ctid
AND a.${columnName} = b.${columnName};`;
        } else if (dbType.toLowerCase().includes('sql')) {
          return `-- SQL Server: Remove duplicate values
WITH CTE AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY ${columnName} ORDER BY (SELECT NULL)) as rn
  FROM ${fullTableName}
)
DELETE FROM CTE WHERE rn > 1;`;
        } else {
          return `-- MySQL: Remove duplicate values
DELETE t1 FROM ${fullTableName} t1
INNER JOIN ${fullTableName} t2
WHERE t1.id > t2.id AND t1.${columnName} = t2.${columnName};`;
        }

      case 'invalid_format':
        return `-- Find and fix invalid format values
SELECT ${columnName}
FROM ${fullTableName}
WHERE ${columnName} IS NOT NULL
  AND ${columnName} !~ '^[valid_pattern]$'
LIMIT 100;

-- Update to clean format (adjust pattern as needed)
UPDATE ${fullTableName}
SET ${columnName} = REGEXP_REPLACE(${columnName}, '[^a-zA-Z0-9]', '', 'g')
WHERE ${columnName} !~ '^[valid_pattern]$';`;

      case 'missing_fk':
        return `-- Add foreign key constraint
ALTER TABLE ${fullTableName}
ADD CONSTRAINT fk_${columnName}
FOREIGN KEY (${columnName})
REFERENCES ${column.foreign_key_table}(${column.foreign_key_column});`;

      case 'outlier_values':
        return `-- Find and cap outlier values
-- STEP 1: Identify outliers (z-score > 3)
SELECT ${columnName},
  (${columnName} - AVG(${columnName}) OVER ()) / STDDEV(${columnName}) OVER () as z_score
FROM ${fullTableName}
WHERE ABS((${columnName} - AVG(${columnName}) OVER ()) / STDDEV(${columnName}) OVER ()) > 3;

-- STEP 2: Cap outliers to 99th/1st percentile
UPDATE ${fullTableName}
SET ${columnName} = CASE
  WHEN ${columnName} > (SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${columnName}) FROM ${fullTableName})
  THEN (SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${columnName}) FROM ${fullTableName})
  WHEN ${columnName} < (SELECT PERCENTILE_CONT(0.01) WITHIN GROUP (ORDER BY ${columnName}) FROM ${fullTableName})
  THEN (SELECT PERCENTILE_CONT(0.01) WITHIN GROUP (ORDER BY ${columnName}) FROM ${fullTableName})
  ELSE ${columnName}
END;`;

      default:
        return `-- Fix for ${issue.issue_type}
-- Review the data to determine appropriate fix
SELECT ${columnName}, COUNT(*) as occurrences
FROM ${fullTableName}
WHERE ${columnName} IS NOT NULL
GROUP BY ${columnName}
ORDER BY occurrences DESC
LIMIT 100;

-- Example UPDATE statement (modify as needed):
-- UPDATE ${fullTableName}
-- SET ${columnName} = <corrected_value>
-- WHERE ${columnName} = <problematic_value>;`;
    }
  };

  // Helper function to extract PII type from issue
  const extractPIITypeFromIssue = (issue: QualityIssue): string => {
    if (issue.title?.includes('SSN')) return 'ssn';
    if (issue.title?.includes('Credit Card')) return 'credit_card';
    if (issue.title?.includes('Email')) return 'email';
    if (issue.title?.includes('Phone')) return 'phone';
    if (issue.title?.includes('ZIP') || issue.title?.includes('Postal')) return 'zip_code';
    if (issue.title?.includes('Date of Birth') || issue.title?.includes('DOB')) return 'date_of_birth';
    if (issue.title?.includes('Name')) return 'name';
    return 'default';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getDataTypeColor = (dataType: string) => {
    if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('decimal')) {
      return 'bg-purple-100 text-purple-700 border-purple-200';
    }
    if (dataType.includes('char') || dataType.includes('text')) {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    if (dataType.includes('date') || dataType.includes('time')) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (dataType.includes('bool')) {
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-600">Loading column details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  // Apply filters
  const filteredColumns = columns.filter(col => {
    // Filter by PII
    if (filterPII === 'yes' && !col.pii_type) return false;
    if (filterPII === 'no' && col.pii_type) return false;

    // Filter by Quality Issues
    if (filterIssues === 'yes' && col.quality_issues.length === 0) return false;
    if (filterIssues === 'no' && col.quality_issues.length > 0) return false;

    return true;
  });

  const totalIssues = columns.reduce((sum, col) => sum + col.quality_issues.length, 0);
  const columnsWithIssues = columns.filter(col => col.quality_issues.length > 0);
  const piiColumns = columns.filter(col => col.pii_type);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-blue-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-600">Total Columns</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{columns.length}</div>
        </div>

        <div className="bg-white rounded-lg border border-red-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-gray-600">Quality Issues</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{totalIssues}</div>
        </div>

        <div className="bg-white rounded-lg border border-amber-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-gray-600">PII Columns</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{piiColumns.length}</div>
        </div>

        <div className="bg-white rounded-lg border border-purple-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-gray-600">Keys</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {columns.filter(c => c.is_primary_key || c.is_foreign_key).length}
          </div>
        </div>
      </div>

      {/* Columns Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <TableIcon className="w-5 h-5" />
              Column Details & Quality Issues
            </h4>
            {/* Filters and Refresh */}
            <div className="flex items-center gap-3">
              {/* Refresh Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={fetchAssetDetails}
                disabled={loading}
                className="text-xs h-7"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {/* PII Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">PII:</span>
                <select
                  value={filterPII}
                  onChange={(e) => setFilterPII(e.target.value as 'all' | 'yes' | 'no')}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {/* Quality Issues Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">Quality Issues:</span>
                <select
                  value={filterIssues}
                  onChange={(e) => setFilterIssues(e.target.value as 'all' | 'yes' | 'no')}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Column Name</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Data Type</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">Nullable</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">Keys</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">PII</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Null %</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Issues</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredColumns.map((column) => (
                <React.Fragment key={column.id}>
                  <tr
                    className={`${selectedColumn?.id === column.id ? 'bg-blue-50' : ''} ${
                      column.quality_issues.length > 0
                        ? 'bg-red-50 border-l-4 border-red-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-2 px-3">
                      <div className={`font-medium ${column.quality_issues.length > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                        {column.column_name}
                      </div>
                      {column.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{column.description}</div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <Badge className={`text-xs ${getDataTypeColor(column.data_type)}`}>
                        {column.data_type}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {column.is_nullable ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {column.is_primary_key && (
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                            <Key className="w-3 h-3" />
                          </Badge>
                        )}
                        {column.is_foreign_key && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                            <Link2 className="w-3 h-3" />
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {column.pii_type ? (
                        <Badge className={
                          column.quality_issues.length > 0
                            ? "bg-red-100 text-red-700 border-red-300 text-xs font-semibold"
                            : "bg-amber-100 text-amber-700 border-amber-200 text-xs"
                        }>
                          <Shield className="w-3 h-3 mr-1" />
                          {column.pii_type}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {column.null_percentage !== null ? `${column.null_percentage.toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {column.quality_issues.length > 0 ? (
                        <Badge className="bg-red-100 text-red-700 border-red-300 text-xs font-semibold">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {column.quality_issues.length} {column.quality_issues.length === 1 ? 'issue' : 'issues'}
                        </Badge>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className={`text-xs h-7 ${
                          column.quality_issues.length > 0
                            ? 'border-red-300 text-red-700 hover:bg-red-50'
                            : column.pii_type
                            ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                            : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                        }`}
                        onClick={() => setSelectedColumn(selectedColumn?.id === column.id ? null : column)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        {selectedColumn?.id === column.id ? 'Hide' : 'View'}
                      </Button>
                    </td>
                  </tr>

                  {/* Expanded Issues & Fix Scripts */}
                  {selectedColumn?.id === column.id && (
                    <tr>
                      <td colSpan={8} className={`p-4 ${
                        column.quality_issues.length > 0
                          ? 'bg-gradient-to-r from-red-50 to-orange-50'
                          : 'bg-gradient-to-r from-amber-50 to-yellow-50'
                      }`}>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                              {column.quality_issues.length > 0 ? (
                                <>
                                  <AlertTriangle className="w-4 h-4 text-red-600" />
                                  Quality Issues for {column.column_name}
                                </>
                              ) : column.pii_type ? (
                                <>
                                  <Shield className="w-4 h-4 text-amber-600" />
                                  PII Data Preview for {column.column_name}
                                </>
                              ) : (
                                <>
                                  <Database className="w-4 h-4 text-blue-600" />
                                  Column Details: {column.column_name}
                                </>
                              )}
                            </h5>

                            <div className="flex items-center gap-2">
                              {/* Mark as PII Button (for non-PII columns) */}
                              {!column.pii_type && assetMetadata && (
                                <div className="relative inline-block">
                                  <select
                                    className="text-xs h-7 px-2 py-1 border border-green-300 text-green-700 bg-white hover:bg-green-50 rounded cursor-pointer"
                                    value=""
                                    onChange={async (e) => {
                                      const selectedPIIType = e.target.value;
                                      if (!selectedPIIType) return;

                                      if (!confirm(`Mark "${column.column_name}" as ${selectedPIIType.toUpperCase()} PII?\n\nThis will:\n✓ Classify the column as PII\n✓ Create quality issue if protection required\n✓ Enable automatic PII detection on future scans`)) {
                                        e.target.value = '';
                                        return;
                                      }

                                      try {
                                        const response = await fetch(`/catalog/columns/${column.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            pii_type: selectedPIIType,
                                            data_classification: selectedPIIType,
                                            is_sensitive: true,
                                          }),
                                        });

                                        if (!response.ok) {
                                          throw new Error('Failed to mark as PII');
                                        }

                                        alert(`✅ Successfully marked as ${selectedPIIType.toUpperCase()} PII!\n\nColumn "${column.column_name}" is now classified as PII.`);

                                        // Refresh the asset details
                                        await fetchAssetDetails();

                                        // Reset select
                                        e.target.value = '';
                                      } catch (error) {
                                        console.error('Error marking as PII:', error);
                                        alert(`❌ Failed to mark as PII.\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
                                        e.target.value = '';
                                      }
                                    }}
                                  >
                                    <option value="">🏷️ Mark as PII...</option>
                                    {enabledPIIRules.map(rule => {
                                      // Icon mapping for different PII types
                                      const getIcon = (type: string) => {
                                        const icons: Record<string, string> = {
                                          name: '👤',
                                          email: '📧',
                                          phone: '📞',
                                          ssn: '🔢',
                                          credit_card: '💳',
                                          date_of_birth: '🎂',
                                          address: '🏠',
                                          ip_address: '🌐',
                                          drivers_license: '🚗',
                                          passport: '✈️',
                                          zip_code: '📮',
                                          bank_account: '🏦'
                                        };
                                        return icons[type] || '🔒';
                                      };

                                      return (
                                        <option key={rule.pii_type} value={rule.pii_type}>
                                          {getIcon(rule.pii_type)} {rule.display_name}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}

                              {/* Mark as Not PII Button (for PII columns) */}
                              {column.pii_type && assetMetadata && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 border-gray-300 text-gray-700 hover:bg-gray-100"
                                  onClick={async () => {
                                  if (!confirm(`Mark "${column.column_name}" as NOT ${column.pii_type} PII?\n\nThis will:\n✓ Clear the PII classification\n✓ Resolve any quality issues\n✓ Add to exclusion list\n✓ Prevent re-detection on future scans`)) {
                                    return;
                                  }

                                  try {
                                    const response = await fetch('/api/pii-exclusions/mark-not-pii', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        columnId: column.id,
                                        assetId: assetId,
                                        columnName: column.column_name,
                                        tableName: assetMetadata.table_name,
                                        schemaName: assetMetadata.schema_name,
                                        databaseName: assetMetadata.database_name,
                                        piiType: column.pii_type,
                                        exclusionType: 'table_column',
                                        reason: `User manually verified "${column.column_name}" is not ${column.pii_type}`,
                                        excludedBy: 'user',
                                      }),
                                    });

                                    if (!response.ok) {
                                      const errorData = await response.json().catch(() => ({}));
                                      console.error('Mark as Not PII error:', errorData);
                                      throw new Error(errorData.error || 'Failed to mark as not PII');
                                    }

                                    const result = await response.json();
                                    console.log('✅ Mark as Not PII success:', result);

                                    alert(`✅ INSTANT UPDATE - No Rescan Needed!\n\n` +
                                          `Column "${column.column_name}" is NO LONGER ${column.pii_type.toUpperCase()} PII.\n\n` +
                                          `✅ PII classification cleared from database\n` +
                                          `✅ ${result.data.issuesResolved || 0} quality issue(s) resolved\n` +
                                          `✅ Added to exclusion list (ID: ${result.data.exclusionId})\n` +
                                          `✅ Future scans will automatically skip this column\n\n` +
                                          `The change is INSTANT - refresh to see updated data!`);

                                    // Refresh the asset details to show updated data immediately
                                    await fetchAssetDetails();

                                    // Close the details panel
                                    setSelectedColumn(null);
                                  } catch (error) {
                                    console.error('Error marking as not PII:', error);
                                    alert(`❌ Failed to mark as not PII.\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
                                  }
                                }}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Mark as Not PII
                              </Button>
                              )}
                            </div>
                          </div>

                          {column.quality_issues.map((issue, idx) => {
                            const fixScript = generateFixScript(column, issue);
                            const scriptId = `${column.id}-${idx}`;

                            return (
                              <div key={idx} className="bg-white rounded-lg border-2 border-red-200 p-3">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge className={`text-xs ${getSeverityColor(issue.severity)}`}>
                                        {issue.severity.toUpperCase()}
                                      </Badge>
                                      <span className="font-semibold text-gray-900">{issue.issue_type}</span>
                                    </div>
                                    <p className="text-sm text-gray-700">{issue.description}</p>
                                    {issue.affected_rows && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Affected rows: <span className="font-semibold">{issue.affected_rows.toLocaleString()}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Fix Script */}
                                <div className="mt-3 bg-gray-900 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Terminal className="w-4 h-4 text-green-400" />
                                      <span className="text-xs font-semibold text-green-400">Suggested Fix Script</span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-6 bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                                      onClick={() => copyToClipboard(fixScript, scriptId)}
                                    >
                                      {copiedScript === scriptId ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3 mr-1" />
                                          Copied!
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3 mr-1" />
                                          Copy
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                  <pre className="text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                    {fixScript}
                                  </pre>
                                </div>
                              </div>
                            );
                          })}

                          {/* Intelligent Sample Data Display - Context-Aware */}
                          {column.quality_issues.map((issue, issueIdx) => {
                            const issueType = issue.issue_type;

                            return (
                              <div key={`sample-${issueIdx}`} className="bg-white rounded-lg border-2 border-blue-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h6 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <Database className="w-4 h-4 text-blue-600" />
                                    {issueType === 'null_values' && '📊 NULL Value Examples'}
                                    {issueType === 'duplicate_values' && '🔄 Duplicate Records'}
                                    {issueType === 'pii_unencrypted' && '🔓 Unmasked PII Data Preview'}
                                    {issueType === 'invalid_format' && '⚠️ Invalid Format Examples'}
                                    {issueType === 'missing_index' && '🐌 Performance Impact Sample'}
                                    {!['null_values', 'duplicate_values', 'pii_unencrypted', 'invalid_format', 'missing_index'].includes(issueType) && '📋 Sample Data'}
                                  </h6>
                                  <Badge className="bg-blue-100 text-blue-700 text-xs">
                                    {issue.affected_rows ? `${issue.affected_rows.toLocaleString()} affected` : 'Examples below'}
                                  </Badge>
                                </div>

                                {/* NULL VALUES - Show rows with NULL */}
                                {issueType === 'null_values' && (
                                  <div className="space-y-2">
                                    <div className="bg-gray-50 rounded p-3 border border-gray-200">
                                      <div className="text-xs text-gray-600 mb-2">Rows containing NULL values in <code className="bg-gray-200 px-1 rounded">{column.column_name}</code>:</div>
                                      <div className="space-y-1">
                                        {column.sample_values && column.sample_values.filter(v => !v || v === '<null>').length > 0 ? (
                                          column.sample_values.filter(v => !v || v === '<null>').slice(0, 5).map((val, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                                              <XCircle className="w-3 h-3 text-red-500" />
                                              <code className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200 flex-1">
                                                {column.column_name} = NULL
                                              </code>
                                            </div>
                                          ))
                                        ) : (
                                          // Show representative NULL examples when sample_values is null
                                          Array.from({ length: 3 }).map((_, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                                              <XCircle className="w-3 h-3 text-red-500" />
                                              <code className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200 flex-1">
                                                Row #{idx + 1}: {column.column_name} = NULL
                                              </code>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                      {issue.affected_rows && (
                                        <div className="mt-2 text-xs text-gray-600 italic">
                                          Total NULL rows: {issue.affected_rows.toLocaleString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* DUPLICATE VALUES - Show duplicates grouped */}
                                {issueType === 'duplicate_values' && (
                                  <div className="space-y-2">
                                    <div className="bg-amber-50 rounded p-3 border border-amber-200">
                                      <div className="text-xs text-amber-800 mb-2">⚠️ Duplicate values found:</div>
                                      <div className="space-y-2">
                                        {column.sample_values && column.sample_values.length > 0 ? (
                                          Array.from(new Set(column.sample_values)).slice(0, 3).map((val, idx) => {
                                            const count = column.sample_values.filter(v => v === val).length;
                                            return count > 1 ? (
                                              <div key={idx} className="bg-white rounded border border-amber-300 p-2">
                                                <div className="flex items-center justify-between">
                                                  <code className="text-xs font-mono font-semibold text-gray-900">{val}</code>
                                                  <Badge className="bg-red-100 text-red-700 text-xs">
                                                    {count}x duplicates
                                                  </Badge>
                                                </div>
                                              </div>
                                            ) : null;
                                          })
                                        ) : (
                                          // Show representative duplicate examples
                                          <>
                                            <div className="bg-white rounded border border-amber-300 p-2">
                                              <div className="flex items-center justify-between">
                                                <code className="text-xs font-mono font-semibold text-gray-900">"{column.data_type === 'integer' ? '12345' : 'Value_A'}"</code>
                                                <Badge className="bg-red-100 text-red-700 text-xs">5x duplicates</Badge>
                                              </div>
                                            </div>
                                            <div className="bg-white rounded border border-amber-300 p-2">
                                              <div className="flex items-center justify-between">
                                                <code className="text-xs font-mono font-semibold text-gray-900">"{column.data_type === 'integer' ? '67890' : 'Value_B'}"</code>
                                                <Badge className="bg-red-100 text-red-700 text-xs">3x duplicates</Badge>
                                              </div>
                                            </div>
                                            <div className="text-xs text-gray-500 italic mt-2">Representative examples - run query to see actual duplicates</div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* PII UNENCRYPTED - Show unmasked data with warning */}
                                {(issueType === 'pii_unencrypted' || issueType.includes('PII Detected')) && (
                                  <div className="space-y-2">
                                    <div className="bg-red-50 rounded p-3 border-2 border-red-300">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Shield className="w-4 h-4 text-red-600" />
                                        <span className="text-xs font-bold text-red-900">⚠️ SENSITIVE DATA - ENCRYPTION REQUIRED</span>
                                      </div>
                                      <div className="text-xs text-red-800 mb-3">
                                        The following {column.data_classification || column.pii_type || 'PII'} data is stored in plain text without encryption:
                                      </div>
                                      <div className="space-y-1">
                                        {column.sample_values && column.sample_values.length > 0 ? (
                                          column.sample_values.slice(0, 5).map((val, idx) => (
                                            <div key={idx} className="bg-white rounded p-2 border border-red-300">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <Lock className="w-3 h-3 text-red-600" />
                                                  <code className="text-xs font-mono text-red-900 font-semibold blur-sm hover:blur-none transition-all cursor-pointer" title="Hover to reveal">
                                                    {val}
                                                  </code>
                                                </div>
                                                <Badge className="bg-red-100 text-red-700 text-xs">Unencrypted {column.data_classification || column.pii_type}</Badge>
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          // Show representative PII examples based on type
                                          (() => {
                                            const piiType = column.data_classification || column.pii_type || '';
                                            const examples = (() => {
                                              if (piiType.includes('ssn')) return ['123-45-6789', '987-65-4321', '555-12-3456'];
                                              if (piiType.includes('email')) return ['john.doe@company.com', 'jane.smith@example.com', 'user@domain.com'];
                                              if (piiType.includes('phone')) return ['(555) 123-4567', '555-987-6543', '555-246-8135'];
                                              if (piiType.includes('credit')) return ['4532-1234-5678-9012', '5412-3456-7890-1234', '6011-1111-2222-3333'];
                                              if (piiType.includes('address')) return ['123 Main St, Springfield', '456 Oak Ave, Boston', '789 Elm St, Seattle'];
                                              if (piiType.includes('name')) return ['John Doe', 'Jane Smith', 'Bob Johnson'];
                                              if (piiType.includes('ip')) return ['192.168.1.100', '10.0.0.25', '172.16.0.50'];
                                              return ['Sensitive Data #1', 'Sensitive Data #2', 'Sensitive Data #3'];
                                            })();

                                            return examples.map((example, idx) => (
                                              <div key={idx} className="bg-white rounded p-2 border border-red-300">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <Lock className="w-3 h-3 text-red-600" />
                                                    <code className="text-xs font-mono text-red-900 font-semibold blur-sm hover:blur-none transition-all cursor-pointer" title="Hover to reveal - Representative example">
                                                      {example}
                                                    </code>
                                                  </div>
                                                  <Badge className="bg-red-100 text-red-700 text-xs">Unencrypted {piiType}</Badge>
                                                </div>
                                              </div>
                                            ));
                                          })()
                                        )}
                                      </div>
                                      {!column.sample_values && (
                                        <div className="mt-2 text-xs text-gray-500 italic">Representative examples shown - actual data may vary</div>
                                      )}
                                      <div className="mt-3 space-y-2">
                                        <div className="text-xs font-semibold text-gray-700 mb-1">
                                          ✅ After Protection Should Look Like:
                                        </div>

                                        {/* Show masking examples based on PII type */}
                                        {(() => {
                                          const piiType = column.data_classification || column.pii_type || '';

                                          if (piiType.includes('email')) {
                                            return (
                                              <div className="bg-green-50 rounded p-2 border border-green-200">
                                                <div className="text-xs text-gray-600 mb-1">Masked Format:</div>
                                                <code className="text-xs font-mono text-green-700">j***@email.com</code>
                                                <div className="text-xs text-gray-500 mt-1">Only first letter and domain visible</div>
                                              </div>
                                            );
                                          }

                                          if (piiType.includes('phone')) {
                                            return (
                                              <div className="bg-green-50 rounded p-2 border border-green-200">
                                                <div className="text-xs text-gray-600 mb-1">Masked Format:</div>
                                                <code className="text-xs font-mono text-green-700">***-***-4567</code>
                                                <div className="text-xs text-gray-500 mt-1">Only last 4 digits visible</div>
                                              </div>
                                            );
                                          }

                                          if (piiType.includes('ssn')) {
                                            return (
                                              <div className="bg-green-50 rounded p-2 border border-green-200">
                                                <div className="text-xs text-gray-600 mb-1">Masked Format:</div>
                                                <code className="text-xs font-mono text-green-700">***-**-6789</code>
                                                <div className="text-xs text-gray-500 mt-1">Only last 4 digits visible</div>
                                              </div>
                                            );
                                          }

                                          if (piiType.includes('credit')) {
                                            return (
                                              <div className="bg-green-50 rounded p-2 border border-green-200">
                                                <div className="text-xs text-gray-600 mb-1">Masked Format:</div>
                                                <code className="text-xs font-mono text-green-700">****-****-****-9012</code>
                                                <div className="text-xs text-gray-500 mt-1">Only last 4 digits visible</div>
                                              </div>
                                            );
                                          }

                                          if (piiType.includes('name')) {
                                            return (
                                              <div className="bg-green-50 rounded p-2 border border-green-200">
                                                <div className="text-xs text-gray-600 mb-1">Masked Format:</div>
                                                <code className="text-xs font-mono text-green-700">J*** D***</code>
                                                <div className="text-xs text-gray-500 mt-1">Only first letter of each word visible</div>
                                              </div>
                                            );
                                          }

                                          if (piiType.includes('address')) {
                                            return (
                                              <div className="bg-green-50 rounded p-2 border border-green-200">
                                                <div className="text-xs text-gray-600 mb-1">Masked Format:</div>
                                                <code className="text-xs font-mono text-green-700">*** Main St, Springfield</code>
                                                <div className="text-xs text-gray-500 mt-1">Street number masked</div>
                                              </div>
                                            );
                                          }

                                          // Default masking for other PII types
                                          return (
                                            <div className="bg-green-50 rounded p-2 border border-green-200">
                                              <div className="text-xs text-gray-600 mb-1">Masked Format:</div>
                                              <code className="text-xs font-mono text-green-700">****** (partially masked)</code>
                                            </div>
                                          );
                                        })()}

                                        {/* Encryption option */}
                                        <div className="bg-blue-50 rounded p-2 border border-blue-200">
                                          <div className="text-xs text-gray-600 mb-1">Or Fully Encrypted:</div>
                                          <code className="text-xs font-mono text-blue-700">\\x7f8e9a2b... (encrypted hash)</code>
                                          <div className="text-xs text-gray-500 mt-1">Complete encryption for maximum security</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* INVALID FORMAT - Show bad vs good examples with real data */}
                                {issueType === 'invalid_format' && (() => {
                                  const cacheKey = `${column.id}-${issueType}`;
                                  const samples = realSamples[cacheKey];
                                  const piiType = column.data_classification || column.pii_type || '';
                                  const dataType = column.data_type || '';

                                  // Real samples are fetched automatically in useEffect hook at component level

                                  // Determine format details based on type
                                  const formatDetails = (() => {
                                    if (piiType.includes('email')) {
                                      return {
                                        goodExamples: ['user@example.com', 'name.surname@domain.co', 'contact@company.com'],
                                        details: '✓ Must contain @ symbol\n✓ Valid domain with extension\n✓ No special characters before @'
                                      };
                                    }
                                    if (piiType.includes('phone')) {
                                      return {
                                        goodExamples: ['(555) 123-4567', '+1-555-123-4567', '555.123.4567'],
                                        details: '✓ Valid phone format\n✓ Correct number of digits\n✓ Proper country code (if international)'
                                      };
                                    }
                                    if (piiType.includes('ssn')) {
                                      return {
                                        goodExamples: ['123-45-6789', '987-65-4321', '555-12-3456'],
                                        details: '✓ Format: XXX-XX-XXXX\n✓ 9 digits total\n✓ Hyphens in correct positions'
                                      };
                                    }
                                    if (dataType.includes('timestamp') || dataType.includes('date')) {
                                      return {
                                        goodExamples: ['2024-01-15 10:30:00', '2024-12-31 23:59:59', '2024-06-15 12:00:00'],
                                        details: '✓ Format: YYYY-MM-DD HH:MM:SS\n✓ Valid date ranges\n✓ 24-hour time format'
                                      };
                                    }
                                    return {
                                      goodExamples: ['Valid_Format_1', 'Valid_Format_2', 'Valid_Format_3'],
                                      details: `✓ Must match ${dataType} format\n✓ No invalid characters\n✓ Within valid range`
                                    };
                                  })();

                                  return (
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-2 gap-3">
                                        {/* Bad Examples (Real Data) */}
                                        <div className="bg-red-50 rounded p-3 border border-red-200">
                                          <div className="text-xs font-semibold text-red-900 mb-2 flex items-center gap-1">
                                            <XCircle className="w-3 h-3" />
                                            ❌ Actual Invalid Data from Table
                                          </div>
                                          <div className="space-y-1">
                                            {samples?.loading ? (
                                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Loading real examples...
                                              </div>
                                            ) : samples?.bad_samples && samples.bad_samples.length > 0 ? (
                                              samples.bad_samples.slice(0, 3).map((val: any, idx: number) => (
                                                <div key={idx} className="bg-white px-2 py-1.5 rounded border border-red-300">
                                                  <code className="block text-xs text-red-700 font-mono font-semibold">
                                                    {String(val)}
                                                  </code>
                                                  <div className="text-xs text-red-600 mt-0.5">Row {idx + 1} from {assetName}</div>
                                                </div>
                                              ))
                                            ) : (
                                              <div className="text-xs text-gray-500 italic">No invalid data samples available</div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Good Examples (Expected Format) */}
                                        <div className="bg-green-50 rounded p-3 border border-green-200">
                                          <div className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            ✅ Expected Valid Format
                                          </div>
                                          <div className="space-y-1">
                                            {formatDetails.goodExamples.map((example: string, idx: number) => (
                                              <code key={idx} className="block text-xs bg-white px-2 py-1 rounded border border-green-300 text-green-700 font-mono">
                                                {example}
                                              </code>
                                            ))}
                                          </div>
                                          <div className="mt-3 pt-2 border-t border-green-200">
                                            <div className="text-xs font-semibold text-green-900 mb-1">Format Requirements:</div>
                                            <div className="text-xs text-green-800 whitespace-pre-line">{formatDetails.details}</div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2">
                                        <Info className="w-4 h-4 text-blue-600" />
                                        <span>
                                          {samples?.bad_samples && samples.bad_samples.length > 0
                                            ? `Showing ${samples.bad_samples.length} actual invalid records from the database`
                                            : 'Run the fix script to correct invalid formats'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* MISSING INDEX - Show performance impact */}
                                {issueType === 'missing_index' && (
                                  <div className="space-y-2">
                                    <div className="bg-yellow-50 rounded p-3 border border-yellow-200">
                                      <div className="text-xs text-yellow-900 mb-2">⚡ Performance Impact:</div>
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-gray-700">Without Index:</span>
                                          <Badge className="bg-red-100 text-red-700">~2,500ms query time</Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-gray-700">With Index:</span>
                                          <Badge className="bg-green-100 text-green-700">~15ms query time</Badge>
                                        </div>
                                        <div className="mt-2 p-2 bg-white rounded border border-yellow-300">
                                          <div className="text-xs font-semibold text-gray-700 mb-1">Sample Query Being Slowed:</div>
                                          <code className="text-xs text-gray-600 font-mono">
                                            SELECT * FROM {assetName} WHERE {column.column_name} = ...
                                          </code>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* DEFAULT - Generic sample data */}
                                {!['null_values', 'duplicate_values', 'pii_unencrypted', 'invalid_format', 'missing_index'].includes(issueType) && column.sample_values && column.sample_values.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {column.sample_values.slice(0, 10).map((val, idx) => (
                                      <code key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300 font-mono">
                                        {val || '<null>'}
                                      </code>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* PII Data Preview - When no quality issues (just monitoring) */}
                          {column.quality_issues.length === 0 && column.pii_type && (
                            <div className="bg-white rounded-lg border-2 border-amber-200 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h6 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                  <Database className="w-4 h-4 text-amber-600" />
                                  🔍 PII Data Preview - Monitoring Only
                                </h6>
                                <Badge className="bg-amber-100 text-amber-700 text-xs">
                                  <Shield className="w-3 h-3 mr-1" />
                                  {column.pii_type} detected
                                </Badge>
                              </div>

                              {/* Info message */}
                              <div className="bg-blue-50 rounded p-3 border border-blue-200 mb-3">
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                                  <div className="text-xs text-blue-800">
                                    <strong>Monitoring Mode:</strong> This column contains PII data but encryption is not required based on your current configuration. You can view the data for monitoring purposes.
                                  </div>
                                </div>
                              </div>

                              {/* Sample data without blur */}
                              <div className="space-y-2">
                                <div className="bg-amber-50 rounded p-3 border border-amber-200">
                                  <div className="text-xs text-amber-800 mb-2 font-semibold">
                                    Sample {column.pii_type} data in this column:
                                  </div>
                                  <div className="space-y-1">
                                    {column.sample_values && column.sample_values.length > 0 ? (
                                      column.sample_values.slice(0, 5).map((val, idx) => (
                                        <div key={idx} className="bg-white rounded p-2 border border-amber-200">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <Eye className="w-3 h-3 text-amber-600" />
                                              <code className="text-xs font-mono text-gray-900">
                                                {val}
                                              </code>
                                            </div>
                                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                                              {column.pii_type}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      // Show representative PII examples based on type
                                      (() => {
                                        const piiType = column.data_classification || column.pii_type || '';
                                        const examples = (() => {
                                          if (piiType.includes('ssn')) return ['123-45-6789', '987-65-4321', '555-12-3456'];
                                          if (piiType.includes('email')) return ['john.doe@company.com', 'jane.smith@example.com', 'user@domain.com'];
                                          if (piiType.includes('phone')) return ['(555) 123-4567', '555-987-6543', '555-246-8135'];
                                          if (piiType.includes('credit')) return ['4532-1234-5678-9012', '5412-3456-7890-1234', '6011-1111-2222-3333'];
                                          if (piiType.includes('address')) return ['123 Main St, Springfield', '456 Oak Ave, Boston', '789 Elm St, Seattle'];
                                          if (piiType.includes('name')) return ['John Doe', 'Jane Smith', 'Bob Johnson'];
                                          if (piiType.includes('ip')) return ['192.168.1.100', '10.0.0.25', '172.16.0.50'];
                                          return ['Sensitive Data #1', 'Sensitive Data #2', 'Sensitive Data #3'];
                                        })();

                                        return examples.map((example, idx) => (
                                          <div key={idx} className="bg-white rounded p-2 border border-amber-200">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <Eye className="w-3 h-3 text-amber-600" />
                                                <code className="text-xs font-mono text-gray-900">
                                                  {example}
                                                </code>
                                              </div>
                                              <Badge className="bg-amber-100 text-amber-700 text-xs">
                                                {piiType}
                                              </Badge>
                                            </div>
                                          </div>
                                        ));
                                      })()
                                    )}
                                  </div>
                                  {!column.sample_values && (
                                    <div className="mt-2 text-xs text-gray-500 italic">Representative examples shown - actual data may vary</div>
                                  )}
                                </div>

                                {/* Optional protection suggestion */}
                                <div className="bg-green-50 rounded p-3 border border-green-200">
                                  <div className="flex items-start gap-2">
                                    <Shield className="w-4 h-4 text-green-600 mt-0.5" />
                                    <div className="text-xs text-green-800">
                                      <strong>Optional:</strong> To require encryption for this PII type, enable the "Encryption Required" option in PII Settings and run a new scan.
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Summary */}
      {totalIssues > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border-2 border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-semibold text-gray-900 mb-1">Action Required</h5>
              <p className="text-sm text-gray-700 mb-2">
                Found <strong>{totalIssues} quality issues</strong> across <strong>{columnsWithIssues.length} columns</strong>.
                Review the fix scripts above and apply them carefully in a test environment first.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleGenerateFullScript}
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  {copiedScript === 'full-script' ? 'Copied!' : 'Generate Full Fix Script'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDocumentation(!showDocumentation)}
                >
                  <Info className="w-4 h-4 mr-2" />
                  View Documentation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Script Modal */}
      {showFullScript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-600" />
                Complete Fix Script for {assetName}
              </h3>
              <button
                onClick={() => setShowFullScript(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-gray-900 rounded-lg p-4">
                <pre className="text-sm text-green-300 font-mono whitespace-pre-wrap">
                  {generateFullFixScript()}
                </pre>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFullScript(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => copyToClipboard(generateFullFixScript(), 'full-script-modal')}
              >
                {copiedScript === 'full-script-modal' ? 'Copied!' : 'Copy All'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Documentation Panel */}
      {showDocumentation && (
        <div className="mt-4 bg-blue-50 rounded-lg border-2 border-blue-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <h4 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Data Quality Fix Scripts Documentation
            </h4>
            <button
              onClick={() => setShowDocumentation(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h5 className="font-semibold text-gray-900 mb-2">⚠️ Important Safety Guidelines</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Always test scripts in a development environment first</li>
                <li>Backup your database before applying any changes</li>
                <li>Review and customize scripts for your specific use case</li>
                <li>Execute scripts during maintenance windows</li>
                <li>Monitor performance impact on large tables</li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold text-gray-900 mb-2">📋 Issue Types & Resolutions</h5>
              <div className="space-y-3">
                <div className="bg-white rounded p-3 border border-blue-200">
                  <div className="font-semibold text-red-600">PII Unencrypted (CRITICAL)</div>
                  <p className="text-xs mt-1">Sensitive data is stored in plain text. Use pgcrypto extension for encryption or implement column-level masking.</p>
                </div>
                <div className="bg-white rounded p-3 border border-blue-200">
                  <div className="font-semibold text-orange-600">NULL Values (HIGH)</div>
                  <p className="text-xs mt-1">Missing values can cause data integrity issues. Set default values and add NOT NULL constraints where appropriate.</p>
                </div>
                <div className="bg-white rounded p-3 border border-blue-200">
                  <div className="font-semibold text-yellow-600">Duplicate Values (MEDIUM)</div>
                  <p className="text-xs mt-1">Duplicate entries may indicate data quality problems. Use window functions to identify and remove duplicates safely.</p>
                </div>
                <div className="bg-white rounded p-3 border border-blue-200">
                  <div className="font-semibold text-blue-600">Missing Indexes (MEDIUM)</div>
                  <p className="text-xs mt-1">Foreign key columns without indexes can cause performance issues. Create indexes to improve query performance.</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-100 border border-amber-300 rounded p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-amber-900">Production Deployment Checklist:</div>
                  <ol className="list-decimal list-inside mt-1 space-y-0.5">
                    <li>Test script in development environment</li>
                    <li>Create database backup</li>
                    <li>Review execution plan for large tables</li>
                    <li>Schedule during low-traffic period</li>
                    <li>Monitor system resources during execution</li>
                    <li>Verify data integrity after completion</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedAssetView;
