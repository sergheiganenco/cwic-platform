import type { DataSource, TestResult } from '@/types/dataSources'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import * as React from 'react'

export function ConnectionTest({
  connection,
  onTest,
}: {
  /** Optional: allow the page to pass the connection (your page is doing this) */
  connection?: DataSource
  /** Test callback; may ignore the connection param if you want */
  onTest: (conn?: DataSource) => Promise<TestResult> | TestResult
}) {
  const [status, setStatus] = React.useState<TestResult>('idle')

  async function run() {
    setStatus('testing')
    try {
      const res = await onTest(connection)
      setStatus(res) // 'ok' | 'fail' | 'idle' | 'testing' (enforced by type)
    } catch {
      setStatus('fail')
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Connection Test</CardTitle></CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Status:{' '}
          <strong className={status === 'ok' ? 'text-green-600' : status === 'fail' ? 'text-red-600' : 'text-gray-700'}>
            {status}
          </strong>
        </div>
        <Button onClick={run} disabled={status === 'testing'}>
          {status === 'testing' ? 'Testing…' : 'Run Test'}
        </Button>
      </CardContent>
    </Card>
  )
}
