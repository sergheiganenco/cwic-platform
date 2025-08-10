import { cn } from '@/utils'
import {
    ChevronRight,
    Settings as Cog,
    Database,
    FileText,
    GitBranch,
    Home,
    Layers,
    MessageSquare,
    Monitor,
    Shield,
    Users,
    Workflow,
    Zap
} from 'lucide-react'
import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type NavItem = { id: string; label: string; path: string; icon: React.ComponentType<any>; badge?: string }

const NAV: NavItem[] = [
  { id: 'dashboard',     label: 'Dashboard',         path: '/dashboard',     icon: Home },
  { id: 'ai',            label: 'AI Assistant',      path: '/ai-assistant',  icon: MessageSquare, badge: 'AI' },
  { id: 'catalog',       label: 'Data Catalog',      path: '/data-catalog',  icon: Database },
  { id: 'quality',       label: 'Data Quality',      path: '/data-quality',  icon: Shield },
  { id: 'lineage',       label: 'Data Lineage',      path: '/data-lineage',  icon: GitBranch },
  { id: 'pipelines',     label: 'CI/CD Pipelines',   path: '/pipelines',     icon: Workflow },
  { id: 'requests',      label: 'Workflow Requests', path: '/requests',      icon: FileText },
  { id: 'connections',   label: 'Data Sources',      path: '/connections',   icon: Layers },
  { id: 'governance',    label: 'Governance',        path: '/governance',    icon: Users },
  { id: 'monitoring',    label: 'Monitoring',        path: '/monitoring',    icon: Monitor },
  { id: 'settings',      label: 'Settings',          path: '/settings',      icon: Cog },
]

export interface NavigationProps {
  collapsed?: boolean
  onToggle?: () => void
}

export const Navigation: React.FC<NavigationProps> = ({ collapsed = false, onToggle }) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <aside
      className={cn(
        'bg-slate-900 text-white transition-all duration-300 sticky top-0 h-screen shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
      aria-label="Primary"
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-4 py-4 border-b border-white/5')}>
        <div className="bg-blue-600 p-2 rounded-xl shadow-sm">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">CWIC</div>
            <div className="text-[11px] text-slate-400">Workflow Intelligence</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="px-2 py-3 space-y-1">
        {NAV.map(({ id, label, icon: Icon, path, badge }) => {
          const active = pathname === path
          return (
            <button
              key={id}
              onClick={() => navigate(path)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left outline-none',
                active ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
              title={collapsed ? label : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{label}</span>
                  {badge && (
                    <span className="ml-auto text-[10px] leading-4 rounded-full px-2 py-0.5 bg-green-500/90">
                      {badge}
                    </span>
                  )}
                </>
              )}
            </button>
          )
        })}
      </nav>

      {/* Collapse */}
      <div className="absolute bottom-3 left-0 right-0 px-2">
        <button
          className="w-full flex items-center justify-center rounded-xl py-2 text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', collapsed ? '' : 'rotate-180')} />
        </button>
      </div>
    </aside>
  )
}
