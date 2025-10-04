// Performance test page to verify optimizations
import React, { useEffect, useState } from 'react'
import { useDataSources } from '@/hooks/useDataSources'
import { useRequests } from '@/hooks/useRequests'
import { useDataAssets } from '@/hooks/useDataAssets'

export const PerformanceTest: React.FC = () => {
  const [renderCount, setRenderCount] = useState(0)
  const [apiCallLog, setApiCallLog] = useState<string[]>([])

  // Track renders
  useEffect(() => {
    setRenderCount(c => c + 1)
  })

  // Monitor API calls
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = function(...args) {
      const url = args[0] as string
      if (url.includes('/api/')) {
        const timestamp = new Date().toISOString()
        setApiCallLog(prev => [...prev.slice(-20), `${timestamp}: ${url}`])
      }
      return originalFetch.apply(this, args)
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  const dataSources = useDataSources()
  const requests = useRequests()
  const dataAssets = useDataAssets()

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Performance Test Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Render Count</h2>
          <p className="text-3xl font-mono">{renderCount}</p>
          <p className="text-sm text-gray-500">Lower is better</p>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Data Sources</h2>
          <p>Items: {dataSources.items.length}</p>
          <p>Loading: {dataSources.loading ? 'Yes' : 'No'}</p>
          <p className="text-xs text-gray-500">Last refresh prevented if &lt; 5s</p>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Requests</h2>
          <p>Items: {requests.requests.length}</p>
          <p>Loading: {requests.isLoading ? 'Yes' : 'No'}</p>
        </div>
      </div>

      <div className="border p-4 rounded">
        <h2 className="font-semibold mb-2">API Call Log (Last 20)</h2>
        <div className="h-48 overflow-y-auto font-mono text-xs space-y-1">
          {apiCallLog.length === 0 ? (
            <p className="text-gray-500">No API calls yet...</p>
          ) : (
            apiCallLog.map((log, i) => (
              <div key={i} className="text-gray-700">{log}</div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => dataSources.refresh()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Force Refresh Data Sources
        </button>
        <button
          onClick={() => {
            // Try rapid refresh - should be throttled
            dataSources.refresh()
            setTimeout(() => dataSources.refresh(), 100)
            setTimeout(() => dataSources.refresh(), 200)
            setTimeout(() => dataSources.refresh(), 300)
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Test Rapid Refresh (Should Throttle)
        </button>
      </div>

      <div className="text-xs text-gray-500">
        <p>✅ Debouncing: Filter changes are debounced by 500ms</p>
        <p>✅ Throttling: Dashboard refresh is throttled to once per 3 seconds</p>
        <p>✅ Minimum interval: Data fetches have 5-second minimum interval</p>
        <p>✅ Memoization: KPIs and computed values are memoized</p>
      </div>
    </div>
  )
}

export default PerformanceTest