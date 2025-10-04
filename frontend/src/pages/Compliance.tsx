import {
  AlertTriangle,
  DownloadCloud,
  FileText,
  ShieldCheck,
  ShieldHalf,
  Timer
} from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const FRAMEWORKS = [
  { id: 'soc2', name: 'SOC 2 Type II', coverage: 78, owner: 'Security', nextAudit: '2024-04-18', gaps: 3 },
  { id: 'gdpr', name: 'GDPR', coverage: 64, owner: 'Privacy Office', nextAudit: '2024-06-01', gaps: 5 },
  { id: 'hipaa', name: 'HIPAA', coverage: 81, owner: 'Compliance', nextAudit: '2024-09-15', gaps: 1 },
]

const UPCOMING_TASKS = [
  { id: 'task-1', title: 'Review access attestations', dueIn: '3 days', owner: 'Data Governance', status: 'at-risk' },
  { id: 'task-2', title: 'Upload breach drill evidence', dueIn: '8 days', owner: 'Security Ops', status: 'on-track' },
  { id: 'task-3', title: 'Renew processor contract appendix', dueIn: '14 days', owner: 'Legal', status: 'on-track' },
]

const evidencePackages = [
  { id: 'pkg-1', name: 'Quarterly Audit Evidence (Q4)', size: '21 files', status: 'complete', generated: 'Yesterday' },
  { id: 'pkg-2', name: 'Vendor Management Evidence', size: '13 files', status: 'draft', generated: '2 days ago' },
]

const Compliance: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Command Center</h1>
          <p className="text-sm text-gray-600">Track control coverage, resolve audit gaps, and distribute evidence packages.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<FileText className="h-4 w-4" />}>Control library</Button>
          <Button leftIcon={<ShieldCheck className="h-4 w-4" />}>Generate report</Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Frameworks tracked</p>
              <p className="text-2xl font-semibold text-gray-900">5</p>
            </div>
            <ShieldHalf className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Open gaps</p>
              <p className="text-2xl font-semibold text-gray-900">9</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Evidence packages</p>
              <p className="text-2xl font-semibold text-gray-900">12</p>
            </div>
            <DownloadCloud className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Upcoming audits</p>
              <p className="text-2xl font-semibold text-gray-900">3</p>
            </div>
            <Timer className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Framework coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FRAMEWORKS.map((framework) => (
            <div key={framework.id} className="rounded-lg border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{framework.name}</p>
                  <p className="text-xs text-gray-500">Owned by {framework.owner}</p>
                </div>
                <Badge tone={framework.coverage >= 80 ? 'success' : 'warning'}>{framework.coverage}% covered</Badge>
              </div>
              <div className="mt-3 grid gap-3 text-xs text-gray-500 sm:grid-cols-3">
                <span>Next audit: {framework.nextAudit}</span>
                <span>Open gaps: {framework.gaps}</span>
                <span>Control library: {framework.name.split(' ')[0]}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline">View controls</Button>
                <Button size="sm">Resolve gaps</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Upcoming tasks</CardTitle>
            <Button variant="outline" size="sm">View planner</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {UPCOMING_TASKS.map((task) => (
              <div key={task.id} className="flex flex-col gap-2 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                  <p className="text-xs text-gray-500">Owner: {task.owner}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={task.status === 'at-risk' ? 'danger' : 'success'}>{task.status === 'at-risk' ? 'At risk' : 'On track'}</Badge>
                  <span className="text-xs text-gray-500">Due {task.dueIn}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Evidence packages</CardTitle>
            <Button variant="outline" size="sm">Upload evidence</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {evidencePackages.map((pkg) => (
              <div key={pkg.id} className="flex flex-col gap-2 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{pkg.name}</p>
                  <p className="text-xs text-gray-500">{pkg.size} � Generated {pkg.generated}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={pkg.status === 'complete' ? 'success' : 'warning'}>{pkg.status}</Badge>
                  <Button size="sm" variant="outline" leftIcon={<DownloadCloud className="h-4 w-4" />}>Download</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { Compliance }
export default Compliance
