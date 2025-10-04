// src/layouts/AppLayout.tsx
import CommandPalette from '@/components/layout/overlays/CommandPalette'
import QuickActions from '@/components/layout/overlays/QuickActions'
import { env } from '@/config/environment'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/utils/cn'
import {
  Activity, Bell, BookOpen,
  Brain,
  CheckCircle, ChevronDown,
  Database,
  FileCheck,
  FileText,
  GitBranch,
  Home,
  LayoutDashboard, LogOut, Menu, MessageSquare,
  Network,
  Package,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Tag,
  TrendingUp,
  User as UserIcon,
  Users,
  Workflow, X,
  Zap,
  type LucideIcon
} from 'lucide-react'
import * as React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

/* -------------------------------------------------------------------------- */
/* Types & nav items                                                          */
/* -------------------------------------------------------------------------- */

type NavItem = {
  key: string
  label: string
  to: string
  icon: LucideIcon
  permission?: string
  badge?: {
    text: string
    type: 'info' | 'success' | 'warning' | 'danger'
  }
}

type ParentNavItem = {
  key: string
  label: string
  icon: LucideIcon
  color: string
  children: NavItem[]
}

const NAV_HIERARCHY: ParentNavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: Home,
    color: 'from-blue-500 to-blue-600',
    children: [
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { key: 'analytics', label: 'Analytics', to: '/analytics', icon: TrendingUp, permission: 'read:analytics' },
      { key: 'reports', label: 'Reports', to: '/reports', icon: FileText, permission: 'read:reports' },
    ],
  },
  {
    key: 'data',
    label: 'Data',
    icon: Database,
    color: 'from-purple-500 to-purple-600',
    children: [
      { key: 'sources', label: 'Data Sources', to: '/data-sources', icon: Database, permission: 'read:sources' },
      { key: 'catalog', label: 'Data Catalog', to: '/catalog', icon: BookOpen, permission: 'read:catalog' },
      { key: 'quality', label: 'Data Quality', to: '/quality', icon: Shield, permission: 'read:quality' },
      { key: 'lineage', label: 'Data Lineage', to: '/lineage', icon: GitBranch, permission: 'read:lineage' },
    ],
  },
  {
    key: 'ai',
    label: 'AI & ML',
    icon: Brain,
    color: 'from-green-500 to-emerald-600',
    children: [
      { key: 'assistant', label: 'AI Assistant', to: '/assistant', icon: MessageSquare, permission: 'read:assistant' },
      { key: 'discovery', label: 'Field Discovery', to: '/field-discovery', icon: Search, permission: 'read:discovery' },
      { key: 'classification', label: 'Classification', to: '/classification', icon: Tag, permission: 'read:classification' },
    ],
  },
  {
    key: 'ops',
    label: 'Operations',
    icon: Zap,
    color: 'from-orange-500 to-orange-600',
    children: [
      { key: 'pipelines', label: 'Pipelines', to: '/pipelines', icon: Workflow, permission: 'read:pipelines' },
      { key: 'monitoring', label: 'Monitoring', to: '/monitoring', icon: Activity, permission: 'read:monitoring' },
      { key: 'requests', label: 'Requests', to: '/requests', icon: FileCheck, permission: 'read:requests' },
    ],
  },
  {
    key: 'govern',
    label: 'Governance',
    icon: ShieldCheck,
    color: 'from-red-500 to-red-600',
    children: [
      { key: 'governance', label: 'Policies', to: '/governance', icon: FileCheck, permission: 'read:governance' },
      { key: 'compliance', label: 'Compliance', to: '/compliance', icon: CheckCircle, permission: 'read:compliance' },
      { key: 'audit', label: 'Audit Logs', to: '/audit', icon: Package, permission: 'read:audit' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: SettingsIcon,
    color: 'from-gray-500 to-gray-600',
    children: [
      { key: 'settings', label: 'Settings', to: '/settings', icon: SettingsIcon, permission: 'read:settings' },
      { key: 'users', label: 'Users', to: '/users', icon: Users, permission: 'read:users' },
      { key: 'integrations', label: 'Integrations', to: '/integrations', icon: Network, permission: 'read:integrations' },
    ],
  },
]

// Flatten for legacy checks
const NAV_ITEMS: NavItem[] = NAV_HIERARCHY.flatMap(p => p.children)
const TOTAL_NAV_CHILDREN = NAV_ITEMS.length


/** RBAC resource aliases by nav key */
const PERM_MAP: Record<string, string[]> = {
  assistant:  ['assistant'],
  catalog:    ['catalog'],
  quality:    ['quality', 'data-quality'],
  lineage:    ['lineage', 'data-lineage'],
  pipelines:  ['pipelines', 'cicd', 'workflow'],
  requests:   ['requests', 'tickets'],
  sources:    ['data-sources', 'sources', 'connections'],
  governance: ['governance'],
  monitoring: ['monitoring', 'observability'],
  settings:   ['settings', 'account'],
  analytics:  ['analytics', 'reports'],
  reports:    ['reports'],
  'field-discovery': ['field-discovery', 'discovery'],
  'auto-classification': ['auto-classification', 'classification'],
  workflows:  ['workflows'],
  compliance: ['compliance'],
  'user-management': ['user-management', 'users', 'admin'],
}

const DEFAULT_ALLOW = import.meta.env.VITE_RBAC_DEFAULT_ALLOW === 'true'
const STRICT_MODE   = import.meta.env.VITE_RBAC_STRICT === 'true'

/* -------------------------------------------------------------------------- */

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false) // mobile
  const [userMenuOpen, setUserMenuOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selectedParent, setSelectedParent] = React.useState<string>('overview')

  const [showCmd, setShowCmd] = React.useState(false)
  const [showQA, setShowQA] = React.useState(false)

  const { pathname } = useLocation()
  const navigate = useNavigate()

  React.useEffect(() => {
    setSidebarOpen(false)
    setUserMenuOpen(false)
  }, [pathname])

  // Auto-select parent by current route
  React.useEffect(() => {
    for (const parent of NAV_HIERARCHY) {
      if (parent.children.some(child => pathname.startsWith(child.to))) {
        setSelectedParent(parent.key)
        break
      }
    }
  }, [pathname])

  // Cmd/Ctrl+K
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); setShowCmd(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- auth / perms --------------------------------------------------------
  const auth  = useAuth()
  const perms = usePermissions()

  const authLoading: boolean = (auth as any)?.loading ?? (auth as any)?.user === undefined
  const user   = (auth as any)?.user
  const logout = (auth as any)?.logout
  const permsLoading: boolean = Boolean((perms as any)?.isLoading)
  const noExplicitPerms: boolean = Array.isArray((perms as any)?.permissions) && (((perms as any)?.permissions?.length ?? 0) === 0)

  // can('read','resource') OR can('read:resource')
  const rawCan =
    (perms as any)?.can as
      | ((action: string, resource: string) => boolean)
      | ((scope: string) => boolean)
      | undefined

  const gatingDisabled = React.useMemo(() => {
    if (DEFAULT_ALLOW) return true
    if (permsLoading) return true
    if (!rawCan) return true
    if (noExplicitPerms) return true
    if ((perms as any)?.isAdmin) return true
    return false
  }, [permsLoading, rawCan, noExplicitPerms, perms])

  const canRead = React.useCallback((navKey: string): boolean => {
    if (gatingDisabled) return true
    if (!rawCan) return true

    const aliases = PERM_MAP[navKey] ?? [navKey]
    for (const res of aliases) {
      try {
        if (rawCan && rawCan.length >= 2 && (rawCan as any)('read', res)) return true
        if (rawCan && (rawCan as any)(`read:${res}`)) return true
      } catch {}
    }
    const item = NAV_ITEMS.find(n => n.key === navKey)
    if (item?.permission) {
      try {
        if (rawCan && rawCan.length >= 2) {
          const [act, res] = item.permission.split(':')
          if ((rawCan as any)(act, res ?? item.permission)) return true
        } else {
          if (rawCan && (rawCan as any)(item.permission)) return true
        }
      } catch {}
    }
    return false
  }, [gatingDisabled, rawCan])

  // Gate hierarchical nav
  const gatedHierarchy: ParentNavItem[] = React.useMemo(() => {
    if (gatingDisabled) return NAV_HIERARCHY

    const filtered = NAV_HIERARCHY
      .map(parent => ({
        ...parent,
        children: parent.children.filter(child => !child.permission || canRead(child.key))
      }))
      .filter(parent => parent.children.length > 0)

    const totalAllowedChildren = filtered.reduce((acc, parent) => acc + parent.children.length, 0)
    if (totalAllowedChildren < TOTAL_NAV_CHILDREN) return NAV_HIERARCHY

    return filtered
  }, [gatingDisabled, canRead])

  // Current children
  const currentChildren = React.useMemo(() => {
    const parent = gatedHierarchy.find(p => p.key === selectedParent)
    return parent?.children ?? []
  }, [gatedHierarchy, selectedParent])

  // crumbs / search
  const crumbs = React.useMemo(() => {
    const parts = pathname.split('/').filter(Boolean)
    const acc: Array<{ label: string; to?: string }> = [{ label: 'Home', to: '/dashboard' }]
    let running = ''
    for (const p of parts) {
      running += `/${p}`
      acc.push({ label: decodeURIComponent(p).replace(/-/g, ' '), to: running })
    }
    return acc
  }, [pathname])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/catalog?search=${encodeURIComponent(query.trim())}`)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-gray-50 text-gray-900 grid">
        <div className="m-auto text-sm text-gray-600">Loading session…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900">
      {/* A11y: skip link */}
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-blue-600 focus:shadow"
      >
        Skip to content
      </a>

      {/* Env banner (optional) */}
      {import.meta.env.VITE_SHOW_ENV_BANNER === 'true' && env?.apiBaseUrl && (
        <div className="bg-yellow-50 text-yellow-800 text-sm px-4 py-2 border-b border-yellow-200">
          Environment — API: <span className="font-mono">{env.apiBaseUrl}</span>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-0px)]">
        {/* Sidebar (desktop) - Dark theme matching your screenshot */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-gray-900 text-white">
          {/* Logo */}
          <div className="h-16 flex items-center px-5 bg-gray-900 border-b border-gray-800">
            <Logo />
          </div>

          {/* Navigation (VERTICAL) */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {gatedHierarchy.map((parent) => {
              const isActive = selectedParent === parent.key
              const Icon = parent.icon
              return (
                <div key={parent.key} className="rounded-lg">
                  <button
                    onClick={() => setSelectedParent(parent.key)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {parent.label}
                    </span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', isActive && 'rotate-180')} />
                  </button>

                  {isActive && (
                    <div className="mt-1 space-y-1 pl-2">
                      {parent.children.map((item) => (
                        <SidebarLink key={item.key} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User Footer */}
          <div className="border-t border-gray-800 bg-gray-900 p-4">
            <UserCard
              name={user?.name || user?.email || 'User'}
              email={user?.email || ''}
              onLogout={logout}
              userMenuOpen={userMenuOpen}
              setUserMenuOpen={setUserMenuOpen}
            />
          </div>
        </aside>

        {/* Mobile scrim */}
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity md:hidden',
            sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
          onClick={() => setSidebarOpen(false)}
          aria-hidden={!sidebarOpen}
        />

        {/* Sidebar (mobile) - Dark theme */}
        <aside
          className={cn(
            'fixed z-50 inset-y-0 left-0 w-72 bg-gray-900 text-white shadow-xl transform transition-transform md:hidden flex flex-col',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          role="dialog"
          aria-modal
          aria-label="Sidebar"
        >
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 bg-gray-900 border-b border-gray-800">
            <Logo />
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-800 transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Navigation (VERTICAL) */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {gatedHierarchy.map((parent) => {
              const isActive = selectedParent === parent.key
              const Icon = parent.icon
              return (
                <div key={parent.key} className="rounded-lg">
                  <button
                    onClick={() => setSelectedParent(parent.key)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {parent.label}
                    </span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', isActive && 'rotate-180')} />
                  </button>

                  {isActive && (
                    <div className="mt-1 space-y-1 pl-2">
                      {parent.children.map((item) => (
                        <SidebarLink
                          key={item.key}
                          item={item}
                          onNavigate={() => setSidebarOpen(false)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-800 bg-gray-900 p-4">
            <UserCard
              name={user?.name || user?.email || 'User'}
              email={user?.email || ''}
              onLogout={logout}
              userMenuOpen={userMenuOpen}
              setUserMenuOpen={setUserMenuOpen}
            />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b bg-white px-3 md:px-6">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs */}
            <nav className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
              {crumbs.map((c, idx: number) => {
                const isLast = idx === crumbs.length - 1
                return (
                  <span key={`${c.label}-${idx}`} className="flex items-center gap-2">
                    {idx > 0 && <span className="text-gray-300">/</span>}
                    {isLast || !c.to ? (
                      <span className="font-medium text-gray-900">{c.label}</span>
                    ) : (
                      <NavLink className="hover:text-gray-900" to={c.to}>
                        {c.label}
                      </NavLink>
                    )}
                  </span>
                )
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {/* Quick Actions */}
              <button
                onClick={() => setShowQA(true)}
                className="hidden sm:inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 text-sm font-medium text-white hover:shadow-lg"
              >
                <span className="inline-block h-4 w-4 rounded-sm bg-white/20" />
                Quick Actions
              </button>

              {/* Command Palette */}
              <button
                onClick={() => setShowCmd(true)}
                className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
                title="Command Palette (Ctrl/Cmd+K)"
              >
                <Search className="h-4 w-4" />
                <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-mono">
                  ⌘K
                </kbd>
              </button>

              {/* Search */}
              <form onSubmit={onSearch} className="hidden md:flex items-center">
                <div className="flex items-center rounded-md border bg-white focus-within:ring-2 focus-within:ring-blue-500">
                  <Search className="h-4 w-4 ml-3 text-gray-500" />
                  <input
                    className="w-64 px-3 py-2 outline-none text-sm placeholder:text-gray-400"
                    placeholder="Search catalog, lineage, sources…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search"
                  />
                </div>
              </form>

              {/* Alerts */}
              <NavLink
                to="/requests"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
              </NavLink>

              {/* Settings shortcut */}
              <NavLink
                to="/settings"
                className="hidden sm:inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-gray-50"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </NavLink>

              {/* User menu (md+) */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <UserIcon className="h-4 w-4" />
                  <span className="max-w-[14rem] truncate">{user?.name || user?.email || 'User'}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border bg-white shadow-lg z-50"
                  >
                    <div className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {user?.name || user?.email || 'User'}
                      </div>
                      {user?.email && <div className="text-xs text-gray-500 truncate">{user.email}</div>}
                    </div>
                    <div className="border-t">
                      <NavLink
                        to="/settings"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <SettingsIcon className="h-4 w-4" />
                        Account settings
                      </NavLink>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false)
                          logout?.()
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main content */}
          <main id="app-main" className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
              <Outlet />
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t bg-white px-6 py-3 text-xs text-gray-500">
            <div className="mx-auto max-w-[1600px] flex items-center justify-between">
              <div>&copy; {new Date().getFullYear()} CWIC</div>
              <div className="hidden sm:block">
                {env.isProduction ? 'Production' : 'Development'} · API: {env.apiBaseUrl}
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Overlays */}
      <CommandPalette open={showCmd} onClose={() => setShowCmd(false)} />
      <QuickActions open={showQA} onClose={() => setShowQA(false)} />
    </div>
  )
}

/* ----------------------------- small pieces ----------------------------- */

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
          'relative overflow-hidden',
          isActive
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0 relative z-10" />
      <span className="flex-1 truncate font-medium relative z-10">{item.label}</span>

      {item.badge && (
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-semibold rounded-full relative z-10',
            item.badge.type === 'info' && 'bg-blue-100 text-blue-700',
            item.badge.type === 'success' && 'bg-green-100 text-green-700',
            item.badge.type === 'warning' && 'bg-yellow-100 text-yellow-700',
            item.badge.type === 'danger' && 'bg-red-100 text-red-700',
          )}
        >
          {item.badge.text}
        </span>
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300" />
    </NavLink>
  )
}

function UserCard({
  name, email, onLogout, userMenuOpen, setUserMenuOpen,
}: {
  name: string; email?: string; onLogout?: () => void;
  userMenuOpen: boolean; setUserMenuOpen: (v: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => setUserMenuOpen(!userMenuOpen)}
        className="flex w-full items-center gap-3 rounded-md border border-gray-700 px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors"
        aria-haspopup="menu"
        aria-expanded={userMenuOpen}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white">
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium text-white">{name}</div>
          {email ? <div className="truncate text-xs text-gray-400">{email}</div> : null}
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      {userMenuOpen && (
        <div role="menu" className="absolute left-0 right-0 bottom-full mb-2 overflow-hidden rounded-md border border-gray-700 bg-gray-800 shadow-lg z-50">
          <NavLink
            to="/settings"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            onClick={() => setUserMenuOpen(false)}
          >
            <SettingsIcon className="h-4 w-4" />
            Account settings
          </NavLink>
          <button
            role="menuitem"
            onClick={() => { setUserMenuOpen(false); onLogout?.() }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
          C
        </div>
        <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-gray-800" />
      </div>
      <div>
        <div className="text-lg font-bold text-white">
          CWIC
        </div>
        <div className="text-[11px] text-gray-400 -mt-1 font-medium">Data Platform</div>
      </div>
    </div>
  )
}

function initials(value?: string) {
  if (!value) return 'U'
  const parts = value.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase()).join('') || 'U'
}