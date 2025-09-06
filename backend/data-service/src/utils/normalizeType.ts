// Normalize external aliases to canonical internal types
export type KnownType =
  | 'postgres' | 'postgresql' | 'mysql' | 'mssql' | 'mongodb' | 'redis'
  | 'snowflake' | 'bigquery' | 'redshift' | 'databricks' | 's3' | 'azure-blob'
  | 'gcs' | 'kafka' | 'api' | 'file' | 'ftp' | 'elasticsearch' | 'oracle';

export function normalizeDataSourceType(t?: string): KnownType | undefined {
  if (!t) return undefined;
  const lower = t.toLowerCase();
  switch (lower) {
    case 'postgres': return 'postgresql';
    default: return lower as KnownType;
  }
}
