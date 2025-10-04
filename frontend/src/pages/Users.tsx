import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Mail,
  MoreHorizontal,
  Search,
  Shield,
  UserCog,
  UserPlus,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const USERS = [
  { id: 'u-1', name: 'Sarah Chen', email: 'sarah.chen@cwic.io', role: 'Admin', status: 'active', lastActive: '5 minutes ago', teams: ['Data Governance'] },
  { id: 'u-2', name: 'Mike Wilson', email: 'mike.wilson@cwic.io', role: 'Steward', status: 'active', lastActive: '1 hour ago', teams: ['Analytics'] },
  { id: 'u-3', name: 'Lisa Johnson', email: 'lisa.johnson@cwic.io', role: 'Viewer', status: 'invited', lastActive: 'Pending invite', teams: ['Finance'] },
  { id: 'u-4', name: 'David Kim', email: 'david.kim@cwic.io', role: 'Editor', status: 'inactive', lastActive: '14 days ago', teams: ['Product'] },
]

const roles = [
  { id: 'admin', name: 'Admin', description: 'Full access to platform configuration and governance workflows.' },
  { id: 'steward', name: 'Data Steward', description: 'Manage catalog metadata, approvals, and data quality rules.' },
  { id: 'editor', name: 'Editor', description: 'Create dashboards, annotations, and share content.' },
  { id: 'viewer', name: 'Viewer', description: 'View curated content and request access.' },
]

const Users: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'Admin' | 'Steward' | 'Editor' | 'Viewer'>('all')

  const filteredUsers = useMemo(() => {
    return USERS.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesSearch =
        searchTerm.trim() === '' || user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesRole && matchesSearch
    })
  }, [searchTerm, roleFilter])

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-600">Invite teammates, assign roles, and monitor account activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<Mail className="h-4 w-4" />}>Send reminder</Button>
          <Button leftIcon={<UserPlus className="h-4 w-4" />}>Invite user</Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Total users</p>
              <p className="text-2xl font-semibold text-gray-900">{USERS.length}</p>
            </div>
            <UserCog className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-semibold text-gray-900">{USERS.filter((u) => u.status === 'active').length}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Invited</p>
              <p className="text-2xl font-semibold text-gray-900">{USERS.filter((u) => u.status === 'invited').length}</p>
            </div>
            <Mail className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Inactive</p>
              <p className="text-2xl font-semibold text-gray-900">{USERS.filter((u) => u.status === 'inactive').length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>People</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name or email"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-64"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | 'Admin' | 'Steward' | 'Editor' | 'Viewer')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All roles</option>
              <option value="Admin">Admin</option>
              <option value="Steward">Steward</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredUsers.map((user) => (
            <div key={user.id} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <Badge tone={user.status === 'inactive' ? 'warning' : user.status === 'invited' ? 'info' : 'success'}>
                  {user.role}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>Status: {user.status}</span>
                <span>Last active: {user.lastActive}</span>
                <span>Teams: {user.teams.join(', ')}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline">Manage access</Button>
                <Button size="sm" variant="ghost" leftIcon={<MoreHorizontal className="h-4 w-4" />}>More</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role definitions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {roles.map((role) => (
            <div key={role.id} className="rounded-lg border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{role.name}</p>
                <Badge tone={role.id === 'admin' ? 'danger' : 'neutral'}>Default</Badge>
              </div>
              <p className="mt-2 text-xs text-gray-500">{role.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export { Users }
export default Users
