import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils'
import { Bell, LogOut, Search, Settings, UserRound } from 'lucide-react'
import * as React from 'react'
import { useLocation } from 'react-router-dom'

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ai-assistant': 'AI Assistant',
  '/data-catalog': 'Data Catalog',
  '/data-quality': 'Data Quality',
  '/data-lineage': 'Data Lineage',
  '/pipelines': 'CI/CD Pipelines',
  '/requests': 'Workflow Requests',
  '/connections': 'Data Sources',
  '/governance': 'Governance',
  '/monitoring': 'Monitoring',
  '/settings': 'Settings',
}

export interface HeaderProps {
  notifications?: Array<{ id: string; title: string; message: string; time: string; type: 'success'|'warning'|'error'|'info'; unread?: boolean }>
}

export const Header: React.FC<HeaderProps> = ({ notifications = [] }) => {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const [showNotif, setShowNotif] = React.useState(false)
  const [showUser, setShowUser] = React.useState(false)
  const [q, setQ] = React.useState('')
  const unread = notifications.filter(n => n.unread).length

  return (
    <header className="bg-white border-b border-gray-200 z-10 sticky top-0">
      <div className="h-16 px-6 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <h1 className="truncate text-xl font-semibold text-gray-900">{TITLES[pathname] ?? 'CWIC Platform'}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <label className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search assets, pipelines, requests…"
              className="w-80 rounded-xl border border-gray-300 bg-gray-50 px-9 py-2 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => setShowNotif(s => !s)}>
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <Badge tone="danger" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center">
                  {unread}
                </Badge>
              )}
            </Button>
            {showNotif && (
              <div className="absolute right-0 mt-2 w-96 rounded-xl border border-gray-200 bg-white shadow-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="font-semibold">Notifications</div>
                  <button className="text-sm text-blue-600 hover:underline">Mark all read</button>
                </div>
                <ul className="max-h-80 overflow-auto">
                  {notifications.slice(0, 8).map((n) => (
                    <li key={n.id} className={cn('px-4 py-3 border-b last:border-b-0', n.unread && 'bg-blue-50')}>
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="text-sm text-gray-700">{n.message}</div>
                      <div className="text-xs text-gray-500 mt-1">{n.time}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* User */}
          <div className="relative">
            <Button variant="outline" onClick={() => setShowUser(s => !s)} leftIcon={<UserRound className="h-4 w-4" />}>
              {user?.name ?? 'User'}
            </Button>
            {showUser && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg">
                <div className="px-4 py-3 border-b">
                  <div className="text-sm font-medium">{user?.name ?? 'User'}</div>
                  <div className="text-xs text-gray-500">{user?.email ?? ''}</div>
                </div>
                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
