import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  FileCheck2,
  Loader2,
  Lock,
  Plus,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Tag,
  Wand2,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useClassification, useReviewSelection, useReviewQueueFilters } from '@/hooks/useClassification'

// Import the ultra revolutionary classification component
import { UltraRevolutionaryClassification } from './UltraRevolutionaryClassification'
// import { RevolutionaryClassification } from './RevolutionaryClassification'

// Export the ultra revolutionary version as the default
const Classification: React.FC = () => {
  return <UltraRevolutionaryClassification />
}

// Alternative: use the previous revolutionary version
// const Classification: React.FC = () => {
//   return <RevolutionaryClassification />
// }

// Keep the original implementation below for reference
const OriginalClassification: React.FC = () => {
  const {
    policies,
    reviewQueue,
    stats,
    loading,
    error,
    reviewTotal,
    fetchPolicies,
    fetchReviewQueue,
    fetchStats,
    runPolicy,
    reviewItem,
    bulkApprove,
    refresh,
  } = useClassification()

  const { selectedItemIds, toggleItem, selectAll, clearSelection } = useReviewSelection()
  const { filters: reviewFilters, updateFilter: updateReviewFilter } = useReviewQueueFilters()

  const [searchTerm, setSearchTerm] = useState('')
  const [sensitivityFilter, setSensitivityFilter] = useState<'all' | 'public' | 'internal' | 'confidential' | 'restricted'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'draft'>('all')
  const [runningPolicyId, setRunningPolicyId] = useState<string | null>(null)

  // Initial data load
  useEffect(() => {
    refresh()
  }, [])

  // Apply policy filters
  useEffect(() => {
    const appliedFilters = {
      sensitivity: sensitivityFilter !== 'all' ? sensitivityFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: searchTerm.trim() || undefined,
    }
    fetchPolicies(appliedFilters)
  }, [searchTerm, sensitivityFilter, statusFilter])

  const handleRunPolicy = async (policyId: string) => {
    setRunningPolicyId(policyId)
    try {
      await runPolicy(policyId)
      // Refresh review queue after running policy
      await fetchReviewQueue()
      await fetchStats()
    } catch (err) {
      console.error('Failed to run policy:', err)
    } finally {
      setRunningPolicyId(null)
    }
  }

  const handleApproveReview = async (itemId: string) => {
    try {
      await reviewItem(itemId, { decision: 'approved' })
      await fetchStats()
    } catch (err) {
      console.error('Failed to approve review:', err)
    }
  }

  const handleRejectReview = async (itemId: string) => {
    try {
      await reviewItem(itemId, { decision: 'rejected' })
      await fetchStats()
    } catch (err) {
      console.error('Failed to reject review:', err)
    }
  }

  const handleBulkApprove = async () => {
    if (selectedItemIds.length === 0) return
    try {
      await bulkApprove({ itemIds: selectedItemIds })
      clearSelection()
      await fetchStats()
    } catch (err) {
      console.error('Failed to bulk approve:', err)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return `${diffDays} days ago`
  }

  const getSensitivityBadgeTone = (sensitivity: string) => {
    switch (sensitivity.toLowerCase()) {
      case 'restricted':
        return 'danger'
      case 'confidential':
        return 'warning'
      case 'internal':
        return 'neutral'
      case 'public':
        return 'success'
      default:
        return 'neutral'
    }
  }

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

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Total policies</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.totalPolicies || 0}
              </p>
            </div>
            <Shield className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Active policies</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.activePolicies || 0}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Pending reviews</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.pendingReviews || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Total classifications</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.totalClassifications || 0}
              </p>
            </div>
            <Scale className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Classification policies ({policies.length})</CardTitle>
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
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
            <select
              value={sensitivityFilter}
              onChange={(event) => setSensitivityFilter(event.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All sensitivity levels</option>
              <option value="restricted">Restricted</option>
              <option value="confidential">Confidential</option>
              <option value="internal">Internal</option>
              <option value="public">Public</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && policies.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No classification policies found</p>
              <p className="text-xs text-gray-400 mt-1">Create a new policy to get started</p>
              <Button className="mt-4" leftIcon={<Plus className="h-4 w-4" />}>Create policy</Button>
            </div>
          ) : (
            policies.map((policy) => (
              <div key={policy.id} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{policy.name}</p>
                      <Badge tone={
                        policy.status === 'active' ? 'success' :
                        policy.status === 'draft' ? 'neutral' :
                        'warning'
                      }>
                        {policy.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{policy.description}</p>
                    <p className="text-xs text-gray-500">Owned by {policy.owner}</p>
                  </div>
                  <Badge tone={getSensitivityBadgeTone(policy.sensitivity)}>
                    {policy.sensitivity}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-3 text-xs text-gray-500 sm:grid-cols-3">
                  <span className="flex items-center gap-1">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    {policy.actions?.length || 0} actions
                  </span>
                  <span>
                    Last run: {policy.lastRunAt ? formatDate(policy.lastRunAt) : 'Never'}
                  </span>
                  <span>
                    Updated: {formatDate(policy.updatedAt)}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline">View details</Button>
                  <Button
                    size="sm"
                    onClick={() => handleRunPolicy(policy.id)}
                    disabled={runningPolicyId === policy.id || policy.status !== 'active'}
                    leftIcon={runningPolicyId === policy.id ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                  >
                    {runningPolicyId === policy.id ? 'Running...' : 'Run now'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Human-in-the-loop reviews ({reviewTotal})</CardTitle>
          {selectedItemIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkApprove}
                leftIcon={<ShieldCheck className="h-4 w-4" />}
              >
                Approve selected ({selectedItemIds.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                leftIcon={<X className="h-4 w-4" />}
              >
                Clear
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" leftIcon={<ShieldCheck className="h-4 w-4" />}>
              Approve all high confidence
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && reviewQueue.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : reviewQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-300 mb-3" />
              <p className="text-sm text-gray-500">No pending reviews</p>
              <p className="text-xs text-gray-400 mt-1">All classifications have been reviewed</p>
            </div>
          ) : (
            reviewQueue.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-4 transition-colors ${
                  selectedItemIds.includes(item.id)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{item.assetName}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.reason}</p>
                      </div>
                      <Badge tone={item.confidence > 0.85 ? 'success' : item.confidence > 0.7 ? 'warning' : 'neutral'}>
                        Confidence {(item.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {item.currentClassification && (
                          <span className="inline-flex items-center gap-1">
                            Current: <strong className="text-gray-700">{item.currentClassification}</strong>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Lock className="h-3.5 w-3.5 text-gray-400" />
                          Proposed: <strong className="text-gray-700">{item.proposedClassification}</strong>
                        </span>
                        <Badge tone={getSensitivityBadgeTone(item.proposedSensitivity)} size="sm">
                          {item.proposedSensitivity}
                        </Badge>
                      </div>
                      {item.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectReview(item.id)}
                            leftIcon={<X className="h-4 w-4" />}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApproveReview(item.id)}
                            leftIcon={<CheckCircle className="h-4 w-4" />}
                          >
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { Classification }
export default Classification
