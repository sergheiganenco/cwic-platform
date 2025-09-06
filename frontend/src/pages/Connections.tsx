// src/pages/Connections.tsx
import AddConnectionWizard from '@/components/features/data-sources/AddConnectionWizard';
import DataSourceCard from '@/components/features/data-sources/DataSourceCard';
import { useDataSources } from '@/hooks/useDataSources';
import type { DataSourceStatus, DataSourceType } from '@/types/dataSources';
import React from 'react';

export function Connections() {
  const {
    items, page, setPage, limit, setLimit, total,
    status, setStatus, type, setType,
    loading, error, refresh, summary,
    create, remove, test, sync,
  } = useDataSources();

  const pages = Math.max(1, Math.ceil(total / limit));
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Data Sources</h1>
          <p className="text-sm text-gray-500">Manage connections to databases, warehouses, storage, streams, and APIs.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Connection
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Total Sources" value={summary.total} icon="💽" />
        <Stat label="Healthy" value={summary.healthy} icon="✅" />
        <Stat label="Warning" value={summary.warning} icon="⚠️" />
        <Stat label="Error" value={summary.error} icon="⛔" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Status"
          value={status}
          onChange={v => setStatus(v as DataSourceStatus | '')}
          options={['', 'pending','connected','disconnected','error','warning','syncing','testing']}
        />
        <Select
          label="Type"
          value={type}
          onChange={v => setType(v as DataSourceType | '')}
          options={ALL_TYPES}
        />
        <Select
          label="Page size"
          value={String(limit)}
          onChange={v => setLimit(Number(v))}
          options={['10','20','50','100']}
        />
        <div className="ml-auto text-sm text-gray-500">Page {page} / {pages}</div>
      </div>

      {/* Content */}
      {loading ? (
        <Box>Loading…</Box>
      ) : error ? (
        <Box className="border-red-200 bg-red-50 text-red-700">{error}</Box>
      ) : items.length === 0 ? (
        <Box>No data sources connected.</Box>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {items.map(ds => (
            <DataSourceCard
              key={ds.id}
              ds={ds}
              onTest={async id => {
                const r = await test(id);
                alert(r.success ? 'Connection OK' : `Failed: ${r.error ?? 'Unknown error'}`);
              }}
              onSync={async id => {
                const r = await sync(id);
                alert(`Sync ${r.status} (${r.syncId})`);
              }}
              onDelete={async id => {
                if (confirm('Delete this source?')) await remove(id);
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage(p => p - 1)}
          className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
        >
          Prev
        </button>
        <button
          disabled={page >= pages}
          onClick={() => setPage(p => p + 1)}
          className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
        >
          Next
        </button>
        <button onClick={() => refresh()} className="ml-2 rounded-lg border px-3 py-1 text-sm">
          Refresh
        </button>
      </div>

      {/* New Wizard (searchable gallery + dynamic fields) */}
      <AddConnectionWizard
        open={open}
        onClose={() => setOpen(false)}
        onCreate={create}
        onTestAfterCreate={async (id) => test(id)}
      />
    </div>
  );
}

/* ---------- helpers ---------- */
const ALL_TYPES: (DataSourceType | '')[] = [
  '',
  'postgresql','mysql','mssql','oracle','mongodb','redis',
  's3','azure-blob','gcs',
  'snowflake','bigquery','redshift','databricks',
  'api','file','kafka','elasticsearch'
];

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xl">{icon}</div>
      </div>
    </div>
  );
}

function Box({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`rounded-xl border p-6 text-sm text-gray-600 ${className}`}>{children}</div>;
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string | number;
  onChange(v: string): void;
  options: (string | number)[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      <select
        className="mt-1 rounded-lg border p-2 text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o} value={o}>
            {o === '' ? 'All' : o}
          </option>
        ))}
      </select>
    </div>
  );
}
