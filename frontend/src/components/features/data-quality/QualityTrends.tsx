import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'

export interface TrendPoint {
  ts: string // ISO
  score: number
}

export function QualityTrends({ points = [] as TrendPoint[] }: { points?: TrendPoint[] }) {
  // Simple SVG sparkline (no external chart lib required)
  const w = 520, h = 80, pad = 6
  const ys = points.map(p => p.score)
  const min = Math.min(70, ...ys), max = Math.max(100, ...ys)
  const xStep = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const path = points
    .map((p, i) => {
      const x = pad + i * xStep
      const y = pad + (1 - (p.score - min) / Math.max(1, (max - min))) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')

  return (
    <Card>
      <CardHeader><CardTitle>Quality Trends</CardTitle></CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="text-sm text-gray-600">No trend data available.</div>
        ) : (
          <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Quality score trend">
            <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </CardContent>
    </Card>
  )
}
