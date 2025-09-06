// src/components/features/data-sources/DataSourceCard.tsx
import type { DataSource, DataSourceType } from '@/types/dataSources';

// Fixed status colors to match actual DataSourceStatus union
const statusColors: Record<DataSource['status'], string> = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-gray-200 text-gray-700',
  pending: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-700',
  testing: 'bg-blue-100 text-blue-800',
};

// Helper function to safely get connection info
function getConnectionInfo(config: DataSource['connectionConfig'], type: DataSourceType) {
  // Type-safe property access based on connector type
  const info: { host?: string; database?: string; bucket?: string; baseUrl?: string } = {};

  // Database types that have host/database
  if (['postgresql', 'mysql', 'mssql', 'mongodb', 'redis', 'elasticsearch'].includes(type)) {
    info.host = (config as any).host;
    info.database = (config as any).database;
  }
  // Storage types that have bucket
  else if (['s3', 'azure-blob', 'gcs'].includes(type)) {
    info.bucket = (config as any).bucket || (config as any).containerName || (config as any).bucketName;
  }
  // API types that have baseUrl
  else if (type === 'api') {
    info.baseUrl = (config as any).baseUrl;
  }
  // Data warehouses
  else if (['snowflake', 'bigquery', 'redshift', 'databricks'].includes(type)) {
    info.host = (config as any).host;
    info.database = (config as any).database || (config as any).projectId;
  }

  return info;
}

// Helper function to format dates
function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return '—';
  }
}

// Helper function to format relative time
function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Never';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  } catch {
    return 'Unknown';
  }
}

// Get connector icon
function getConnectorIcon(type: DataSourceType): string {
  const icons: Record<DataSourceType, string> = {
    postgresql: '🐘',
    mysql: '🐬',
    mssql: '🏢',
    mongodb: '🍃',
    redis: '📦',
    snowflake: '❄️',
    bigquery: '📊',
    redshift: '🔴',
    databricks: '🧱',
    s3: '☁️',
    'azure-blob': '🟦',
    gcs: '☁️',
    kafka: '🚀',
    api: '🔌',
    file: '📁',
    ftp: '📡',
    elasticsearch: '🔍',
    oracle: '🏛️', // If you decide to support Oracle in the future

  };
  return icons[type] || '💾';
}

// Get display name for type
function getTypeDisplayName(type: DataSourceType): string {
  const displayNames: Record<DataSourceType, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mssql: 'SQL Server',
    mongodb: 'MongoDB',
    redis: 'Redis',
    snowflake: 'Snowflake',
    bigquery: 'BigQuery',
    redshift: 'Amazon Redshift',
    databricks: 'Databricks',
    s3: 'Amazon S3',
    'azure-blob': 'Azure Blob Storage',
    gcs: 'Google Cloud Storage',
    kafka: 'Apache Kafka',
    api: 'REST API',
    file: 'File System',
    ftp: 'FTP/SFTP',
    elasticsearch: 'Elasticsearch',
    oracle: 'Oracle Database' // If you decide to support Oracle in the future
  };
  return displayNames[type] || type;
}

