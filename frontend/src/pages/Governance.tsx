// src/pages/Governance.tsx
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { AlertTriangle, CheckCircle, Clock, FileText, Shield } from 'lucide-react'
import * as React from 'react'

type Tab = 'policies' | 'workflows' | 'compliance'
type PolicyStatus = 'active' | 'draft'
type Priority = 'low' | 'medium' | 'high'
type WorkflowStatus = 'pending' | 'approved' | 'in_review'

export const Governance: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<Tab>('policies')

  const policies = [
    { id: 1, name: 'GDPR Data Protection', category: 'Privacy',  status: 'active' as PolicyStatus, compliance: 98 },
    { id: 2, name: 'Data Retention Policy', category: 'Lifecycle', status: 'active' as PolicyStatus, compliance: 95 },
    { id: 3, name: 'PCI DSS Compliance',    category: 'Security', status: 'active' as PolicyStatus, compliance: 100 },
    { id: 4, name: 'Data Quality Standards',category: 'Quality',  status: 'draft'  as PolicyStatus, compliance: 0 },
  ]

  const workflows = [
    { id: 1, title: 'Data Access Request - Marketing', requester: 'John Smith',  status: 'pending'  as WorkflowStatus, priority: 'high'   as Priority },
    { id: 2, title: 'Schema Change Approval',          requester: 'Sarah Johnson', status: 'approved' as WorkflowStatus, priority: 'medium' as Priority },
    { id: 3, title: 'Data Classification Review',      requester: 'Mike Wilson', status: 'in_review' as WorkflowStatus, priority: 'low'    as Priority },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Governance</h1>
          <p className="mt-1 text-gray-600">Manage data policies, compliance, and governance workflows.</p>
        </div>
        <Button onClick={() => console.log('create-policy')}>
          <FileText className="mr-2 h-4 w-4" />
          Create Policy
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Policies</p>
                <p className="text-3xl font-bold text-blue-600">24</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Rate</p>
                <p className="text-3xl font-bold text-green-600">97.2%</p>
              </div>
              <Shield className="h-8 w-8 text-green-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                <p className="text-3xl font-bold text-yellow-600">8</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Violations</p>
                <p className="text-3xl font-bold text-red-600">3</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Governance sections">
          <TabButton onClick={() => setActiveTab('policies')} active={activeTab === 'policies'}>
            Data Policies
          </TabButton>
          <TabButton onClick={() => setActiveTab('workflows')} active={activeTab === 'workflows'}>
            Approval Workflows
          </TabButton>
          <TabButton onClick={() => setActiveTab('compliance')} active={activeTab === 'compliance'}>
            Compliance Reports
          </TabButton>
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'policies' && (
          <Card>
            <CardHeader>
              <CardTitle>Data Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Policy Name</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Compliance</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {policies.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{p.name}</td>
                        <td className="whitespace-nowrap px-6 py-4">{p.category}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <Badge tone={p.status === 'active' ? 'success' : 'neutral'} className="capitalize">
                            {p.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">{p.compliance}%</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <Button variant="ghost" size="sm" onClick={() => console.log('view-policy', p.id)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'workflows' && (
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflows.map((wf) => (
                  <div key={wf.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{wf.title}</h4>
                        <p className="text-sm text-gray-600">Requested by: {wf.requester}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={priorityTone(wf.priority)} className="capitalize">{wf.priority}</Badge>
                        <Badge tone={statusTone(wf.status)} className="capitalize">{wf.status}</Badge>
                        <Button size="sm" onClick={() => console.log('review-workflow', wf.id)}>Review</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'compliance' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Compliance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ProgressRow label="GDPR Compliance" value={98} />
                  <ProgressRow label="Data Retention"  value={95} />
                  <ProgressRow label="Security Standards" value={100} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Violations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <ViolationRow icon={<AlertTriangle className="h-4 w-4 text-red-500" />}  title="Data Access Violation"    time="2 hours ago" />
                  <ViolationRow icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />} title="Retention Policy Warning" time="1 day ago" />
                  <ViolationRow icon={<CheckCircle className="h-4 w-4 text-green-500" />}  title="Issue Resolved"           time="3 days ago" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'border-b-2 py-2 px-1 text-sm font-medium',
        active ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700',
      ].join(' ')}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </button>
  )
}

function priorityTone(p: Priority): 'danger' | 'warning' | 'neutral' {
  return p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'neutral'
}
function statusTone(s: WorkflowStatus): 'warning' | 'success' | 'info' {
  return s === 'approved' ? 'success' : s === 'pending' ? 'warning' : 'info'
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-2 w-32 rounded-full bg-gray-200">
          <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        </div>
        <span className="text-sm font-medium">{value}%</span>
      </div>
    </div>
  )
}

function ViolationRow({ icon, title, time }: { icon: React.ReactNode; title: string; time: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-gray-600">{time}</p>
      </div>
    </div>
  )
}

export default Governance
