import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  FileCheck2,
  Lock,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Tag,
  Wand2,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const policies = [
  {
    id: 'pol-1',
    name: 'Customer PII Classification',
    sensitivity: 'Restricted',
    lastRun: '2 hours ago',
    owner: 'Data Governance',
    coverage: 68,
    outstandingReviews: 5,
  },
  {
    id: 'pol-2',
    name: 'Revenue Metrics',
    sensitivity: 'Internal',
    lastRun: '30 minutes ago',
    owner: 'Finance Analytics',
    coverage: 91,
    outstandingReviews: 0,
  },
  {
    id: 'pol-3',
    name: 'Marketing Engagement Signals',
    sensitivity: 'Internal',
    lastRun: '6 hours ago',
    owner: 'Lifecycle Ops',
    coverage: 54,
    outstandingReviews: 2,
  },
]

const reviewQueue = [
  {
    id: 'review-1',
    field: 'payments.card_number',
    suggestedLabel: 'Highly Confidential',
    confidence: 0.96,
    reason: 'Format matches PAN pattern',
  },
  {
    id: 'review-2',
    field: 'customer.profile_image',
    suggestedLabel: 'Personal Data',
    confidence: 0.73,
    reason: 'Detected face embedding metadata',
  },
  {
    id: 'review-3',
    field: 'support.chat_transcript',
    suggestedLabel: 'Contains PII',
    confidence: 0.89,
    reason: 'Named entity detection surfaced personal addresses',
  },
]

const Classification: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [sensitivityFilter, setSensitivityFilter] = useState<'all' | 'Restricted' | 'Internal'>('all')

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      const matchesSensitivity = sensitivityFilter === 'all' || policy.sensitivity === sensitivityFilter
      const matchesSearch = searchTerm.trim() === '' || policy.name.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSensitivity && matchesSearch
    })
  }, [searchTerm, sensitivityFilter])

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classification Center</h1>
          <p className="text-sm text-gray-600">Automate detection, review, and labeling of sensitive data across the platform.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<Tag className="h-4 w-4" />}>Import labels</Button>
          <Button leftIcon={<Wand2 className="h-4 w-4" />}>Create policy</Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Labeled datasets</p>
              <p className="text-2xl font-semibold text-gray-900">132</p>
            </div>
            <Shield className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Auto approvals last 7d</p>
              <p className="text-2xl font-semibold text-gray-900">87%</p>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Pending reviews</p>
              <p className="text-2xl font-semibold text-gray-900">12</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Policies with gaps</p>
              <p className="text-2xl font-semibold text-gray-900">6</p>
            </div>
            <Scale className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Classification policies</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search policies"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-64"
              />
            </div>
            <select
              value={sensitivityFilter}
              onChange={(event) => setSensitivityFilter(event.target.value as 'all' | 'Restricted' | 'Internal')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All sensitivity levels</option>
              <option value="Restricted">Restricted</option>
              <option value="Internal">Internal</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredPolicies.map((policy) => (
            <div key={policy.id} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{policy.name}</p>
                  <p className="text-xs text-gray-500">Owned by {policy.owner}</p>
                </div>
                <Badge tone={policy.sensitivity === 'Restricted' ? 'danger' : 'warning'}>{policy.sensitivity}</Badge>
              </div>
              <div className="mt-3 grid gap-3 text-xs text-gray-500 sm:grid-cols-3">
                <span>Coverage: {policy.coverage}% of scoped assets</span>
                <span>Last run: {policy.lastRun}</span>
                <span>Reviews outstanding: {policy.outstandingReviews}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline">View lineage</Button>
                <Button size="sm">Run now</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Human-in-the-loop reviews</CardTitle>
          <Button variant="outline" size="sm" leftIcon={<ShieldCheck className="h-4 w-4" />}>Approve selected</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviewQueue.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.field}</p>
                  <p className="text-xs text-gray-500">{item.reason}</p>
                </div>
                <Badge tone={item.confidence > 0.85 ? 'success' : 'warning'}>Confidence {(item.confidence * 100).toFixed(0)}%</Badge>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                  <Lock className="h-3.5 w-3.5 text-gray-400" /> Suggested label:
                  <strong className="text-gray-700">{item.suggestedLabel}</strong>
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Request context</Button>
                  <Button size="sm">Approve</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export { Classification }
export default Classification