export default function DataSourceCard({
  ds, 
  onTest, 
  onSync, 
  onDelete,
}: { 
  ds: DataSource; 
  onTest(id: string): void; 
  onSync(id: string): void; 
  onDelete(id: string): void; 
}) {
  const connectionInfo = getConnectionInfo(ds.connectionConfig, ds.type);
  const hasError = ds.status === 'error' || ds.healthStatus?.status === 'down';
  const isLoading = ds.status === 'testing' || ds.syncStatus?.status === 'syncing';

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getConnectorIcon(ds.type)}</span>
            <div className="text-sm text-gray-500">{getTypeDisplayName(ds.type)}</div>
          </div>
          <div className="mt-0.5 text-lg font-semibold truncate" title={ds.name}>
            {ds.name}
          </div>
          {ds.description && (
            <div className="text-sm text-gray-500 line-clamp-2" title={ds.description}>
              {ds.description}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ds.status]}`}>
            {ds.status === 'active' ? 'Active' : 
             ds.status === 'inactive' ? 'Inactive' : 
             ds.status === 'pending' ? 'Pending' : 
             ds.status === 'error' ? 'Error' : 
             'Testing'}
          </span>
          {isLoading && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <div className="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full"></div>
              {ds.status === 'testing' ? 'Testing' : 'Syncing'}
            </div>
          )}
        </div>
      </div>

      {/* Connection Details */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
        {connectionInfo.host && (
          <div>
            <span className="text-gray-500">Host:</span>{' '}
            <span className="font-medium">{connectionInfo.host}</span>
          </div>
        )}
        {connectionInfo.database && (
          <div>
            <span className="text-gray-500">Database:</span>{' '}
            <span className="font-medium">{connectionInfo.database}</span>
          </div>
        )}
        {connectionInfo.bucket && (
          <div>
            <span className="text-gray-500">Bucket:</span>{' '}
            <span className="font-medium">{connectionInfo.bucket}</span>
          </div>
        )}
        {connectionInfo.baseUrl && (
          <div className="col-span-2">
            <span className="text-gray-500">URL:</span>{' '}
            <span className="font-medium truncate">{connectionInfo.baseUrl}</span>
          </div>
        )}
        <div>
          <span className="text-gray-500">Last Sync:</span>{' '}
          <span className="font-medium">{formatRelativeTime(ds.lastSyncAt)}</span>
        </div>
        <div>
          <span className="text-gray-500">Last Test:</span>{' '}
          <span className="font-medium">{formatRelativeTime(ds.lastTestedAt)}</span>
        </div>
      </div>

      {/* Health Status */}
      {ds.healthStatus && ds.healthStatus.status !== 'healthy' && (
        <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 p-2">
          <div className="flex items-center gap-1 text-xs text-amber-700">
            <span>⚠️</span>
            <span className="font-medium">Health: {ds.healthStatus.status}</span>
          </div>
          {ds.healthStatus.message && (
            <div className="text-xs text-amber-600 mt-1">{ds.healthStatus.message}</div>
          )}
        </div>
      )}

      {/* Error Display */}
      {hasError && ds.healthStatus?.message && (
        <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-2">
          <div className="flex items-center gap-1 text-xs text-red-700">
            <span>❌</span>
            <span className="font-medium">Error</span>
          </div>
          <div className="text-xs text-red-600 mt-1">{ds.healthStatus.message}</div>
        </div>
      )}

      {/* Usage Stats */}
      {ds.usage && (ds.usage.queriesCount > 0 || ds.usage.lastUsed) && (
        <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 p-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {ds.usage.queriesCount > 0 && (
              <div>
                <span className="text-blue-600">Queries:</span>{' '}
                <span className="font-medium text-blue-800">{ds.usage.queriesCount}</span>
              </div>
            )}
            {ds.usage.lastUsed && (
              <div>
                <span className="text-blue-600">Last Used:</span>{' '}
                <span className="font-medium text-blue-800">{formatRelativeTime(ds.usage.lastUsed)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {ds.tags && ds.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ds.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
            >
              {tag}
            </span>
          ))}
          {ds.tags.length > 3 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              +{ds.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button 
          onClick={() => onTest(ds.id)} 
          disabled={isLoading}
          className="flex-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Test connection"
        >
          {ds.status === 'testing' ? 'Testing...' : 'Test'}
        </button>
        <button 
          onClick={() => onSync(ds.id)} 
          disabled={isLoading}
          className="flex-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Sync/discover assets"
        >
          {ds.syncStatus?.status === 'syncing' ? 'Syncing...' : 'Sync'}
        </button>
        <button 
          onClick={() => onDelete(ds.id)} 
          disabled={isLoading}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Delete data source"
        >
          Delete
        </button>
      </div>

      {/* Metadata */}
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Created {formatRelativeTime(ds.createdAt)}</span>
          {ds.createdBy && <span>by {ds.createdBy}</span>}
        </div>
      </div>
    </div>
  );
}