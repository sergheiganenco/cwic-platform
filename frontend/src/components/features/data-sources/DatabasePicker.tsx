// src/components/features/datasources/DatabasePicker.tsx
import { useDb } from '@/store/dbContext';
import { cn } from '@/utils';
import { ChevronDown, Database, Server } from 'lucide-react';
import React from 'react';

export interface DatabasePickerProps {
  className?: string;
  compact?: boolean; // smaller for header
}

export const DatabasePicker: React.FC<DatabasePickerProps> = ({ className = '', compact = true }) => {
  const { servers, databases, selection, status, error, setServer, setDatabase, refreshServers, refreshDatabases } = useDb();

  const loading = status === 'loading';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Server select */}
      <label className="relative inline-flex items-center">
        <Server className={cn('mr-2 h-4 w-4 text-gray-500', compact && 'h-3 w-3')} />
        <select
          value={selection?.serverId ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            setServer(id);
            if (id) refreshDatabases(id);
          }}
          className={cn(
            'rounded-lg border border-gray-300 bg-white text-sm',
            compact ? 'px-2 py-1' : 'px-3 py-2'
          )}
          title="Select server"
        >
          <option value="">{loading ? 'Loading servers…' : 'Select server'}</option>
          {servers.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.engine}
            </option>
          ))}
        </select>
      </label>

      {/* Database select */}
      <label className="relative inline-flex items-center">
        <Database className={cn('mr-2 h-4 w-4 text-gray-500', compact && 'h-3 w-3')} />
        <select
          value={selection?.dbName ?? ''}
          onChange={(e) => setDatabase(e.target.value || null)}
          disabled={!selection?.serverId || loading}
          className={cn(
            'rounded-lg border border-gray-300 bg-white text-sm disabled:bg-gray-100 disabled:text-gray-400',
            compact ? 'px-2 py-1' : 'px-3 py-2'
          )}
          title={selection?.serverId ? 'Select database' : 'Pick a server first'}
        >
          <option value="">
            {!selection?.serverId ? 'Pick server first' : loading ? 'Loading databases…' : 'Select database'}
          </option>
          {databases.map(d => (
            <option key={d.name} value={d.name}>{d.name}</option>
          ))}
        </select>
        <ChevronDown className={cn('pointer-events-none -ml-5 h-4 w-4 text-gray-400', compact && 'h-3 w-3')} />
      </label>

      {error && (
        <button
          onClick={() => {
            refreshServers();
            if (selection?.serverId) refreshDatabases(selection.serverId);
          }}
          className="text-xs text-red-600 underline"
          title={error}
        >
          Retry
        </button>
      )}
    </div>
  );
};
