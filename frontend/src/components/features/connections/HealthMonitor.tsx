import type { DataSource } from '@/types/dataSources';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import * as React from 'react';

type LegacyItem = { name: string; status: 'up' | 'down'; latencyMs?: number }

type Props =
  | { dataSources: DataSource[]; items?: never }
  | { items: LegacyItem[]; dataSources?: never }
  | { dataSources?: DataSource[]; items?: LegacyItem[] } // allow both; dataSources wins

export function HealthMonitor(props: Props) {
  // Normalize to a single render shape
  const normalized: LegacyItem[] = React.useMemo(() => {
    if (props.dataSources && props.dataSources.length) {
      return props.dataSources.map((ds) => ({
        name: ds.name,
        status: ds.status === 'down' || ds.status === 'error' ? 'down' : 'up',
        latencyMs:
          typeof ds.metadata === 'object' && ds.metadata
            ? (ds.metadata['latencyMs'] as number | undefined)
            : undefined,
      }))
    }
    return (props.items ?? []).map((x) => ({ ...x }))
  }, [props])

  const totals = React.useMemo(() => {
    const total = normalized.length
    const up = normalized.filter((i) => i.status === 'up').length
    const down = total - up
    return { total, up, down }
  }, [normalized])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Health Monitor</CardTitle>
          <div className="text-sm text-gray-600">
            Total: <strong>{totals.total}</strong> · Up: <strong className="text-green-600">{totals.up}</strong> · Down:{' '}
            <strong className="text-red-600">{totals.down}</strong>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {normalized.length === 0 ? (
          <div className="text-sm text-gray-600">No sources to monitor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Latency</th>
                </tr>
              </thead>
              <tbody>
                {normalized.map((i) => (
                  <tr key={i.name} className="border-t">
                    <td className="py-2 pr-4 font-medium text-gray-900">{i.name}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={[
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          i.status === 'up'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'mr-1 inline-block h-2 w-2 rounded-full',
                            i.status === 'up' ? 'bg-green-500' : 'bg-red-500',
                          ].join(' ')}
                        />
                        {i.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {typeof i.latencyMs === 'number' ? `${i.latencyMs} ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default HealthMonitor
