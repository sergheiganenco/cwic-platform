// src/pages/DataSources.tsx
import { useState } from 'react';
import AddConnectionWizard from '../components/features/data-sources/AddConnectionWizard';
import DataSourceCard from '../components/features/data-sources/DataSourceCard';
import { useDataSources } from '../hooks/useDataSources';
import type { DataSourceStatus, DataSourceType } from '../types/dataSources';

export default function DataSourcesPage() {
  const {
    items, page, setPage, limit, setLimit, total,
    status, setStatus, type, setType,
    loading, error, refresh, summary,
    create, remove, test, sync,
  } = useDataSources();

  const pages = Math.max(1, Math.ceil(total / limit));
  const [open, setOpen] = useState(false);

  // Handle test after creation
  const handleTestAfterCreate = async (id: string) => {
    try {
      const result = await test(id);
      return {
        success: result.success,
        message: result.message,
        error: result.error
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Test failed'
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Data Sources</h1>
          <p className="text-sm text-gray-500">Manage connections to databases, storage, and APIs.</p>
        </div>
        <button 
          onClick={() => setOpen(true)} 
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Connection
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Total Sources" value={summary.total} icon="💽" />
        <Stat label="Healthy" value={summary.healthy} icon="✅" />
        <Stat label="Warning" value={summary.warning} icon="⚠️" />
        <Stat label="Error" value={summary.error} icon="⛔" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600">Status</label>
          <select 
            className="mt-1 rounded-lg border p-2 text-sm" 
            value={status} 
            onChange={e => setStatus(e.target.value as DataSourceStatus | '')}
          >
            <option value="">All</option>
            {['active', 'inactive', 'pending', 'error', 'testing'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600">Type</label>
          <select 
            className="mt-1 rounded-lg border p-2 text-sm" 
            value={type} 
            onChange={e => setType(e.target.value as DataSourceType | '')}
          >
            {ALL_TYPES.map(t => (
              <option key={t} value={t}>
                {t === '' ? 'All' : getTypeDisplayName(t as DataSourceType)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600">Page size</label>
          <select 
            className="mt-1 rounded-lg border p-2 text-sm" 
            value={limit} 
            onChange={e => setLimit(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-gray-500">
          Page {page} / {pages} ({total} total)
        </div>
      </div>

      {/* Grid/List */}
      {loading ? (
        <div className="rounded-xl border p-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            Loading data sources...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button 
            onClick={refresh}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-4">🔌</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No data sources yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Connect to databases, APIs, and storage systems to get started.
          </p>
          <button 
            onClick={() => setOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Your First Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {items.map(ds => (
            <DataSourceCard
              key={ds.id}
              ds={ds}
              onTest={async (id) => {
                try {
                  const result = await test(id);
                  alert(result.success ? 'Connection successful!' : `Failed: ${result.error ?? 'Unknown error'}`);
                } catch (error: any) {
                  alert(`Test failed: ${error.message}`);
                }
              }}
              onSync={async (id) => {
                try {
                  const result = await sync(id);
                  alert(`Sync ${result.status} (ID: ${result.syncId})`);
                } catch (error: any) {
                  alert(`Sync failed: ${error.message}`);
                }
              }}
              onDelete={async (id) => {
                if (confirm('Are you sure you want to delete this data source? This action cannot be undone.')) {
                  try {
                    await remove(id);
                    alert('Data source deleted successfully');
                  } catch (error: any) {
                    alert(`Delete failed: ${error.message}`);
                  }
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} results
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={page <= 1} 
              onClick={() => setPage(p => p - 1)} 
              className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm">
              {page} of {pages}
            </span>
            <button 
              disabled={page >= pages} 
              onClick={() => setPage(p => p + 1)} 
              className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
            <button 
              onClick={refresh} 
              className="ml-2 rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Add Connection Wizard */}
      <AddConnectionWizard
        open={open}
        onClose={() => setOpen(false)}
        onCreate={create}
        onTestAfterCreate={handleTestAfterCreate}
        existingConnections={items}
      />
    </div>
  );
}

// Updated ALL_TYPES to match your DataSourceType union (removed 'oracle')
const ALL_TYPES: (DataSourceType | '')[] = [
  '', 
  'postgresql', 'mysql', 'mssql', 'mongodb', 'redis',
  'snowflake', 'bigquery', 'redshift', 'databricks',
  's3', 'azure-blob', 'gcs',
  'kafka', 'api', 'file', 'ftp', 'elasticsearch'
];

// Helper function to get display names
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

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xl">{icon}</div>
      </div>
    </div>
  );
}