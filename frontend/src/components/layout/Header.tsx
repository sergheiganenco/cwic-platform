import { Bell, LogOut, Search, Settings, UserRound } from 'lucide-react'
import * as React from 'react'
import { useLocation } from 'react-router-dom'

import { DatabasePicker } from '@/components/features/data-sources/DatabasePicker'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils'

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
  notifications?: Array<{
    id: string
    title: string
    message: string
    time: string
    type: 'success' | 'warning' | 'error' | 'info'
    unread?: boolean
  }>
}

export const Header: React.FC<HeaderProps> = ({ notifications = [] }) => {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  const [showNotif, setShowNotif] = React.useState(false)
  const [showUser, setShowUser] = React.useState(false)
  const [q, setQ] = React.useState('')

  const unread = notifications.filter((n) => n.unread).length

  // ---- click outside / escape handlers ----
  const notifRef = React.useRef<HTMLDivElement | null>(null)
  const userRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (showNotif && notifRef.current && !notifRef.current.contains(t)) setShowNotif(false)
      if (showUser && userRef.current && !userRef.current.contains(t)) setShowUser(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotif(false)
        setShowUser(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showNotif, showUser])

  // ---- search submit (non-navigating placeholder) ----
  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: tie to global search route or command palette
    // e.g., navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
        {/* Title */}
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-xl font-semibold text-gray-900">
            {TITLES[pathname] ?? 'CWIC Platform'}
          </h1>
        </div>

        {/* Right rail */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <form onSubmit={onSearchSubmit} className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search assets, pipelines, requests…"
              aria-label="Search"
              className="w-80 rounded-xl border border-gray-300 bg-gray-50 px-9 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>

          {/* Global DB/Server picker */}
          <DatabasePicker compact className="hidden sm:flex" />

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 rounded-full p-0"
              aria-haspopup="dialog"
              aria-expanded={showNotif}
              aria-label="Notifications"
              onClick={() => setShowNotif((s) => !s)}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <Badge
                  tone="danger"
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center p-0"
                >
                  {unread}
                </Badge>
              )}
            </Button>
            {showNotif && (
              <div
                role="dialog"
                aria-label="Notifications"
                className="absolute right-0 mt-2 w-96 rounded-xl border border-gray-200 bg-white shadow-lg"
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="font-semibold">Notifications</div>
                  <button
                    className="text-sm text-blue-600 hover:underline"
                    onClick={(e) => {
                      e.preventDefault()
                      // TODO: mark all read API
                    }}
                  >
                    Mark all read
                  </button>
                </div>
                <ul className="max-h-80 overflow-auto">
                  {notifications.slice(0, 8).map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        'border-b px-4 py-3 last:border-b-0',
                        n.unread && 'bg-blue-50',
                      )}
                    >
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="text-sm text-gray-700">{n.message}</div>
                      <div className="mt-1 text-xs text-gray-500">{n.time}</div>
                    </li>
                  ))}
                  {notifications.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-gray-500">No notifications</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* User */}
          <div className="relative" ref={userRef}>
            <Button
              variant="outline"
              onClick={() => setShowUser((s) => !s)}
              aria-haspopup="menu"
              aria-expanded={showUser}
              leftIcon={<UserRound className="h-4 w-4" />}
            >
              {user?.name ?? 'User'}
            </Button>
            {showUser && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg"
              >
                <div className="border-b px-4 py-3">
                  <div className="text-sm font-medium">{user?.name ?? 'User'}</div>
                  <div className="text-xs text-gray-500">{user?.email ?? ''}</div>
                </div>
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                  // TODO: navigate('/settings')
                  onClick={() => setShowUser(false)}
                >
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
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
