import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Play, RefreshCcw, Upload } from 'lucide-react'

export interface QuickActionsProps {
  onNewScan?: () => void
  onRefresh?: () => void
  onImport?: () => void
  busy?: boolean
}

export function QuickActions({ onNewScan, onRefresh, onImport, busy }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={onNewScan} disabled={busy} leftIcon={<Play className="h-4 w-4" />}>
          Start New Scan
        </Button>
        <Button variant="outline" onClick={onRefresh} disabled={busy} leftIcon={<RefreshCcw className="h-4 w-4" />}>
          Refresh Data
        </Button>
        <Button variant="secondary" onClick={onImport} disabled={busy} leftIcon={<Upload className="h-4 w-4" />}>
          Import Metadata
        </Button>
      </CardContent>
    </Card>
  )
}
